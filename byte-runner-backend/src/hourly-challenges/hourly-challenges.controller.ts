import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SupertokensGuard } from '../auth/supertokens.guard';
import { HourlyChallengesService } from './hourly-challenges.service';
import { CurrentUserId } from '../common/decorators/current-user.decorator';
import { FraudPreventionService } from '../fraud-prevention/fraud-prevention.service';

@Controller('hourly-challenges')
export class HourlyChallengesController {
  constructor(
    private readonly hourlyChallengesService: HourlyChallengesService,
    private readonly fraudPreventionService: FraudPreventionService,
  ) {}

  @Get('current')
  async getCurrentChallenge() {
    const hourStart = this.hourlyChallengesService.getCurrentHourTimestamp();
    const challenge = await this.hourlyChallengesService.getOrCreateChallengeByHour(hourStart);
    if (!challenge) return { challenge: null, message: 'No active challenge found' };

    return {
      challenge: {
        id: challenge.id,
        challengeHour: challenge.challenge_hour,
        status: challenge.status,
        winnerUserId: challenge.winner_user_id,
        winnerScore: challenge.winner_score,
        winnerDistance: challenge.winner_distance,
      },
    };
  }

  @UseGuards(SupertokensGuard)
  @Get('my-entries')
  async getMyEntries(@CurrentUserId() userId: string, @Query('challengeHour') challengeHour?: string) {
    const hour = challengeHour ?? this.hourlyChallengesService.getCurrentHourTimestamp();
    const entries = await this.hourlyChallengesService.getUserEntriesForChallenge(userId, hour);

    return {
      challengeHour: hour,
      entries: entries.map((e) => ({
        runId: e.run_id,
        score: e.score,
        distance: e.distance,
        createdAt: e.created_at,
      })),
    };
  }

  @UseGuards(SupertokensGuard)
  @Get('my-eligibility')
  async getMyEligibility(@CurrentUserId() userId: string) {
    return this.fraudPreventionService.getPrizeEligibilityStatus(userId);
  }

  @Get('leaderboard')
  async getLeaderboard(@Query('challengeHour') challengeHour?: string, @Query('limit') limit?: string) {
    const hour = challengeHour ?? this.hourlyChallengesService.getCurrentHourTimestamp();
    const leaderboard = await this.hourlyChallengesService.getLeaderboardForChallenge(
      hour,
      limit ? parseInt(limit, 10) : 10,
    );
    return { challengeHour: hour, leaderboard };
  }
}
