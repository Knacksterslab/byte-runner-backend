import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { SupertokensGuard } from '../auth/supertokens.guard';
import { BadgesService } from './badges.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRecord } from '../users/users.service';

@Controller('badges')
export class BadgesController {
  constructor(private readonly badgesService: BadgesService) {}

  @Get()
  getAllBadges() {
    return this.badgesService.getAllBadges();
  }

  @UseGuards(SupertokensGuard)
  @Get('my-badges')
  getMyBadges(@CurrentUser() user: UserRecord) {
    return this.badgesService.getUserBadges(user.id);
  }

  @UseGuards(SupertokensGuard)
  @Post('check')
  async checkBadges(@CurrentUser() user: UserRecord) {
    const awardedBadges = await this.badgesService.checkAndAwardBadges(user.id);
    return {
      awarded: awardedBadges,
      message: awardedBadges.length > 0 ? `Earned ${awardedBadges.length} new badge(s)!` : 'No new badges',
    };
  }

  @UseGuards(SupertokensGuard)
  @Post('featured')
  async setFeaturedBadge(@CurrentUser() user: UserRecord, @Body() body: { badgeId: string }) {
    await this.badgesService.setFeaturedBadge(user.id, body.badgeId);
    return { success: true };
  }
}
