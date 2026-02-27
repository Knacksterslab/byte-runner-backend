import { Module, Injectable, ExecutionContext } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ResolveUserInterceptor } from './common/interceptors/resolve-user.interceptor';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
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
import { BalanceModule } from './balance/balance.module';
import { HourlyChallengesModule } from './hourly-challenges/hourly-challenges.module';
import { FraudPreventionModule } from './fraud-prevention/fraud-prevention.module';
import { TronModule } from './tron/tron.module';
import { SponsorsModule } from './sponsors/sponsors.module';
import { EmailModule } from './email/email.module';

@Injectable()
class CustomThrottlerGuard extends ThrottlerGuard {
  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    return request.url?.startsWith('/auth');
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        throttlers: [
          {
            name: 'default',
            ttl: configService.get<number>('rateLimit.ttlSeconds') ?? 60,
            limit: configService.get<number>('rateLimit.limit') ?? 15,
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
    FraudPreventionModule,
    TronModule,
    SponsorsModule,
    EmailModule,
    BalanceModule,
    HourlyChallengesModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_GUARD, useClass: CustomThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: ResolveUserInterceptor },
  ],
})
export class AppModule {}
