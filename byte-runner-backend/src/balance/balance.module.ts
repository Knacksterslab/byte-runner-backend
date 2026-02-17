import { Module, forwardRef } from '@nestjs/common';
import { BalanceController } from './balance.controller';
import { BalanceService } from './balance.service';
import { FraudPreventionModule } from '../fraud-prevention/fraud-prevention.module';

@Module({
  imports: [forwardRef(() => FraudPreventionModule)],
  controllers: [BalanceController],
  providers: [BalanceService],
  exports: [BalanceService],
})
export class BalanceModule {}
