import { BadRequestException, Body, Controller, forwardRef, Get, Inject, Param, Post, Req, UseGuards } from '@nestjs/common';
import { SupertokensGuard } from '../auth/supertokens.guard';
import { PrizeClaimsService } from './prize-claims.service';
import { UsersService } from '../users/users.service';
import { ContestsService } from '../contests/contests.service';
import { SubmitClaimDto } from './dto/submit-claim.dto';

@Controller('prize-claims')
export class PrizeClaimsController {
  constructor(
    private readonly prizeClaimsService: PrizeClaimsService,
    private readonly usersService: UsersService,
    @Inject(forwardRef(() => ContestsService))
    private readonly contestsService: ContestsService,
  ) {}

  @UseGuards(SupertokensGuard)
  @Get('my-claims')
  async getMyClaims(@Req() req: any) {
    const supertokensId = req.session.getUserId();
    const user = await this.usersService.getOrCreateUser(supertokensId);

    return this.prizeClaimsService.getUserClaims(user.id);
  }

  @UseGuards(SupertokensGuard)
  @Get(':id')
  async getClaim(@Req() req: any, @Param('id') claimId: string) {
    const supertokensId = req.session.getUserId();
    const user = await this.usersService.getOrCreateUser(supertokensId);

    const claim = await this.prizeClaimsService.getClaimById(claimId, user.id);
    if (!claim) {
      return { error: 'Prize claim not found' };
    }

    return claim;
  }

  @UseGuards(SupertokensGuard)
  @Post(':id/submit')
  async submitClaim(
    @Req() req: any,
    @Param('id') claimId: string,
    @Body() body: SubmitClaimDto,
  ) {
    const supertokensId = req.session.getUserId();
    const user = await this.usersService.getOrCreateUser(supertokensId);

    const claim = await this.prizeClaimsService.submitClaim(
      claimId,
      user.id,
      body as any,
    );

    return {
      id: claim.id,
      status: claim.claim_status,
      submittedAt: claim.submitted_at,
    };
  }

  @UseGuards(SupertokensGuard)
  @Get('contest/:contestIdOrSlug/my-claim')
  async getMyClaimForContest(
    @Req() req: any,
    @Param('contestIdOrSlug') contestIdOrSlug: string,
  ) {
    const supertokensId = req.session.getUserId();
    const user = await this.usersService.getOrCreateUser(supertokensId);

    // Resolve slug to UUID if needed
    const contest = await this.contestsService.getContestByIdOrSlug(contestIdOrSlug);
    if (!contest) {
      throw new BadRequestException('Contest not found');
    }

    return this.prizeClaimsService.getUserClaimForContest(contest.id, user.id);
  }
}
