import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface Contest {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  start_date: string;
  end_date: string;
  contest_timezone: string;
  status: 'upcoming' | 'active' | 'ended' | 'cancelled';
  prize_pool: Record<string, string> | null;
  rules: Record<string, any> | null;
  max_entries_per_user: number;
  created_at: string;
  updated_at: string;
}

export interface ContestEntry {
  id: string;
  contest_id: string;
  user_id: string;
  run_id: string;
  score: number;
  distance: number;
  rank: number | null;
  created_at: string;
}

@Injectable()
export class ContestsService {
  constructor(private readonly supabaseService: SupabaseService) {}

  private get client() {
    return this.supabaseService.getClient();
  }

  async getActiveContests(): Promise<Contest[]> {
    const now = new Date().toISOString();

    const { data, error } = await this.client
      .from('contests')
      .select('*')
      .in('status', ['active', 'upcoming'])
      .gte('end_date', now) // Only include contests that haven't ended
      .order('start_date', { ascending: false });

    if (error) {
      throw new BadRequestException('Failed to fetch active contests.');
    }

    return (data || []) as Contest[];
  }

  async getAllContests(status?: string): Promise<Contest[]> {
    let query = this.client.from('contests').select('*');

    if (status) {
      query = query.eq('status', status);
    }

    query = query.order('start_date', { ascending: false });

    const { data, error } = await query;

    if (error) {
      throw new BadRequestException('Failed to fetch contests.');
    }

    return (data || []) as Contest[];
  }

  async getContestById(contestId: string): Promise<Contest | null> {
    const { data, error } = await this.client
      .from('contests')
      .select('*')
      .eq('id', contestId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new BadRequestException('Failed to fetch contest.');
    }

    return data as Contest | null;
  }

  async getContestBySlug(slug: string): Promise<Contest | null> {
    const { data, error } = await this.client
      .from('contests')
      .select('*')
      .eq('slug', slug)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new BadRequestException('Failed to fetch contest by slug.');
    }

    return data as Contest | null;
  }

  async getContestByIdOrSlug(idOrSlug: string): Promise<Contest | null> {
    // Check if it's a UUID (36 characters with hyphens)
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
    
    if (isUuid) {
      return this.getContestById(idOrSlug);
    } else {
      return this.getContestBySlug(idOrSlug);
    }
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  async enterContest(
    contestId: string,
    userId: string,
    runId: string,
    score: number,
    distance: number,
  ): Promise<ContestEntry> {
    // Check if contest exists and is active
    const contest = await this.getContestById(contestId);
    if (!contest) {
      throw new BadRequestException('Contest not found.');
    }

    const now = new Date();
    const endDate = new Date(contest.end_date);

    if (now > endDate) {
      throw new BadRequestException('Contest has ended.');
    }

    if (contest.status !== 'active' && contest.status !== 'upcoming') {
      throw new BadRequestException('Contest is not open for entries.');
    }

    // Insert entry (will fail if run already entered due to unique constraint)
    const { data: entry, error } = await this.client
      .from('contest_entries')
      .insert({
        contest_id: contestId,
        user_id: userId,
        run_id: runId,
        score,
        distance,
      })
      .select('*')
      .single();

    if (error) {
      if (error.code === '23505') {
        // Duplicate entry
        throw new BadRequestException('This run is already entered in the contest.');
      }
      throw new BadRequestException('Failed to enter contest.');
    }

    return entry as ContestEntry;
  }

  async getContestLeaderboard(
    contestId: string,
    limit = 100,
  ): Promise<any[]> {
    const { data, error } = await this.client
      .from('contest_entries')
      .select('*, users:users(username)')
      .eq('contest_id', contestId)
      .order('score', { ascending: false })
      .order('distance', { ascending: false });

    if (error) {
      throw new BadRequestException('Failed to fetch contest leaderboard.');
    }

    // Group by user and keep only their best score
    const userBestEntries = new Map<string, any>();
    
    for (const entry of data || []) {
      const userId = entry.user_id;
      const existing = userBestEntries.get(userId);
      
      if (!existing || 
          entry.score > existing.score || 
          (entry.score === existing.score && entry.distance > existing.distance)) {
        userBestEntries.set(userId, entry);
      }
    }

    // Convert to array and sort by score/distance
    const sortedEntries = Array.from(userBestEntries.values())
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return b.distance - a.distance;
      })
      .slice(0, limit);

    return sortedEntries.map((entry: any, index) => ({
      rank: index + 1,
      userId: entry.user_id,
      username: entry.users?.username || 'Unknown',
      score: entry.score,
      distance: entry.distance,
      createdAt: entry.created_at,
    }));
  }

  async getUserEntries(
    contestId: string,
    userId: string,
  ): Promise<ContestEntry[]> {
    const { data, error } = await this.client
      .from('contest_entries')
      .select('*')
      .eq('contest_id', contestId)
      .eq('user_id', userId)
      .order('score', { ascending: false });

    if (error) {
      throw new BadRequestException('Failed to fetch user entries.');
    }

    return (data || []) as ContestEntry[];
  }

  async getUserRank(contestId: string, userId: string): Promise<number | null> {
    // Get user's best entry
    const entries = await this.getUserEntries(contestId, userId);
    if (entries.length === 0) return null;

    const bestEntry = entries[0]; // Already sorted by score

    // Get all entries for this contest and calculate rank
    const { data, error } = await this.client
      .from('contest_entries')
      .select('id, score, distance, user_id')
      .eq('contest_id', contestId)
      .order('score', { ascending: false })
      .order('distance', { ascending: false });

    if (error) {
      throw new BadRequestException('Failed to calculate rank.');
    }

    // Find the user's best entry rank
    // Group by user_id and get their best score
    const userBestScores = new Map<string, { score: number; distance: number }>();
    
    for (const entry of data || []) {
      const existing = userBestScores.get(entry.user_id);
      if (!existing || entry.score > existing.score || 
          (entry.score === existing.score && entry.distance > existing.distance)) {
        userBestScores.set(entry.user_id, { score: entry.score, distance: entry.distance });
      }
    }

    // Sort users by their best scores
    const rankedUsers = Array.from(userBestScores.entries())
      .sort((a, b) => {
        if (b[1].score !== a[1].score) return b[1].score - a[1].score;
        return b[1].distance - a[1].distance;
      });

    // Find user's rank
    const userRank = rankedUsers.findIndex(([uid]) => uid === userId);
    
    return userRank >= 0 ? userRank + 1 : null;
  }

  // Admin functions
  async createContest(data: {
    name: string;
    slug?: string;
    description?: string;
    startDate: string;
    endDate: string;
    contestTimezone?: string;
    status?: string;
    prizePool?: Record<string, string>;
    rules?: Record<string, any>;
    maxEntriesPerUser?: number;
  }): Promise<Contest> {
    // Generate slug from name if not provided
    const slug = data.slug || this.generateSlug(data.name);

    const { data: contest, error } = await this.client
      .from('contests')
      .insert({
        name: data.name,
        slug: slug,
        description: data.description || null,
        start_date: data.startDate,
        end_date: data.endDate,
        contest_timezone: data.contestTimezone || 'UTC',
        status: data.status || 'upcoming',
        prize_pool: data.prizePool || null,
        rules: data.rules || null,
        max_entries_per_user: data.maxEntriesPerUser || 999,
      })
      .select('*')
      .single();

    if (error) {
      throw new BadRequestException('Failed to create contest.');
    }

    return contest as Contest;
  }

  async updateContest(contestId: string, data: Partial<Contest>): Promise<Contest> {
    const { data: contest, error } = await this.client
      .from('contests')
      .update({
        ...(data.name && { name: data.name }),
        ...(data.slug && { slug: data.slug }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.start_date && { start_date: data.start_date }),
        ...(data.end_date && { end_date: data.end_date }),
        ...(data.contest_timezone && { contest_timezone: data.contest_timezone }),
        ...(data.status && { status: data.status }),
        ...(data.prize_pool !== undefined && { prize_pool: data.prize_pool }),
        ...(data.rules !== undefined && { rules: data.rules }),
        ...(data.max_entries_per_user !== undefined && { max_entries_per_user: data.max_entries_per_user }),
        updated_at: new Date().toISOString(),
      })
      .eq('id', contestId)
      .select('*')
      .single();

    if (error) {
      throw new BadRequestException('Failed to update contest.');
    }

    return contest as Contest;
  }

  async deleteContest(contestId: string): Promise<void> {
    const { error } = await this.client
      .from('contests')
      .delete()
      .eq('id', contestId);

    if (error) {
      throw new BadRequestException('Failed to delete contest.');
    }
  }

  // Auto-completion methods
  async getExpiredActiveContests(): Promise<Contest[]> {
    const now = new Date().toISOString();

    const { data, error } = await this.client
      .from('contests')
      .select('*')
      .eq('status', 'active')
      .lt('end_date', now);

    if (error) {
      throw new BadRequestException('Failed to fetch expired contests.');
    }

    return (data || []) as Contest[];
  }

  async getContestsToStart(): Promise<Contest[]> {
    const now = new Date().toISOString();

    const { data, error } = await this.client
      .from('contests')
      .select('*')
      .eq('status', 'upcoming')
      .lte('start_date', now);

    if (error) {
      throw new BadRequestException('Failed to fetch contests to start.');
    }

    return (data || []) as Contest[];
  }

  getPrizeForRank(rank: number, prizePool: Record<string, string> | null): string | null {
    if (!prizePool) return null;

    // Check for exact match first
    const exactMatch = prizePool[rank.toString()];
    if (exactMatch) return exactMatch;

    // Check for range matches (e.g., "4-10")
    for (const [key, value] of Object.entries(prizePool)) {
      if (key.includes('-')) {
        const [start, end] = key.split('-').map(Number);
        if (rank >= start && rank <= end) {
          return value;
        }
      }
    }

    return null;
  }
}
