import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { assertNoDbError } from '../common/utils/db.util';

export interface BalanceTransaction {
  id: string;
  user_id: string;
  amount_cents: number;
  type: string;
  reference_id: string | null;
  description: string;
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
  constructor(private readonly supabaseService: SupabaseService) {}

  private get client() {
    return this.supabaseService.getClient();
  }

  async getUserBalance(userId: string): Promise<BalanceInfo> {
    const { data: user, error: userError } = await this.client
      .from('users')
      .select('balance_cents')
      .eq('id', userId)
      .single();

    assertNoDbError(userError, 'User not found');
    if (!user) throw new Error('User not found');

    const { data: pendingWithdrawals } = await this.client
      .from('withdrawals')
      .select('amount_cents')
      .eq('user_id', userId)
      .in('status', ['pending', 'approved']);

    const pending_withdrawals_cents =
      pendingWithdrawals?.reduce((sum, w) => sum + w.amount_cents, 0) ?? 0;

    const { data: earnedTx } = await this.client
      .from('balance_transactions')
      .select('amount_cents')
      .eq('user_id', userId)
      .gt('amount_cents', 0);

    const total_earned_cents = earnedTx?.reduce((sum, t) => sum + t.amount_cents, 0) ?? 0;

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
      transactions: (recentTransactions ?? []) as BalanceTransaction[],
    };
  }

  async getTransactions(userId: string, limit = 50, offset = 0): Promise<BalanceTransaction[]> {
    const { data, error } = await this.client
      .from('balance_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    assertNoDbError(error);
    return (data ?? []) as BalanceTransaction[];
  }

  async addBalance(
    userId: string,
    amountCents: number,
    type: string,
    referenceId: string | null,
    description: string,
  ): Promise<void> {
    const { error: balanceError } = await this.client.rpc('increment_balance', {
      user_id: userId,
      amount: amountCents,
    });

    assertNoDbError(balanceError, 'Failed to update balance');

    const { error: txError } = await this.client.from('balance_transactions').insert({
      user_id: userId,
      amount_cents: amountCents,
      type,
      reference_id: referenceId,
      description,
    });

    assertNoDbError(txError, 'Failed to record transaction');
  }
}
