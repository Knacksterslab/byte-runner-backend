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
    const mechanic = challenge?.mechanic ?? 'runner';
    const leaderboard = await this.dailyChallengesService.getLeaderboardForDate(date, 10, mechanic);

    const userId = req.user?.id ?? null;
    const [myBest, myStreak, myLevelToday] = userId
      ? await Promise.all([
          this.dailyChallengesService.getUserBestForDate(userId, date, mechanic),
          this.dailyChallengesService.getUserStreak(userId),
          this.dailyChallengesService.getBestLevelToday(userId),
        ])
      : [null, 0, 0];
    const targetLevel = challenge?.stages?.targetLevel ?? null;
    const myCurriculum =
      userId && targetLevel !== null
        ? { levelToday: myLevelToday, targetLevel, complete: myLevelToday >= targetLevel }
        : null;

    return {
      challenge: challenge
        ? {
            date: challenge.challenge_date,
            name: challenge.name,
            description: challenge.description,
            mechanic,
            stages: challenge.stages,
            modifiers: challenge.modifiers,
            status: challenge.status,
            endsAt: this.dailyChallengesService.endOfDayIso(),
          }
        : null,
      leaderboard,
      myBest,
      myStreak,
      myCurriculum,
    };
  }

  @Get('leaderboard')
  async getLeaderboard(@Query('date') date?: string, @Query('limit') limit?: string) {
    const day = date ?? this.dailyChallengesService.todayKey();
    const challenge = await this.dailyChallengesService.getByDate(day);
    const leaderboard = await this.dailyChallengesService.getLeaderboardForDate(
      day,
      limit ? Math.min(parseInt(limit, 10) || 10, 50) : 10,
      challenge?.mechanic,
    );
    return { date: day, leaderboard };
  }
}
