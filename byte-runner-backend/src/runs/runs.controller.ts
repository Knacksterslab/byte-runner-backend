import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { SupertokensGuard } from '../auth/supertokens.guard';
import { FinishRunDto } from './dto/finish-run.dto';
import { RunsService } from './runs.service';

@Controller('runs')
export class RunsController {
  constructor(private readonly runsService: RunsService) {}

  @UseGuards(SupertokensGuard)
  @Post('start')
  startRun(@Req() req: any) {
    const supertokensId = req.session.getUserId();
    return this.runsService.startRun(supertokensId);
  }

  @UseGuards(SupertokensGuard)
  @Throttle({ default: { limit: 5, ttl: 60 } })
  @Post('finish')
  finishRun(@Req() req: any, @Body() body: FinishRunDto) {
    const supertokensId = req.session.getUserId();
    return this.runsService.finishRun(supertokensId, body);
  }
}
