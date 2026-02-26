import { Module } from '@nestjs/common';
import { BadgesController } from './badges.controller';
import { BadgesService } from './badges.service';
import { SharesModule } from '../shares/shares.module';

@Module({
  imports: [SharesModule],
  controllers: [BadgesController],
  providers: [BadgesService],
  exports: [BadgesService],
})
export class BadgesModule {}
