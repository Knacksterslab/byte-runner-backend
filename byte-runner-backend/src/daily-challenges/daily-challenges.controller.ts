import { Controller, Get, Query, Req } from '@nestjs/common';
import { DailyChallengesService } from './daily-challenges.service';

@Controller('daily-challenges')
export class DailyChallengesController {
  constructor(private readonly dailyChallengesService: DailyChallengesService) {}

  /**
   * Today's seeded Incident challenge. Public; when a valid session cookie
   * is present the global ResolveUserInterceptor attaches request.user and
   * personal extras (best score, streak) are included.
   */
  @Get('current')
  async getCurrent(@Req() req: { user?: { id?: string } }) {
    const date = this.dailyChallengesService.todayKey();
    const challenge = await this.dailyChallengesService.getOrCreateChallengeByDate(date);
    const leaderboard = await this.dailyChallengesService.getLeaderboardForDate(date);

    const userId = req.user?.id ?? null;
    const [myBest, myStreak] = userId
      ? await Promise.all([
          this.dailyChallengesService.getUserBestForDate(userId, date),
          this.dailyChallengesService.getUserStreak(userId),
        ])
      : [null, 0];

    return {
      challenge: challenge
        ? {
            date: challenge.challenge_date,
            name: challenge.name,
            description: challenge.description,
            modifiers: challenge.modifiers,
            status: challenge.status,
            endsAt: this.dailyChallengesService.endOfDayIso(),
          }
        : null,
      leaderboard,
      myBest,
      myStreak,
    };
  }

  @Get('leaderboard')
  async getLeaderboard(@Query('date') date?: string, @Query('limit') limit?: string) {
    const day = date ?? this.dailyChallengesService.todayKey();
    const leaderboard = await this.dailyChallengesService.getLeaderboardForDate(
      day,
      limit ? Math.min(parseInt(limit, 10) || 10, 50) : 10,
    );
    return { date: day, leaderboard };
  }
}
