import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class LeaderboardService {
  private readonly windowHours: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly supabaseService: SupabaseService,
  ) {
    this.windowHours = this.configService.get<number>('leaderboard.windowHours') || 24;
  }

  private get client() {
    return this.supabaseService.getClient();
  }

  async getCurrentLeaderboard(limit = 50) {
    const since = new Date(Date.now() - this.windowHours * 60 * 60 * 1000).toISOString();

    const { data, error } = await this.client
      .from('runs')
      .select('score, distance, created_at, users:users(username, featured_badge)')
      .gte('created_at', since)
      .order('score', { ascending: false })
      .order('distance', { ascending: false });

    if (error) {
      throw new BadRequestException('Failed to fetch leaderboard.');
    }

    // Group by username and keep only their best score
    const userBestScores = new Map<string, any>();
    
    for (const entry of data || []) {
      const user = Array.isArray(entry.users) ? entry.users[0] : entry.users;
      const username = user?.username || 'Unknown';
      const existing = userBestScores.get(username);
      
      if (!existing || 
          entry.score > existing.score || 
          (entry.score === existing.score && entry.distance > existing.distance)) {
        userBestScores.set(username, {
          score: entry.score,
          distance: entry.distance,
          createdAt: entry.created_at,
          username: username,
          featuredBadge: user?.featured_badge || null,
        });
      }
    }

    // Convert to array, sort, and limit
    const entries = Array.from(userBestScores.values())
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return b.distance - a.distance;
      })
      .slice(0, limit);

    // Fetch badge details if any featured badges exist
    const badgeIds = entries
      .filter(e => e.featuredBadge)
      .map(e => e.featuredBadge);

    if (badgeIds.length > 0) {
      const { data: badges } = await this.client
        .from('badges')
        .select('id, emoji')
        .in('id', badgeIds);

      const badgeMap = new Map(badges?.map(b => [b.id, b.emoji]) || []);

      return entries.map(entry => ({
        ...entry,
        badgeEmoji: entry.featuredBadge ? badgeMap.get(entry.featuredBadge) : null,
      }));
    }

    return entries;
  }
}
