import { Controller, Get, Query } from '@nestjs/common';
import { LeaderboardService } from './leaderboard.service';

@Controller('leaderboard')
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  @Get('current')
  getCurrent(@Query('limit') limit?: string) {
    const parsedLimit = limit ? Math.min(Math.max(parseInt(limit, 10), 1), 100) : 50;
    return this.leaderboardService.getCurrentLeaderboard(parsedLimit);
  }
}
