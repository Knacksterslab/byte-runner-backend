import { Module } from '@nestjs/common';
import { DailyChallengesController } from './daily-challenges.controller';
import { DailyChallengesService } from './daily-challenges.service';
import { DailyChallengesCron } from './daily-challenges.cron';

@Module({
  controllers: [DailyChallengesController],
  providers: [DailyChallengesService, DailyChallengesCron],
  exports: [DailyChallengesService],
})
export class DailyChallengesModule {}
