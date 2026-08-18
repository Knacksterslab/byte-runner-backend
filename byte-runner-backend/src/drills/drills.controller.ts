import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { SupertokensGuard } from '../auth/supertokens.guard';
import { DrillsService } from './drills.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRecord } from '../users/users.service';
import { FinishDrillDto } from './dto/finish-drill.dto';

@Controller('drills')
export class DrillsController {
  constructor(private readonly drillsService: DrillsService) {}

  @UseGuards(SupertokensGuard)
  @Throttle({ default: { limit: 30, ttl: 60 } })
  @Post('start')
  startDrill(@Req() req: any) {
    return this.drillsService.startDrill(req.session.getUserId());
  }

  @UseGuards(SupertokensGuard)
  @Throttle({ default: { limit: 30, ttl: 60 } })
  @Post('finish')
  finishDrill(
    @Req() req: any,
    @CurrentUser() user: UserRecord,
    @Body() body: FinishDrillDto,
  ) {
    return this.drillsService.finishDrill(req.session.getUserId(), user, body);
  }

  @UseGuards(SupertokensGuard)
  @Get('mastery')
  getMastery(@CurrentUser() user: UserRecord) {
    // DB user id (≠ supertokens id) — matches the ledger's user_id key
    return this.drillsService.getMastery(user.id);
  }
}
