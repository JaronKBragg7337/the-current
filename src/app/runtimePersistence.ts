import type { EventChunkRecord, ExternalInputRecord } from '../persistence';

export const PERSISTENCE_WAITER_TIMEOUT_MS = 30_000;
export const AUTOSAVE_MIN_INTERVAL_MS = 2_000;

export interface TimedDeferred<T> {
  promise: Promise<T>;
  reject: (reason: unknown) => void;
  resolve: (value: T) => void;
}

export function createTimedDeferred<T>(
  label: string,
  timeoutMilliseconds = PERSISTENCE_WAITER_TIMEOUT_MS,
  onSettled?: () => void,
): TimedDeferred<T> {
  if (!Number.isFinite(timeoutMilliseconds) || timeoutMilliseconds <= 0) {
    throw new RangeError('Deferred timeout must be a positive finite number');
  }

  let settled = false;
  let resolvePromise: ((value: T) => void) | undefined;
  let rejectPromise: ((reason: unknown) => void) | undefined;
  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });
  // The original promise remains rejectable to awaiters; this handler only
  // prevents a timeout from becoming an unhandled rejection before it is awaited.
  void promise.catch(() => undefined);

  const timer = setTimeout(() => {
    if (settled) return;
    settled = true;
    onSettled?.();
    rejectPromise?.(new Error(`${label} timed out after ${timeoutMilliseconds.toString()}ms`));
  }, timeoutMilliseconds);

  const settle = (callback: () => void): void => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    onSettled?.();
    callback();
  };

  return {
    promise,
    reject: (reason) => settle(() => rejectPromise?.(reason)),
    resolve: (value) => settle(() => resolvePromise?.(value)),
  };
}

export class TimedWaiterRegistry<T> {
  private readonly waiters = new Map<string, TimedDeferred<T>>();

  get size(): number {
    return this.waiters.size;
  }

  wait(
    requestId: string,
    label: string,
    timeoutMilliseconds = PERSISTENCE_WAITER_TIMEOUT_MS,
  ): Promise<T> {
    if (this.waiters.has(requestId)) {
      throw new Error(`A waiter already exists for ${requestId}`);
    }
    const deferred = createTimedDeferred<T>(label, timeoutMilliseconds, () => {
      if (this.waiters.get(requestId) === deferred) this.waiters.delete(requestId);
    });
    this.waiters.set(requestId, deferred);
    return deferred.promise;
  }

  resolve(requestId: string, value: T): boolean {
    const waiter = this.waiters.get(requestId);
    if (waiter === undefined) return false;
    waiter.resolve(value);
    return true;
  }

  reject(requestId: string, reason: unknown): boolean {
    const waiter = this.waiters.get(requestId);
    if (waiter === undefined) return false;
    waiter.reject(reason);
    return true;
  }

  rejectAll(reason: unknown): void {
    for (const waiter of [...this.waiters.values()]) waiter.reject(reason);
  }
}

interface AutosaveSchedulerOptions {
  request: (day: number, requestId: string) => void;
  onError: (error: unknown) => void;
  idFactory: () => string;
  minimumIntervalMilliseconds?: number;
  now?: () => number;
}

export interface AutosaveSchedulerState {
  inFlightDay: number | null;
  inFlightRequestId: string | null;
  pendingDay: number | null;
}

/**
 * Keeps no more than one automatic export in flight and collapses projections
 * that arrive while it is saving into one latest-day request.
 */
export class AutosaveScheduler {
  private readonly minimumIntervalMilliseconds: number;
  private readonly now: () => number;
  private inFlight: { day: number; requestId: string } | null = null;
  private pendingDay: number | null = null;
  private lastStartedAt = Number.NEGATIVE_INFINITY;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;

  constructor(private readonly options: AutosaveSchedulerOptions) {
    this.minimumIntervalMilliseconds =
      options.minimumIntervalMilliseconds ?? AUTOSAVE_MIN_INTERVAL_MS;
    this.now = options.now ?? Date.now;
    if (
      !Number.isFinite(this.minimumIntervalMilliseconds)
      || this.minimumIntervalMilliseconds < 0
    ) {
      throw new RangeError('Autosave minimum interval must be a finite non-negative number');
    }
  }

  get state(): AutosaveSchedulerState {
    return {
      inFlightDay: this.inFlight?.day ?? null,
      inFlightRequestId: this.inFlight?.requestId ?? null,
      pendingDay: this.pendingDay,
    };
  }

  queue(day: number): void {
    if (this.disposed) return;
    if (!Number.isSafeInteger(day) || day < 0) {
      throw new RangeError('Autosave day must be a non-negative safe integer');
    }
    this.pendingDay = Math.max(this.pendingDay ?? day, day);
    this.pump();
  }

  complete(requestId: string): boolean {
    if (this.inFlight?.requestId !== requestId) return false;
    this.inFlight = null;
    this.pump();
    return true;
  }

  fail(requestId: string, error: unknown): boolean {
    if (this.inFlight?.requestId !== requestId) return false;
    this.inFlight = null;
    this.options.onError(error);
    this.pump();
    return true;
  }

  abort(): void {
    this.pendingDay = null;
    this.inFlight = null;
    this.lastStartedAt = Number.NEGATIVE_INFINITY;
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  dispose(): void {
    this.disposed = true;
    this.abort();
  }

  private pump(): void {
    if (this.disposed || this.inFlight !== null || this.pendingDay === null) return;
    const remaining = this.minimumIntervalMilliseconds - (this.now() - this.lastStartedAt);
    if (remaining > 0) {
      if (this.timer === null) {
        this.timer = setTimeout(() => {
          this.timer = null;
          this.pump();
        }, remaining);
      }
      return;
    }

    const day = this.pendingDay;
    const requestId = this.options.idFactory();
    this.pendingDay = null;
    this.inFlight = { day, requestId };
    this.lastStartedAt = this.now();
    try {
      this.options.request(day, requestId);
    } catch (error: unknown) {
      this.inFlight = null;
      this.options.onError(error);
    }
  }
}

export function queuedWorldDay(record: ExternalInputRecord): number {
  if (record.queuedDay !== undefined) return record.queuedDay;
  if (record.kind === 'signal') return record.input.timestampDay;
  return Math.max(0, record.effectiveDay - 1);
}

export function calculateRecoveryDay(
  snapshotDay: number,
  laterEventChunks: ReadonlyArray<Pick<EventChunkRecord, 'lastDay'>>,
  externalInputs: readonly ExternalInputRecord[],
): number {
  const eventDay = laterEventChunks.reduce(
    (latest, chunk) => Math.max(latest, chunk.lastDay),
    snapshotDay,
  );
  return externalInputs.reduce(
    (latest, record) => Math.max(latest, queuedWorldDay(record)),
    eventDay,
  );
}

export async function drainPendingOperations(
  operations: ReadonlySet<Promise<void>>,
): Promise<void> {
  while (operations.size > 0) {
    await Promise.all([...operations]);
  }
}
