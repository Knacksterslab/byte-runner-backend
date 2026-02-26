import { Module, forwardRef } from '@nestjs/common';
import { ContestsController } from './contests.controller';
import { ContestsService } from './contests.service';
import { ContestsLeaderboardService } from './contests-leaderboard.service';
import { ContestsCron } from './contests.cron';
import { UsersModule } from '../users/users.module';
import { PrizeClaimsModule } from '../prize-claims/prize-claims.module';
import { BalanceModule } from '../balance/balance.module';

@Module({
  imports: [UsersModule, forwardRef(() => PrizeClaimsModule), BalanceModule],
  controllers: [ContestsController],
  providers: [ContestsService, ContestsLeaderboardService, ContestsCron],
  exports: [ContestsService, ContestsLeaderboardService],
})
export class ContestsModule {}
