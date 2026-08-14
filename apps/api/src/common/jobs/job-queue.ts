/**
 * Job queue abstraction.
 *
 * The MVP runs background work in-process, which is the right answer while
 * everything lives in one deployable. The interface exists so that swapping in
 * BullMQ or RabbitMQ later is a new implementation of `JobQueue` plus a module
 * binding, with no change to the domain services that enqueue work.
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
