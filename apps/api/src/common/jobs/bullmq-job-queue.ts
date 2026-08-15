import { Logger, type OnApplicationBootstrap, type OnModuleDestroy } from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';

import { JOB_NAMES } from './job-names';
import type { JobHandler, JobQueue } from './job-queue';

const QUEUE_NAME = 'gamescore';

const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 2000 },
  removeOnComplete: { count: 200 },
  removeOnFail: { count: 100 },
};

/**
 * Redis-backed {@link JobQueue}. Work survives process restarts; handlers stay
 * registered by the same domain services that used the in-process queue.
 */
export class BullMqJobQueue implements JobQueue, OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(BullMqJobQueue.name);
  private readonly connection: Redis;
  private readonly queue: Queue;
  private worker: Worker | null = null;
  private readonly handlers = new Map<string, JobHandler<unknown>>();

  constructor(redisUrl: string) {
    this.connection = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
    this.queue = new Queue(QUEUE_NAME, { connection: this.connection });
  }

  register<TPayload>(name: string, handler: JobHandler<TPayload>): void {
    if (this.handlers.has(name)) {
      throw new Error(`A handler for job "${name}" is already registered`);
    }
    this.handlers.set(name, handler as JobHandler<unknown>);
  }

  async enqueue<TPayload>(name: string, payload: TPayload): Promise<void> {
    try {
      const jobId = stableJobId(name, payload);
      await this.queue.add(name, payload, {
        ...DEFAULT_JOB_OPTIONS,
        ...(jobId ? { jobId } : {}),
      });
    } catch (error) {
      if (isDuplicateJobId(error)) {
        return;
      }
      this.logger.error(
        `Failed to enqueue job "${name}"`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  async drain(): Promise<void> {
    for (let attempt = 0; attempt < 200; attempt += 1) {
      const counts = await this.queue.getJobCounts('active', 'waiting', 'delayed');
      if ((counts.active ?? 0) + (counts.waiting ?? 0) + (counts.delayed ?? 0) === 0) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  onApplicationBootstrap(): void {
    this.worker = new Worker(
      QUEUE_NAME,
      async (job) => {
        const handler = this.handlers.get(job.name);
        if (!handler) {
          throw new Error(`No handler registered for job "${job.name}"`);
        }
        await handler(job.data);
      },
      { connection: this.connection.duplicate() },
    );
    this.worker.on('failed', (job, error) => {
      this.logger.error(`Job "${job?.name ?? 'unknown'}" failed`, error.stack);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue.close();
    this.connection.disconnect();
  }
}

function stableJobId(name: string, payload: unknown): string | undefined {
  if (name === JOB_NAMES.RECALCULATE_GAME_SCORE && isRecord(payload) && typeof payload.gameId === 'string') {
    return `recalculate:${payload.gameId}`;
  }
  if (
    name === JOB_NAMES.DETECT_REVIEW_BOMB &&
    isRecord(payload) &&
    typeof payload.gameId === 'string' &&
    typeof payload.date === 'string'
  ) {
    return `detect-bomb:${payload.gameId}:${payload.date}`;
  }
  if (name === JOB_NAMES.INVALIDATE_RANKINGS) {
    return 'invalidate-rankings';
  }
  if (name === JOB_NAMES.SNAPSHOT_SCORES) {
    return `snapshot:${utcDate()}`;
  }
  if (name === JOB_NAMES.MAINTENANCE) {
    return `maintenance:${utcDate()}`;
  }
  return undefined;
}

function utcDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isDuplicateJobId(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = 'code' in error ? String(error.code) : '';
  const message = error instanceof Error ? error.message : String(error);
  return code === 'EJOBIDCONFLICT' || /already (exists|exists with this id)/i.test(message);
}
