import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

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

@Injectable()
export class FraudPreventionService {
  private readonly logger = new Logger(FraudPreventionService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  private get client() {
    return this.supabaseService.getClient();
  }

  /**
   * Check if user is eligible to win prizes in hourly challenges
   * Phase 1 checks:
   * 1. Account age > 24 hours
   * 2. Minimum 5 completed runs
   * 3. Can't win more than 3 times per day (12.5% max win rate)
   * 4. Fraud score < 6
   */
  async isEligibleForPrize(userId: string): Promise<EligibilityResult> {
    const flags: string[] = [];
    let fraudScore = 0;

    // 1. Check account age (must be 24+ hours old)
    const { data: user, error: userError } = await this.client
      .from('users')
      .select('created_at')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return {
        eligible: false,
        reason: 'User not found',
        fraudScore: 10,
        flags: ['user_not_found']
      };
    }

    const accountAgeHours = (Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60);
    
    if (accountAgeHours < 24) {
      flags.push('new_account');
      fraudScore += 2;
      
      // Auto-flag new accounts
      await this.createFraudFlag(userId, 'new_account', 2, null, {
        accountAgeHours: Math.round(accountAgeHours * 10) / 10
      });
      
      return {
        eligible: false,
        reason: `Account must be at least 24 hours old. Your account is ${Math.round(accountAgeHours)} hours old.`,
        fraudScore,
        flags
      };
    }

    // 2. Check minimum runs (must have 5+ completed runs)
    const { count: totalRuns, error: countError } = await this.client
      .from('runs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (countError || totalRuns === null || totalRuns < 5) {
      flags.push('insufficient_runs');
      fraudScore += 1;
      
      return {
        eligible: false,
        reason: `You must complete at least 5 games to be eligible. You have ${totalRuns || 0} games.`,
        fraudScore,
        flags
      };
    }

    // 3. Check daily win limit (max 3 wins per day = 12.5% win rate cap)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    
    const { data: todayWins, error: winsError } = await this.client
      .from('balance_transactions')
      .select('id')
      .eq('user_id', userId)
      .eq('type', 'hourly_challenge')
      .gte('created_at', todayStart.toISOString());

    if (winsError) {
      this.logger.error('Error checking daily wins:', winsError);
    }

    const winsToday = todayWins?.length || 0;

    if (winsToday >= 3) {
      flags.push('multiple_wins_today');
      fraudScore += 3;
      
      // Flag suspicious win rate
      await this.createFraudFlag(userId, 'multiple_wins', 3, null, {
        winsToday,
        date: todayStart.toISOString()
      });
      
      return {
        eligible: false,
        reason: `Maximum 3 wins per day reached. You've won ${winsToday} times today. Try again tomorrow!`,
        fraudScore,
        flags
      };
    }

    // 4. Check existing fraud flags in last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    const { data: recentFlags, error: flagsError } = await this.client
      .from('fraud_flags')
      .select('severity, flag_type')
      .eq('user_id', userId)
      .gte('created_at', sevenDaysAgo.toISOString());

    if (flagsError) {
      this.logger.error('Error checking fraud flags:', flagsError);
    }

    const recentFraudScore = recentFlags?.reduce((sum, flag) => sum + flag.severity, 0) || 0;
    fraudScore += recentFraudScore;

    if (recentFraudScore > 0 && recentFlags) {
      flags.push(...recentFlags.map(f => f.flag_type));
    }

    // 5. Final fraud score check
    if (fraudScore >= 6) {
      this.logger.warn(`User ${userId} failed fraud check with score ${fraudScore}`);
      
      return {
        eligible: false,
        reason: 'Your account has been flagged for suspicious activity. Please contact support.',
        fraudScore,
        flags
      };
    }

    // All checks passed
    this.logger.log(`User ${userId} passed eligibility check (fraud score: ${fraudScore})`);
    
    return {
      eligible: true,
      fraudScore,
      flags
    };
  }

  /**
   * Check if user can make a withdrawal
   * Phase 1 checks:
   * 1. Max 1 withdrawal per week
   */
  async canWithdraw(userId: string): Promise<EligibilityResult> {
    const flags: string[] = [];
    let fraudScore = 0;

    // Check last withdrawal time
    const { data: user, error: userError } = await this.client
      .from('users')
      .select('last_withdrawal_at')
      .eq('id', userId)
      .single();

    if (userError) {
      return {
        eligible: false,
        reason: 'User not found',
        fraudScore: 10,
        flags: ['user_not_found']
      };
    }

    if (user.last_withdrawal_at) {
      const lastWithdrawal = new Date(user.last_withdrawal_at);
      const daysSinceLastWithdrawal = (Date.now() - lastWithdrawal.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysSinceLastWithdrawal < 7) {
        const daysRemaining = Math.ceil(7 - daysSinceLastWithdrawal);
        flags.push('rapid_withdrawal');
        fraudScore += 2;
        
        await this.createFraudFlag(userId, 'rapid_withdrawal', 2, null, {
          daysSinceLastWithdrawal: Math.round(daysSinceLastWithdrawal * 10) / 10
        });
        
        return {
          eligible: false,
          reason: `You can only withdraw once per week. Please wait ${daysRemaining} more day${daysRemaining > 1 ? 's' : ''}.`,
          fraudScore,
          flags
        };
      }
    }

    return {
      eligible: true,
      fraudScore,
      flags
    };
  }

  /**
   * Create a fraud flag record
   */
  private async createFraudFlag(
    userId: string,
    flagType: string,
    severity: number,
    referenceId: string | null,
    metadata: any
  ): Promise<void> {
    const { error } = await this.client
      .from('fraud_flags')
      .insert({
        user_id: userId,
        flag_type: flagType,
        severity,
        reference_id: referenceId,
        metadata
      });

    if (error) {
      this.logger.error('Error creating fraud flag:', error);
    }
  }

  /**
   * Update last withdrawal timestamp
   */
  async updateLastWithdrawal(userId: string): Promise<void> {
    const { error } = await this.client
      .from('users')
      .update({ last_withdrawal_at: new Date().toISOString() })
      .eq('id', userId);

    if (error) {
      this.logger.error('Error updating last withdrawal:', error);
    }
  }

  /**
   * Get user's fraud flags (admin function)
   */
  async getUserFraudFlags(userId: string, limit: number = 50): Promise<FraudFlag[]> {
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

    return (data || []) as FraudFlag[];
  }

  /**
   * Calculate current fraud score (admin function)
   */
  async calculateFraudScore(userId: string): Promise<number> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    const { data: recentFlags } = await this.client
      .from('fraud_flags')
      .select('severity')
      .eq('user_id', userId)
      .gte('created_at', sevenDaysAgo.toISOString());

    return recentFlags?.reduce((sum, flag) => sum + flag.severity, 0) || 0;
  }
}
