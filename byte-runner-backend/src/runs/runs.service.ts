import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { UserRecord } from '../users/users.service';
import { ContestsService } from '../contests/contests.service';
import { BadgesService } from '../badges/badges.service';
import { getBestScorePerUser, rankEntries } from '../common/utils/scores.util';
import { hoursAgo } from '../common/utils/date.util';
import * as jwt from 'jsonwebtoken';
import { FinishRunDto } from './dto/finish-run.dto';

interface RunTokenPayload {
  sub: string;
  startedAt: number;
}

@Injectable()
export class RunsService {
  private readonly logger = new Logger(RunsService.name);
  private readonly runTokenSecret: string;
  private readonly runTokenTtlSeconds: number;
  private readonly maxScorePerSecond: number;
  private readonly maxDistancePerSecond: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly supabaseService: SupabaseService,
    private readonly contestsService: ContestsService,
    private readonly badgesService: BadgesService,
  ) {
    this.runTokenSecret = this.configService.get<string>('runs.runTokenSecret') ?? '';
    this.runTokenTtlSeconds = this.configService.get<number>('runs.runTokenTtlSeconds') ?? 3600;
    this.maxScorePerSecond = this.configService.get<number>('runs.maxScorePerSecond') ?? 500;
    this.maxDistancePerSecond = this.configService.get<number>('runs.maxDistancePerSecond') ?? 200;

    if (!this.runTokenSecret) throw new Error('RUN_TOKEN_SECRET is missing.');
  }

  private get client() {
    return this.supabaseService.getClient();
  }

  async getUserStats(userId: string) {
    const { data: bestRun } = await this.client
      .from('runs')
      .select('score, distance')
      .eq('user_id', userId)
      .order('score', { ascending: false })
      .order('distance', { ascending: false })
      .limit(1)
      .single();

    const { count: totalRuns } = await this.client
      .from('runs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    const { data: allRuns } = await this.client
      .from('runs')
      .select('user_id, score, distance')
      .gte('created_at', hoursAgo(24).toISOString())
      .order('score', { ascending: false })
      .order('distance', { ascending: false });

    const best = getBestScorePerUser(allRuns ?? []);
    const ranked = rankEntries(Array.from(best.values()));
    const userRankIndex = ranked.findIndex((r) => r.user_id === userId);

    return {
      bestScore: bestRun?.score ?? 0,
      bestDistance: bestRun?.distance ?? 0,
      rank: userRankIndex >= 0 ? userRankIndex + 1 : null,
      totalRuns: totalRuns ?? 0,
    };
  }

  startRun(supertokensId: string) {
    const payload: RunTokenPayload = { sub: supertokensId, startedAt: Date.now() };
    const token = jwt.sign(payload, this.runTokenSecret, { expiresIn: this.runTokenTtlSeconds });
    return { runToken: token };
  }

  async finishRun(supertokensId: string, user: UserRecord, dto: FinishRunDto) {
    let payload: RunTokenPayload;
    try {
      payload = jwt.verify(dto.runToken, this.runTokenSecret) as RunTokenPayload;
    } catch {
      throw new BadRequestException('Invalid run token.');
    }

    if (payload.sub !== supertokensId) throw new BadRequestException('Run token does not match user.');

    const serverDurationMs = Math.max(0, Date.now() - payload.startedAt);
    const durationMs = Math.max(dto.durationMs, serverDurationMs);
    const durationSeconds = Math.max(1, Math.ceil(durationMs / 1000));

    if (dto.score > this.maxScorePerSecond * durationSeconds) {
      throw new BadRequestException('Score exceeds maximum allowed rate.');
    }
    if (dto.distance > this.maxDistancePerSecond * durationSeconds) {
      throw new BadRequestException('Distance exceeds maximum allowed rate.');
    }

    if (!user.username) throw new BadRequestException('Username must be set before submitting scores.');

    const { data, error } = await this.client
      .from('runs')
      .insert({ user_id: user.id, score: dto.score, distance: dto.distance, duration_ms: durationMs, client_version: dto.clientVersion ?? null })
      .select('id, score, distance, duration_ms, created_at')
      .single();

    if (error || !data) throw new BadRequestException('Failed to submit run.');

    const enteredContests: string[] = [];
    try {
      const activeContests = await this.contestsService.getActiveContests();
      for (const contest of activeContests) {
        try {
          await this.contestsService.enterContest(contest.id, user.id, data.id, dto.score, dto.distance);
          enteredContests.push(contest.name);
        } catch {
          // expected for duplicate entries or closed contests — not an error
        }
      }
    } catch (err) {
      this.logger.warn('Failed to auto-enter contests:', err);
    }

    this.badgesService.checkAndAwardBadges(user.id).catch((err) =>
      this.logger.warn('Badge check failed after run:', err),
    );

    return { ...data, enteredContests };
  }
}
