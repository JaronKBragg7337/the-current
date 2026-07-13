import {
  deleteDB,
  openDB,
  type IDBPDatabase,
} from 'idb';
import {
  SIMULATION_SCHEMA_VERSION,
  canonicalDigest,
  canonicalStringify,
  restoreSimulation,
  type NormalizedSignal,
  type ObserverIntervention,
  type SimulationEvent,
  type WorldSnapshot,
} from '../simulation';
import {
  CURRENT_DATABASE_NAME,
  CURRENT_DATABASE_VERSION,
  PERSISTENCE_RECORD_VERSION,
  WORLD_EXPORT_FORMAT,
  WORLD_EXPORT_VERSION,
  type CurrentDatabaseSchema,
  type EventChunkRecord,
  type ExportWorldOptions,
  type ExternalInputRecord,
  type ImportWorldOptions,
  type InterventionInputRecord,
  type JsonValue,
  type LoadedWorld,
  type PersistenceOptions,
  type PreferenceRecord,
  type SaveSnapshotOptions,
  type SignalInputRecord,
  type SnapshotRecord,
  type WorldExportDocument,
  type WorldExportPayload,
  type WorldRecord,
} from './schema';

const WORLD_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const PREFERENCE_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cloneValue<T>(value: T): T {
  return structuredClone(value);
}

function assertNonEmptyString(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeError(`${label} must be a non-empty string`);
  }
}

function assertSafeNonNegativeInteger(value: unknown, label: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${label} must be a non-negative safe integer`);
  }
}

function assertWorldId(worldId: string): void {
  if (!WORLD_ID_PATTERN.test(worldId)) {
    throw new TypeError('worldId must be 1-128 characters using letters, numbers, dot, underscore, colon, or hyphen');
  }
}

function assertPreferenceKey(key: string): void {
  if (!PREFERENCE_KEY_PATTERN.test(key)) {
    throw new TypeError('preference key must be 1-128 characters using letters, numbers, dot, underscore, colon, or hyphen');
  }
}

function assertIsoTimestamp(value: unknown, label: string): asserts value is string {
  assertNonEmptyString(value, label);
  const time = Date.parse(value);
  if (!Number.isFinite(time) || new Date(time).toISOString() !== value) {
    throw new TypeError(`${label} must be an ISO-8601 UTC timestamp`);
  }
}

function assertJsonValue(value: unknown, label: string): asserts value is JsonValue {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError(`${label} cannot contain a non-finite number`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((child, index) => assertJsonValue(child, `${label}[${index}]`));
    return;
  }
  if (isObject(value)) {
    for (const [key, child] of Object.entries(value)) {
      if (child === undefined) throw new TypeError(`${label}.${key} cannot be undefined`);
      assertJsonValue(child, `${label}.${key}`);
    }
    return;
  }
  throw new TypeError(`${label} must be JSON-compatible`);
}

function assertRecordVersion(value: unknown, label: string): void {
  if (value !== PERSISTENCE_RECORD_VERSION) {
    throw new Error(`${label} uses unsupported persistence record version ${String(value)}`);
  }
}

export function validateWorldSnapshot(snapshot: WorldSnapshot): void {
  if (!isObject(snapshot) || !isObject(snapshot.state)) {
    throw new TypeError('Snapshot must contain a world state');
  }
  if (
    snapshot.schemaVersion !== SIMULATION_SCHEMA_VERSION ||
    snapshot.state.schemaVersion !== SIMULATION_SCHEMA_VERSION
  ) {
    throw new Error(`Unsupported simulation schema ${String(snapshot.schemaVersion)}`);
  }
  assertSafeNonNegativeInteger(snapshot.day, 'snapshot.day');
  if (snapshot.day !== snapshot.state.day) {
    throw new Error('Snapshot day does not match state day');
  }
  assertNonEmptyString(snapshot.engineVersion, 'snapshot.engineVersion');
  if (snapshot.engineVersion !== snapshot.state.engineVersion) {
    throw new Error('Snapshot engine version does not match state engine version');
  }
  assertNonEmptyString(snapshot.state.seed, 'snapshot.state.seed');
  assertNonEmptyString(snapshot.digest, 'snapshot.digest');
  const actualDigest = canonicalDigest(snapshot.state);
  if (snapshot.digest !== actualDigest) {
    throw new Error(`Snapshot digest mismatch: expected ${snapshot.digest}, calculated ${actualDigest}`);
  }
  // Exercise the engine's own schema/config/RNG restoration guard as part of every write/import.
  restoreSimulation(snapshot);
}

function validateWorldRecord(world: WorldRecord): void {
  if (!isObject(world)) throw new TypeError('World metadata must be an object');
  assertRecordVersion(world.recordVersion, 'World metadata');
  assertWorldId(world.id);
  assertNonEmptyString(world.name, 'world.name');
  assertNonEmptyString(world.seed, 'world.seed');
  if (world.simulationSchemaVersion !== SIMULATION_SCHEMA_VERSION) {
    throw new Error(`Unsupported world simulation schema ${world.simulationSchemaVersion}`);
  }
  assertNonEmptyString(world.engineVersion, 'world.engineVersion');
  assertIsoTimestamp(world.createdAt, 'world.createdAt');
  assertIsoTimestamp(world.updatedAt, 'world.updatedAt');
  assertNonEmptyString(world.latestSnapshotKey, 'world.latestSnapshotKey');
  assertSafeNonNegativeInteger(world.latestDay, 'world.latestDay');
  assertNonEmptyString(world.latestDigest, 'world.latestDigest');
  assertSafeNonNegativeInteger(world.lastEventSequence, 'world.lastEventSequence');
}

function validateSnapshotRecord(record: SnapshotRecord, worldId?: string): void {
  if (!isObject(record)) throw new TypeError('Snapshot record must be an object');
  assertRecordVersion(record.recordVersion, 'Snapshot record');
  assertNonEmptyString(record.key, 'snapshotRecord.key');
  assertWorldId(record.worldId);
  if (worldId !== undefined && record.worldId !== worldId) {
    throw new Error(`Snapshot record ${record.key} belongs to ${record.worldId}, expected ${worldId}`);
  }
  assertSafeNonNegativeInteger(record.day, 'snapshotRecord.day');
  assertNonEmptyString(record.digest, 'snapshotRecord.digest');
  assertIsoTimestamp(record.createdAt, 'snapshotRecord.createdAt');
  validateWorldSnapshot(record.snapshot);
  if (record.day !== record.snapshot.day || record.digest !== record.snapshot.digest) {
    throw new Error(`Snapshot record ${record.key} metadata does not match its snapshot`);
  }
}

function validateEvents(events: SimulationEvent[]): void {
  if (!Array.isArray(events) || events.length === 0) {
    throw new TypeError('Event chunk must contain at least one event');
  }
  let previousSequence = -1;
  for (const [index, event] of events.entries()) {
    if (!isObject(event)) throw new TypeError(`events[${index}] must be an object`);
    assertSafeNonNegativeInteger(event.sequence, `events[${index}].sequence`);
    assertSafeNonNegativeInteger(event.day, `events[${index}].day`);
    assertSafeNonNegativeInteger(event.tick, `events[${index}].tick`);
    if (event.sequence <= previousSequence) {
      throw new Error('Event chunk sequences must be strictly increasing');
    }
    previousSequence = event.sequence;
  }
}

function validateEventChunkRecord(record: EventChunkRecord, worldId?: string): void {
  if (!isObject(record)) throw new TypeError('Event chunk record must be an object');
  assertRecordVersion(record.recordVersion, 'Event chunk');
  assertNonEmptyString(record.key, 'eventChunk.key');
  assertWorldId(record.worldId);
  if (worldId !== undefined && record.worldId !== worldId) {
    throw new Error(`Event chunk ${record.key} belongs to ${record.worldId}, expected ${worldId}`);
  }
  assertSafeNonNegativeInteger(record.firstSequence, 'eventChunk.firstSequence');
  assertSafeNonNegativeInteger(record.lastSequence, 'eventChunk.lastSequence');
  assertSafeNonNegativeInteger(record.firstDay, 'eventChunk.firstDay');
  assertSafeNonNegativeInteger(record.lastDay, 'eventChunk.lastDay');
  assertSafeNonNegativeInteger(record.eventCount, 'eventChunk.eventCount');
  assertIsoTimestamp(record.createdAt, 'eventChunk.createdAt');
  assertNonEmptyString(record.digest, 'eventChunk.digest');
  validateEvents(record.events);
  const first = record.events[0];
  const last = record.events[record.events.length - 1];
  if (
    first === undefined ||
    last === undefined ||
    record.firstSequence !== first.sequence ||
    record.lastSequence !== last.sequence ||
    record.firstDay !== first.day ||
    record.lastDay !== last.day ||
    record.eventCount !== record.events.length
  ) {
    throw new Error(`Event chunk ${record.key} metadata does not match its events`);
  }
  if (record.digest !== canonicalDigest(record.events)) {
    throw new Error(`Event chunk ${record.key} digest does not match its events`);
  }
}

function validateExternalInputRecord(record: ExternalInputRecord, worldId?: string): void {
  if (!isObject(record)) throw new TypeError('External input record must be an object');
  assertRecordVersion(record.recordVersion, 'External input');
  assertNonEmptyString(record.key, 'externalInput.key');
  assertWorldId(record.worldId);
  if (worldId !== undefined && record.worldId !== worldId) {
    throw new Error(`External input ${record.key} belongs to ${record.worldId}, expected ${worldId}`);
  }
  assertNonEmptyString(record.inputId, 'externalInput.inputId');
  assertSafeNonNegativeInteger(record.effectiveDay, 'externalInput.effectiveDay');
  assertIsoTimestamp(record.recordedAt, 'externalInput.recordedAt');
  if (record.kind !== 'signal' && record.kind !== 'intervention') {
    throw new Error(`External input ${record.key} has unsupported kind ${String(record.kind)}`);
  }
  if (!isObject(record.input) || record.input.id !== record.inputId) {
    throw new Error(`External input ${record.key} payload does not match inputId`);
  }
  if (record.digest !== canonicalDigest(record.input)) {
    throw new Error(`External input ${record.key} digest does not match its payload`);
  }
}

function validatePreferenceRecord(record: PreferenceRecord): void {
  if (!isObject(record)) throw new TypeError('Preference record must be an object');
  assertRecordVersion(record.recordVersion, 'Preference');
  assertPreferenceKey(record.key);
  assertIsoTimestamp(record.updatedAt, 'preference.updatedAt');
  assertJsonValue(record.value, 'preference.value');
}

function snapshotKey(worldId: string, snapshot: WorldSnapshot): string {
  return `${worldId}:snapshot:${snapshot.day.toString().padStart(10, '0')}:${snapshot.digest}`;
}

function eventChunkKey(worldId: string, events: SimulationEvent[]): string {
  const first = events[0];
  const last = events[events.length - 1];
  if (first === undefined || last === undefined) throw new Error('Cannot key an empty event chunk');
  return `${worldId}:events:${first.sequence.toString().padStart(12, '0')}-${last.sequence.toString().padStart(12, '0')}:${canonicalDigest(events)}`;
}

function externalInputKey(worldId: string, kind: ExternalInputRecord['kind'], inputId: string): string {
  return `${worldId}:input:${kind}:${encodeURIComponent(inputId)}`;
}

async function openCurrentDatabase(
  databaseName: string,
): Promise<IDBPDatabase<CurrentDatabaseSchema>> {
  const database = await openDB<CurrentDatabaseSchema>(databaseName, CURRENT_DATABASE_VERSION, {
    upgrade(upgradeDatabase, oldVersion) {
      if (oldVersion < 1) {
        const worlds = upgradeDatabase.createObjectStore('worlds', { keyPath: 'id' });
        worlds.createIndex('by-created-at', 'createdAt');
        worlds.createIndex('by-updated-at', 'updatedAt');

        const snapshots = upgradeDatabase.createObjectStore('snapshots', { keyPath: 'key' });
        snapshots.createIndex('by-world', 'worldId');
        snapshots.createIndex('by-world-day', ['worldId', 'day']);

        const events = upgradeDatabase.createObjectStore('event-chunks', { keyPath: 'key' });
        events.createIndex('by-world', 'worldId');
        events.createIndex('by-world-sequence', ['worldId', 'firstSequence']);

        const inputs = upgradeDatabase.createObjectStore('external-inputs', { keyPath: 'key' });
        inputs.createIndex('by-world', 'worldId');
        inputs.createIndex('by-world-day', ['worldId', 'effectiveDay']);
        inputs.createIndex('by-world-kind', ['worldId', 'kind']);

        const preferences = upgradeDatabase.createObjectStore('preferences', { keyPath: 'key' });
        preferences.createIndex('by-updated-at', 'updatedAt');
      }
    },
  });
  if (database.version !== CURRENT_DATABASE_VERSION) {
    database.close();
    throw new Error(`Unsupported persistence database version ${database.version}`);
  }
  return database;
}

export class CurrentPersistence {
  readonly databaseName: string;
  private readonly now: () => Date;
  private readonly databasePromise: Promise<IDBPDatabase<CurrentDatabaseSchema>>;
  private closed = false;

  constructor(options: PersistenceOptions = {}) {
    this.databaseName = options.databaseName ?? CURRENT_DATABASE_NAME;
    assertNonEmptyString(this.databaseName, 'databaseName');
    this.now = options.now ?? (() => new Date());
    this.databasePromise = openCurrentDatabase(this.databaseName);
  }

  async saveWorldSnapshot(options: SaveSnapshotOptions): Promise<WorldRecord> {
    this.assertOpen();
    assertWorldId(options.worldId);
    validateWorldSnapshot(options.snapshot);
    const database = await this.databasePromise;
    const transaction = database.transaction(['worlds', 'snapshots'], 'readwrite');
    const worlds = transaction.objectStore('worlds');
    const snapshots = transaction.objectStore('snapshots');
    const existing = await worlds.get(options.worldId);
    if (existing !== undefined) {
      validateWorldRecord(existing);
      if (options.snapshot.day < existing.latestDay) {
        throw new Error(
          `Cannot move world ${options.worldId} backward from day ${existing.latestDay} to ${options.snapshot.day}`,
        );
      }
      if (
        options.snapshot.day === existing.latestDay &&
        options.snapshot.digest !== existing.latestDigest
      ) {
        throw new Error(`World ${options.worldId} already has a different snapshot for day ${options.snapshot.day}`);
      }
    }

    const timestamp = this.timestamp();
    const key = snapshotKey(options.worldId, options.snapshot);
    const snapshotRecord: SnapshotRecord = {
      recordVersion: PERSISTENCE_RECORD_VERSION,
      key,
      worldId: options.worldId,
      day: options.snapshot.day,
      digest: options.snapshot.digest,
      createdAt: timestamp,
      snapshot: cloneValue(options.snapshot),
    };
    const world: WorldRecord = {
      recordVersion: PERSISTENCE_RECORD_VERSION,
      id: options.worldId,
      name: options.name?.trim() || existing?.name || `World ${options.snapshot.state.seed}`,
      seed: options.snapshot.state.seed,
      simulationSchemaVersion: options.snapshot.schemaVersion,
      engineVersion: options.snapshot.engineVersion,
      createdAt: existing?.createdAt ?? options.createdAt ?? timestamp,
      updatedAt: timestamp,
      latestSnapshotKey: key,
      latestDay: options.snapshot.day,
      latestDigest: options.snapshot.digest,
      lastEventSequence: Math.max(existing?.lastEventSequence ?? 0, options.snapshot.state.eventSequence),
    };
    assertIsoTimestamp(world.createdAt, 'world.createdAt');
    await snapshots.put(snapshotRecord);
    await worlds.put(world);
    await transaction.done;
    return cloneValue(world);
  }

  async loadWorld(worldId: string): Promise<LoadedWorld | null> {
    this.assertOpen();
    assertWorldId(worldId);
    const database = await this.databasePromise;
    const world = await database.get('worlds', worldId);
    if (world === undefined) return null;
    validateWorldRecord(world);
    const snapshotRecord = await database.get('snapshots', world.latestSnapshotKey);
    if (snapshotRecord === undefined) {
      throw new Error(`World ${world.id} references missing snapshot ${world.latestSnapshotKey}`);
    }
    validateSnapshotRecord(snapshotRecord, world.id);
    if (
      snapshotRecord.day !== world.latestDay ||
      snapshotRecord.digest !== world.latestDigest
    ) {
      throw new Error(`World ${world.id} latest snapshot metadata is inconsistent`);
    }
    return {
      world: cloneValue(world),
      snapshot: cloneValue(snapshotRecord.snapshot),
    };
  }

  async loadLatestWorld(): Promise<LoadedWorld | null> {
    const worlds = await this.listWorlds();
    const latest = worlds[0];
    return latest === undefined ? null : this.loadWorld(latest.id);
  }

  async listWorlds(): Promise<WorldRecord[]> {
    this.assertOpen();
    const database = await this.databasePromise;
    const worlds = await database.getAll('worlds');
    worlds.forEach(validateWorldRecord);
    return worlds
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || left.id.localeCompare(right.id))
      .map(cloneValue);
  }

  async listSnapshots(worldId: string): Promise<SnapshotRecord[]> {
    this.assertOpen();
    assertWorldId(worldId);
    const database = await this.databasePromise;
    const records = await database.getAllFromIndex('snapshots', 'by-world', worldId);
    records.forEach((record) => validateSnapshotRecord(record, worldId));
    return records
      .sort((left, right) => left.day - right.day || left.key.localeCompare(right.key))
      .map(cloneValue);
  }

  async listEventChunks(worldId: string, afterSequence = 0): Promise<EventChunkRecord[]> {
    this.assertOpen();
    assertWorldId(worldId);
    assertSafeNonNegativeInteger(afterSequence, 'afterSequence');
    const database = await this.databasePromise;
    const records = await database.getAllFromIndex('event-chunks', 'by-world', worldId);
    records.forEach((record) => validateEventChunkRecord(record, worldId));
    return records
      .filter((record) => record.lastSequence > afterSequence)
      .sort(
        (left, right) =>
          left.firstSequence - right.firstSequence || left.key.localeCompare(right.key),
      )
      .map(cloneValue);
  }

  async appendEventChunk(worldId: string, events: SimulationEvent[]): Promise<EventChunkRecord> {
    this.assertOpen();
    assertWorldId(worldId);
    validateEvents(events);
    const eventCopies = cloneValue(events);
    const first = eventCopies[0];
    const last = eventCopies[eventCopies.length - 1];
    if (first === undefined || last === undefined) throw new Error('Event chunk cannot be empty');
    const timestamp = this.timestamp();
    const record: EventChunkRecord = {
      recordVersion: PERSISTENCE_RECORD_VERSION,
      key: eventChunkKey(worldId, eventCopies),
      worldId,
      firstSequence: first.sequence,
      lastSequence: last.sequence,
      firstDay: first.day,
      lastDay: last.day,
      eventCount: eventCopies.length,
      digest: canonicalDigest(eventCopies),
      createdAt: timestamp,
      events: eventCopies,
    };

    const database = await this.databasePromise;
    const transaction = database.transaction(['worlds', 'event-chunks'], 'readwrite');
    const worldStore = transaction.objectStore('worlds');
    const eventStore = transaction.objectStore('event-chunks');
    const world = await worldStore.get(worldId);
    if (world === undefined) {
      throw new Error(`Cannot append events to unknown world ${worldId}`);
    }
    const existingChunks = await eventStore.index('by-world').getAll(worldId);
    const conflict = existingChunks.find(
      (chunk) =>
        chunk.key !== record.key &&
        chunk.firstSequence <= record.lastSequence &&
        chunk.lastSequence >= record.firstSequence,
    );
    if (conflict !== undefined) {
      throw new Error(`Event chunk overlaps existing chunk ${conflict.key}`);
    }
    await eventStore.put(record);
    await worldStore.put({
      ...world,
      updatedAt: timestamp,
      lastEventSequence: Math.max(world.lastEventSequence, record.lastSequence),
    });
    await transaction.done;
    return cloneValue(record);
  }

  async saveSignal(worldId: string, signal: NormalizedSignal): Promise<SignalInputRecord> {
    assertNonEmptyString(signal.id, 'signal.id');
    assertSafeNonNegativeInteger(signal.effectiveDay, 'signal.effectiveDay');
    const record: SignalInputRecord = {
      recordVersion: PERSISTENCE_RECORD_VERSION,
      key: externalInputKey(worldId, 'signal', signal.id),
      worldId,
      inputId: signal.id,
      kind: 'signal',
      effectiveDay: signal.effectiveDay,
      recordedAt: this.timestamp(),
      digest: canonicalDigest(signal),
      input: cloneValue(signal),
    };
    await this.saveExternalInputRecord(record);
    return cloneValue(record);
  }

  async saveIntervention(
    worldId: string,
    intervention: ObserverIntervention,
  ): Promise<InterventionInputRecord> {
    assertNonEmptyString(intervention.id, 'intervention.id');
    assertSafeNonNegativeInteger(intervention.effectiveDay, 'intervention.effectiveDay');
    const record: InterventionInputRecord = {
      recordVersion: PERSISTENCE_RECORD_VERSION,
      key: externalInputKey(worldId, 'intervention', intervention.id),
      worldId,
      inputId: intervention.id,
      kind: 'intervention',
      effectiveDay: intervention.effectiveDay,
      recordedAt: this.timestamp(),
      digest: canonicalDigest(intervention),
      input: cloneValue(intervention),
    };
    await this.saveExternalInputRecord(record);
    return cloneValue(record);
  }

  async listExternalInputs(worldId: string): Promise<ExternalInputRecord[]> {
    this.assertOpen();
    assertWorldId(worldId);
    const database = await this.databasePromise;
    const records = await database.getAllFromIndex('external-inputs', 'by-world', worldId);
    records.forEach((record) => validateExternalInputRecord(record, worldId));
    return records
      .sort(
        (left, right) =>
          left.effectiveDay - right.effectiveDay ||
          left.kind.localeCompare(right.kind) ||
          left.inputId.localeCompare(right.inputId),
      )
      .map(cloneValue);
  }

  async setPreference(key: string, value: JsonValue): Promise<PreferenceRecord> {
    this.assertOpen();
    assertPreferenceKey(key);
    assertJsonValue(value, 'preference value');
    const record: PreferenceRecord = {
      recordVersion: PERSISTENCE_RECORD_VERSION,
      key,
      updatedAt: this.timestamp(),
      value: cloneValue(value),
    };
    const database = await this.databasePromise;
    await database.put('preferences', record);
    return cloneValue(record);
  }

  async getPreference<T extends JsonValue = JsonValue>(key: string): Promise<T | null> {
    this.assertOpen();
    assertPreferenceKey(key);
    const database = await this.databasePromise;
    const record = await database.get('preferences', key);
    if (record === undefined) return null;
    validatePreferenceRecord(record);
    return cloneValue(record.value) as T;
  }

  async listPreferences(): Promise<PreferenceRecord[]> {
    this.assertOpen();
    const database = await this.databasePromise;
    const records = await database.getAll('preferences');
    records.forEach(validatePreferenceRecord);
    return records.sort((left, right) => left.key.localeCompare(right.key)).map(cloneValue);
  }

  async exportWorldJson(worldId: string, options: ExportWorldOptions = {}): Promise<string> {
    this.assertOpen();
    assertWorldId(worldId);
    const database = await this.databasePromise;
    const transaction = database.transaction(
      ['worlds', 'snapshots', 'event-chunks', 'external-inputs', 'preferences'],
      'readonly',
    );
    const world = await transaction.objectStore('worlds').get(worldId);
    if (world === undefined) {
      await transaction.done;
      throw new Error(`Cannot export unknown world ${worldId}`);
    }
    validateWorldRecord(world);

    const allSnapshots = await transaction.objectStore('snapshots').index('by-world').getAll(worldId);
    const snapshots = options.includeHistory === false
      ? allSnapshots.filter((record) => record.key === world.latestSnapshotKey)
      : allSnapshots;
    const eventChunks = options.includeHistory === false
      ? []
      : await transaction.objectStore('event-chunks').index('by-world').getAll(worldId);
    const externalInputs = options.includeExternalInputs === false
      ? []
      : await transaction.objectStore('external-inputs').index('by-world').getAll(worldId);
    const preferences = options.includePreferences === true
      ? await transaction.objectStore('preferences').getAll()
      : [];
    await transaction.done;

    snapshots.forEach((record) => validateSnapshotRecord(record, worldId));
    eventChunks.forEach((record) => validateEventChunkRecord(record, worldId));
    externalInputs.forEach((record) => validateExternalInputRecord(record, worldId));
    preferences.forEach(validatePreferenceRecord);
    if (!snapshots.some((record) => record.key === world.latestSnapshotKey)) {
      throw new Error(`World ${worldId} export is missing its latest snapshot`);
    }

    const payload: WorldExportPayload = {
      format: WORLD_EXPORT_FORMAT,
      formatVersion: WORLD_EXPORT_VERSION,
      exportedAt: this.timestamp(),
      world: cloneValue(world),
      snapshots: snapshots.sort((left, right) => left.day - right.day || left.key.localeCompare(right.key)),
      eventChunks: eventChunks.sort(
        (left, right) => left.firstSequence - right.firstSequence || left.key.localeCompare(right.key),
      ),
      externalInputs: externalInputs.sort(
        (left, right) =>
          left.effectiveDay - right.effectiveDay ||
          left.kind.localeCompare(right.kind) ||
          left.inputId.localeCompare(right.inputId),
      ),
      preferences: preferences.sort((left, right) => left.key.localeCompare(right.key)),
    };
    const document: WorldExportDocument = {
      ...payload,
      digest: canonicalDigest(payload),
    };
    return canonicalStringify(document);
  }

  async importWorldJson(
    json: string,
    options: ImportWorldOptions = {},
  ): Promise<LoadedWorld> {
    this.assertOpen();
    let parsed: unknown;
    try {
      parsed = JSON.parse(json) as unknown;
    } catch (error: unknown) {
      throw new TypeError(
        `World export is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error },
      );
    }
    const document = this.validateExportDocument(parsed);
    const worldId = document.world.id;
    const database = await this.databasePromise;
    const transaction = database.transaction(
      ['worlds', 'snapshots', 'event-chunks', 'external-inputs', 'preferences'],
      'readwrite',
    );
    const worldStore = transaction.objectStore('worlds');
    const snapshotStore = transaction.objectStore('snapshots');
    const eventStore = transaction.objectStore('event-chunks');
    const inputStore = transaction.objectStore('external-inputs');
    const preferenceStore = transaction.objectStore('preferences');
    const existing = await worldStore.get(worldId);
    if (existing !== undefined && options.replaceExisting !== true) {
      throw new Error(`World ${worldId} already exists; set replaceExisting to import over it`);
    }
    if (existing !== undefined) {
      const [snapshotKeys, eventKeys, inputKeys] = await Promise.all([
        snapshotStore.index('by-world').getAllKeys(worldId),
        eventStore.index('by-world').getAllKeys(worldId),
        inputStore.index('by-world').getAllKeys(worldId),
      ]);
      await Promise.all([
        ...snapshotKeys.map((key) => snapshotStore.delete(key)),
        ...eventKeys.map((key) => eventStore.delete(key)),
        ...inputKeys.map((key) => inputStore.delete(key)),
      ]);
    }

    for (const snapshot of document.snapshots) await snapshotStore.put(cloneValue(snapshot));
    for (const chunk of document.eventChunks) await eventStore.put(cloneValue(chunk));
    for (const input of document.externalInputs) await inputStore.put(cloneValue(input));
    if (options.includePreferences === true) {
      for (const preference of document.preferences) {
        await preferenceStore.put(cloneValue(preference));
      }
    }
    await worldStore.put(cloneValue(document.world));
    await transaction.done;

    const loaded = await this.loadWorld(worldId);
    if (loaded === null) throw new Error(`Imported world ${worldId} could not be loaded`);
    return loaded;
  }

  async deleteWorld(worldId: string): Promise<boolean> {
    this.assertOpen();
    assertWorldId(worldId);
    const database = await this.databasePromise;
    const transaction = database.transaction(
      ['worlds', 'snapshots', 'event-chunks', 'external-inputs'],
      'readwrite',
    );
    const worldStore = transaction.objectStore('worlds');
    const existing = await worldStore.get(worldId);
    if (existing === undefined) {
      await transaction.done;
      return false;
    }
    const snapshotStore = transaction.objectStore('snapshots');
    const eventStore = transaction.objectStore('event-chunks');
    const inputStore = transaction.objectStore('external-inputs');
    const [snapshotKeys, eventKeys, inputKeys] = await Promise.all([
      snapshotStore.index('by-world').getAllKeys(worldId),
      eventStore.index('by-world').getAllKeys(worldId),
      inputStore.index('by-world').getAllKeys(worldId),
    ]);
    await Promise.all([
      ...snapshotKeys.map((key) => snapshotStore.delete(key)),
      ...eventKeys.map((key) => eventStore.delete(key)),
      ...inputKeys.map((key) => inputStore.delete(key)),
      worldStore.delete(worldId),
    ]);
    await transaction.done;
    return true;
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    const database = await this.databasePromise;
    database.close();
  }

  async destroy(): Promise<void> {
    await this.close();
    await deleteDB(this.databaseName);
  }

  private async saveExternalInputRecord(record: ExternalInputRecord): Promise<void> {
    this.assertOpen();
    assertWorldId(record.worldId);
    validateExternalInputRecord(record, record.worldId);
    const database = await this.databasePromise;
    const transaction = database.transaction(['worlds', 'external-inputs'], 'readwrite');
    const worldStore = transaction.objectStore('worlds');
    const world = await worldStore.get(record.worldId);
    if (world === undefined) {
      throw new Error(`Cannot save external input for unknown world ${record.worldId}`);
    }
    await transaction.objectStore('external-inputs').put(record);
    await worldStore.put({ ...world, updatedAt: record.recordedAt });
    await transaction.done;
  }

  private validateExportDocument(value: unknown): WorldExportDocument {
    if (!isObject(value)) throw new TypeError('World export root must be an object');
    if (value.format !== WORLD_EXPORT_FORMAT || value.formatVersion !== WORLD_EXPORT_VERSION) {
      throw new Error(
        `Unsupported world export ${String(value.format)} version ${String(value.formatVersion)}`,
      );
    }
    assertIsoTimestamp(value.exportedAt, 'export.exportedAt');
    assertNonEmptyString(value.digest, 'export.digest');
    if (!isObject(value.world)) throw new TypeError('export.world must be an object');
    if (
      !Array.isArray(value.snapshots) ||
      !Array.isArray(value.eventChunks) ||
      !Array.isArray(value.externalInputs) ||
      !Array.isArray(value.preferences)
    ) {
      throw new TypeError('World export collections must be arrays');
    }

    const payload: WorldExportPayload = {
      format: WORLD_EXPORT_FORMAT,
      formatVersion: WORLD_EXPORT_VERSION,
      exportedAt: value.exportedAt,
      world: value.world as unknown as WorldRecord,
      snapshots: value.snapshots as SnapshotRecord[],
      eventChunks: value.eventChunks as EventChunkRecord[],
      externalInputs: value.externalInputs as ExternalInputRecord[],
      preferences: value.preferences as PreferenceRecord[],
    };
    const expectedDigest = canonicalDigest(payload);
    if (value.digest !== expectedDigest) {
      throw new Error(`World export digest mismatch: expected ${String(value.digest)}, calculated ${expectedDigest}`);
    }
    validateWorldRecord(payload.world);
    payload.snapshots.forEach((record) => validateSnapshotRecord(record, payload.world.id));
    payload.eventChunks.forEach((record) => validateEventChunkRecord(record, payload.world.id));
    payload.externalInputs.forEach((record) => validateExternalInputRecord(record, payload.world.id));
    payload.preferences.forEach(validatePreferenceRecord);
    const latest = payload.snapshots.find((record) => record.key === payload.world.latestSnapshotKey);
    if (
      latest === undefined ||
      latest.day !== payload.world.latestDay ||
      latest.digest !== payload.world.latestDigest
    ) {
      throw new Error('World export does not contain the latest snapshot referenced by its metadata');
    }
    return { ...payload, digest: value.digest };
  }

  private timestamp(): string {
    const value = this.now();
    if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
      throw new Error('Persistence clock returned an invalid Date');
    }
    return value.toISOString();
  }

  private assertOpen(): void {
    if (this.closed) throw new Error('Persistence database is closed');
  }
}
