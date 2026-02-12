import { BadRequestException, Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

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
  constructor(private readonly supabaseService: SupabaseService) {}

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
      .insert({
        contest_id: contestId,
        user_id: userId,
        rank,
        prize_description: prizeDescription,
      })
      .select('*')
      .single();

    if (error) {
      throw new BadRequestException('Failed to create prize claim.');
    }

    return claim as PrizeClaim;
  }

  async submitClaim(
    claimId: string,
    userId: string,
    contactInfo: Record<string, any>,
  ): Promise<PrizeClaim> {
    // First get the claim to check if it exists and get prize details
    const existing = await this.getClaimById(claimId, userId);
    if (!existing) {
      throw new BadRequestException('Prize claim not found or does not belong to you.');
    }

    if (existing.claim_status !== 'pending') {
      throw new BadRequestException('This prize claim has already been submitted.');
    }

    const { data: claim, error } = await this.client
      .from('prize_claims')
      .update({
        claim_status: 'submitted',
        contact_info: contactInfo,
        submitted_at: new Date().toISOString(),
      })
      .eq('id', claimId)
      .eq('user_id', userId)
      .select('*')
      .single();

    if (error) {
      throw new BadRequestException('Failed to submit prize claim.');
    }

    // TODO: Send email notification
    // For now, just log the details
    console.log('📧 Prize claim submitted - Email should be sent:', {
      claimId: claim.id,
      paymentMethod: contactInfo.payment_method,
      email: contactInfo.email,
      prize: claim.prize_description,
      rank: claim.rank,
    });

    // Future: Implement email sending
    // await this.emailService.sendPrizeClaimConfirmation({
    //   to: contactInfo.email,
    //   prize: claim.prize_description,
    //   rank: claim.rank,
    //   paymentMethod: contactInfo.payment_method,
    //   usdtWallet: contactInfo.usdt_wallet,
    // });

    return claim as PrizeClaim;
  }

  async getUserClaims(userId: string): Promise<any[]> {
    const { data, error } = await this.client
      .from('prize_claims')
      .select('*, contests:contests(name, start_date, end_date)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new BadRequestException('Failed to fetch prize claims.');
    }

    return data || [];
  }

  async getClaimById(claimId: string, userId?: string): Promise<PrizeClaim | null> {
    let query = this.client
      .from('prize_claims')
      .select('*')
      .eq('id', claimId);

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query.single();

    if (error && error.code !== 'PGRST116') {
      throw new BadRequestException('Failed to fetch prize claim.');
    }

    return data as PrizeClaim | null;
  }

  async getUserClaimForContest(
    contestId: string,
    userId: string,
  ): Promise<PrizeClaim | null> {
    const { data, error } = await this.client
      .from('prize_claims')
      .select('*')
      .eq('contest_id', contestId)
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new BadRequestException('Failed to fetch prize claim.');
    }

    return data as PrizeClaim | null;
  }
}
