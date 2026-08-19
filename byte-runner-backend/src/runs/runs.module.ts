import { Module } from '@nestjs/common';
import { RunsController } from './runs.controller';
import { RunsService } from './runs.service';
import { ContestsModule } from '../contests/contests.module';
import { BadgesModule } from '../badges/badges.module';
import { DailyChallengesModule } from '../daily-challenges/daily-challenges.module';

@Module({
  imports: [ContestsModule, BadgesModule, DailyChallengesModule],
  controllers: [RunsController],
  providers: [RunsService],
})
export class RunsModule {}
