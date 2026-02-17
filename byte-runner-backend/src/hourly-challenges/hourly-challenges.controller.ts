import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { SupertokensGuard } from '../auth/supertokens.guard';
import { HourlyChallengesService } from './hourly-challenges.service';

@Controller('hourly-challenges')
export class HourlyChallengesController {
  constructor(private readonly hourlyChallengesService: HourlyChallengesService) {}

  @Get('current')
  async getCurrentChallenge() {
    const challenge = await this.hourlyChallengesService.getCurrentChallenge();
    
    if (!challenge) {
      return {
        challenge: null,
        message: 'No active challenge found'
      };
    }

    return {
      challenge: {
        id: challenge.id,
        challengeHour: challenge.challenge_hour,
        status: challenge.status,
        winnerUserId: challenge.winner_user_id,
        winnerScore: challenge.winner_score,
        winnerDistance: challenge.winner_distance
      }
    };
  }

  @UseGuards(SupertokensGuard)
  @Get('my-entries')
  async getMyEntries(@Req() req: any, @Query('challengeHour') challengeHour?: string) {
    const supertokensId = req.session.getUserId();
    
    // Get user_id from supertokens_id
    const { data: user } = await this.hourlyChallengesService['client']
      .from('users')
      .select('id')
      .eq('supertokens_id', supertokensId)
      .single();

    if (!user) {
      throw new Error('User not found');
    }

    // If no challenge hour provided, use current hour
    const hour = challengeHour || (() => {
      const now = new Date();
      now.setMinutes(0, 0, 0);
      return now.toISOString();
    })();

    const entries = await this.hourlyChallengesService.getUserEntriesForChallenge(user.id, hour);

    return {
      challengeHour: hour,
      entries: entries.map(e => ({
        runId: e.run_id,
        score: e.score,
        distance: e.distance,
        createdAt: e.created_at
      }))
    };
  }

  @Get('create-test')
  async createTestChallenge() {
    try {
      const challenge = await this.hourlyChallengesService.createCurrentChallenge();
      return {
        success: true,
        message: 'Test challenge created for current hour',
        challenge: {
          id: challenge.id,
          challengeHour: challenge.challenge_hour,
          status: challenge.status
        }
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Failed to create test challenge'
      };
    }
  }

  @Get('leaderboard')
  async getLeaderboard(@Query('challengeHour') challengeHour?: string, @Query('limit') limit?: string) {
    // If no challenge hour provided, use current hour
    const hour = challengeHour || (() => {
      const now = new Date();
      now.setMinutes(0, 0, 0);
      return now.toISOString();
    })();

    const leaderboard = await this.hourlyChallengesService.getLeaderboardForChallenge(
      hour,
      limit ? parseInt(limit) : 10
    );

    return {
      challengeHour: hour,
      leaderboard: leaderboard.map((entry, index) => ({
        rank: index + 1,
        userId: entry.user_id,
        username: entry.users?.username || 'Anonymous',
        score: entry.score,
        distance: entry.distance,
        createdAt: entry.created_at
      }))
    };
  }
}
