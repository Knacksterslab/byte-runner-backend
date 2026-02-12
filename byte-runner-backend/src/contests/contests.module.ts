import { Module } from '@nestjs/common';
import { ContestsController } from './contests.controller';
import { ContestsService } from './contests.service';
import { ContestsCron } from './contests.cron';
import { UsersModule } from '../users/users.module';
import { PrizeClaimsModule } from '../prize-claims/prize-claims.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [UsersModule, PrizeClaimsModule, ConfigModule],
  controllers: [ContestsController],
  providers: [ContestsService, ContestsCron],
  exports: [ContestsService],
})
export class ContestsModule {}
