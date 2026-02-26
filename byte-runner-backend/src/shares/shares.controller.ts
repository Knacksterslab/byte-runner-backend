import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { SupertokensGuard } from '../auth/supertokens.guard';
import { SharesService } from './shares.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRecord } from '../users/users.service';
import { RecordShareDto } from './dto/record-share.dto';

@Controller('shares')
export class SharesController {
  constructor(private readonly sharesService: SharesService) {}

  @UseGuards(SupertokensGuard)
  @Post()
  async recordShare(@CurrentUser() user: UserRecord, @Body() body: RecordShareDto) {
    const share = await this.sharesService.recordShare(user.id, body.platform, body.score, body.runId);
    return { id: share.id, platform: share.platform, createdAt: share.created_at };
  }

  @UseGuards(SupertokensGuard)
  @Get('count')
  async getShareCount(@CurrentUser() user: UserRecord) {
    const count = await this.sharesService.getUserShareCount(user.id);
    return { count };
  }
}
