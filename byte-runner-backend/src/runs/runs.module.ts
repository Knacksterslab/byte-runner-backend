import { Module } from '@nestjs/common';
import { RunsController } from './runs.controller';
import { RunsService } from './runs.service';
import { ContestsModule } from '../contests/contests.module';
import { BadgesModule } from '../badges/badges.module';

@Module({
  imports: [ContestsModule, BadgesModule],
  controllers: [RunsController],
  providers: [RunsService],
})
export class RunsModule {}
