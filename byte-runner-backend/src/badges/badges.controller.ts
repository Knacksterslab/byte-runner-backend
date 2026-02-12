import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { SupertokensGuard } from '../auth/supertokens.guard';
import { BadgesService } from './badges.service';
import { UsersService } from '../users/users.service';

@Controller('badges')
export class BadgesController {
  constructor(
    private readonly badgesService: BadgesService,
    private readonly usersService: UsersService,
  ) {}

  @Get()
  async getAllBadges() {
    return this.badgesService.getAllBadges();
  }

  @UseGuards(SupertokensGuard)
  @Get('my-badges')
  async getMyBadges(@Req() req: any) {
    const supertokensId = req.session.getUserId();
    const user = await this.usersService.getOrCreateUser(supertokensId);
    return this.badgesService.getUserBadges(user.id);
  }

  @UseGuards(SupertokensGuard)
  @Post('check')
  async checkBadges(@Req() req: any) {
    const supertokensId = req.session.getUserId();
    const user = await this.usersService.getOrCreateUser(supertokensId);
    
    const awardedBadges = await this.badgesService.checkAndAwardBadges(user.id);
    
    return {
      awarded: awardedBadges,
      message: awardedBadges.length > 0 
        ? `Earned ${awardedBadges.length} new badge(s)!` 
        : 'No new badges',
    };
  }

  @UseGuards(SupertokensGuard)
  @Post('featured')
  async setFeaturedBadge(
    @Req() req: any,
    @Body() body: { badgeId: string },
  ) {
    const supertokensId = req.session.getUserId();
    const user = await this.usersService.getOrCreateUser(supertokensId);
    
    await this.badgesService.setFeaturedBadge(user.id, body.badgeId);
    
    return { success: true };
  }
}
