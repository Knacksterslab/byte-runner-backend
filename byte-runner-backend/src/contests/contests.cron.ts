import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ContestsService } from './contests.service';
import { PrizeClaimsService } from '../prize-claims/prize-claims.service';

@Injectable()
export class ContestsCron {
  private readonly logger = new Logger(ContestsCron.name);

  constructor(
    private readonly contestsService: ContestsService,
    private readonly prizeClaimsService: PrizeClaimsService,
  ) {}

  // Runs every 5 minutes to quickly detect contest status changes
  @Cron(CronExpression.EVERY_5_MINUTES)
  async checkAndUpdateContests() {
    this.logger.log('Running contest status check...');

    try {
      // Start upcoming contests
      await this.startUpcomingContests();

      // Finish expired contests
      await this.finishExpiredContests();
    } catch (error) {
      this.logger.error('Failed to check/update contests:', error);
    }
  }

  private async startUpcomingContests() {
    try {
      const contestsToStart = await this.contestsService.getContestsToStart();

      if (contestsToStart.length === 0) {
        this.logger.log('No contests to start');
        return;
      }

      this.logger.log(`Found ${contestsToStart.length} contest(s) to start`);

      for (const contest of contestsToStart) {
        try {
          await this.contestsService.updateContest(contest.id, { status: 'active' });
          this.logger.log(`✅ Started contest: "${contest.name}" (${contest.id})`);
        } catch (error) {
          this.logger.error(`Failed to start contest ${contest.id}:`, error);
        }
      }
    } catch (error) {
      this.logger.error('Failed to start upcoming contests:', error);
    }
  }

  private async finishExpiredContests() {
    try {
      const expiredContests = await this.contestsService.getExpiredActiveContests();

      if (expiredContests.length === 0) {
        this.logger.log('No expired contests found');
        return;
      }

      this.logger.log(`Found ${expiredContests.length} expired contest(s)`);

      for (const contest of expiredContests) {
        await this.finishContest(contest.id, contest.name);
      }
    } catch (error) {
      this.logger.error('Failed to finish expired contests:', error);
    }
  }

  private async finishContest(contestId: string, contestName: string) {
    this.logger.log(`Finishing contest: ${contestName} (${contestId})`);

    try {
      // 1. Get contest details
      const contest = await this.contestsService.getContestById(contestId);
      if (!contest) {
        this.logger.warn(`Contest ${contestId} not found`);
        return;
      }

      // 2. Get final leaderboard
      const leaderboard = await this.contestsService.getContestLeaderboard(contestId, 100);

      // 3. Create prize claims for winners
      let claimsCreated = 0;
      for (const entry of leaderboard) {
        const prize = this.contestsService.getPrizeForRank(entry.rank, contest.prize_pool);
        
        if (prize) {
          try {
            // Check if claim already exists to avoid duplicates
            const existingClaim = await this.prizeClaimsService.getUserClaimForContest(
              contestId,
              entry.userId
            );

            if (!existingClaim) {
              await this.prizeClaimsService.createPrizeClaim(
                contestId,
                entry.userId,
                entry.rank,
                prize
              );
              claimsCreated++;
              this.logger.log(`Created prize claim for ${entry.username} (Rank #${entry.rank})`);
            }
          } catch (error) {
            this.logger.error(`Failed to create claim for ${entry.username}:`, error);
          }
        }
      }

      // 4. Mark contest as ended
      await this.contestsService.updateContest(contestId, { status: 'ended' });

      this.logger.log(`✅ Contest "${contestName}" finished! Created ${claimsCreated} prize claims`);

      // TODO: Send email notification to admin
      // TODO: Send email notification to winners

    } catch (error) {
      this.logger.error(`Failed to finish contest ${contestId}:`, error);
    }
  }
}
