import type {
  NormalizedSignal,
  ObserverIntervention,
  Person,
  SimulationCreateOptions,
  SimulationEvent,
  SimulationMetrics,
  WorldProjection,
  WorldSnapshot,
} from '../simulation';

export const SIMULATION_WORKER_PROTOCOL_VERSION = 1 as const;

export interface SimulationSpeed {
  /** Target world days per real second. Zero pauses continuous advancement. */
  daysPerSecond: number;
  /** Hard ceiling for synchronous work performed by one scheduled pulse. */
  maxDaysPerSlice: number;
  /** Emit a projection after at most this many newly simulated days. */
  projectionEveryDays: number;
  /** Emit metrics after at most this many newly simulated days. */
  metricsEveryDays: number;
}

export const DEFAULT_SIMULATION_SPEED: Readonly<SimulationSpeed> = Object.freeze({
  daysPerSecond: 1,
  maxDaysPerSlice: 4,
  projectionEveryDays: 1,
  metricsEveryDays: 5,
});

interface CommandEnvelope {
  protocolVersion: typeof SIMULATION_WORKER_PROTOCOL_VERSION;
  requestId: string;
}

export interface InitCommand extends CommandEnvelope {
  type: 'INIT';
  options?: SimulationCreateOptions;
  speed?: Partial<SimulationSpeed>;
  startPaused?: boolean;
}

export interface LoadCommand extends CommandEnvelope {
  type: 'LOAD';
  snapshot: WorldSnapshot;
  speed?: Partial<SimulationSpeed>;
  startPaused?: boolean;
}

export interface AdvanceCommand extends CommandEnvelope {
  type: 'ADVANCE';
  days: number;
  projectionEveryDays?: number;
}

export interface SetSpeedCommand extends CommandEnvelope {
  type: 'SET_SPEED';
  speed: Partial<SimulationSpeed>;
}

export interface PauseCommand extends CommandEnvelope {
  type: 'PAUSE';
}

export interface SignalCommand extends CommandEnvelope {
  type: 'SIGNAL';
  signal: NormalizedSignal;
}

export interface InterventionCommand extends CommandEnvelope {
  type: 'INTERVENTION';
  intervention: ObserverIntervention;
}

export interface InspectCommand extends CommandEnvelope {
  type: 'INSPECT';
  entityType: 'person';
  entityId: string;
}

export interface ExportCommand extends CommandEnvelope {
  type: 'EXPORT';
}

export interface StopCommand extends CommandEnvelope {
  type: 'STOP';
}

export type SimulationWorkerCommand =
  | InitCommand
  | LoadCommand
  | AdvanceCommand
  | SetSpeedCommand
  | PauseCommand
  | SignalCommand
  | InterventionCommand
  | InspectCommand
  | ExportCommand
  | StopCommand;

export type SimulationWorkerCommandType = SimulationWorkerCommand['type'];

interface ResponseEnvelope {
  protocolVersion: typeof SIMULATION_WORKER_PROTOCOL_VERSION;
  responseId: number;
  inReplyTo: string | null;
  emittedAt: number;
}

export type SimulationHostState = 'paused' | 'running' | 'stopped';

export interface ReadyResponse extends ResponseEnvelope {
  type: 'READY';
  state: SimulationHostState;
  day: number;
  seed: string;
  digest: string;
  speed: SimulationSpeed;
}

export interface ProjectionResponse extends ResponseEnvelope {
  type: 'PROJECTION';
  projection: WorldProjection;
}

export interface EventBatchResponse extends ResponseEnvelope {
  type: 'EVENT_BATCH';
  fromSequence: number;
  toSequence: number;
  events: SimulationEvent[];
}

export interface HostPerformanceMetrics {
  lastAdvanceMilliseconds: number;
  averageMillisecondsPerDay: number;
  totalDaysAdvanced: number;
  continuousBacklogDays: number;
}

export interface MetricsResponse extends ResponseEnvelope {
  type: 'METRICS';
  metrics: SimulationMetrics;
  host: HostPerformanceMetrics;
}

export interface SnapshotResponse extends ResponseEnvelope {
  type: 'SNAPSHOT';
  reason: 'export';
  snapshot: WorldSnapshot;
}

export interface InspectionResponse extends ResponseEnvelope {
  type: 'INSPECTION';
  entityType: 'person';
  entityId: string;
  value: Person | null;
}

export interface ErrorResponse extends ResponseEnvelope {
  type: 'ERROR';
  code:
    | 'ALREADY_INITIALIZED'
    | 'COMMAND_FAILED'
    | 'INVALID_COMMAND'
    | 'NOT_INITIALIZED'
    | 'PROTOCOL_MISMATCH'
    | 'STOPPED';
  message: string;
  recoverable: boolean;
  commandType: SimulationWorkerCommandType | null;
}

export type SimulationWorkerResponse =
  | ReadyResponse
  | ProjectionResponse
  | EventBatchResponse
  | MetricsResponse
  | SnapshotResponse
  | InspectionResponse
  | ErrorResponse;

type WithoutEnvelope<T> = T extends CommandEnvelope ? Omit<T, keyof CommandEnvelope> : never;

export type SimulationWorkerCommandPayload = WithoutEnvelope<SimulationWorkerCommand>;

let requestSequence = 0;

export function createWorkerRequestId(prefix = 'simulation'): string {
  requestSequence += 1;
  return `${prefix}:${Date.now().toString(36)}:${requestSequence.toString(36)}`;
}

export function createWorkerCommand(
  payload: SimulationWorkerCommandPayload,
  requestId = createWorkerRequestId(),
): SimulationWorkerCommand {
  return {
    ...payload,
    protocolVersion: SIMULATION_WORKER_PROTOCOL_VERSION,
    requestId,
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasValidEnvelope(value: Record<string, unknown>): boolean {
  return (
    value.protocolVersion === SIMULATION_WORKER_PROTOCOL_VERSION &&
    typeof value.requestId === 'string' &&
    value.requestId.length > 0
  );
}

export function isSimulationWorkerCommand(value: unknown): value is SimulationWorkerCommand {
  if (!isObject(value) || !hasValidEnvelope(value) || typeof value.type !== 'string') return false;
  switch (value.type) {
    case 'INIT':
      return (
        (value.options === undefined || isObject(value.options)) &&
        (value.speed === undefined || isObject(value.speed)) &&
        (value.startPaused === undefined || typeof value.startPaused === 'boolean')
      );
    case 'LOAD':
      return (
        isObject(value.snapshot) &&
        (value.speed === undefined || isObject(value.speed)) &&
        (value.startPaused === undefined || typeof value.startPaused === 'boolean')
      );
    case 'ADVANCE':
      return (
        typeof value.days === 'number' &&
        Number.isInteger(value.days) &&
        (value.projectionEveryDays === undefined ||
          (typeof value.projectionEveryDays === 'number' && Number.isInteger(value.projectionEveryDays)))
      );
    case 'SET_SPEED':
      return isObject(value.speed);
    case 'PAUSE':
    case 'EXPORT':
    case 'STOP':
      return true;
    case 'SIGNAL':
      return isObject(value.signal);
    case 'INTERVENTION':
      return isObject(value.intervention);
    case 'INSPECT':
      return value.entityType === 'person' && typeof value.entityId === 'string' && value.entityId.length > 0;
    default:
      return false;
  }
}

export function isSimulationWorkerResponse(value: unknown): value is SimulationWorkerResponse {
  if (!isObject(value)) return false;
  if (
    value.protocolVersion !== SIMULATION_WORKER_PROTOCOL_VERSION ||
    typeof value.responseId !== 'number' ||
    !Number.isInteger(value.responseId) ||
    (value.inReplyTo !== null && typeof value.inReplyTo !== 'string') ||
    typeof value.emittedAt !== 'number' ||
    typeof value.type !== 'string'
  ) {
    return false;
  }
  return [
    'READY',
    'PROJECTION',
    'EVENT_BATCH',
    'METRICS',
    'SNAPSHOT',
    'INSPECTION',
    'ERROR',
  ].includes(value.type);
}
