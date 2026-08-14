import { Global, Module } from '@nestjs/common';

import { CacheService } from './cache.service';
import { redisProvider } from './redis.provider';

@Global()
@Module({
  providers: [redisProvider, CacheService],
  exports: [CacheService, redisProvider],
})
export class CacheModule {}
