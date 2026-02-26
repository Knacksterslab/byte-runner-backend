import { BadRequestException, Inject, Injectable, forwardRef } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { ContestsService } from '../contests/contests.service';
import { assertNoDbError, assertNoDbErrorExceptNotFound } from '../common/utils/db.util';

export interface PrizeClaim {
  id: string;
  contest_id: string;
  user_id: string;
  rank: number;
  prize_description: string;
  claim_status: 'pending' | 'submitted' | 'approved' | 'rejected' | 'paid';
  contact_info: Record<string, any> | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  notes: string | null;
  created_at: string;
}

@Injectable()
export class PrizeClaimsService {
  constructor(
    private readonly supabaseService: SupabaseService,
    @Inject(forwardRef(() => ContestsService))
    private readonly contestsService: ContestsService,
  ) {}

  private get client() {
    return this.supabaseService.getClient();
  }

  async createPrizeClaim(
    contestId: string,
    userId: string,
    rank: number,
    prizeDescription: string,
  ): Promise<PrizeClaim> {
    const { data: claim, error } = await this.client
      .from('prize_claims')
      .insert({ contest_id: contestId, user_id: userId, rank, prize_description: prizeDescription })
      .select('*')
      .single();

    assertNoDbError(error, 'Failed to create prize claim');
    return claim as PrizeClaim;
  }

  async submitClaim(claimId: string, userId: string, contactInfo: Record<string, any>): Promise<PrizeClaim> {
    const existing = await this.getClaimById(claimId, userId);
    if (!existing) throw new BadRequestException('Prize claim not found or does not belong to you.');
    if (existing.claim_status !== 'pending') throw new BadRequestException('This prize claim has already been submitted.');

    const { data: claim, error } = await this.client
      .from('prize_claims')
      .update({ claim_status: 'submitted', contact_info: contactInfo, submitted_at: new Date().toISOString() })
      .eq('id', claimId)
      .eq('user_id', userId)
      .select('*')
      .single();

    assertNoDbError(error, 'Failed to submit prize claim');

    // TODO: send email confirmation to contactInfo.email

    return claim as PrizeClaim;
  }

  async getUserClaims(userId: string): Promise<any[]> {
    const { data, error } = await this.client
      .from('prize_claims')
      .select('*, contests:contests(name, start_date, end_date)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    assertNoDbError(error, 'Failed to fetch prize claims');
    return data ?? [];
  }

  async getClaimById(claimId: string, userId?: string): Promise<PrizeClaim | null> {
    let query = this.client.from('prize_claims').select('*').eq('id', claimId);
    if (userId) query = query.eq('user_id', userId);

    const { data, error } = await query.single();
    assertNoDbErrorExceptNotFound(error, 'Failed to fetch prize claim');
    return data as PrizeClaim | null;
  }

  async getUserClaimForContest(contestId: string, userId: string): Promise<PrizeClaim | null> {
    const { data, error } = await this.client
      .from('prize_claims')
      .select('*')
      .eq('contest_id', contestId)
      .eq('user_id', userId)
      .single();

    assertNoDbErrorExceptNotFound(error, 'Failed to fetch prize claim');
    return data as PrizeClaim | null;
  }

  async getUserClaimForContestBySlug(idOrSlug: string, userId: string): Promise<PrizeClaim | null> {
    const contest = await this.contestsService.getContestByIdOrSlug(idOrSlug);
    if (!contest) throw new BadRequestException('Contest not found');
    return this.getUserClaimForContest(contest.id, userId);
  }
}
