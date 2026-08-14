import { Global, Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';

import { AppConfigService } from '../config/app-config.service';
import { RedisThrottlerStorage } from './redis-throttler.storage';

/**
 * Global rate limiting. Individual routes tighten this with `@Throttle(...)`;
 * the values here are only the blanket ceiling that protects the API from a
 * single client hammering it.
 *
 * Limits are disabled while tests run so the suite stays deterministic; the
 * storage itself is unit tested instead.
 */
@Global()
@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      inject: [AppConfigService, RedisThrottlerStorage],
      useFactory: (config: AppConfigService, storage: RedisThrottlerStorage) => ({
        throttlers: [{ name: 'default', ttl: 60_000, limit: 300 }],
        storage,
        skipIf: () => config.isTest,
        errorMessage: 'Too many requests, please slow down',
      }),
    }),
  ],
  providers: [RedisThrottlerStorage],
  exports: [ThrottlerModule, RedisThrottlerStorage],
})
export class RateLimitModule {}
