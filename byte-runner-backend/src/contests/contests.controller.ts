import { Body, Controller, Get, Param, Post, Patch, Delete, Query, Req, UseGuards } from '@nestjs/common';
import { SupertokensGuard } from '../auth/supertokens.guard';
import { AdminGuard } from '../auth/admin.guard';
import { ContestsService } from './contests.service';
import { ContestsCron } from './contests.cron';
import { UsersService } from '../users/users.service';
import { EnterContestDto } from './dto/enter-contest.dto';
import { CreateContestDto } from './dto/create-contest.dto';

@Controller('contests')
export class ContestsController {
  constructor(
    private readonly contestsService: ContestsService,
    private readonly contestsCron: ContestsCron,
    private readonly usersService: UsersService,
  ) {}

  @Get()
  async getContests(@Query('status') status?: string) {
    return this.contestsService.getAllContests(status);
  }

  @Get('active')
  async getActiveContests() {
    return this.contestsService.getActiveContests();
  }

  @Get(':id')
  async getContest(@Param('id') id: string) {
    const contest = await this.contestsService.getContestById(id);
    if (!contest) {
      return { error: 'Contest not found' };
    }
    return contest;
  }

  @Get(':id/leaderboard')
  async getContestLeaderboard(
    @Param('id') contestId: string,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = limit ? Math.min(Math.max(parseInt(limit, 10), 1), 100) : 100;
    return this.contestsService.getContestLeaderboard(contestId, parsedLimit);
  }

  @UseGuards(SupertokensGuard)
  @Post(':id/enter')
  async enterContest(
    @Req() req: any,
    @Param('id') contestId: string,
    @Body() body: EnterContestDto,
  ) {
    const supertokensId = req.session.getUserId();
    const user = await this.usersService.getOrCreateUser(supertokensId);

    const entry = await this.contestsService.enterContest(
      contestId,
      user.id,
      body.runId,
      body.score,
      body.distance,
    );

    return {
      id: entry.id,
      contestId: entry.contest_id,
      score: entry.score,
      distance: entry.distance,
      createdAt: entry.created_at,
    };
  }

  @UseGuards(SupertokensGuard)
  @Get(':id/my-entries')
  async getMyEntries(@Req() req: any, @Param('id') contestId: string) {
    const supertokensId = req.session.getUserId();
    const user = await this.usersService.getOrCreateUser(supertokensId);

    const entries = await this.contestsService.getUserEntries(contestId, user.id);
    const rank = await this.contestsService.getUserRank(contestId, user.id);

    return {
      entries,
      rank,
    };
  }

  // Admin endpoints
  @UseGuards(SupertokensGuard, AdminGuard)
  @Post('admin/create')
  async createContest(@Body() body: CreateContestDto) {
    const contest = await this.contestsService.createContest({
      name: body.name,
      description: body.description,
      startDate: body.startDate,
      endDate: body.endDate,
      status: body.status,
      prizePool: body.prizePool,
      rules: body.rules,
      maxEntriesPerUser: body.maxEntriesPerUser,
    });

    return contest;
  }

  @UseGuards(SupertokensGuard, AdminGuard)
  @Patch('admin/:id')
  async updateContest(@Param('id') id: string, @Body() body: Partial<CreateContestDto>) {
    console.log('📝 Update contest request received:', {
      id,
      body: JSON.stringify(body, null, 2)
    });

    const contest = await this.contestsService.updateContest(id, {
      ...(body.name && { name: body.name }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.startDate && { start_date: body.startDate }),
      ...(body.endDate && { end_date: body.endDate }),
      ...(body.status && { status: body.status }),
      ...(body.prizePool !== undefined && { prize_pool: body.prizePool }),
      ...(body.rules !== undefined && { rules: body.rules }),
      ...(body.maxEntriesPerUser !== undefined && { max_entries_per_user: body.maxEntriesPerUser }),
    } as any);

    console.log('✅ Contest updated successfully:', contest.id);
    return contest;
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
  async checkAdmin() {
    return { isAdmin: true };
  }
}
