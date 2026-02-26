import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { getBestScorePerUser, rankEntries } from '../common/utils/scores.util';
import { assertNoDbError } from '../common/utils/db.util';

@Injectable()
export class ContestsLeaderboardService {
  constructor(private readonly supabaseService: SupabaseService) {}

  private get client() {
    return this.supabaseService.getClient();
  }

  async getContestLeaderboard(contestId: string, limit = 100): Promise<any[]> {
    const { data, error } = await this.client
      .from('contest_entries')
      .select('*, users:users(username)')
      .eq('contest_id', contestId)
      .order('score', { ascending: false })
      .order('distance', { ascending: false });

    assertNoDbError(error, 'Failed to fetch contest leaderboard');

    const best = getBestScorePerUser(data ?? []);
    const sorted = rankEntries(Array.from(best.values())).slice(0, limit);

    return sorted.map((entry: any, index) => ({
      rank: index + 1,
      userId: entry.user_id,
      username: entry.users?.username ?? 'Unknown',
      score: entry.score,
      distance: entry.distance,
      createdAt: entry.created_at,
    }));
  }

  async getUserEntries(contestId: string, userId: string) {
    const { data, error } = await this.client
      .from('contest_entries')
      .select('*')
      .eq('contest_id', contestId)
      .eq('user_id', userId)
      .order('score', { ascending: false });

    assertNoDbError(error, 'Failed to fetch user entries');
    return data ?? [];
  }

  async getUserRank(contestId: string, userId: string): Promise<number | null> {
    const leaderboard = await this.getContestLeaderboard(contestId);
    const idx = leaderboard.findIndex((e) => e.userId === userId);
    return idx >= 0 ? idx + 1 : null;
  }

  getPrizeForRank(rank: number, prizePool: Record<string, string> | null): string | null {
    if (!prizePool) return null;

    const exactMatch = prizePool[rank.toString()];
    if (exactMatch) return exactMatch;

    for (const [key, value] of Object.entries(prizePool)) {
      if (key.includes('-')) {
        const [start, end] = key.split('-').map(Number);
        if (rank >= start && rank <= end) return value;
      }
    }

    return null;
  }
}
