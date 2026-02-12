import { Module, Injectable, ExecutionContext } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';

@Injectable()
class CustomThrottlerGuard extends ThrottlerGuard {
  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    // Skip throttling for SuperTokens auth endpoints
    return request.url?.startsWith('/auth');
  }
}
import { AppController } from './app.controller';
import configuration from './config/configuration';
import { SupabaseModule } from './supabase/supabase.module';
import { UsersModule } from './users/users.module';
import { RunsModule } from './runs/runs.module';
import { LeaderboardModule } from './leaderboard/leaderboard.module';
import { SharesModule } from './shares/shares.module';
import { ContestsModule } from './contests/contests.module';
import { PrizeClaimsModule } from './prize-claims/prize-claims.module';
import { BadgesModule } from './badges/badges.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        throttlers: [
          {
            name: 'default',
            ttl: configService.get<number>('rateLimit.ttlSeconds') || 60,
            limit: configService.get<number>('rateLimit.limit') || 15,
          },
        ],
      }),
    }),
    SupabaseModule,
    UsersModule,
    RunsModule,
    LeaderboardModule,
    SharesModule,
    ContestsModule,
    PrizeClaimsModule,
    BadgesModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: CustomThrottlerGuard,
    },
  ],
})
export class AppModule {}
