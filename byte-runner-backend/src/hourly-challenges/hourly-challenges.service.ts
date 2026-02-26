import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { getBestScorePerUser } from '../common/utils/scores.util';
import { startOfCurrentHour } from '../common/utils/date.util';

export interface HourlyChallenge {
  id: string;
  challenge_hour: string;
  status: string;
  winner_user_id: string | null;
  winner_run_id: string | null;
  winner_score: number | null;
  winner_distance: number | null;
  created_at: string;
  ended_at: string | null;
}

export interface UserHourlyEntry {
  run_id: string;
  score: number;
  distance: number;
  created_at: string;
}

export interface RankedChallengeEntry {
  rank: number;
  userId: string;
  username: string;
  score: number;
  distance: number;
  createdAt: string;
}

@Injectable()
export class HourlyChallengesService {
  private readonly logger = new Logger(HourlyChallengesService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  private get client() {
    return this.supabaseService.getClient();
  }

  getCurrentHourTimestamp(): string {
    return startOfCurrentHour().toISOString();
  }

  async getCurrentChallenge(): Promise<HourlyChallenge | null> {
    const { data, error } = await this.client
      .from('hourly_challenges')
      .select('*')
      .eq('challenge_hour', this.getCurrentHourTimestamp())
      .single();

    if (error && error.code !== 'PGRST116') {
      this.logger.error('Error fetching current challenge:', error);
      return null;
    }
    return data as HourlyChallenge | null;
  }

  async getChallengeByHour(hourStart: string): Promise<HourlyChallenge | null> {
    const { data } = await this.client
      .from('hourly_challenges')
      .select('*')
      .eq('challenge_hour', hourStart)
      .single();
    return data as HourlyChallenge | null;
  }

  async getOrCreateChallengeByHour(hourStart: string): Promise<HourlyChallenge | null> {
    const existing = await this.getChallengeByHour(hourStart);
    if (existing) return existing;

    const { data, error } = await this.client
      .from('hourly_challenges')
      .insert({ challenge_hour: hourStart, status: 'active' })
      .select('*')
      .single();

    if (error || !data) {
      this.logger.error('Failed to create challenge record:', error);
      return null;
    }
    return data as HourlyChallenge;
  }

  async updateChallengeOutcome(
    id: string,
    status: string,
    winner?: { user_id: string; run_id: string; score: number; distance: number },
  ): Promise<void> {
    const update: Record<string, any> = { status, ended_at: new Date().toISOString() };
    if (winner) {
      update.winner_user_id = winner.user_id;
      update.winner_run_id = winner.run_id;
      update.winner_score = winner.score;
      update.winner_distance = winner.distance;
    }
    await this.client.from('hourly_challenges').update(update).eq('id', id);
  }

  async ensureCurrentHourExists(): Promise<void> {
    const currentHour = this.getCurrentHourTimestamp();
    const { data } = await this.client
      .from('hourly_challenges')
      .select('id')
      .eq('challenge_hour', currentHour)
      .single();

    if (!data) {
      await this.client
        .from('hourly_challenges')
        .insert({ challenge_hour: currentHour, status: 'active' });
    }
  }

  async getTopRunForHour(hourStart: string, hourEnd: string): Promise<any | null> {
    const { data, error } = await this.client
      .from('runs')
      .select('id, user_id, score, distance')
      .gte('created_at', hourStart)
      .lt('created_at', hourEnd)
      .order('score', { ascending: false })
      .order('distance', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) return null;
    return data;
  }

  async getUserEntriesForChallenge(userId: string, challengeHour: string): Promise<UserHourlyEntry[]> {
    const hourStart = new Date(challengeHour);
    const hourEnd = new Date(hourStart);
    hourEnd.setHours(hourEnd.getHours() + 1);

    const { data, error } = await this.client
      .from('runs')
      .select('id, score, distance, created_at')
      .eq('user_id', userId)
      .gte('created_at', hourStart.toISOString())
      .lt('created_at', hourEnd.toISOString())
      .order('score', { ascending: false })
      .order('distance', { ascending: false })
      .limit(10);

    if (error) {
      this.logger.error('Error fetching user entries:', error);
      return [];
    }
    return (data ?? []).map((d) => ({ run_id: d.id, score: d.score, distance: d.distance, created_at: d.created_at }));
  }

  async getLeaderboardForChallenge(challengeHour: string, limit = 10): Promise<RankedChallengeEntry[]> {
    const hourStart = new Date(challengeHour);
    const hourEnd = new Date(hourStart);
    hourEnd.setHours(hourEnd.getHours() + 1);

    const { data, error } = await this.client
      .from('runs')
      .select('user_id, score, distance, created_at, users(username)')
      .gte('created_at', hourStart.toISOString())
      .lt('created_at', hourEnd.toISOString())
      .order('score', { ascending: false })
      .order('distance', { ascending: false })
      .limit(100);

    if (error) {
      this.logger.error('Error fetching leaderboard:', error);
      return [];
    }

    const best = getBestScorePerUser(data ?? []);
    return Array.from(best.values())
      .slice(0, limit)
      .map((entry: any, index) => ({
        rank: index + 1,
        userId: entry.user_id,
        username: entry.users?.username ?? 'Anonymous',
        score: entry.score,
        distance: entry.distance,
        createdAt: entry.created_at,
      }));
  }

  async getAllChallenges(limit = 50): Promise<HourlyChallenge[]> {
    const { data, error } = await this.client
      .from('hourly_challenges')
      .select('*')
      .order('challenge_hour', { ascending: false })
      .limit(limit);

    if (error) {
      this.logger.error('Error fetching all challenges:', error);
      return [];
    }
    return (data ?? []) as HourlyChallenge[];
  }
}
