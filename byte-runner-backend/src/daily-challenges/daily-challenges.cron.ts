import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DailyChallengesService } from './daily-challenges.service';
import { BalanceService } from '../balance/balance.service';
import { FraudPreventionService } from '../fraud-prevention/fraud-prevention.service';

/** Points awarded to the daily top 3 (1 point = 1 cent). */
const DAILY_POINT_TIERS = [100, 50, 25];

@Injectable()
export class DailyChallengesCron {
  private readonly logger = new Logger(DailyChallengesCron.name);

  constructor(
    private readonly dailyChallengesService: DailyChallengesService,
    private readonly balanceService: BalanceService,
    private readonly fraudPreventionService: FraudPreventionService,
  ) {}

  /** Shortly after UTC midnight: close yesterday (award points), ensure today exists. */
  @Cron('5 0 * * *')
  async processDailyChallenge() {
    try {
      const yesterday = new Date();
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      const dateKey = yesterday.toISOString().slice(0, 10);

      await this.dailyChallengesService.closeOutDay(
        dateKey,
        async (userId, points, reason) => {
          try {
            const challenge = await this.dailyChallengesService.getByDate(dateKey);
            await this.balanceService.addBalance(userId, points, 'daily_challenge', challenge?.id ?? dateKey, reason);
            return true;
          } catch (error) {
            this.logger.error(`Failed to award ${points} pts to ${userId}:`, error);
            return false;
          }
        },
        async (userId) => this.fraudPreventionService.isEligibleForPrize(userId),
      );

      await this.dailyChallengesService.getOrCreateChallengeByDate(
        this.dailyChallengesService.todayKey(),
      );
      this.logger.log(`Daily rollover complete (closed ${dateKey})`);
    } catch (error) {
      this.logger.error('Error processing daily challenge:', error);
    }
  }
}

export { DAILY_POINT_TIERS };
