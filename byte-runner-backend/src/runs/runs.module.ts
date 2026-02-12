import { Module } from '@nestjs/common';
import { RunsController } from './runs.controller';
import { RunsService } from './runs.service';
import { UsersModule } from '../users/users.module';
import { ContestsModule } from '../contests/contests.module';

@Module({
  imports: [UsersModule, ContestsModule],
  controllers: [RunsController],
  providers: [RunsService],
})
export class RunsModule {}
