import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { daysAgo, startOfToday } from '../common/utils/date.util';

export interface FraudFlag {
  id: string;
  user_id: string;
  flag_type: string;
  severity: number;
  reference_id: string | null;
  metadata: any;
  created_at: string;
}

export interface EligibilityResult {
  eligible: boolean;
  reason?: string;
  fraudScore: number;
  flags: string[];
}

export interface PrizeEligibilityProgress {
  accountAgeHours: number;
  totalRuns: number;
  winsToday: number;
}

export interface PrizeEligibilityStatus extends EligibilityResult {
  requirements: {
    minAccountAgeHours: number;
    minRuns: number;
    maxDailyWins: number;
  };
  progress: PrizeEligibilityProgress;
  nextEligibleAt: string | null;
}

const FRAUD_THRESHOLD = 6;
const MIN_ACCOUNT_AGE_HOURS = 24;
const MIN_RUNS = 5;
const MAX_DAILY_WINS = 3;
const FRAUD_WINDOW_DAYS = 7;
const WITHDRAWAL_COOLDOWN_DAYS = 7;

@Injectable()
export class FraudPreventionService {
  private readonly logger = new Logger(FraudPreventionService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  private get client() {
    return this.supabaseService.getClient();
  }

  private ineligible(reason: string, fraudScore: number, flags: string[]): EligibilityResult {
    return { eligible: false, reason, fraudScore, flags };
  }

  private eligibilityRequirements() {
    return {
      minAccountAgeHours: MIN_ACCOUNT_AGE_HOURS,
      minRuns: MIN_RUNS,
      maxDailyWins: MAX_DAILY_WINS,
    };
  }

  private async evaluatePrizeEligibility(
    userId: string,
    options: { recordFlags: boolean },
  ): Promise<{
    result: EligibilityResult;
    progress: PrizeEligibilityProgress;
    nextEligibleAt: string | null;
  }> {
    const flags: string[] = [];
    let fraudScore = 0;
    let accountAgeHours = 0;
    let totalRuns = 0;
    let winsToday = 0;
    let nextEligibleAt: string | null = null;

    const { data: user, error: userError } = await this.client
      .from('users')
      .select('created_at')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return {
        result: this.ineligible('User not found', 10, ['user_not_found']),
        progress: { accountAgeHours, totalRuns, winsToday },
        nextEligibleAt,
      };
    }

    accountAgeHours = (Date.now() - new Date(user.created_at).getTime()) / 3_600_000;
    if (accountAgeHours < MIN_ACCOUNT_AGE_HOURS) {
      flags.push('new_account');
      fraudScore += 2;
      if (options.recordFlags) {
        await this.createFraudFlag(userId, 'new_account', 2, null, {
          accountAgeHours: Math.round(accountAgeHours * 10) / 10,
        });
      }
      nextEligibleAt = new Date(
        new Date(user.created_at).getTime() + MIN_ACCOUNT_AGE_HOURS * 3_600_000,
      ).toISOString();
      return {
        result: this.ineligible(
          `Account must be at least 24 hours old. Yours is ${Math.round(accountAgeHours)} hours old.`,
          fraudScore,
          flags,
        ),
        progress: {
          accountAgeHours: Math.round(accountAgeHours * 10) / 10,
          totalRuns,
          winsToday,
        },
        nextEligibleAt,
      };
    }

    const { count, error: countError } = await this.client
      .from('runs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);
    totalRuns = count ?? 0;

    if (countError || totalRuns < MIN_RUNS) {
      flags.push('insufficient_runs');
      return {
        result: this.ineligible(
          `You must complete at least ${MIN_RUNS} games to be eligible. You have ${totalRuns}.`,
          fraudScore + 1,
          flags,
        ),
        progress: {
          accountAgeHours: Math.round(accountAgeHours * 10) / 10,
          totalRuns,
          winsToday,
        },
        nextEligibleAt,
      };
    }

    const { data: todayWins, error: winsError } = await this.client
      .from('balance_transactions')
      .select('id')
      .eq('user_id', userId)
      .eq('type', 'hourly_challenge')
      .gte('created_at', startOfToday().toISOString());

    if (winsError) this.logger.error('Error checking daily wins:', winsError);
    winsToday = todayWins?.length ?? 0;

    if (winsToday >= MAX_DAILY_WINS) {
      flags.push('multiple_wins_today');
      fraudScore += 3;
      if (options.recordFlags) {
        await this.createFraudFlag(userId, 'multiple_wins', 3, null, {
          winsToday,
          date: startOfToday().toISOString(),
        });
      }
      return {
        result: this.ineligible(
          `Maximum ${MAX_DAILY_WINS} wins per day reached (${winsToday} today). Try again tomorrow!`,
          fraudScore,
          flags,
        ),
        progress: {
          accountAgeHours: Math.round(accountAgeHours * 10) / 10,
          totalRuns,
          winsToday,
        },
        nextEligibleAt,
      };
    }

    const { data: recentFlags, error: flagsError } = await this.client
      .from('fraud_flags')
      .select('severity, flag_type')
      .eq('user_id', userId)
      .gte('created_at', daysAgo(FRAUD_WINDOW_DAYS).toISOString());

    if (flagsError) this.logger.error('Error checking fraud flags:', flagsError);

    const recentFraudScore = recentFlags?.reduce((sum, f) => sum + f.severity, 0) ?? 0;
    fraudScore += recentFraudScore;

    if (recentFlags && recentFraudScore > 0) {
      flags.push(...recentFlags.map((f) => f.flag_type));
    }

    if (fraudScore >= FRAUD_THRESHOLD) {
      return {
        result: this.ineligible(
          'Your account has been flagged for suspicious activity. Please contact support.',
          fraudScore,
          flags,
        ),
        progress: {
          accountAgeHours: Math.round(accountAgeHours * 10) / 10,
          totalRuns,
          winsToday,
        },
        nextEligibleAt,
      };
    }

    return {
      result: { eligible: true, fraudScore, flags },
      progress: {
        accountAgeHours: Math.round(accountAgeHours * 10) / 10,
        totalRuns,
        winsToday,
      },
      nextEligibleAt,
    };
  }

  /**
   * Checks if user is eligible to win an hourly challenge prize.
   * Rules: account age ≥ 24h, ≥5 runs, ≤3 wins today, fraud score < 6.
   */
  async isEligibleForPrize(userId: string): Promise<EligibilityResult> {
    const { result } = await this.evaluatePrizeEligibility(userId, { recordFlags: true });
    return result;
  }

  async getPrizeEligibilityStatus(userId: string): Promise<PrizeEligibilityStatus> {
    const { result, progress, nextEligibleAt } = await this.evaluatePrizeEligibility(userId, {
      recordFlags: false,
    });
    return {
      ...result,
      requirements: this.eligibilityRequirements(),
      progress,
      nextEligibleAt,
    };
  }

  async canWithdraw(userId: string): Promise<EligibilityResult> {
    const { data: user, error } = await this.client
      .from('users')
      .select('last_withdrawal_at')
      .eq('id', userId)
      .single();

    if (error) return this.ineligible('User not found', 10, ['user_not_found']);

    if (user.last_withdrawal_at) {
      const daysSince = (Date.now() - new Date(user.last_withdrawal_at).getTime()) / 86_400_000;
      if (daysSince < WITHDRAWAL_COOLDOWN_DAYS) {
        const daysRemaining = Math.ceil(WITHDRAWAL_COOLDOWN_DAYS - daysSince);
        await this.createFraudFlag(userId, 'rapid_withdrawal', 2, null, {
          daysSinceLastWithdrawal: Math.round(daysSince * 10) / 10,
        });
        return this.ineligible(
          `Only one withdrawal per week. Wait ${daysRemaining} more day${daysRemaining > 1 ? 's' : ''}.`,
          2,
          ['rapid_withdrawal'],
        );
      }
    }

    return { eligible: true, fraudScore: 0, flags: [] };
  }

  private async createFraudFlag(
    userId: string,
    flagType: string,
    severity: number,
    referenceId: string | null,
    metadata: any,
  ): Promise<void> {
    const { error } = await this.client.from('fraud_flags').insert({
      user_id: userId,
      flag_type: flagType,
      severity,
      reference_id: referenceId,
      metadata,
    });
    if (error) this.logger.error('Error creating fraud flag:', error);
  }

  async updateLastWithdrawal(userId: string): Promise<void> {
    const { error } = await this.client
      .from('users')
      .update({ last_withdrawal_at: new Date().toISOString() })
      .eq('id', userId);
    if (error) this.logger.error('Error updating last withdrawal:', error);
  }

  async getUserFraudFlags(userId: string, limit = 50): Promise<FraudFlag[]> {
    const { data, error } = await this.client
      .from('fraud_flags')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      this.logger.error('Error fetching fraud flags:', error);
      return [];
    }
    return (data ?? []) as FraudFlag[];
  }

  async calculateFraudScore(userId: string): Promise<number> {
    const { data } = await this.client
      .from('fraud_flags')
      .select('severity')
      .eq('user_id', userId)
      .gte('created_at', daysAgo(FRAUD_WINDOW_DAYS).toISOString());

    return data?.reduce((sum, f) => sum + f.severity, 0) ?? 0;
  }
}
