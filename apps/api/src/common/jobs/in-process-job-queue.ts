import { Injectable, Logger } from '@nestjs/common';

import type { JobHandler, JobQueue } from './job-queue';

/**
 * In-process implementation of {@link JobQueue}.
 *
 * Work is executed on the microtask queue, so the HTTP response is not delayed,
 * while `drain()` gives tests a deterministic way to await the side effects.
 */
@Injectable()
export class InProcessJobQueue implements JobQueue {
  private readonly logger = new Logger(InProcessJobQueue.name);
  private readonly handlers = new Map<string, JobHandler<unknown>>();
  private readonly inFlight = new Set<Promise<void>>();

  register<TPayload>(name: string, handler: JobHandler<TPayload>): void {
    if (this.handlers.has(name)) {
      throw new Error(`A handler for job "${name}" is already registered`);
    }
    this.handlers.set(name, handler as JobHandler<unknown>);
  }

  async enqueue<TPayload>(name: string, payload: TPayload): Promise<void> {
    const handler = this.handlers.get(name);
    if (!handler) {
      this.logger.warn(`No handler registered for job "${name}"; dropping it.`);
      return;
    }

    const execution = (async () => {
      try {
        await handler(payload);
      } catch (error) {
        // Background failures are logged, never propagated: the user request
        // that scheduled this job has already succeeded.
        this.logger.error(
          `Job "${name}" failed`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    })();

    this.inFlight.add(execution);
    void execution.finally(() => this.inFlight.delete(execution));
  }

  async drain(): Promise<void> {
    // Jobs may enqueue further jobs, so keep draining until nothing is left.
    while (this.inFlight.size > 0) {
      await Promise.all([...this.inFlight]);
    }
  }
}
