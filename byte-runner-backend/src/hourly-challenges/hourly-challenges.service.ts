import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SupabaseService } from '../supabase/supabase.service';
import { BalanceService } from '../balance/balance.service';
import { FraudPreventionService } from '../fraud-prevention/fraud-prevention.service';

export interface HourlyChallenge {
  id: string;
  challenge_hour: string;
  status: string;
  winner_user_id: string | null;
  winner_run_id: string | null;
  winner_score: number | null;
  winner_distance: number | null;
  created_at: string;
  ended_at: string | null;
}

export interface UserHourlyEntry {
  run_id: string;
  score: number;
  distance: number;
  created_at: string;
}

@Injectable()
export class HourlyChallengesService {
  private readonly logger = new Logger(HourlyChallengesService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly balanceService: BalanceService,
    private readonly fraudPreventionService: FraudPreventionService
  ) {}

  private get client() {
    return this.supabaseService.getClient();
  }

  async getCurrentChallenge(): Promise<HourlyChallenge | null> {
    // Get current hour (rounded down)
    const currentHour = new Date();
    currentHour.setMinutes(0, 0, 0);

    const { data, error } = await this.client
      .from('hourly_challenges')
      .select('*')
      .eq('challenge_hour', currentHour.toISOString())
      .single();

    if (error && error.code !== 'PGRST116') {
      this.logger.error('Error fetching current challenge:', error);
      return null;
    }

    return data as HourlyChallenge | null;
  }

  async createCurrentChallenge(): Promise<HourlyChallenge> {
    // Get current hour (rounded down)
    const currentHour = new Date();
    currentHour.setMinutes(0, 0, 0);

    const { data, error } = await this.client
      .from('hourly_challenges')
      .insert({
        challenge_hour: currentHour.toISOString(),
        status: 'active'
      })
      .select('*')
      .single();

    if (error) {
      this.logger.error('Error creating challenge:', error);
      throw new Error('Failed to create challenge');
    }

    return data as HourlyChallenge;
  }

  async getUserEntriesForChallenge(userId: string, challengeHour: string): Promise<UserHourlyEntry[]> {
    const hourStart = new Date(challengeHour);
    const hourEnd = new Date(hourStart);
    hourEnd.setHours(hourEnd.getHours() + 1);

    const { data, error } = await this.client
      .from('runs')
      .select('id, score, distance, created_at')
      .eq('user_id', userId)
      .gte('created_at', hourStart.toISOString())
      .lt('created_at', hourEnd.toISOString())
      .order('score', { ascending: false })
      .order('distance', { ascending: false })
      .limit(10);

    if (error) {
      this.logger.error('Error fetching user entries:', error);
      return [];
    }

    return (data || []).map(d => ({
      run_id: d.id,
      score: d.score,
      distance: d.distance,
      created_at: d.created_at
    }));
  }

  async getLeaderboardForChallenge(challengeHour: string, limit: number = 10): Promise<any[]> {
    const hourStart = new Date(challengeHour);
    const hourEnd = new Date(hourStart);
    hourEnd.setHours(hourEnd.getHours() + 1);

    // Get best run per user in this hour
    const { data, error } = await this.client
      .from('runs')
      .select('user_id, score, distance, created_at, users(username)')
      .gte('created_at', hourStart.toISOString())
      .lt('created_at', hourEnd.toISOString())
      .order('score', { ascending: false })
      .order('distance', { ascending: false })
      .limit(100); // Get more to deduplicate users

    if (error) {
      this.logger.error('Error fetching leaderboard:', error);
      return [];
    }

    // Deduplicate by user_id (keep best score per user)
    const userBestRuns = new Map();
    for (const run of data || []) {
      if (!userBestRuns.has(run.user_id)) {
        userBestRuns.set(run.user_id, run);
      }
    }

    return Array.from(userBestRuns.values()).slice(0, limit);
  }

  @Cron('0 * * * *') // Every hour at :00
  async processHourlyChallenge() {
    this.logger.log('Starting hourly challenge processing...');

    try {
      // Calculate previous hour
      const previousHour = new Date();
      previousHour.setHours(previousHour.getHours() - 1);
      previousHour.setMinutes(0, 0, 0);

      const hourStart = previousHour.toISOString();
      const hourEnd = new Date(previousHour);
      hourEnd.setHours(hourEnd.getHours() + 1);

      // Find or create challenge record for previous hour
      const { data: existingChallenge } = await this.client
        .from('hourly_challenges')
        .select('*')
        .eq('challenge_hour', hourStart)
        .single();

      let challengeId: string;

      if (!existingChallenge) {
        // Create challenge record
        const { data: newChallenge, error: createError } = await this.client
          .from('hourly_challenges')
          .insert({
            challenge_hour: hourStart,
            status: 'active'
          })
          .select('*')
          .single();

        if (createError || !newChallenge) {
          this.logger.error('Failed to create challenge:', createError);
          return;
        }

        challengeId = newChallenge.id;
      } else if (existingChallenge.status === 'paid') {
        this.logger.log(`Challenge ${existingChallenge.id} already paid, skipping`);
        return;
      } else {
        challengeId = existingChallenge.id;
      }

      // Find winner (highest score in that hour)
      const { data: winnerRun, error: winnerError } = await this.client
        .from('runs')
        .select('id, user_id, score, distance')
        .gte('created_at', hourStart)
        .lt('created_at', hourEnd.toISOString())
        .order('score', { ascending: false })
        .order('distance', { ascending: false })
        .limit(1)
        .single();

      if (winnerError || !winnerRun) {
        this.logger.log(`No winner for hour ${hourStart} - no runs found`);
        
        // Mark as ended with no winner
        await this.client
          .from('hourly_challenges')
          .update({
            status: 'ended',
            ended_at: new Date().toISOString()
          })
          .eq('id', challengeId);

        // Continue to create next hour challenge (don't return early)
      } else {
        // Check eligibility before awarding prize
        this.logger.log(`Winner found: User ${winnerRun.user_id} with score ${winnerRun.score}`);

        const eligibility = await this.fraudPreventionService.isEligibleForPrize(winnerRun.user_id);

        if (!eligibility.eligible) {
          this.logger.warn(
            `User ${winnerRun.user_id} is not eligible for prize. ` +
            `Reason: ${eligibility.reason}. Fraud score: ${eligibility.fraudScore}`
          );

          // Mark challenge as ended without paying
          await this.client
            .from('hourly_challenges')
            .update({
              status: 'ended',
              winner_user_id: winnerRun.user_id,
              winner_run_id: winnerRun.id,
              winner_score: winnerRun.score,
              winner_distance: winnerRun.distance,
              ended_at: new Date().toISOString()
            })
            .eq('id', challengeId);

          this.logger.log(`Challenge ${challengeId} ended without payment due to eligibility failure`);
        } else {
          // Award $1 (100 cents) to eligible winner
          this.logger.log(`User ${winnerRun.user_id} passed eligibility check (fraud score: ${eligibility.fraudScore})`);

          await this.balanceService.addBalance(
            winnerRun.user_id,
            100, // $1.00
            'hourly_challenge',
            challengeId,
            `Hourly Challenge Winner - ${new Date(hourStart).toLocaleString()}`
          );

          // Update challenge with winner info
          await this.client
            .from('hourly_challenges')
            .update({
              status: 'paid',
              winner_user_id: winnerRun.user_id,
              winner_run_id: winnerRun.id,
              winner_score: winnerRun.score,
              winner_distance: winnerRun.distance,
              ended_at: new Date().toISOString()
            })
            .eq('id', challengeId);

          this.logger.log(`Successfully processed and paid hourly challenge ${challengeId}`);
        }
      }

      // Always create challenge for current hour if it doesn't exist
      const currentHour = new Date();
      currentHour.setMinutes(0, 0, 0);

      const { data: currentChallenge } = await this.client
        .from('hourly_challenges')
        .select('id')
        .eq('challenge_hour', currentHour.toISOString())
        .single();

      if (!currentChallenge) {
        await this.client
          .from('hourly_challenges')
          .insert({
            challenge_hour: currentHour.toISOString(),
            status: 'active'
          });

        this.logger.log(`Created challenge for current hour ${currentHour.toISOString()}`);
      }

    } catch (error) {
      this.logger.error('Error processing hourly challenge:', error);
    }
  }

  // Admin function to get all challenges
  async getAllChallenges(limit: number = 50): Promise<HourlyChallenge[]> {
    const { data, error } = await this.client
      .from('hourly_challenges')
      .select('*')
      .order('challenge_hour', { ascending: false })
      .limit(limit);

    if (error) {
      this.logger.error('Error fetching all challenges:', error);
      return [];
    }

    return (data || []) as HourlyChallenge[];
  }
}
