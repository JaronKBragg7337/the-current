import {
  createSimulation,
  restoreSimulation,
  type CurrentSimulation,
} from '../simulation';
import {
  DEFAULT_SIMULATION_SPEED,
  SIMULATION_WORKER_PROTOCOL_VERSION,
  isSimulationWorkerCommand,
  type ErrorResponse,
  type EventBatchResponse,
  type HostPerformanceMetrics,
  type MetricsResponse,
  type ProjectionResponse,
  type ReadyResponse,
  type SimulationHostState,
  type SimulationSpeed,
  type SimulationWorkerCommand,
  type SimulationWorkerCommandType,
  type SimulationWorkerResponse,
  type SnapshotResponse,
  type InspectionResponse,
} from './protocol';

export type SimulationResponseEmitter = (response: SimulationWorkerResponse) => void;

interface ResponseEnvelopeFields {
  protocolVersion: typeof SIMULATION_WORKER_PROTOCOL_VERSION;
  responseId: number;
  inReplyTo: string | null;
  emittedAt: number;
}

const CONTINUOUS_PULSE_MILLISECONDS = 25;
const MAX_ELAPSED_MILLISECONDS_PER_PULSE = 1_000;
const MAX_MANUAL_ADVANCE_DAYS = 1_000_000;

function nowMilliseconds(): number {
  return typeof performance === 'undefined' ? Date.now() : performance.now();
}

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolveYield) => {
    setTimeout(resolveYield, 0);
  });
}

function asMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validPositiveInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

function resolveSpeed(
  patch: Partial<SimulationSpeed> | undefined,
  base: Readonly<SimulationSpeed> = DEFAULT_SIMULATION_SPEED,
): SimulationSpeed {
  const speed: SimulationSpeed = {
    daysPerSecond: patch?.daysPerSecond ?? base.daysPerSecond,
    maxDaysPerSlice: patch?.maxDaysPerSlice ?? base.maxDaysPerSlice,
    projectionEveryDays: patch?.projectionEveryDays ?? base.projectionEveryDays,
    metricsEveryDays: patch?.metricsEveryDays ?? base.metricsEveryDays,
  };
  if (!Number.isFinite(speed.daysPerSecond) || speed.daysPerSecond < 0 || speed.daysPerSecond > 10_000) {
    throw new RangeError('daysPerSecond must be finite and between 0 and 10,000');
  }
  if (!validPositiveInteger(speed.maxDaysPerSlice) || speed.maxDaysPerSlice > 128) {
    throw new RangeError('maxDaysPerSlice must be an integer between 1 and 128');
  }
  if (!validPositiveInteger(speed.projectionEveryDays) || speed.projectionEveryDays > 100_000) {
    throw new RangeError('projectionEveryDays must be an integer between 1 and 100,000');
  }
  if (!validPositiveInteger(speed.metricsEveryDays) || speed.metricsEveryDays > 100_000) {
    throw new RangeError('metricsEveryDays must be an integer between 1 and 100,000');
  }
  return speed;
}

export class SimulationWorkerRuntime {
  private simulation: CurrentSimulation | null = null;
  private state: SimulationHostState = 'paused';
  private speed: SimulationSpeed = { ...DEFAULT_SIMULATION_SPEED };
  private responseSequence = 0;
  private lastEmittedEventSequence = 0;
  private lastProjectionDay = 0;
  private lastMetricsDay = 0;
  private totalDaysAdvanced = 0;
  private totalAdvanceMilliseconds = 0;
  private lastAdvanceMilliseconds = 0;
  private continuousAccumulatorDays = 0;
  private lastPulseAt = 0;
  private pulseTimer: ReturnType<typeof setTimeout> | null = null;
  private operationTail: Promise<void> = Promise.resolve();

  constructor(private readonly emitResponse: SimulationResponseEmitter) {}

  handleMessage(value: unknown): Promise<void> {
    if (!isSimulationWorkerCommand(value)) {
      const requestId = isObject(value) && typeof value.requestId === 'string' ? value.requestId : null;
      const protocolMismatch =
        isObject(value) &&
        typeof value.protocolVersion === 'number' &&
        value.protocolVersion !== SIMULATION_WORKER_PROTOCOL_VERSION;
      this.emitError(
        requestId,
        protocolMismatch ? 'PROTOCOL_MISMATCH' : 'INVALID_COMMAND',
        protocolMismatch
          ? `Unsupported simulation worker protocol ${String(value.protocolVersion)}`
          : 'Message is not a valid simulation worker command',
        true,
        null,
      );
      return Promise.resolve();
    }
    return this.handle(value);
  }

  handle(command: SimulationWorkerCommand): Promise<void> {
    const operation = this.operationTail.then(async () => {
      try {
        await this.execute(command);
      } catch (error: unknown) {
        this.emitError(
          command.requestId,
          this.state === 'stopped' ? 'STOPPED' : 'COMMAND_FAILED',
          asMessage(error),
          this.state !== 'stopped',
          command.type,
        );
      }
    });
    this.operationTail = operation.catch(() => undefined);
    return operation;
  }

  dispose(): void {
    this.cancelPulse();
    this.state = 'stopped';
    this.simulation = null;
    this.continuousAccumulatorDays = 0;
  }

  private async execute(command: SimulationWorkerCommand): Promise<void> {
    if (this.state === 'stopped') {
      throw new Error('Simulation host has been stopped');
    }

    switch (command.type) {
      case 'INIT': {
        if (this.simulation !== null) {
          this.emitError(
            command.requestId,
            'ALREADY_INITIALIZED',
            'INIT cannot replace an existing world; use LOAD or create a new host',
            true,
            command.type,
          );
          return;
        }
        this.speed = resolveSpeed(command.speed);
        this.simulation = createSimulation(command.options);
        this.resetProjectionState(false);
        this.state = command.startPaused === false && this.speed.daysPerSecond > 0 ? 'running' : 'paused';
        this.emitReady(command.requestId);
        this.emitPendingEvents(command.requestId);
        this.emitProjection(command.requestId);
        this.emitMetrics(command.requestId);
        this.schedulePulse();
        return;
      }
      case 'LOAD': {
        this.cancelPulse();
        this.speed = resolveSpeed(command.speed, this.speed);
        this.simulation = restoreSimulation(command.snapshot);
        this.resetProjectionState(true);
        this.state = command.startPaused === false && this.speed.daysPerSecond > 0 ? 'running' : 'paused';
        this.emitReady(command.requestId);
        this.emitProjection(command.requestId);
        this.emitMetrics(command.requestId);
        this.schedulePulse();
        return;
      }
      case 'ADVANCE': {
        const simulation = this.requireSimulation();
        if (!Number.isSafeInteger(command.days) || command.days < 0 || command.days > MAX_MANUAL_ADVANCE_DAYS) {
          throw new RangeError(`ADVANCE days must be an integer between 0 and ${MAX_MANUAL_ADVANCE_DAYS}`);
        }
        const projectionInterval =
          command.projectionEveryDays === undefined
            ? this.speed.projectionEveryDays
            : command.projectionEveryDays;
        if (!validPositiveInteger(projectionInterval)) {
          throw new RangeError('ADVANCE projectionEveryDays must be a positive integer');
        }
        await this.advanceCooperatively(simulation, command.days, projectionInterval, command.requestId);
        return;
      }
      case 'SET_SPEED': {
        this.requireSimulation();
        this.speed = resolveSpeed(command.speed, this.speed);
        this.continuousAccumulatorDays = 0;
        this.lastPulseAt = nowMilliseconds();
        if (this.speed.daysPerSecond === 0) {
          this.state = 'paused';
          this.cancelPulse();
        } else {
          this.state = 'running';
          this.schedulePulse();
        }
        this.emitReady(command.requestId);
        return;
      }
      case 'PAUSE': {
        this.requireSimulation();
        this.state = 'paused';
        this.continuousAccumulatorDays = 0;
        this.cancelPulse();
        this.emitReady(command.requestId);
        return;
      }
      case 'SIGNAL': {
        const simulation = this.requireSimulation();
        simulation.queueSignal(command.signal);
        this.emitPendingEvents(command.requestId);
        this.emitProjection(command.requestId);
        return;
      }
      case 'INTERVENTION': {
        const simulation = this.requireSimulation();
        simulation.queueIntervention(command.intervention);
        this.emitProjection(command.requestId);
        return;
      }
      case 'INSPECT': {
        const simulation = this.requireSimulation();
        const response: InspectionResponse = {
          ...this.envelope(command.requestId),
          type: 'INSPECTION',
          entityType: 'person',
          entityId: command.entityId,
          value: simulation.inspectPerson(command.entityId),
        };
        this.emitResponse(response);
        return;
      }
      case 'EXPORT': {
        const simulation = this.requireSimulation();
        const response: SnapshotResponse = {
          ...this.envelope(command.requestId),
          type: 'SNAPSHOT',
          reason: 'export',
          snapshot: simulation.snapshot(),
        };
        this.emitResponse(response);
        return;
      }
      case 'STOP': {
        const simulation = this.requireSimulation();
        this.cancelPulse();
        this.state = 'stopped';
        this.continuousAccumulatorDays = 0;
        this.emitReady(command.requestId, simulation);
        return;
      }
    }
  }

  private requireSimulation(): CurrentSimulation {
    if (this.simulation === null) {
      throw new Error('Simulation is not initialized; send INIT or LOAD first');
    }
    return this.simulation;
  }

  private resetProjectionState(restored: boolean): void {
    const simulation = this.requireSimulation();
    const day = simulation.currentDay;
    this.lastEmittedEventSequence = restored ? simulation.snapshot().state.eventSequence : 0;
    this.lastProjectionDay = day;
    this.lastMetricsDay = day;
    this.totalDaysAdvanced = 0;
    this.totalAdvanceMilliseconds = 0;
    this.lastAdvanceMilliseconds = 0;
    this.continuousAccumulatorDays = 0;
    this.lastPulseAt = nowMilliseconds();
  }

  private async advanceCooperatively(
    simulation: CurrentSimulation,
    days: number,
    projectionInterval: number,
    inReplyTo: string,
  ): Promise<void> {
    if (days === 0) {
      this.emitProjection(inReplyTo);
      this.emitMetrics(inReplyTo);
      return;
    }

    let remaining = days;
    while (remaining > 0) {
      const daysSinceProjection = simulation.currentDay - this.lastProjectionDay;
      const daysUntilProjection = Math.max(1, projectionInterval - daysSinceProjection);
      const sliceDays = Math.min(
        remaining,
        this.speed.maxDaysPerSlice,
        daysUntilProjection,
      );
      const startedAt = nowMilliseconds();
      for (let day = 0; day < sliceDays; day += 1) simulation.advanceDay();
      this.recordAdvance(sliceDays, nowMilliseconds() - startedAt);
      remaining -= sliceDays;
      this.emitPendingEvents(inReplyTo);
      const isFinal = remaining === 0;
      if (isFinal || simulation.currentDay - this.lastProjectionDay >= projectionInterval) {
        this.emitProjection(inReplyTo);
      }
      if (isFinal || simulation.currentDay - this.lastMetricsDay >= this.speed.metricsEveryDays) {
        this.emitMetrics(inReplyTo);
      }
      if (!isFinal) await yieldToEventLoop();
    }
  }

  private recordAdvance(days: number, milliseconds: number): void {
    this.totalDaysAdvanced += days;
    this.totalAdvanceMilliseconds += milliseconds;
    this.lastAdvanceMilliseconds = milliseconds;
  }

  private schedulePulse(): void {
    if (this.state !== 'running' || this.pulseTimer !== null) return;
    if (this.lastPulseAt === 0) this.lastPulseAt = nowMilliseconds();
    this.pulseTimer = setTimeout(() => {
      this.pulseTimer = null;
      const operation = this.operationTail.then(async () => {
        try {
          await this.runContinuousPulse();
        } catch (error: unknown) {
          this.state = 'paused';
          this.emitError(null, 'COMMAND_FAILED', asMessage(error), true, null);
        }
      });
      this.operationTail = operation.catch(() => undefined);
    }, CONTINUOUS_PULSE_MILLISECONDS);
  }

  private async runContinuousPulse(): Promise<void> {
    if (this.state !== 'running') return;
    const simulation = this.requireSimulation();
    const currentTime = nowMilliseconds();
    const elapsed = Math.min(
      Math.max(0, currentTime - this.lastPulseAt),
      MAX_ELAPSED_MILLISECONDS_PER_PULSE,
    );
    this.lastPulseAt = currentTime;
    this.continuousAccumulatorDays = Math.min(
      this.continuousAccumulatorDays + (elapsed / 1_000) * this.speed.daysPerSecond,
      this.speed.maxDaysPerSlice * 4,
    );

    const dueDays = Math.min(
      Math.floor(this.continuousAccumulatorDays),
      this.speed.maxDaysPerSlice,
    );
    if (dueDays > 0) {
      const startedAt = nowMilliseconds();
      for (let day = 0; day < dueDays; day += 1) simulation.advanceDay();
      this.recordAdvance(dueDays, nowMilliseconds() - startedAt);
      this.continuousAccumulatorDays -= dueDays;
      this.emitPendingEvents(null);
      if (simulation.currentDay - this.lastProjectionDay >= this.speed.projectionEveryDays) {
        this.emitProjection(null);
      }
      if (simulation.currentDay - this.lastMetricsDay >= this.speed.metricsEveryDays) {
        this.emitMetrics(null);
      }
      await yieldToEventLoop();
    }
    this.schedulePulse();
  }

  private cancelPulse(): void {
    if (this.pulseTimer !== null) {
      clearTimeout(this.pulseTimer);
      this.pulseTimer = null;
    }
  }

  private envelope(inReplyTo: string | null): ResponseEnvelopeFields {
    this.responseSequence += 1;
    return {
      protocolVersion: SIMULATION_WORKER_PROTOCOL_VERSION,
      responseId: this.responseSequence,
      inReplyTo,
      emittedAt: Date.now(),
    };
  }

  private emitReady(inReplyTo: string, simulation = this.requireSimulation()): void {
    const response: ReadyResponse = {
      ...this.envelope(inReplyTo),
      type: 'READY',
      state: this.state,
      day: simulation.currentDay,
      seed: simulation.seed,
      digest: simulation.digest(),
      speed: { ...this.speed },
    };
    this.emitResponse(response);
  }

  private emitProjection(inReplyTo: string | null): void {
    const simulation = this.requireSimulation();
    const projection = simulation.projection();
    this.lastProjectionDay = projection.day;
    const response: ProjectionResponse = {
      ...this.envelope(inReplyTo),
      type: 'PROJECTION',
      projection,
    };
    this.emitResponse(response);
  }

  private emitMetrics(inReplyTo: string | null): void {
    const simulation = this.requireSimulation();
    const metrics = simulation.metrics();
    this.lastMetricsDay = metrics.day;
    const host: HostPerformanceMetrics = {
      lastAdvanceMilliseconds: this.lastAdvanceMilliseconds,
      averageMillisecondsPerDay:
        this.totalDaysAdvanced === 0 ? 0 : this.totalAdvanceMilliseconds / this.totalDaysAdvanced,
      totalDaysAdvanced: this.totalDaysAdvanced,
      continuousBacklogDays: this.continuousAccumulatorDays,
    };
    const response: MetricsResponse = {
      ...this.envelope(inReplyTo),
      type: 'METRICS',
      metrics,
      host,
    };
    this.emitResponse(response);
  }

  private emitPendingEvents(inReplyTo: string | null): void {
    const simulation = this.requireSimulation();
    const events = simulation.eventsSince(this.lastEmittedEventSequence);
    if (events.length === 0) return;
    const first = events[0];
    const last = events[events.length - 1];
    if (first === undefined || last === undefined) return;
    this.lastEmittedEventSequence = last.sequence;
    const response: EventBatchResponse = {
      ...this.envelope(inReplyTo),
      type: 'EVENT_BATCH',
      fromSequence: first.sequence,
      toSequence: last.sequence,
      events,
    };
    this.emitResponse(response);
  }

  private emitError(
    inReplyTo: string | null,
    code: ErrorResponse['code'],
    message: string,
    recoverable: boolean,
    commandType: SimulationWorkerCommandType | null,
  ): void {
    const response: ErrorResponse = {
      ...this.envelope(inReplyTo),
      type: 'ERROR',
      code,
      message,
      recoverable,
      commandType,
    };
    this.emitResponse(response);
  }
}
