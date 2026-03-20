import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRecord } from '../users/users.service';
import { AdminGuard } from '../auth/admin.guard';
import { SupertokensGuard } from '../auth/supertokens.guard';
import { SponsorsService } from './sponsors.service';
import { GetRecoverySponsorDto } from './dto/get-recovery-sponsor.dto';
import { RecordImpressionDto } from './dto/record-impression.dto';
import { CreateSponsorDto, UpdateSponsorDto } from './dto/admin-sponsor.dto';
import {
  CreateCampaignDto,
  SetCampaignLifecycleDto,
  UpdateCampaignDto,
} from './dto/admin-campaign.dto';
import { CreateCreativeDto, UpdateCreativeDto } from './dto/admin-creative.dto';
import { UpsertCampaignTargetingDto } from './dto/admin-targeting.dto';
import { SimulateSponsorDto } from './dto/simulate-sponsor.dto';

@Controller('sponsors')
export class SponsorsController {
  constructor(private readonly sponsorsService: SponsorsService) {}

  @Get('recovery')
  async getRecoverySponsor(
    @Query() query: GetRecoverySponsorDto,
    @Req() req: Request,
    @CurrentUser() user?: UserRecord,
  ) {
    const platform = req.headers['x-client-platform'];
    const country = req.headers['x-client-country'];
    const sessionId = (req.headers['x-session-id'] as string) || undefined;
    const sponsor = await this.sponsorsService.getRecoverySponsor(query.threatId, query.kitType, {
      userId: user?.id,
      sessionId,
      platform: typeof platform === 'string' ? platform : undefined,
      country: typeof country === 'string' ? country : undefined,
    });
    return {
      sponsor,
    };
  }

  @Post('events/impression')
  async recordImpression(
    @Body() body: RecordImpressionDto,
    @CurrentUser() user?: UserRecord,
  ) {
    const result = await this.sponsorsService.recordAdEvent({
      trackingToken: body.trackingToken,
      eventType: 'impression',
      userId: user?.id,
      idempotencyKey: body.idempotencyKey,
      sessionId: body.sessionId,
      threatId: body.threatId,
      kitType: body.kitType,
      metadata: body.metadata,
    });
    return { ok: true, recorded: result.recorded, duplicated: result.duplicated };
  }

  @Get('click/:token')
  @Header('Cache-Control', 'no-store')
  async clickRedirect(@Param('token') token: string, @Res() res: Response, @CurrentUser() user?: UserRecord) {
    const decoded = decodeURIComponent(token);
    const result = await this.sponsorsService.recordAdEvent({
      trackingToken: decoded,
      eventType: 'click',
      userId: user?.id,
      metadata: { source: 'recovery-overlay' },
    });
    return res.redirect(302, result.ctaUrl);
  }

  @UseGuards(SupertokensGuard, AdminGuard)
  @Get('admin/sponsors')
  listSponsors() {
    return this.sponsorsService.listSponsors();
  }

  @UseGuards(SupertokensGuard, AdminGuard)
  @Post('admin/sponsors')
  createSponsor(@Body() body: CreateSponsorDto) {
    return this.sponsorsService.createSponsor(body);
  }

  @UseGuards(SupertokensGuard, AdminGuard)
  @Patch('admin/sponsors/:id')
  updateSponsor(@Param('id') id: string, @Body() body: UpdateSponsorDto) {
    return this.sponsorsService.updateSponsor(id, body);
  }

  @UseGuards(SupertokensGuard, AdminGuard)
  @Get('admin/campaigns')
  listCampaigns() {
    return this.sponsorsService.listCampaigns();
  }

  @UseGuards(SupertokensGuard, AdminGuard)
  @Post('admin/campaigns')
  createCampaign(@Body() body: CreateCampaignDto) {
    return this.sponsorsService.createCampaign(body);
  }

  @UseGuards(SupertokensGuard, AdminGuard)
  @Patch('admin/campaigns/:id')
  updateCampaign(@Param('id') id: string, @Body() body: UpdateCampaignDto) {
    return this.sponsorsService.updateCampaign(id, body);
  }

  @UseGuards(SupertokensGuard, AdminGuard)
  @Post('admin/campaigns/:id/lifecycle')
  setCampaignLifecycle(@Param('id') id: string, @Body() body: SetCampaignLifecycleDto) {
    return this.sponsorsService.setCampaignStatus(id, body.status);
  }

  @UseGuards(SupertokensGuard, AdminGuard)
  @Post('admin/campaigns/:id/creatives')
  createCreative(@Param('id') campaignId: string, @Body() body: CreateCreativeDto) {
    return this.sponsorsService.createCreative({ ...body, campaignId });
  }

  @UseGuards(SupertokensGuard, AdminGuard)
  @Patch('admin/creatives/:id')
  updateCreative(@Param('id') id: string, @Body() body: UpdateCreativeDto) {
    return this.sponsorsService.updateCreative(id, body);
  }

  @UseGuards(SupertokensGuard, AdminGuard)
  @Post('admin/campaigns/:id/targeting')
  upsertCampaignTargeting(@Param('id') campaignId: string, @Body() body: UpsertCampaignTargetingDto) {
    return this.sponsorsService.upsertCampaignTargeting(campaignId, {
      threat_ids: body.threatIds,
      kit_types: body.kitTypes,
      countries: body.countries,
      platforms: body.platforms,
      metadata: body.metadata,
    });
  }

  @UseGuards(SupertokensGuard, AdminGuard)
  @Post('admin/simulate')
  simulate(@Body() body: SimulateSponsorDto) {
    return this.sponsorsService.simulateSelection(body.threatId, body.kitType);
  }
}
