import { BadRequestException, Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { assertNoDbError, assertNoDbErrorExceptNotFound } from '../common/utils/db.util';
import { CreateContestDto } from './dto/create-contest.dto';

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

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  async getActiveContests(): Promise<Contest[]> {
    const { data, error } = await this.client
      .from('contests')
      .select('*')
      .in('status', ['active', 'upcoming'])
      .gte('end_date', new Date().toISOString())
      .order('start_date', { ascending: false });

    assertNoDbError(error, 'Failed to fetch active contests');
    return (data ?? []) as Contest[];
  }

  async getAllContests(status?: string): Promise<Contest[]> {
    let query = this.client.from('contests').select('*');
    if (status) query = query.eq('status', status);
    query = query.order('start_date', { ascending: false });

    const { data, error } = await query;
    assertNoDbError(error, 'Failed to fetch contests');
    return (data ?? []) as Contest[];
  }

  async getContestById(contestId: string): Promise<Contest | null> {
    const { data, error } = await this.client
      .from('contests')
      .select('*')
      .eq('id', contestId)
      .single();

    assertNoDbErrorExceptNotFound(error, 'Failed to fetch contest');
    return data as Contest | null;
  }

  async getContestBySlug(slug: string): Promise<Contest | null> {
    const { data, error } = await this.client
      .from('contests')
      .select('*')
      .eq('slug', slug)
      .single();

    assertNoDbErrorExceptNotFound(error, 'Failed to fetch contest by slug');
    return data as Contest | null;
  }

  async getContestByIdOrSlug(idOrSlug: string): Promise<Contest | null> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
    return isUuid ? this.getContestById(idOrSlug) : this.getContestBySlug(idOrSlug);
  }

  async enterContest(
    contestId: string,
    userId: string,
    runId: string,
    score: number,
    distance: number,
  ): Promise<ContestEntry> {
    const contest = await this.getContestById(contestId);
    if (!contest) throw new BadRequestException('Contest not found.');
    if (new Date() > new Date(contest.end_date)) throw new BadRequestException('Contest has ended.');
    if (contest.status !== 'active' && contest.status !== 'upcoming') {
      throw new BadRequestException('Contest is not open for entries.');
    }

    const { data: entry, error } = await this.client
      .from('contest_entries')
      .insert({ contest_id: contestId, user_id: userId, run_id: runId, score, distance })
      .select('*')
      .single();

    if (error) {
      if (error.code === '23505') throw new BadRequestException('This run is already entered in the contest.');
      throw new BadRequestException('Failed to enter contest.');
    }

    return entry as ContestEntry;
  }

  async createContest(data: Omit<CreateContestDto, 'slug'> & { slug?: string }): Promise<Contest> {
    const slug = data.slug ?? this.generateSlug(data.name);

    const { data: contest, error } = await this.client
      .from('contests')
      .insert({
        name: data.name,
        slug,
        description: data.description ?? null,
        start_date: data.startDate,
        end_date: data.endDate,
        contest_timezone: data.contestTimezone ?? 'UTC',
        status: data.status ?? 'upcoming',
        prize_pool: data.prizePool ?? null,
        rules: data.rules ?? null,
        max_entries_per_user: data.maxEntriesPerUser ?? 999,
      })
      .select('*')
      .single();

    assertNoDbError(error, 'Failed to create contest');
    return contest as Contest;
  }

  async updateContest(contestId: string, dto: Partial<CreateContestDto>): Promise<Contest> {
    const updates: Record<string, any> = { updated_at: new Date().toISOString() };
    if (dto.name) updates.name = dto.name;
    if (dto.slug) updates.slug = dto.slug;
    if (dto.description !== undefined) updates.description = dto.description;
    if (dto.startDate) updates.start_date = dto.startDate;
    if (dto.endDate) updates.end_date = dto.endDate;
    if (dto.contestTimezone) updates.contest_timezone = dto.contestTimezone;
    if (dto.status) updates.status = dto.status;
    if (dto.prizePool !== undefined) updates.prize_pool = dto.prizePool;
    if (dto.rules !== undefined) updates.rules = dto.rules;
    if (dto.maxEntriesPerUser !== undefined) updates.max_entries_per_user = dto.maxEntriesPerUser;

    const { data: contest, error } = await this.client
      .from('contests')
      .update(updates)
      .eq('id', contestId)
      .select('*')
      .single();

    assertNoDbError(error, 'Failed to update contest');
    return contest as Contest;
  }

  async deleteContest(contestId: string): Promise<void> {
    const { error } = await this.client.from('contests').delete().eq('id', contestId);
    assertNoDbError(error, 'Failed to delete contest');
  }

  async getExpiredActiveContests(): Promise<Contest[]> {
    const { data, error } = await this.client
      .from('contests')
      .select('*')
      .eq('status', 'active')
      .lt('end_date', new Date().toISOString());

    assertNoDbError(error, 'Failed to fetch expired contests');
    return (data ?? []) as Contest[];
  }

  async getContestsToStart(): Promise<Contest[]> {
    const { data, error } = await this.client
      .from('contests')
      .select('*')
      .eq('status', 'upcoming')
      .lte('start_date', new Date().toISOString());

    assertNoDbError(error, 'Failed to fetch contests to start');
    return (data ?? []) as Contest[];
  }

  async getEndedContests(sinceDate?: Date): Promise<Contest[]> {
    let query = this.client.from('contests').select('*').eq('status', 'ended');
    if (sinceDate) query = query.gte('end_date', sinceDate.toISOString());

    const { data, error } = await query;
    assertNoDbError(error, 'Failed to fetch ended contests');
    return (data ?? []) as Contest[];
  }
}
