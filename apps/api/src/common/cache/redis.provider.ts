import { Logger, type Provider } from '@nestjs/common';
import Redis from 'ioredis';

import { AppConfigService } from '../config/app-config.service';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

/**
 * Redis is optional by design: the platform is fully functional on PostgreSQL
 * alone, and Redis only makes hot paths cheaper. When `REDIS_URL` is unset, or
 * the server is unreachable, the application keeps working with in-process
 * fallbacks instead of failing to boot.
 */
export const redisProvider: Provider = {
  provide: REDIS_CLIENT,
  inject: [AppConfigService],
  useFactory: (config: AppConfigService): Redis | null => {
    const logger = new Logger('Redis');
    const url = config.redisUrl;

    if (!url) {
      logger.log('REDIS_URL is not set; using in-process cache and rate limiting.');
      return null;
    }

    const client = new Redis(url, {
      maxRetriesPerRequest: 2,
      enableOfflineQueue: false,
      lazyConnect: false,
      retryStrategy: (attempt) => Math.min(attempt * 500, 5000),
    });

    let hasLoggedFailure = false;
    client.on('error', (error: Error) => {
      if (!hasLoggedFailure) {
        hasLoggedFailure = true;
        logger.warn(`Redis unavailable (${error.message}); falling back to in-process behaviour.`);
      }
    });
    client.on('ready', () => {
      hasLoggedFailure = false;
      logger.log('Connected to Redis.');
    });

    return client;
  },
};
