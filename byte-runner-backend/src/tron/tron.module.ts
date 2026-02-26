import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TronService } from './tron.service';

@Module({
  imports: [ConfigModule],
  providers: [TronService],
  exports: [TronService],
})
export class TronModule {}
