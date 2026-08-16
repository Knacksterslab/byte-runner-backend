import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DailyChallengesService } from './daily-challenges.service';

@Injectable()
export class DailyChallengesCron {
  private readonly logger = new Logger(DailyChallengesCron.name);

  constructor(private readonly dailyChallengesService: DailyChallengesService) {}

  /** Shortly after UTC midnight: close yesterday, ensure today exists. */
  @Cron('5 0 * * *')
  async processDailyChallenge() {
    try {
      const yesterday = new Date();
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      const dateKey = yesterday.toISOString().slice(0, 10);
      await this.dailyChallengesService.closeOutDay(dateKey);
      await this.dailyChallengesService.getOrCreateChallengeByDate(
        this.dailyChallengesService.todayKey(),
      );
      this.logger.log(`Daily challenge rollover complete (closed ${dateKey})`);
    } catch (error) {
      this.logger.error('Error processing daily challenge:', error);
    }
  }
}
