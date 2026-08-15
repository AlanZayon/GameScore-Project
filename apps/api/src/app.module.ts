import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard } from '@nestjs/throttler';

import { CacheModule } from './common/cache/cache.module';
import { AppConfigModule } from './common/config/app-config.module';
import { EmailModule } from './common/email/email.module';
import { AllExceptionsFilter } from './common/errors/all-exceptions.filter';
import { JobsModule } from './common/jobs/jobs.module';
import { LoggingModule } from './common/logging/logging.module';
import { PrismaModule } from './common/prisma/prisma.module';
import { RateLimitModule } from './common/rate-limit/rate-limit.module';
import { AdminModule } from './modules/admin/admin.module';
import { AuthModule } from './modules/auth/auth.module';
import { GamesModule } from './modules/games/games.module';
import { HealthModule } from './modules/health/health.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { RankingsModule } from './modules/rankings/rankings.module';
import { RatingsModule } from './modules/ratings/ratings.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { SearchModule } from './modules/search/search.module';
import { UsersModule } from './modules/users/users.module';

/**
 * Composition root of the modular monolith. Each feature module owns its
 * controllers, application services, domain logic and repositories, so any of
 * them could later be lifted into its own service.
 */
@Module({
  imports: [
    AppConfigModule,
    LoggingModule,
    PrismaModule,
    EmailModule,
    CacheModule,
    RateLimitModule,
    JobsModule,
    ScheduleModule.forRoot(),
    AuthModule,
    UsersModule,
    GamesModule,
    SearchModule,
    ReviewsModule,
    RatingsModule,
    RankingsModule,
    IntegrationsModule,
    AdminModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      // Applies the blanket rate limit to every route; individual endpoints
      // narrow it with @Throttle.
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
