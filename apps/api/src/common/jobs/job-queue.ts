/**
 * Job queue abstraction.
 *
 * Background work is enqueued through this port. Tests and environments
 * without Redis use the in-process implementation; otherwise BullMQ persists
 * jobs in Redis. Domain services never import a specific queue library.
 */
export const JOB_QUEUE = Symbol('JOB_QUEUE');

export type JobHandler<TPayload> = (payload: TPayload) => Promise<void>;

export interface JobQueue {
  /**
   * Schedules work to run outside the current request. Never rejects: a failed
   * background job must not break the user-facing operation that triggered it.
   */
  enqueue<TPayload>(name: string, payload: TPayload): Promise<void>;

  /** Registers the handler for a job name. */
  register<TPayload>(name: string, handler: JobHandler<TPayload>): void;

  /** Waits for all in-flight jobs. Used by tests to stay deterministic. */
  drain(): Promise<void>;
}
