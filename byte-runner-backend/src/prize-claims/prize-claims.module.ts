import { Module } from '@nestjs/common';
import { PrizeClaimsController } from './prize-claims.controller';
import { PrizeClaimsService } from './prize-claims.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule],
  controllers: [PrizeClaimsController],
  providers: [PrizeClaimsService],
  exports: [PrizeClaimsService],
})
export class PrizeClaimsModule {}
