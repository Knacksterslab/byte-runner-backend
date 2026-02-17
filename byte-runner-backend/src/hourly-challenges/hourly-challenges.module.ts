import { Module } from '@nestjs/common';
import { HourlyChallengesController } from './hourly-challenges.controller';
import { HourlyChallengesService } from './hourly-challenges.service';
import { BalanceModule } from '../balance/balance.module';
import { FraudPreventionModule } from '../fraud-prevention/fraud-prevention.module';

@Module({
  imports: [BalanceModule, FraudPreventionModule],
  controllers: [HourlyChallengesController],
  providers: [HourlyChallengesService],
  exports: [HourlyChallengesService],
})
export class HourlyChallengesModule {}
