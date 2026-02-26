import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { daysAgo } from '../common/utils/date.util';
import { ContestsService } from './contests.service';
import { ContestsLeaderboardService } from './contests-leaderboard.service';
import { PrizeClaimsService } from '../prize-claims/prize-claims.service';
import { BalanceService } from '../balance/balance.service';

@Injectable()
export class ContestsCron {
  private readonly logger = new Logger(ContestsCron.name);

  constructor(
    private readonly contestsService: ContestsService,
    private readonly leaderboardService: ContestsLeaderboardService,
    private readonly prizeClaimsService: PrizeClaimsService,
    private readonly balanceService: BalanceService,
  ) {}

  private parsePrizeAmount(prizeString: string): number {
    const match = prizeString.match(/\$?([\d.]+)/);
    return match ? Math.round(parseFloat(match[1]) * 100) : 0;
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async checkAndUpdateContests() {
    try {
      await this.startUpcomingContests();
      await this.finishExpiredContests();
      // Only re-check contests ended in last 7 days to avoid growing unbounded
      await this.recoverEndedContests();
    } catch (error) {
      this.logger.error('Contest status check failed:', error);
    }
  }

  private async startUpcomingContests() {
    const contests = await this.contestsService.getContestsToStart();
    for (const contest of contests) {
      try {
        await this.contestsService.updateContest(contest.id, { status: 'active' });
        this.logger.log(`Started contest: "${contest.name}" (${contest.id})`);
      } catch (error) {
        this.logger.error(`Failed to start contest ${contest.id}:`, error);
      }
    }
  }

  private async finishExpiredContests() {
    const expired = await this.contestsService.getExpiredActiveContests();
    for (const contest of expired) {
      await this.finishContest(contest.id, contest.name);
    }
  }

  private async recoverEndedContests() {
    const ended = await this.contestsService.getEndedContests(daysAgo(7));
    for (const contest of ended) {
      await this.ensurePrizeClaimsExist(contest.id, contest.name);
    }
  }

  /**
   * Award prizes to eligible ranked entries that don't yet have a claim.
   * Returns the number of new prizes awarded.
   */
  private async awardMissingPrizes(
    contestId: string,
    contestName: string,
    prizePool: Record<string, string> | null,
  ): Promise<number> {
    if (!prizePool || Object.keys(prizePool).length === 0) return 0;

    const leaderboard = await this.leaderboardService.getContestLeaderboard(contestId, 100);
    let awarded = 0;

    for (const entry of leaderboard) {
      const prize = this.leaderboardService.getPrizeForRank(entry.rank, prizePool);
      if (!prize) continue;

      try {
        const existingClaim = await this.prizeClaimsService.getUserClaimForContest(contestId, entry.userId);
        if (existingClaim) continue;

        const amountCents = this.parsePrizeAmount(prize);
        if (amountCents <= 0) {
          this.logger.warn(`Cannot parse prize amount "${prize}" for rank #${entry.rank} in "${contestName}"`);
          continue;
        }

        await this.balanceService.addBalance(
          entry.userId,
          amountCents,
          'contest_prize',
          contestId,
          `Contest Prize - "${contestName}" (Rank #${entry.rank}): ${prize}`,
        );

        await this.prizeClaimsService.createPrizeClaim(contestId, entry.userId, entry.rank, prize);
        awarded++;
        this.logger.log(`Awarded ${prize} to ${entry.username} (Rank #${entry.rank}) in "${contestName}"`);
      } catch (error) {
        this.logger.error(`Failed to award prize to ${entry.username} in "${contestName}":`, error);
      }
    }

    return awarded;
  }

  private async finishContest(contestId: string, contestName: string) {
    try {
      const contest = await this.contestsService.getContestById(contestId);
      if (!contest) return;

      const awarded = await this.awardMissingPrizes(contestId, contestName, contest.prize_pool);
      await this.contestsService.updateContest(contestId, { status: 'ended' });
      this.logger.log(`Contest "${contestName}" finished. Awarded ${awarded} prize(s).`);
    } catch (error) {
      this.logger.error(`Failed to finish contest "${contestName}" (${contestId}):`, error);
    }
  }

  private async ensurePrizeClaimsExist(contestId: string, contestName: string) {
    try {
      const contest = await this.contestsService.getContestById(contestId);
      if (!contest) return;

      const awarded = await this.awardMissingPrizes(contestId, contestName, contest.prize_pool);
      if (awarded > 0) {
        this.logger.log(`Recovered ${awarded} missing prize claim(s) for "${contestName}"`);
      }
    } catch (error) {
      this.logger.error(`Failed to recover prizes for "${contestName}" (${contestId}):`, error);
    }
  }
}
