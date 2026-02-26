import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { SupertokensGuard } from '../auth/supertokens.guard';
import { AdminGuard } from '../auth/admin.guard';
import { ContestsService } from './contests.service';
import { ContestsLeaderboardService } from './contests-leaderboard.service';
import { ContestsCron } from './contests.cron';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRecord } from '../users/users.service';
import { EnterContestDto } from './dto/enter-contest.dto';
import { CreateContestDto } from './dto/create-contest.dto';

@Controller('contests')
export class ContestsController {
  constructor(
    private readonly contestsService: ContestsService,
    private readonly leaderboardService: ContestsLeaderboardService,
    private readonly contestsCron: ContestsCron,
  ) {}

  @Get()
  getContests(@Query('status') status?: string) {
    return this.contestsService.getAllContests(status);
  }

  @Get('active')
  getActiveContests() {
    return this.contestsService.getActiveContests();
  }

  @Get(':idOrSlug')
  async getContest(@Param('idOrSlug') idOrSlug: string) {
    const contest = await this.contestsService.getContestByIdOrSlug(idOrSlug);
    return contest ?? { error: 'Contest not found' };
  }

  @Get(':idOrSlug/leaderboard')
  async getContestLeaderboard(@Param('idOrSlug') idOrSlug: string, @Query('limit') limit?: string) {
    const contest = await this.contestsService.getContestByIdOrSlug(idOrSlug);
    if (!contest) return { error: 'Contest not found' };

    const parsedLimit = limit ? Math.min(Math.max(parseInt(limit, 10), 1), 100) : 100;
    return this.leaderboardService.getContestLeaderboard(contest.id, parsedLimit);
  }

  @UseGuards(SupertokensGuard)
  @Post(':idOrSlug/enter')
  async enterContest(
    @CurrentUser() user: UserRecord,
    @Param('idOrSlug') idOrSlug: string,
    @Body() body: EnterContestDto,
  ) {
    const contest = await this.contestsService.getContestByIdOrSlug(idOrSlug);
    if (!contest) return { error: 'Contest not found' };

    const entry = await this.contestsService.enterContest(contest.id, user.id, body.runId, body.score, body.distance);
    return { id: entry.id, contestId: entry.contest_id, score: entry.score, distance: entry.distance, createdAt: entry.created_at };
  }

  @UseGuards(SupertokensGuard)
  @Get(':idOrSlug/my-entries')
  async getMyEntries(@CurrentUser() user: UserRecord, @Param('idOrSlug') idOrSlug: string) {
    const contest = await this.contestsService.getContestByIdOrSlug(idOrSlug);
    if (!contest) return { error: 'Contest not found' };

    const [entries, rank] = await Promise.all([
      this.leaderboardService.getUserEntries(contest.id, user.id),
      this.leaderboardService.getUserRank(contest.id, user.id),
    ]);
    return { entries, rank };
  }

  @UseGuards(SupertokensGuard, AdminGuard)
  @Post('admin/create')
  createContest(@Body() body: CreateContestDto) {
    return this.contestsService.createContest(body);
  }

  @UseGuards(SupertokensGuard, AdminGuard)
  @Patch('admin/:id')
  updateContest(@Param('id') id: string, @Body() body: Partial<CreateContestDto>) {
    return this.contestsService.updateContest(id, body);
  }

  @UseGuards(SupertokensGuard, AdminGuard)
  @Delete('admin/:id')
  async deleteContest(@Param('id') id: string) {
    await this.contestsService.deleteContest(id);
    return { success: true };
  }

  @UseGuards(SupertokensGuard, AdminGuard)
  @Post('admin/update-statuses')
  async updateContestStatuses() {
    await this.contestsCron.checkAndUpdateContests();
    return { success: true, message: 'Contest statuses updated' };
  }

  @UseGuards(SupertokensGuard, AdminGuard)
  @Get('admin/check')
  checkAdmin() {
    return { isAdmin: true };
  }
}
