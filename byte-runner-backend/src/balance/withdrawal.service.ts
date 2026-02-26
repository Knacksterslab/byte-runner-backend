import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { FraudPreventionService } from '../fraud-prevention/fraud-prevention.service';
import { TronService } from '../tron/tron.service';
import { assertNoDbError } from '../common/utils/db.util';
import { startOfToday } from '../common/utils/date.util';

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

const MIN_WITHDRAWAL_CENTS = 1000;

@Injectable()
export class WithdrawalService {
  private readonly logger = new Logger(WithdrawalService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly fraudPreventionService: FraudPreventionService,
    private readonly tronService: TronService,
    private readonly configService: ConfigService,
  ) {}

  private get client() {
    return this.supabaseService.getClient();
  }

  async submitWithdrawal(
    userId: string,
    amountCents: number,
    paymentMethod: string,
    contactInfo: any,
  ): Promise<Withdrawal> {
    if (amountCents < MIN_WITHDRAWAL_CENTS) {
      throw new BadRequestException('Minimum withdrawal is $10.00');
    }

    const eligibility = await this.fraudPreventionService.canWithdraw(userId);
    if (!eligibility.eligible) {
      throw new BadRequestException(eligibility.reason ?? 'Not eligible to withdraw');
    }

    const { data: user } = await this.client
      .from('users')
      .select('balance_cents')
      .eq('id', userId)
      .single();

    if (!user) throw new BadRequestException('User not found');

    if (user.balance_cents < amountCents) {
      throw new BadRequestException(
        `Insufficient balance. Have $${(user.balance_cents / 100).toFixed(2)}, ` +
          `requested $${(amountCents / 100).toFixed(2)}`,
      );
    }

    const { error: deductError } = await this.client
      .from('users')
      .update({ balance_cents: user.balance_cents - amountCents })
      .eq('id', userId);

    if (deductError) {
      throw new BadRequestException('Failed to deduct balance: ' + deductError.message);
    }

    await this.client.from('balance_transactions').insert({
      user_id: userId,
      amount_cents: -amountCents,
      type: 'withdrawal',
      reference_id: null,
      description: `Withdrawal request - ${paymentMethod}`,
    });

    const { data: withdrawal, error: withdrawalError } = await this.client
      .from('withdrawals')
      .insert({ user_id: userId, amount_cents: amountCents, payment_method: paymentMethod, contact_info: contactInfo, status: 'pending' })
      .select('*')
      .single();

    if (withdrawalError || !withdrawal) {
      await this.client
        .from('users')
        .update({ balance_cents: user.balance_cents })
        .eq('id', userId);
      throw new BadRequestException('Failed to create withdrawal: ' + withdrawalError?.message);
    }

    await this.fraudPreventionService.updateLastWithdrawal(userId);
    return withdrawal as Withdrawal;
  }

  async getWithdrawals(userId: string): Promise<Withdrawal[]> {
    const { data, error } = await this.client
      .from('withdrawals')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    assertNoDbError(error);
    return (data ?? []) as Withdrawal[];
  }

  async getAllWithdrawals(status?: string): Promise<Withdrawal[]> {
    let query = this.client.from('withdrawals').select('*').order('created_at', { ascending: false });
    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    assertNoDbError(error);
    return (data ?? []) as Withdrawal[];
  }

  async updateWithdrawalStatus(
    withdrawalId: string,
    status: string,
    reviewedBy: string,
    notes?: string,
  ): Promise<Withdrawal> {
    const { data, error } = await this.client
      .from('withdrawals')
      .update({ status, reviewed_at: new Date().toISOString(), reviewed_by: reviewedBy, notes })
      .eq('id', withdrawalId)
      .select('*')
      .single();

    assertNoDbError(error, 'Failed to update withdrawal');
    return data as Withdrawal;
  }

  async processUsdtWithdrawal(withdrawalId: string): Promise<{ success: boolean; txId?: string; error?: string }> {
    const { data: withdrawal, error: fetchError } = await this.client
      .from('withdrawals')
      .select('*')
      .eq('id', withdrawalId)
      .single();

    if (fetchError || !withdrawal) return { success: false, error: 'Withdrawal not found' };
    if (withdrawal.status !== 'approved') {
      return { success: false, error: `Withdrawal status is ${withdrawal.status}, not approved` };
    }
    if (withdrawal.payment_method !== 'USDT') {
      return { success: false, error: 'Only USDT withdrawals can be auto-processed' };
    }

    const tronAddress = withdrawal.contact_info?.tron_address ?? withdrawal.contact_info?.address;
    if (!tronAddress) {
      await this.updateWithdrawalStatus(withdrawalId, 'failed', 'system', 'No Tron address provided');
      return { success: false, error: 'No Tron address provided' };
    }

    const amountUsdt = withdrawal.amount_cents / 100;

    const dailyLimitError = await this.checkDailyUsdtLimit(amountUsdt);
    if (dailyLimitError) return { success: false, error: dailyLimitError };

    try {
      const result = await this.tronService.sendUsdt(tronAddress, amountUsdt);

      const finalStatus = result.success ? 'completed' : 'failed';
      const notes = result.success
        ? `Sent ${amountUsdt} USDT to ${tronAddress}. TxID: ${result.txId}`
        : `Transaction failed: ${result.error}. TxID: ${result.txId ?? 'N/A'}`;

      await this.client
        .from('withdrawals')
        .update({ status: finalStatus, transaction_id: result.txId, notes, reviewed_at: new Date().toISOString(), reviewed_by: 'system-auto' })
        .eq('id', withdrawalId);

      if (result.success) {
        this.logger.log(`Withdrawal ${withdrawalId} completed. TxID: ${result.txId} — ${this.tronService.getExplorerUrl(result.txId!)}`);
      } else {
        this.logger.error(`Withdrawal ${withdrawalId} failed: ${result.error}`);
      }

      return result.success
        ? { success: true, txId: result.txId }
        : { success: false, error: result.error, txId: result.txId };
    } catch (error) {
      this.logger.error(`Error processing withdrawal ${withdrawalId}:`, error);
      await this.client
        .from('withdrawals')
        .update({ status: 'failed', notes: `System error: ${error.message}`, reviewed_at: new Date().toISOString(), reviewed_by: 'system-auto' })
        .eq('id', withdrawalId);
      return { success: false, error: error.message };
    }
  }

  async processAllApprovedUsdtWithdrawals(): Promise<{ processed: number; successful: number; failed: number }> {
    const { data: withdrawals, error } = await this.client
      .from('withdrawals')
      .select('id')
      .eq('status', 'approved')
      .eq('payment_method', 'USDT');

    if (error || !withdrawals?.length) return { processed: 0, successful: 0, failed: 0 };

    let successful = 0;
    let failed = 0;

    for (const w of withdrawals) {
      const result = await this.processUsdtWithdrawal(w.id);
      result.success ? successful++ : failed++;
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }

    this.logger.log(`Processed ${withdrawals.length} withdrawals: ${successful} ok, ${failed} failed`);
    return { processed: withdrawals.length, successful, failed };
  }

  private async checkDailyUsdtLimit(amountUsdt: number): Promise<string | null> {
    const maxDaily = parseFloat(this.configService.get<string>('MAX_DAILY_PAYOUT_USDT', '100'));

    const { data } = await this.client
      .from('withdrawals')
      .select('amount_cents')
      .eq('payment_method', 'USDT')
      .eq('status', 'completed')
      .gte('created_at', startOfToday().toISOString());

    const todayTotal = (data?.reduce((sum, w) => sum + w.amount_cents, 0) ?? 0) / 100;

    if (todayTotal + amountUsdt > maxDaily) {
      return `Daily USDT payout limit reached (${todayTotal.toFixed(2)}/${maxDaily} USDT sent today)`;
    }
    return null;
  }
}
