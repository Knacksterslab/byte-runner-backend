import { BadRequestException, Injectable, forwardRef, Inject } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { FraudPreventionService } from '../fraud-prevention/fraud-prevention.service';

export interface BalanceTransaction {
  id: string;
  user_id: string;
  amount_cents: number;
  type: string;
  reference_id: string | null;
  description: string;
  created_at: string;
}

export interface Withdrawal {
  id: string;
  user_id: string;
  amount_cents: number;
  payment_method: string;
  contact_info: any;
  status: string;
  submitted_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  notes: string | null;
  created_at: string;
}

export interface BalanceInfo {
  balance_cents: number;
  pending_withdrawals_cents: number;
  total_earned_cents: number;
  transactions: BalanceTransaction[];
}

@Injectable()
export class BalanceService {
  constructor(
    private readonly supabaseService: SupabaseService,
    @Inject(forwardRef(() => FraudPreventionService))
    private readonly fraudPreventionService: FraudPreventionService
  ) {}

  private get client() {
    return this.supabaseService.getClient();
  }

  async getUserBalance(userId: string): Promise<BalanceInfo> {
    // Get user balance
    const { data: user, error: userError } = await this.client
      .from('users')
      .select('balance_cents')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      throw new BadRequestException('User not found');
    }

    // Get pending withdrawals total
    const { data: pendingWithdrawals } = await this.client
      .from('withdrawals')
      .select('amount_cents')
      .eq('user_id', userId)
      .in('status', ['pending', 'approved']);

    const pending_withdrawals_cents = pendingWithdrawals?.reduce(
      (sum, w) => sum + w.amount_cents,
      0
    ) || 0;

    // Get total earned (sum of positive transactions)
    const { data: transactions } = await this.client
      .from('balance_transactions')
      .select('amount_cents')
      .eq('user_id', userId)
      .gt('amount_cents', 0);

    const total_earned_cents = transactions?.reduce(
      (sum, t) => sum + t.amount_cents,
      0
    ) || 0;

    // Get recent transactions
    const { data: recentTransactions } = await this.client
      .from('balance_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    return {
      balance_cents: user.balance_cents,
      pending_withdrawals_cents,
      total_earned_cents,
      transactions: (recentTransactions || []) as BalanceTransaction[]
    };
  }

  async getTransactions(userId: string, limit: number = 50, offset: number = 0): Promise<BalanceTransaction[]> {
    const { data, error } = await this.client
      .from('balance_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new BadRequestException(error.message);
    }

    return (data || []) as BalanceTransaction[];
  }

  async addBalance(
    userId: string,
    amountCents: number,
    type: string,
    referenceId: string | null,
    description: string
  ): Promise<void> {
    // Update user balance
    const { error: balanceError } = await this.client.rpc('increment_balance', {
      user_id: userId,
      amount: amountCents
    });

    if (balanceError) {
      throw new BadRequestException('Failed to update balance: ' + balanceError.message);
    }

    // Create transaction record
    const { error: txError } = await this.client
      .from('balance_transactions')
      .insert({
        user_id: userId,
        amount_cents: amountCents,
        type,
        reference_id: referenceId,
        description
      });

    if (txError) {
      throw new BadRequestException('Failed to record transaction: ' + txError.message);
    }
  }

  async submitWithdrawal(
    userId: string,
    amountCents: number,
    paymentMethod: string,
    contactInfo: any
  ): Promise<Withdrawal> {
    // Validate minimum withdrawal
    if (amountCents < 1000) {
      throw new BadRequestException('Minimum withdrawal is $10.00');
    }

    // Check withdrawal eligibility (velocity limits, fraud checks)
    const eligibility = await this.fraudPreventionService.canWithdraw(userId);
    
    if (!eligibility.eligible) {
      throw new BadRequestException(eligibility.reason || 'You are not eligible to withdraw at this time.');
    }

    // Get current balance
    const { data: user } = await this.client
      .from('users')
      .select('balance_cents')
      .eq('id', userId)
      .single();

    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Check sufficient balance
    if (user.balance_cents < amountCents) {
      throw new BadRequestException(
        `Insufficient balance. You have $${(user.balance_cents / 100).toFixed(2)}, but requested $${(amountCents / 100).toFixed(2)}`
      );
    }

    // Deduct from balance immediately
    const { error: deductError } = await this.client
      .from('users')
      .update({ balance_cents: user.balance_cents - amountCents })
      .eq('id', userId);

    if (deductError) {
      throw new BadRequestException('Failed to deduct balance: ' + deductError.message);
    }

    // Create transaction record (negative for withdrawal)
    await this.client
      .from('balance_transactions')
      .insert({
        user_id: userId,
        amount_cents: -amountCents,
        type: 'withdrawal',
        reference_id: null,
        description: `Withdrawal request - ${paymentMethod}`
      });

    // Create withdrawal record
    const { data: withdrawal, error: withdrawalError } = await this.client
      .from('withdrawals')
      .insert({
        user_id: userId,
        amount_cents: amountCents,
        payment_method: paymentMethod,
        contact_info: contactInfo,
        status: 'pending'
      })
      .select('*')
      .single();

    if (withdrawalError || !withdrawal) {
      // Rollback balance if withdrawal creation fails
      await this.client
        .from('users')
        .update({ balance_cents: user.balance_cents })
        .eq('id', userId);

      throw new BadRequestException('Failed to create withdrawal: ' + withdrawalError?.message);
    }

    // Update last withdrawal timestamp for velocity limiting
    await this.fraudPreventionService.updateLastWithdrawal(userId);

    return withdrawal as Withdrawal;
  }

  async getWithdrawals(userId: string): Promise<Withdrawal[]> {
    const { data, error } = await this.client
      .from('withdrawals')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new BadRequestException(error.message);
    }

    return (data || []) as Withdrawal[];
  }

  // Admin functions
  async getAllWithdrawals(status?: string): Promise<Withdrawal[]> {
    let query = this.client
      .from('withdrawals')
      .select('*')
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      throw new BadRequestException(error.message);
    }

    return (data || []) as Withdrawal[];
  }

  async updateWithdrawalStatus(
    withdrawalId: string,
    status: string,
    reviewedBy: string,
    notes?: string
  ): Promise<Withdrawal> {
    const { data, error } = await this.client
      .from('withdrawals')
      .update({
        status,
        reviewed_at: new Date().toISOString(),
        reviewed_by: reviewedBy,
        notes
      })
      .eq('id', withdrawalId)
      .select('*')
      .single();

    if (error || !data) {
      throw new BadRequestException('Failed to update withdrawal: ' + error?.message);
    }

    return data as Withdrawal;
  }
}
