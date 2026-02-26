import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { SupertokensGuard } from '../auth/supertokens.guard';
import { RunsService } from './runs.service';
import { CurrentUser, CurrentUserId } from '../common/decorators/current-user.decorator';
import { UserRecord } from '../users/users.service';
import { FinishRunDto } from './dto/finish-run.dto';

@Controller('runs')
export class RunsController {
  constructor(private readonly runsService: RunsService) {}

  @UseGuards(SupertokensGuard)
  @Post('start')
  startRun(@Req() req: any) {
    return this.runsService.startRun(req.session.getUserId());
  }

  @UseGuards(SupertokensGuard)
  @Throttle({ default: { limit: 5, ttl: 60 } })
  @Post('finish')
  finishRun(@Req() req: any, @CurrentUser() user: UserRecord, @Body() body: FinishRunDto) {
    return this.runsService.finishRun(req.session.getUserId(), user, body);
  }

  @UseGuards(SupertokensGuard)
  @Get('my-stats')
  getMyStats(@CurrentUserId() userId: string) {
    return this.runsService.getUserStats(userId);
  }
}
