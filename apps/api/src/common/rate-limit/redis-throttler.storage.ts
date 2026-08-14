import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';
import type { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface';
import type Redis from 'ioredis';

import { REDIS_CLIENT } from '../cache/redis.provider';

interface MemoryCounter {
  hits: number;
  expiresAt: number;
  blockedUntil: number;
}

/**
 * Rate limit counters backed by Redis, so limits are shared by every API
 * instance instead of being per process. When Redis is absent or unreachable the
 * storage silently falls back to an in-process counter: degraded, but still
 * protecting the endpoint.
 *
 * `ttl` and `blockDuration` arrive in milliseconds; the returned expiry values
 * are in seconds, matching the contract of the built-in storage.
 */
@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
  private readonly logger = new Logger(RedisThrottlerStorage.name);
  private readonly memory = new Map<string, MemoryCounter>();
  private redisUsable: boolean;

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis | null) {
    this.redisUsable = redis !== null;
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    if (this.redis && this.redisUsable) {
      try {
        return await this.incrementInRedis(key, ttl, limit, blockDuration, throttlerName);
      } catch (error) {
        this.degrade(error);
      }
    }

    return this.incrementInMemory(key, ttl, limit, blockDuration, throttlerName);
  }

  private async incrementInRedis(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const redis = this.redis as Redis;
    const hitsKey = `gs:throttle:${throttlerName}:${key}`;
    const blockKey = `gs:throttle:blocked:${throttlerName}:${key}`;
    const effectiveBlockDuration = blockDuration > 0 ? blockDuration : ttl;

    const blockTtl = await redis.pttl(blockKey);
    if (blockTtl > 0) {
      const seconds = Math.ceil(blockTtl / 1000);
      return {
        totalHits: limit + 1,
        timeToExpire: seconds,
        isBlocked: true,
        timeToBlockExpire: seconds,
      };
    }

    const hits = await redis.incr(hitsKey);
    if (hits === 1) {
      await redis.pexpire(hitsKey, ttl);
    }

    let hitsTtl = await redis.pttl(hitsKey);
    if (hitsTtl < 0) {
      // The counter lost its expiry (a crash between INCR and PEXPIRE). Restore
      // it rather than leaving a key that never resets.
      await redis.pexpire(hitsKey, ttl);
      hitsTtl = ttl;
    }

    if (hits > limit) {
      await redis.set(blockKey, '1', 'PX', effectiveBlockDuration);
      return {
        totalHits: hits,
        timeToExpire: Math.ceil(hitsTtl / 1000),
        isBlocked: true,
        timeToBlockExpire: Math.ceil(effectiveBlockDuration / 1000),
      };
    }

    return {
      totalHits: hits,
      timeToExpire: Math.ceil(hitsTtl / 1000),
      isBlocked: false,
      timeToBlockExpire: 0,
    };
  }

  private incrementInMemory(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): ThrottlerStorageRecord {
    const now = Date.now();
    const compositeKey = `${throttlerName}:${key}`;
    const effectiveBlockDuration = blockDuration > 0 ? blockDuration : ttl;

    let counter = this.memory.get(compositeKey);

    if (counter && counter.blockedUntil > now) {
      const seconds = Math.ceil((counter.blockedUntil - now) / 1000);
      return {
        totalHits: limit + 1,
        timeToExpire: seconds,
        isBlocked: true,
        timeToBlockExpire: seconds,
      };
    }

    if (!counter || counter.expiresAt <= now) {
      counter = { hits: 0, expiresAt: now + ttl, blockedUntil: 0 };
    }

    counter.hits += 1;
    this.memory.set(compositeKey, counter);
    this.pruneMemory(now);

    if (counter.hits > limit) {
      counter.blockedUntil = now + effectiveBlockDuration;
      return {
        totalHits: counter.hits,
        timeToExpire: Math.ceil((counter.expiresAt - now) / 1000),
        isBlocked: true,
        timeToBlockExpire: Math.ceil(effectiveBlockDuration / 1000),
      };
    }

    return {
      totalHits: counter.hits,
      timeToExpire: Math.ceil((counter.expiresAt - now) / 1000),
      isBlocked: false,
      timeToBlockExpire: 0,
    };
  }

  /** Keeps the fallback map from growing without bound on a long-lived process. */
  private pruneMemory(now: number): void {
    if (this.memory.size < 5_000) return;
    for (const [key, counter] of this.memory) {
      if (counter.expiresAt <= now && counter.blockedUntil <= now) {
        this.memory.delete(key);
      }
    }
  }

  private degrade(error: unknown): void {
    if (this.redisUsable) {
      this.redisUsable = false;
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Rate limiting fell back to in-process counters: ${message}`);
    }
  }
}
