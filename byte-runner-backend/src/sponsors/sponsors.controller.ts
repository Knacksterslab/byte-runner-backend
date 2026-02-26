import { Controller, Get, Query } from '@nestjs/common';
import { SponsorsService } from './sponsors.service';

@Controller('sponsors')
export class SponsorsController {
  constructor(private readonly sponsorsService: SponsorsService) {}

  @Get('recovery')
  getRecoverySponsor(
    @Query('threatId') threatId?: string,
    @Query('kitType') kitType?: string,
  ) {
    return {
      sponsor: this.sponsorsService.getRecoverySponsor(threatId, kitType),
    };
  }
}
