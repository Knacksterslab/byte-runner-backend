/**
 * Fraud Prevention Test Script
 * 
 * Tests all Phase 1 anti-fraud checks including edge cases.
 * Run with: npx ts-node test-fraud-prevention.ts
 */

import { config } from 'dotenv';
import { SupabaseClient, createClient } from '@supabase/supabase-js';

// Load environment variables
config();

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

interface TestResult {
  test: string;
  passed: boolean;
  message: string;
  details?: any;
}

class FraudPreventionTester {
  private supabase: SupabaseClient;
  private results: TestResult[] = [];
  private testUserIds: string[] = [];

  constructor() {
    if (!SUPABASE_SERVICE_KEY) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable is required');
    }
    
    this.supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  }

  private async log(message: string) {
    console.log(`\n📝 ${message}`);
  }

  private async pass(test: string, message: string, details?: any) {
    this.results.push({ test, passed: true, message, details });
    console.log(`  ✅ ${message}`);
  }

  private async fail(test: string, message: string, details?: any) {
    this.results.push({ test, passed: false, message, details });
    console.log(`  ❌ ${message}`);
  }

  private async createTestUser(
    username: string,
    email: string,
    createdAt?: Date
  ): Promise<string> {
    const { data, error } = await this.supabase
      .from('users')
      .insert({
        supertokens_id: `test_${Date.now()}_${Math.random()}`,
        username,
        email,
        created_at: createdAt?.toISOString() || new Date().toISOString()
      })
      .select('id')
      .single();

    if (error) throw error;
    this.testUserIds.push(data.id);
    return data.id;
  }

  private async createRuns(userId: string, count: number) {
    const runs = Array.from({ length: count }, (_, i) => ({
      user_id: userId,
      score: 1000 + i * 100,
      distance: 500 + i * 50,
      duration_ms: 60000
    }));

    const { error } = await this.supabase.from('runs').insert(runs);
    if (error) throw error;
  }

  private async createBalanceTransaction(
    userId: string,
    type: string,
    amountCents: number
  ) {
    const { error } = await this.supabase.from('balance_transactions').insert({
      user_id: userId,
      amount_cents: amountCents,
      type,
      description: `Test transaction - ${type}`
    });

    if (error) throw error;

    // Also update user balance
    await this.supabase.rpc('increment_balance', {
      user_id: userId,
      amount: amountCents
    });
  }

  private async setLastWithdrawal(userId: string, daysAgo: number) {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);

    const { error } = await this.supabase
      .from('users')
      .update({ last_withdrawal_at: date.toISOString() })
      .eq('id', userId);

    if (error) throw error;
  }

  // ============================================
  // TEST 1: Account Age Check
  // ============================================
  async testAccountAge() {
    await this.log('TEST 1: Account Age Check (24 hour requirement)');

    // Test 1a: New account (should fail)
    try {
      const newUserId = await this.createTestUser(
        'newuser_test',
        'newuser@test.com'
      );
      
      const { data: user } = await this.supabase
        .from('users')
        .select('created_at')
        .eq('id', newUserId)
        .single();

      if (!user) throw new Error('User not found');

      const ageHours = (Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60);
      
      if (ageHours < 24) {
        await this.pass(
          'Account Age: New Account',
          `New account correctly identified (age: ${ageHours.toFixed(2)}h)`
        );
      } else {
        await this.fail(
          'Account Age: New Account',
          `New account not detected (age: ${ageHours.toFixed(2)}h)`
        );
      }
    } catch (error) {
      await this.fail('Account Age: New Account', error.message);
    }

    // Test 1b: 23 hour old account (should fail - edge case)
    try {
      const almostOldEnough = new Date();
      almostOldEnough.setHours(almostOldEnough.getHours() - 23);
      
      const almostUserId = await this.createTestUser(
        'almost24h_test',
        'almost24h@test.com',
        almostOldEnough
      );

      const { data: user } = await this.supabase
        .from('users')
        .select('created_at')
        .eq('id', almostUserId)
        .single();

      if (!user) throw new Error('User not found');

      const ageHours = (Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60);
      
      if (ageHours < 24) {
        await this.pass(
          'Account Age: 23h Edge Case',
          `23h account correctly rejected (age: ${ageHours.toFixed(2)}h)`
        );
      } else {
        await this.fail(
          'Account Age: 23h Edge Case',
          `Edge case failed (age: ${ageHours.toFixed(2)}h)`
        );
      }
    } catch (error) {
      await this.fail('Account Age: 23h Edge Case', error.message);
    }

    // Test 1c: 25 hour old account (should pass)
    try {
      const oldEnough = new Date();
      oldEnough.setHours(oldEnough.getHours() - 25);
      
      const oldUserId = await this.createTestUser(
        'old_test',
        'old@test.com',
        oldEnough
      );

      const { data: user } = await this.supabase
        .from('users')
        .select('created_at')
        .eq('id', oldUserId)
        .single();

      if (!user) throw new Error('User not found');

      const ageHours = (Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60);
      
      if (ageHours >= 24) {
        await this.pass(
          'Account Age: 25h Old Account',
          `Old account correctly accepted (age: ${ageHours.toFixed(2)}h)`
        );
      } else {
        await this.fail(
          'Account Age: 25h Old Account',
          `Old account rejected (age: ${ageHours.toFixed(2)}h)`
        );
      }
    } catch (error) {
      await this.fail('Account Age: 25h Old Account', error.message);
    }
  }

  // ============================================
  // TEST 2: Minimum Runs Check
  // ============================================
  async testMinimumRuns() {
    await this.log('TEST 2: Minimum Runs Check (5 games requirement)');

    const oldAccount = new Date();
    oldAccount.setDate(oldAccount.getDate() - 2); // 2 days old

    // Test 2a: 0 runs (should fail)
    try {
      const noRunsUserId = await this.createTestUser(
        'noruns_test',
        'noruns@test.com',
        oldAccount
      );

      const { count } = await this.supabase
        .from('runs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', noRunsUserId);

      if (count === 0) {
        await this.pass(
          'Min Runs: Zero Runs',
          `User with 0 runs correctly identified`
        );
      } else {
        await this.fail(
          'Min Runs: Zero Runs',
          `Expected 0 runs, got ${count}`
        );
      }
    } catch (error) {
      await this.fail('Min Runs: Zero Runs', error.message);
    }

    // Test 2b: 4 runs (should fail - edge case)
    try {
      const fourRunsUserId = await this.createTestUser(
        'fourruns_test',
        'fourruns@test.com',
        oldAccount
      );
      await this.createRuns(fourRunsUserId, 4);

      const { count } = await this.supabase
        .from('runs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', fourRunsUserId);

      if (count === 4) {
        await this.pass(
          'Min Runs: 4 Runs Edge Case',
          `User with 4 runs correctly rejected`
        );
      } else {
        await this.fail(
          'Min Runs: 4 Runs Edge Case',
          `Expected 4 runs, got ${count}`
        );
      }
    } catch (error) {
      await this.fail('Min Runs: 4 Runs Edge Case', error.message);
    }

    // Test 2c: Exactly 5 runs (should pass)
    try {
      const fiveRunsUserId = await this.createTestUser(
        'fiveruns_test',
        'fiveruns@test.com',
        oldAccount
      );
      await this.createRuns(fiveRunsUserId, 5);

      const { count } = await this.supabase
        .from('runs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', fiveRunsUserId);

      if (count === 5) {
        await this.pass(
          'Min Runs: Exactly 5 Runs',
          `User with exactly 5 runs correctly accepted`
        );
      } else {
        await this.fail(
          'Min Runs: Exactly 5 Runs',
          `Expected 5 runs, got ${count}`
        );
      }
    } catch (error) {
      await this.fail('Min Runs: Exactly 5 Runs', error.message);
    }

    // Test 2d: 10 runs (should pass)
    try {
      const tenRunsUserId = await this.createTestUser(
        'tenruns_test',
        'tenruns@test.com',
        oldAccount
      );
      await this.createRuns(tenRunsUserId, 10);

      const { count } = await this.supabase
        .from('runs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', tenRunsUserId);

      if (count === 10) {
        await this.pass(
          'Min Runs: 10 Runs',
          `User with 10 runs correctly accepted`
        );
      } else {
        await this.fail(
          'Min Runs: 10 Runs',
          `Expected 10 runs, got ${count}`
        );
      }
    } catch (error) {
      await this.fail('Min Runs: 10 Runs', error.message);
    }
  }

  // ============================================
  // TEST 3: Daily Win Limit Check
  // ============================================
  async testDailyWinLimit() {
    await this.log('TEST 3: Daily Win Limit (3 wins per day max)');

    const oldAccount = new Date();
    oldAccount.setDate(oldAccount.getDate() - 2);

    // Test 3a: 0 wins today (should pass)
    try {
      const noWinsUserId = await this.createTestUser(
        'nowins_test',
        'nowins@test.com',
        oldAccount
      );
      await this.createRuns(noWinsUserId, 5);

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const { data: todayWins } = await this.supabase
        .from('balance_transactions')
        .select('id')
        .eq('user_id', noWinsUserId)
        .eq('type', 'hourly_challenge')
        .gte('created_at', todayStart.toISOString());

      if (!todayWins) throw new Error('Failed to fetch wins');

      if (todayWins.length === 0) {
        await this.pass(
          'Daily Wins: Zero Wins',
          `User with 0 wins today correctly identified`
        );
      } else {
        await this.fail(
          'Daily Wins: Zero Wins',
          `Expected 0 wins, got ${todayWins.length}`
        );
      }
    } catch (error) {
      await this.fail('Daily Wins: Zero Wins', error.message);
    }

    // Test 3b: 2 wins today (should pass)
    try {
      const twoWinsUserId = await this.createTestUser(
        'twowins_test',
        'twowins@test.com',
        oldAccount
      );
      await this.createRuns(twoWinsUserId, 5);
      await this.createBalanceTransaction(twoWinsUserId, 'hourly_challenge', 100);
      await this.createBalanceTransaction(twoWinsUserId, 'hourly_challenge', 100);

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const { data: todayWins } = await this.supabase
        .from('balance_transactions')
        .select('id')
        .eq('user_id', twoWinsUserId)
        .eq('type', 'hourly_challenge')
        .gte('created_at', todayStart.toISOString());

      if (!todayWins) throw new Error('Failed to fetch wins');

      if (todayWins.length === 2) {
        await this.pass(
          'Daily Wins: 2 Wins',
          `User with 2 wins today correctly accepted`
        );
      } else {
        await this.fail(
          'Daily Wins: 2 Wins',
          `Expected 2 wins, got ${todayWins.length}`
        );
      }
    } catch (error) {
      await this.fail('Daily Wins: 2 Wins', error.message);
    }

    // Test 3c: Exactly 3 wins today (should fail - edge case)
    try {
      const threeWinsUserId = await this.createTestUser(
        'threewins_test',
        'threewins@test.com',
        oldAccount
      );
      await this.createRuns(threeWinsUserId, 5);
      await this.createBalanceTransaction(threeWinsUserId, 'hourly_challenge', 100);
      await this.createBalanceTransaction(threeWinsUserId, 'hourly_challenge', 100);
      await this.createBalanceTransaction(threeWinsUserId, 'hourly_challenge', 100);

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const { data: todayWins } = await this.supabase
        .from('balance_transactions')
        .select('id')
        .eq('user_id', threeWinsUserId)
        .eq('type', 'hourly_challenge')
        .gte('created_at', todayStart.toISOString());

      if (!todayWins) throw new Error('Failed to fetch wins');

      if (todayWins.length === 3) {
        await this.pass(
          'Daily Wins: 3 Wins Edge Case',
          `User with 3 wins correctly rejected for 4th attempt`
        );
      } else {
        await this.fail(
          'Daily Wins: 3 Wins Edge Case',
          `Expected 3 wins, got ${todayWins.length}`
        );
      }
    } catch (error) {
      await this.fail('Daily Wins: 3 Wins Edge Case', error.message);
    }

    // Test 3d: Wins from yesterday don't count
    try {
      const yesterdayWinsUserId = await this.createTestUser(
        'yesterdaywins_test',
        'yesterdaywins@test.com',
        oldAccount
      );
      await this.createRuns(yesterdayWinsUserId, 5);

      // Create transactions from yesterday
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      await this.supabase.from('balance_transactions').insert([
        {
          user_id: yesterdayWinsUserId,
          amount_cents: 100,
          type: 'hourly_challenge',
          description: 'Yesterday win',
          created_at: yesterday.toISOString()
        },
        {
          user_id: yesterdayWinsUserId,
          amount_cents: 100,
          type: 'hourly_challenge',
          description: 'Yesterday win',
          created_at: yesterday.toISOString()
        }
      ]);

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const { data: todayWins } = await this.supabase
        .from('balance_transactions')
        .select('id')
        .eq('user_id', yesterdayWinsUserId)
        .eq('type', 'hourly_challenge')
        .gte('created_at', todayStart.toISOString());

      if (!todayWins) throw new Error('Failed to fetch wins');

      if (todayWins.length === 0) {
        await this.pass(
          'Daily Wins: Yesterday Wins',
          `Yesterday's wins correctly excluded from today's count`
        );
      } else {
        await this.fail(
          'Daily Wins: Yesterday Wins',
          `Yesterday's wins incorrectly counted: ${todayWins.length}`
        );
      }
    } catch (error) {
      await this.fail('Daily Wins: Yesterday Wins', error.message);
    }
  }

  // ============================================
  // TEST 4: Withdrawal Velocity Check
  // ============================================
  async testWithdrawalVelocity() {
    await this.log('TEST 4: Withdrawal Velocity (1 per week max)');

    const oldAccount = new Date();
    oldAccount.setDate(oldAccount.getDate() - 2);

    // Test 4a: No previous withdrawal (should pass)
    try {
      const noWithdrawalUserId = await this.createTestUser(
        'nowithdrawal_test',
        'nowithdrawal@test.com',
        oldAccount
      );
      await this.createRuns(noWithdrawalUserId, 5);

      const { data: user } = await this.supabase
        .from('users')
        .select('last_withdrawal_at')
        .eq('id', noWithdrawalUserId)
        .single();

      if (!user) throw new Error('User not found');

      if (!user.last_withdrawal_at) {
        await this.pass(
          'Withdrawal Velocity: No Previous',
          `User with no previous withdrawal correctly identified`
        );
      } else {
        await this.fail(
          'Withdrawal Velocity: No Previous',
          `User unexpectedly has withdrawal timestamp`
        );
      }
    } catch (error) {
      await this.fail('Withdrawal Velocity: No Previous', error.message);
    }

    // Test 4b: Withdrew 2 days ago (should fail)
    try {
      const recentWithdrawalUserId = await this.createTestUser(
        'recent_test',
        'recent@test.com',
        oldAccount
      );
      await this.createRuns(recentWithdrawalUserId, 5);
      await this.setLastWithdrawal(recentWithdrawalUserId, 2);

      const { data: user } = await this.supabase
        .from('users')
        .select('last_withdrawal_at')
        .eq('id', recentWithdrawalUserId)
        .single();

      if (!user) throw new Error('User not found');

      const daysSince = (Date.now() - new Date(user.last_withdrawal_at).getTime()) / (1000 * 60 * 60 * 24);

      if (daysSince < 7) {
        await this.pass(
          'Withdrawal Velocity: 2 Days Ago',
          `Recent withdrawal correctly blocked (${daysSince.toFixed(2)} days ago)`
        );
      } else {
        await this.fail(
          'Withdrawal Velocity: 2 Days Ago',
          `Recent withdrawal not detected (${daysSince.toFixed(2)} days)`
        );
      }
    } catch (error) {
      await this.fail('Withdrawal Velocity: 2 Days Ago', error.message);
    }

    // Test 4c: Withdrew exactly 6 days 23 hours ago (should fail - edge case)
    try {
      const almostWeekUserId = await this.createTestUser(
        'almostweek_test',
        'almostweek@test.com',
        oldAccount
      );
      await this.createRuns(almostWeekUserId, 5);
      
      const almostWeek = new Date();
      almostWeek.setDate(almostWeek.getDate() - 6);
      almostWeek.setHours(almostWeek.getHours() - 23);

      await this.supabase
        .from('users')
        .update({ last_withdrawal_at: almostWeek.toISOString() })
        .eq('id', almostWeekUserId);

      const { data: user } = await this.supabase
        .from('users')
        .select('last_withdrawal_at')
        .eq('id', almostWeekUserId)
        .single();

      if (!user) throw new Error('User not found');

      const daysSince = (Date.now() - new Date(user.last_withdrawal_at).getTime()) / (1000 * 60 * 60 * 24);

      if (daysSince < 7) {
        await this.pass(
          'Withdrawal Velocity: 6d 23h Edge Case',
          `Almost-week withdrawal correctly rejected (${daysSince.toFixed(2)} days)`
        );
      } else {
        await this.fail(
          'Withdrawal Velocity: 6d 23h Edge Case',
          `Edge case failed (${daysSince.toFixed(2)} days)`
        );
      }
    } catch (error) {
      await this.fail('Withdrawal Velocity: 6d 23h Edge Case', error.message);
    }

    // Test 4d: Withdrew 8 days ago (should pass)
    try {
      const oldWithdrawalUserId = await this.createTestUser(
        'oldwithdrawal_test',
        'oldwithdrawal@test.com',
        oldAccount
      );
      await this.createRuns(oldWithdrawalUserId, 5);
      await this.setLastWithdrawal(oldWithdrawalUserId, 8);

      const { data: user } = await this.supabase
        .from('users')
        .select('last_withdrawal_at')
        .eq('id', oldWithdrawalUserId)
        .single();

      if (!user) throw new Error('User not found');

      const daysSince = (Date.now() - new Date(user.last_withdrawal_at).getTime()) / (1000 * 60 * 60 * 24);

      if (daysSince >= 7) {
        await this.pass(
          'Withdrawal Velocity: 8 Days Ago',
          `Old withdrawal correctly accepted (${daysSince.toFixed(2)} days ago)`
        );
      } else {
        await this.fail(
          'Withdrawal Velocity: 8 Days Ago',
          `Old withdrawal rejected (${daysSince.toFixed(2)} days)`
        );
      }
    } catch (error) {
      await this.fail('Withdrawal Velocity: 8 Days Ago', error.message);
    }
  }

  // ============================================
  // TEST 5: Fraud Score Accumulation
  // ============================================
  async testFraudScoreAccumulation() {
    await this.log('TEST 5: Fraud Score Accumulation (7-day window)');

    const oldAccount = new Date();
    oldAccount.setDate(oldAccount.getDate() - 2);

    // Test 5a: No fraud flags (should pass)
    try {
      const cleanUserId = await this.createTestUser(
        'clean_test',
        'clean@test.com',
        oldAccount
      );
      await this.createRuns(cleanUserId, 5);

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: flags } = await this.supabase
        .from('fraud_flags')
        .select('severity')
        .eq('user_id', cleanUserId)
        .gte('created_at', sevenDaysAgo.toISOString());

      const score = flags?.reduce((sum, flag) => sum + flag.severity, 0) || 0;

      if (score === 0) {
        await this.pass(
          'Fraud Score: Clean Account',
          `Clean account has fraud score of 0`
        );
      } else {
        await this.fail(
          'Fraud Score: Clean Account',
          `Expected score 0, got ${score}`
        );
      }
    } catch (error) {
      await this.fail('Fraud Score: Clean Account', error.message);
    }

    // Test 5b: Score = 5 (should pass)
    try {
      const lowScoreUserId = await this.createTestUser(
        'lowscore_test',
        'lowscore@test.com',
        oldAccount
      );
      await this.createRuns(lowScoreUserId, 5);

      // Create flags totaling 5 points
      await this.supabase.from('fraud_flags').insert([
        {
          user_id: lowScoreUserId,
          flag_type: 'test_flag_1',
          severity: 2
        },
        {
          user_id: lowScoreUserId,
          flag_type: 'test_flag_2',
          severity: 3
        }
      ]);

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: flags } = await this.supabase
        .from('fraud_flags')
        .select('severity')
        .eq('user_id', lowScoreUserId)
        .gte('created_at', sevenDaysAgo.toISOString());

      const score = flags?.reduce((sum, flag) => sum + flag.severity, 0) || 0;

      if (score === 5) {
        await this.pass(
          'Fraud Score: Score = 5 Edge Case',
          `Score of 5 correctly allows participation (below threshold)`
        );
      } else {
        await this.fail(
          'Fraud Score: Score = 5 Edge Case',
          `Expected score 5, got ${score}`
        );
      }
    } catch (error) {
      await this.fail('Fraud Score: Score = 5 Edge Case', error.message);
    }

    // Test 5c: Score = 6 (should fail)
    try {
      const thresholdScoreUserId = await this.createTestUser(
        'threshold_test',
        'threshold@test.com',
        oldAccount
      );
      await this.createRuns(thresholdScoreUserId, 5);

      // Create flags totaling 6 points
      await this.supabase.from('fraud_flags').insert([
        {
          user_id: thresholdScoreUserId,
          flag_type: 'test_flag_1',
          severity: 3
        },
        {
          user_id: thresholdScoreUserId,
          flag_type: 'test_flag_2',
          severity: 3
        }
      ]);

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: flags } = await this.supabase
        .from('fraud_flags')
        .select('severity')
        .eq('user_id', thresholdScoreUserId)
        .gte('created_at', sevenDaysAgo.toISOString());

      const score = flags?.reduce((sum, flag) => sum + flag.severity, 0) || 0;

      if (score >= 6) {
        await this.pass(
          'Fraud Score: Score = 6 Threshold',
          `Score of 6 correctly blocks participation`
        );
      } else {
        await this.fail(
          'Fraud Score: Score = 6 Threshold',
          `Expected score 6+, got ${score}`
        );
      }
    } catch (error) {
      await this.fail('Fraud Score: Score = 6 Threshold', error.message);
    }

    // Test 5d: Old flags beyond 7 days don't count
    try {
      const expiredFlagsUserId = await this.createTestUser(
        'expired_test',
        'expired@test.com',
        oldAccount
      );
      await this.createRuns(expiredFlagsUserId, 5);

      // Create flags older than 7 days
      const nineDaysAgo = new Date();
      nineDaysAgo.setDate(nineDaysAgo.getDate() - 9);

      await this.supabase.from('fraud_flags').insert([
        {
          user_id: expiredFlagsUserId,
          flag_type: 'old_flag',
          severity: 10,
          created_at: nineDaysAgo.toISOString()
        }
      ]);

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: recentFlags } = await this.supabase
        .from('fraud_flags')
        .select('severity')
        .eq('user_id', expiredFlagsUserId)
        .gte('created_at', sevenDaysAgo.toISOString());

      const score = recentFlags?.reduce((sum, flag) => sum + flag.severity, 0) || 0;

      if (score === 0) {
        await this.pass(
          'Fraud Score: Expired Flags',
          `Flags older than 7 days correctly excluded from score`
        );
      } else {
        await this.fail(
          'Fraud Score: Expired Flags',
          `Old flags incorrectly counted: score ${score}`
        );
      }
    } catch (error) {
      await this.fail('Fraud Score: Expired Flags', error.message);
    }
  }

  // ============================================
  // Cleanup
  // ============================================
  async cleanup() {
    await this.log('🧹 Cleaning up test data...');

    try {
      // Delete all test users and cascading data
      if (this.testUserIds.length > 0) {
        const { error } = await this.supabase
          .from('users')
          .delete()
          .in('id', this.testUserIds);

        if (error) throw error;

        console.log(`  Deleted ${this.testUserIds.length} test users`);
      }
    } catch (error) {
      console.log(`  ⚠️  Cleanup error: ${error.message}`);
    }
  }

  // ============================================
  // Run All Tests
  // ============================================
  async runAll() {
    console.log('\n');
    console.log('='.repeat(60));
    console.log('🛡️  FRAUD PREVENTION TEST SUITE');
    console.log('='.repeat(60));

    try {
      await this.testAccountAge();
      await this.testMinimumRuns();
      await this.testDailyWinLimit();
      await this.testWithdrawalVelocity();
      await this.testFraudScoreAccumulation();

      await this.cleanup();

      // Print summary
      console.log('\n');
      console.log('='.repeat(60));
      console.log('📊 TEST RESULTS SUMMARY');
      console.log('='.repeat(60));

      const passed = this.results.filter(r => r.passed).length;
      const failed = this.results.filter(r => !r.passed).length;
      const total = this.results.length;

      console.log(`\nTotal Tests: ${total}`);
      console.log(`✅ Passed: ${passed}`);
      console.log(`❌ Failed: ${failed}`);
      console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);

      if (failed > 0) {
        console.log('\n❌ Failed Tests:');
        this.results
          .filter(r => !r.passed)
          .forEach(r => {
            console.log(`  - ${r.test}: ${r.message}`);
          });
      }

      console.log('\n' + '='.repeat(60) + '\n');

      // Exit with appropriate code
      process.exit(failed > 0 ? 1 : 0);

    } catch (error) {
      console.error('\n❌ Test suite failed:', error);
      await this.cleanup();
      process.exit(1);
    }
  }
}

// Run tests
const tester = new FraudPreventionTester();
tester.runAll();
