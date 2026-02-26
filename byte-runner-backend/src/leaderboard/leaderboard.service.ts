import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { getBestScorePerUser, rankEntries } from '../common/utils/scores.util';
import { assertNoDbError } from '../common/utils/db.util';
import { hoursAgo } from '../common/utils/date.util';

@Injectable()
export class LeaderboardService {
  private readonly windowHours: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly supabaseService: SupabaseService,
  ) {
    this.windowHours = this.configService.get<number>('leaderboard.windowHours') ?? 24;
  }

  private get client() {
    return this.supabaseService.getClient();
  }

  async getCurrentLeaderboard(limit = 50) {
    const { data, error } = await this.client
      .from('runs')
      .select('user_id, score, distance, created_at, users:users(username, featured_badge)')
      .gte('created_at', hoursAgo(this.windowHours).toISOString())
      .order('score', { ascending: false })
      .order('distance', { ascending: false });

    assertNoDbError(error, 'Failed to fetch leaderboard');

    const best = getBestScorePerUser(data ?? []);
    const entries = rankEntries(Array.from(best.values())).slice(0, limit).map((entry: any) => {
      const user = Array.isArray(entry.users) ? entry.users[0] : entry.users;
      return {
        username: user?.username ?? 'Unknown',
        score: entry.score,
        distance: entry.distance,
        createdAt: entry.created_at,
        featuredBadge: user?.featured_badge ?? null,
      };
    });

    const badgeIds = entries.map((e) => e.featuredBadge).filter(Boolean);
    if (badgeIds.length === 0) return entries;

    const { data: badges } = await this.client
      .from('badges')
      .select('id, emoji')
      .in('id', badgeIds);

    const badgeMap = new Map(badges?.map((b) => [b.id, b.emoji]) ?? []);

    return entries.map((entry) => ({
      ...entry,
      badgeEmoji: entry.featuredBadge ? (badgeMap.get(entry.featuredBadge) ?? null) : null,
    }));
  }
}
