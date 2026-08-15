import { Inject, Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import type Redis from 'ioredis';

import { REDIS_CLIENT } from './redis.provider';

interface MemoryEntry {
  value: string;
  expiresAt: number;
}

/**
 * Small cache abstraction used for genuinely hot, cheap-to-rebuild data such as
 * rankings and the home feed. It is intentionally not used for anything the
 * database is the source of truth for.
 */
@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private readonly memory = new Map<string, MemoryEntry>();
  private readonly inflight = new Map<string, Promise<unknown>>();
  private redisHealthy: boolean;

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis | null) {
    this.redisHealthy = redis !== null;
  }

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.readRaw(key);
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      await this.delete(key);
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    const raw = JSON.stringify(value);

    if (this.redis && this.redisHealthy) {
      try {
        await this.redis.set(key, raw, 'EX', Math.max(1, Math.trunc(ttlSeconds)));
        return;
      } catch (error) {
        this.degrade(error);
      }
    }

    this.memory.set(key, { value: raw, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  async delete(key: string): Promise<void> {
    this.memory.delete(key);
    if (this.redis && this.redisHealthy) {
      try {
        await this.redis.del(key);
      } catch (error) {
        this.degrade(error);
      }
    }
  }

  /** Invalidates a whole family of keys, e.g. every cached ranking. */
  async deleteByPrefix(prefix: string): Promise<void> {
    for (const key of this.memory.keys()) {
      if (key.startsWith(prefix)) {
        this.memory.delete(key);
      }
    }

    if (this.redis && this.redisHealthy) {
      try {
        // SCAN rather than KEYS: this must never block the Redis event loop.
        let cursor = '0';
        do {
          const [next, keys] = await this.redis.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 200);
          cursor = next;
          if (keys.length > 0) {
            await this.redis.del(...keys);
          }
        } while (cursor !== '0');
      } catch (error) {
        this.degrade(error);
      }
    }
  }

  /** Returns the cached value, or computes, stores and returns a fresh one. */
  async wrap<T>(key: string, ttlSeconds: number, factory: () => Promise<T>): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const existing = this.inflight.get(key);
    if (existing) {
      return existing as Promise<T>;
    }

    const pending = (async () => {
      try {
        const again = await this.get<T>(key);
        if (again !== null) {
          return again;
        }
        const value = await factory();
        await this.set(key, value, ttlSeconds);
        return value;
      } finally {
        this.inflight.delete(key);
      }
    })();

    this.inflight.set(key, pending);
    return pending;
  }

  private async readRaw(key: string): Promise<string | null> {
    if (this.redis && this.redisHealthy) {
      try {
        return await this.redis.get(key);
      } catch (error) {
        this.degrade(error);
      }
    }

    const entry = this.memory.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      this.memory.delete(key);
      return null;
    }
    return entry.value;
  }

  private degrade(error: unknown): void {
    if (this.redisHealthy) {
      this.redisHealthy = false;
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Redis cache disabled for this process: ${message}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.memory.clear();
    this.inflight.clear();
    if (this.redis) {
      await this.redis.quit().catch(() => undefined);
    }
  }
}
