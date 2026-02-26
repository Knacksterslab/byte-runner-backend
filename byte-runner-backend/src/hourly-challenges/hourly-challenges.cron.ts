import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { HourlyChallengesService } from './hourly-challenges.service';
import { BalanceService } from '../balance/balance.service';
import { FraudPreventionService } from '../fraud-prevention/fraud-prevention.service';
import { startOfPreviousHour } from '../common/utils/date.util';

@Injectable()
export class HourlyChallengesCron {
  private readonly logger = new Logger(HourlyChallengesCron.name);

  constructor(
    private readonly hourlyChallengesService: HourlyChallengesService,
    private readonly balanceService: BalanceService,
    private readonly fraudPreventionService: FraudPreventionService,
  ) {}

  @Cron('0 * * * *')
  async processHourlyChallenge() {
    try {
      await this.processPreviousHour();
      await this.hourlyChallengesService.ensureCurrentHourExists();
    } catch (error) {
      this.logger.error('Error processing hourly challenge:', error);
    }
  }

  private async processPreviousHour() {
    const previousHour = startOfPreviousHour();
    const hourStart = previousHour.toISOString();
    const hourEnd = new Date(previousHour);
    hourEnd.setHours(hourEnd.getHours() + 1);

    const challenge = await this.hourlyChallengesService.getOrCreateChallengeByHour(hourStart);
    if (!challenge || challenge.status === 'paid') return;

    const winnerRun = await this.hourlyChallengesService.getTopRunForHour(hourStart, hourEnd.toISOString());

    if (!winnerRun) {
      await this.hourlyChallengesService.updateChallengeOutcome(challenge.id, 'ended');
      return;
    }

    const winner = { user_id: winnerRun.user_id, run_id: winnerRun.id, score: winnerRun.score, distance: winnerRun.distance };
    const eligibility = await this.fraudPreventionService.isEligibleForPrize(winnerRun.user_id);

    if (!eligibility.eligible) {
      this.logger.warn(`Winner ${winnerRun.user_id} ineligible: ${eligibility.reason}`);
      await this.hourlyChallengesService.updateChallengeOutcome(challenge.id, 'ended', winner);
      return;
    }

    await this.balanceService.addBalance(
      winnerRun.user_id,
      100,
      'hourly_challenge',
      challenge.id,
      `Hourly Challenge Winner - ${new Date(hourStart).toLocaleString()}`,
    );

    await this.hourlyChallengesService.updateChallengeOutcome(challenge.id, 'paid', winner);
    this.logger.log(`Paid $1 to winner ${winnerRun.user_id} for challenge ${challenge.id}`);
  }
}
