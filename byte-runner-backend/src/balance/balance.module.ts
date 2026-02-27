import { Module, forwardRef } from '@nestjs/common';
import { BalanceController } from './balance.controller';
import { BalanceService } from './balance.service';
import { WithdrawalService } from './withdrawal.service';
import { FraudPreventionModule } from '../fraud-prevention/fraud-prevention.module';
import { TronModule } from '../tron/tron.module';
import { UsersModule } from '../users/users.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [forwardRef(() => FraudPreventionModule), TronModule, UsersModule, EmailModule],
  controllers: [BalanceController],
  providers: [BalanceService, WithdrawalService],
  exports: [BalanceService, WithdrawalService],
})
export class BalanceModule {}
