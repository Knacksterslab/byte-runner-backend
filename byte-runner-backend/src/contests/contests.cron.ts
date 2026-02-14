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

      // Recover ended contests that may be missing prize claims
      await this.recoverEndedContests();
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

  private async recoverEndedContests() {
    try {
      const endedContests = await this.contestsService.getEndedContests();

      if (endedContests.length === 0) {
        this.logger.log('No ended contests to recover');
        return;
      }

      this.logger.log(`Checking ${endedContests.length} ended contest(s) for missing prize claims...`);

      for (const contest of endedContests) {
        await this.ensurePrizeClaimsExist(contest.id, contest.name);
      }
    } catch (error) {
      this.logger.error('Failed to recover ended contests:', error);
    }
  }

  private async ensurePrizeClaimsExist(contestId: string, contestName: string) {
    try {
      this.logger.log(`🔍 Checking contest "${contestName}" (${contestId})...`);

      // 1. Get contest details
      const contest = await this.contestsService.getContestById(contestId);
      if (!contest) {
        this.logger.warn(`⚠️ Contest "${contestName}" not found in database`);
        return;
      }

      this.logger.log(`📋 Contest found. Prize pool: ${JSON.stringify(contest.prize_pool)}`);

      if (!contest.prize_pool || Object.keys(contest.prize_pool).length === 0) {
        this.logger.log(`⏭️ Skipping "${contestName}" - no prizes configured`);
        return;
      }

      // 2. Get final leaderboard
      this.logger.log(`🏆 Fetching leaderboard for "${contestName}"...`);
      const leaderboard = await this.contestsService.getContestLeaderboard(contestId, 100);
      
      this.logger.log(`📊 Leaderboard has ${leaderboard.length} entries`);
      
      if (leaderboard.length === 0) {
        this.logger.log(`⏭️ Skipping "${contestName}" - no contest entries found`);
        return;
      }

      // Log top 3 for debugging
      const top3 = leaderboard.slice(0, 3).map(e => `${e.username} (Rank #${e.rank}, Score: ${e.score})`).join(', ');
      this.logger.log(`🥇 Top entries: ${top3}`);

      // 3. Create missing prize claims for winners
      let claimsCreated = 0;
      let claimsChecked = 0;
      for (const entry of leaderboard) {
        const prize = this.contestsService.getPrizeForRank(entry.rank, contest.prize_pool);
        
        if (prize) {
          claimsChecked++;
          this.logger.log(`🎁 Rank #${entry.rank} (${entry.username}) qualifies for prize: ${prize}`);
          
          try {
            // Check if claim already exists to avoid duplicates
            const existingClaim = await this.prizeClaimsService.getUserClaimForContest(
              contestId,
              entry.userId
            );

            if (existingClaim) {
              this.logger.log(`✓ Prize claim already exists for ${entry.username}`);
            } else {
              this.logger.log(`🔧 Creating prize claim for ${entry.username}...`);
              await this.prizeClaimsService.createPrizeClaim(
                contestId,
                entry.userId,
                entry.rank,
                prize
              );
              claimsCreated++;
              this.logger.log(`✅ Recovered prize claim for ${entry.username} in "${contestName}" (Rank #${entry.rank}, Prize: ${prize})`);
            }
          } catch (error) {
            this.logger.error(`❌ Failed to create claim for ${entry.username}:`, error);
          }
        }
      }

      if (claimsCreated > 0) {
        this.logger.log(`🎉 Recovered ${claimsCreated} missing prize claims for "${contestName}"`);
      } else if (claimsChecked > 0) {
        this.logger.log(`✓ All ${claimsChecked} prize claims already exist for "${contestName}"`);
      } else {
        this.logger.log(`⏭️ No winners in prize pool range for "${contestName}"`);
      }

    } catch (error) {
      this.logger.error(`❌ Failed to ensure prize claims for contest ${contestId}:`, error);
    }
  }

  private async finishContest(contestId: string, contestName: string) {
    this.logger.log(`🏁 Finishing contest: ${contestName} (${contestId})`);

    try {
      // 1. Get contest details
      const contest = await this.contestsService.getContestById(contestId);
      if (!contest) {
        this.logger.warn(`⚠️ Contest ${contestId} not found`);
        return;
      }

      this.logger.log(`📋 Contest details: Prize pool: ${JSON.stringify(contest.prize_pool)}`);

      // 2. Get final leaderboard
      this.logger.log(`🏆 Fetching final leaderboard...`);
      const leaderboard = await this.contestsService.getContestLeaderboard(contestId, 100);
      
      this.logger.log(`📊 Final leaderboard has ${leaderboard.length} entries`);
      
      if (leaderboard.length > 0) {
        const top3 = leaderboard.slice(0, 3).map(e => `${e.username} (Rank #${e.rank}, Score: ${e.score})`).join(', ');
        this.logger.log(`🥇 Top entries: ${top3}`);
      }

      // 3. Create prize claims for winners
      let claimsCreated = 0;
      let winnersChecked = 0;
      for (const entry of leaderboard) {
        const prize = this.contestsService.getPrizeForRank(entry.rank, contest.prize_pool);
        
        if (prize) {
          winnersChecked++;
          this.logger.log(`🎁 Rank #${entry.rank} (${entry.username}) qualifies for prize: ${prize}`);
          
          try {
            // Check if claim already exists to avoid duplicates
            const existingClaim = await this.prizeClaimsService.getUserClaimForContest(
              contestId,
              entry.userId
            );

            if (!existingClaim) {
              this.logger.log(`💰 Creating prize claim for ${entry.username}...`);
              await this.prizeClaimsService.createPrizeClaim(
                contestId,
                entry.userId,
                entry.rank,
                prize
              );
              claimsCreated++;
              this.logger.log(`✅ Created prize claim for ${entry.username} (Rank #${entry.rank}, Prize: ${prize})`);
            } else {
              this.logger.log(`✓ Prize claim already exists for ${entry.username}`);
            }
          } catch (error) {
            this.logger.error(`❌ Failed to create claim for ${entry.username}:`, error);
          }
        }
      }

      // 4. Mark contest as ended
      await this.contestsService.updateContest(contestId, { status: 'ended' });

      if (claimsCreated > 0) {
        this.logger.log(`🎉 Contest "${contestName}" finished! Created ${claimsCreated} prize claims`);
      } else if (winnersChecked > 0) {
        this.logger.log(`✅ Contest "${contestName}" finished! All ${winnersChecked} prize claims already existed`);
      } else {
        this.logger.warn(`⚠️ Contest "${contestName}" finished! Created ${claimsCreated} prize claims (leaderboard: ${leaderboard.length} entries, winners checked: ${winnersChecked})`);
      }

      // TODO: Send email notification to admin
      // TODO: Send email notification to winners

    } catch (error) {
      this.logger.error(`❌ Failed to finish contest ${contestId}:`, error);
    }
  }
}
