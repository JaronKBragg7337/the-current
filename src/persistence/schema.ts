import type { DBSchema } from 'idb';
import type {
  NormalizedSignal,
  ObserverIntervention,
  SimulationEvent,
  WorldSnapshot,
} from '../simulation';

export const CURRENT_DATABASE_NAME = 'heartbeat-observatory.the-current' as const;
export const CURRENT_DATABASE_VERSION = 1 as const;
export const PERSISTENCE_RECORD_VERSION = 1 as const;
export const WORLD_EXPORT_FORMAT = 'the-current-world-export' as const;
export const WORLD_EXPORT_VERSION = 1 as const;

export type JsonPrimitive = boolean | null | number | string;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export interface WorldRecord {
  recordVersion: typeof PERSISTENCE_RECORD_VERSION;
  id: string;
  name: string;
  seed: string;
  simulationSchemaVersion: number;
  engineVersion: string;
  createdAt: string;
  updatedAt: string;
  latestSnapshotKey: string;
  latestDay: number;
  latestDigest: string;
  lastEventSequence: number;
}

export interface SnapshotRecord {
  recordVersion: typeof PERSISTENCE_RECORD_VERSION;
  key: string;
  worldId: string;
  day: number;
  digest: string;
  createdAt: string;
  snapshot: WorldSnapshot;
}

export interface EventChunkRecord {
  recordVersion: typeof PERSISTENCE_RECORD_VERSION;
  key: string;
  worldId: string;
  firstSequence: number;
  lastSequence: number;
  firstDay: number;
  lastDay: number;
  eventCount: number;
  digest: string;
  createdAt: string;
  events: SimulationEvent[];
}

interface ExternalInputRecordBase {
  recordVersion: typeof PERSISTENCE_RECORD_VERSION;
  key: string;
  worldId: string;
  inputId: string;
  effectiveDay: number;
  recordedAt: string;
  digest: string;
}

export interface SignalInputRecord extends ExternalInputRecordBase {
  kind: 'signal';
  input: NormalizedSignal;
}

export interface InterventionInputRecord extends ExternalInputRecordBase {
  kind: 'intervention';
  input: ObserverIntervention;
}

export type ExternalInputRecord = SignalInputRecord | InterventionInputRecord;

export interface PreferenceRecord {
  recordVersion: typeof PERSISTENCE_RECORD_VERSION;
  key: string;
  updatedAt: string;
  value: JsonValue;
}

export interface CurrentDatabaseSchema extends DBSchema {
  worlds: {
    key: string;
    value: WorldRecord;
    indexes: {
      'by-created-at': string;
      'by-updated-at': string;
    };
  };
  snapshots: {
    key: string;
    value: SnapshotRecord;
    indexes: {
      'by-world': string;
      'by-world-day': [string, number];
    };
  };
  'event-chunks': {
    key: string;
    value: EventChunkRecord;
    indexes: {
      'by-world': string;
      'by-world-sequence': [string, number];
    };
  };
  'external-inputs': {
    key: string;
    value: ExternalInputRecord;
    indexes: {
      'by-world': string;
      'by-world-day': [string, number];
      'by-world-kind': [string, ExternalInputRecord['kind']];
    };
  };
  preferences: {
    key: string;
    value: PreferenceRecord;
    indexes: {
      'by-updated-at': string;
    };
  };
}

export interface SaveSnapshotOptions {
  worldId: string;
  snapshot: WorldSnapshot;
  name?: string;
  createdAt?: string;
}

export interface LoadedWorld {
  world: WorldRecord;
  snapshot: WorldSnapshot;
}

export interface WorldExportPayload {
  format: typeof WORLD_EXPORT_FORMAT;
  formatVersion: typeof WORLD_EXPORT_VERSION;
  exportedAt: string;
  world: WorldRecord;
  snapshots: SnapshotRecord[];
  eventChunks: EventChunkRecord[];
  externalInputs: ExternalInputRecord[];
  preferences: PreferenceRecord[];
}

export interface WorldExportDocument extends WorldExportPayload {
  digest: string;
}

export interface ExportWorldOptions {
  includeHistory?: boolean;
  includeExternalInputs?: boolean;
  includePreferences?: boolean;
}

export interface ImportWorldOptions {
  replaceExisting?: boolean;
  includePreferences?: boolean;
}

export interface PersistenceOptions {
  databaseName?: string;
  now?: () => Date;
}

export type StoragePersistenceResult = 'denied' | 'granted' | 'unsupported';
