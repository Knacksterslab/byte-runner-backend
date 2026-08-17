import { Module } from '@nestjs/common';
import { DailyChallengesController } from './daily-challenges.controller';
import { DailyChallengesService } from './daily-challenges.service';
import { DailyChallengesCron } from './daily-challenges.cron';
import { BalanceModule } from '../balance/balance.module';
import { FraudPreventionModule } from '../fraud-prevention/fraud-prevention.module';

@Module({
  imports: [BalanceModule, FraudPreventionModule],
  controllers: [DailyChallengesController],
  providers: [DailyChallengesService, DailyChallengesCron],
  exports: [DailyChallengesService],
})
export class DailyChallengesModule {}
