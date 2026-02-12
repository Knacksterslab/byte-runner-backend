import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { SupertokensGuard } from '../auth/supertokens.guard';
import { SharesService } from './shares.service';
import { UsersService } from '../users/users.service';
import { RecordShareDto } from './dto/record-share.dto';

@Controller('shares')
export class SharesController {
  constructor(
    private readonly sharesService: SharesService,
    private readonly usersService: UsersService,
  ) {}

  @UseGuards(SupertokensGuard)
  @Post()
  async recordShare(@Req() req: any, @Body() body: RecordShareDto) {
    const supertokensId = req.session.getUserId();
    const user = await this.usersService.getOrCreateUser(supertokensId);

    const share = await this.sharesService.recordShare(
      user.id,
      body.platform,
      body.score,
      body.runId,
    );

    return {
      id: share.id,
      platform: share.platform,
      createdAt: share.created_at,
    };
  }

  @UseGuards(SupertokensGuard)
  @Get('count')
  async getShareCount(@Req() req: any) {
    const supertokensId = req.session.getUserId();
    const user = await this.usersService.getOrCreateUser(supertokensId);
    const count = await this.sharesService.getUserShareCount(user.id);

    return { count };
  }
}
