import { Module, forwardRef } from '@nestjs/common';
import { PrizeClaimsController } from './prize-claims.controller';
import { PrizeClaimsService } from './prize-claims.service';
import { ContestsModule } from '../contests/contests.module';

@Module({
  imports: [forwardRef(() => ContestsModule)],
  controllers: [PrizeClaimsController],
  providers: [PrizeClaimsService],
  exports: [PrizeClaimsService],
})
export class PrizeClaimsModule {}
