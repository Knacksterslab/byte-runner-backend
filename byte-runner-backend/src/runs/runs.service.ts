import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { UsersService } from '../users/users.service';
import { ContestsService } from '../contests/contests.service';
import * as jwt from 'jsonwebtoken';
import { FinishRunDto } from './dto/finish-run.dto';

interface RunTokenPayload {
  sub: string;
  startedAt: number;
}

@Injectable()
export class RunsService {
  private readonly runTokenSecret: string;
  private readonly runTokenTtlSeconds: number;
  private readonly maxScorePerSecond: number;
  private readonly maxDistancePerSecond: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly supabaseService: SupabaseService,
    private readonly usersService: UsersService,
    private readonly contestsService: ContestsService,
  ) {
    this.runTokenSecret = this.configService.get<string>('runs.runTokenSecret') || '';
    this.runTokenTtlSeconds = this.configService.get<number>('runs.runTokenTtlSeconds') || 3600;
    this.maxScorePerSecond = this.configService.get<number>('runs.maxScorePerSecond') || 500;
    this.maxDistancePerSecond = this.configService.get<number>('runs.maxDistancePerSecond') || 200;

    if (!this.runTokenSecret) {
      throw new Error('RUN_TOKEN_SECRET is missing.');
    }
  }

  private get client() {
    return this.supabaseService.getClient();
  }

  async getUserStats(userId: string) {
    // Get user's best run
    const { data: bestRun } = await this.client
      .from('runs')
      .select('score, distance')
      .eq('user_id', userId)
      .order('score', { ascending: false })
      .order('distance', { ascending: false })
      .limit(1)
      .single();

    // Get total runs count
    const { count: totalRuns } = await this.client
      .from('runs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    // Get user's rank by comparing to leaderboard (best runs per user in last 24h)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { data: allBestRuns } = await this.client
      .from('runs')
      .select('user_id, score, distance')
      .gte('created_at', twentyFourHoursAgo)
      .order('score', { ascending: false })
      .order('distance', { ascending: false });

    // Deduplicate to get best score per user
    const userBestScores = new Map();
    for (const run of allBestRuns || []) {
      if (!userBestScores.has(run.user_id)) {
        userBestScores.set(run.user_id, run);
      }
    }

    const rankedUsers = Array.from(userBestScores.values());
    const userRankIndex = rankedUsers.findIndex(r => r.user_id === userId);

    return {
      bestScore: bestRun?.score || 0,
      bestDistance: bestRun?.distance || 0,
      rank: userRankIndex >= 0 ? userRankIndex + 1 : null,
      totalRuns: totalRuns || 0
    };
  }

  startRun(supertokensId: string) {
    const payload: RunTokenPayload = {
      sub: supertokensId,
      startedAt: Date.now(),
    };

    const token = jwt.sign(payload, this.runTokenSecret, {
      expiresIn: this.runTokenTtlSeconds,
    });

    return { runToken: token };
  }

  async finishRun(supertokensId: string, dto: FinishRunDto) {
    let payload: RunTokenPayload;
    try {
      payload = jwt.verify(dto.runToken, this.runTokenSecret) as RunTokenPayload;
    } catch {
      throw new BadRequestException('Invalid run token.');
    }

    if (payload.sub !== supertokensId) {
      throw new BadRequestException('Run token does not match user.');
    }

    const serverDurationMs = Math.max(0, Date.now() - payload.startedAt);
    const durationMs = Math.max(dto.durationMs, serverDurationMs);
    const durationSeconds = Math.max(1, Math.ceil(durationMs / 1000));

    if (dto.score > this.maxScorePerSecond * durationSeconds) {
      throw new BadRequestException('Score exceeds maximum allowed rate.');
    }

    if (dto.distance > this.maxDistancePerSecond * durationSeconds) {
      throw new BadRequestException('Distance exceeds maximum allowed rate.');
    }

    const user = await this.usersService.getOrCreateUser(supertokensId);
    if (!user.username) {
      throw new BadRequestException('Username must be set before submitting scores.');
    }

    const { data, error } = await this.client
      .from('runs')
      .insert({
        user_id: user.id,
        score: dto.score,
        distance: dto.distance,
        duration_ms: durationMs,
        client_version: dto.clientVersion || null,
      })
      .select('id, score, distance, duration_ms, created_at')
      .single();

    if (error || !data) {
      throw new BadRequestException('Failed to submit run.');
    }

    // Auto-enter into active contests
    const enteredContests: string[] = [];
    try {
      const activeContests = await this.contestsService.getActiveContests();
      
      for (const contest of activeContests) {
        try {
          await this.contestsService.enterContest(
            contest.id,
            user.id,
            data.id,
            dto.score,
            dto.distance,
          );
          enteredContests.push(contest.name);
        } catch (err) {
          // Silently fail individual contest entries (might already be entered with this run)
          console.log(`Failed to enter contest ${contest.id}:`, err.message);
        }
      }
    } catch (err) {
      // Don't fail the run submission if contest entry fails
      console.error('Failed to auto-enter contests:', err);
    }

    return {
      ...data,
      enteredContests, // Return which contests were entered
    };
  }
}
