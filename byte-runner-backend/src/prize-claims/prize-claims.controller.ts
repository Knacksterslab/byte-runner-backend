import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { SupertokensGuard } from '../auth/supertokens.guard';
import { PrizeClaimsService } from './prize-claims.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRecord } from '../users/users.service';
import { SubmitClaimDto } from './dto/submit-claim.dto';

@Controller('prize-claims')
export class PrizeClaimsController {
  constructor(private readonly prizeClaimsService: PrizeClaimsService) {}

  @UseGuards(SupertokensGuard)
  @Get('my-claims')
  getMyClaims(@CurrentUser() user: UserRecord) {
    return this.prizeClaimsService.getUserClaims(user.id);
  }

  @UseGuards(SupertokensGuard)
  @Get(':id')
  async getClaim(@CurrentUser() user: UserRecord, @Param('id') claimId: string) {
    const claim = await this.prizeClaimsService.getClaimById(claimId, user.id);
    return claim ?? { error: 'Prize claim not found' };
  }

  @UseGuards(SupertokensGuard)
  @Post(':id/submit')
  async submitClaim(@CurrentUser() user: UserRecord, @Param('id') claimId: string, @Body() body: SubmitClaimDto) {
    const claim = await this.prizeClaimsService.submitClaim(claimId, user.id, body as any);
    return { id: claim.id, status: claim.claim_status, submittedAt: claim.submitted_at };
  }

  @UseGuards(SupertokensGuard)
  @Get('contest/:contestIdOrSlug/my-claim')
  getMyClaimForContest(@CurrentUser() user: UserRecord, @Param('contestIdOrSlug') contestIdOrSlug: string) {
    return this.prizeClaimsService.getUserClaimForContestBySlug(contestIdOrSlug, user.id);
  }
}
