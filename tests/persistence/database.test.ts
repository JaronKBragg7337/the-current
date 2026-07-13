import 'fake-indexeddb/auto';

import { afterEach, describe, expect, it } from 'vitest';
import {
  CurrentPersistence,
  WORLD_EXPORT_FORMAT,
  WORLD_EXPORT_VERSION,
} from '../../src/persistence';
import {
  createSimulation,
  restoreSimulation,
  type NormalizedSignal,
  type ObserverIntervention,
} from '../../src/simulation';

const openDatabases: CurrentPersistence[] = [];
let databaseSequence = 0;

function createStore(label: string): CurrentPersistence {
  databaseSequence += 1;
  let timestampSequence = 0;
  const store = new CurrentPersistence({
    databaseName: `the-current-test-${label}-${databaseSequence}`,
    now: () => {
      timestampSequence += 1;
      return new Date(Date.UTC(2026, 6, 13, 0, 0, timestampSequence));
    },
  });
  openDatabases.push(store);
  return store;
}

const signal: NormalizedSignal = {
  id: 'signal:test-rainfall',
  sourceIds: ['fixture:weather'],
  domain: 'climate',
  geography: 'Confluence',
  intensity: 0.72,
  confidence: 0.9,
  sourceAgreement: 0.8,
  novelty: 0.55,
  durationDays: 4,
  halfLifeDays: 2,
  timestampDay: 5,
  effectiveDay: 6,
  objectivePressure: { food: -0.2, water: -0.35 },
  beliefPressure: { sentiment: 0.1 },
};

const intervention: ObserverIntervention = {
  id: 'intervention:test-water',
  kind: 'help',
  payloadType: 'water',
  effectiveDay: 7,
  amount: 20,
  intensity: 0.6,
  targetSettlementId: 'settlement:current',
  note: 'Persistence round-trip fixture',
};

afterEach(async () => {
  const stores = openDatabases.splice(0);
  await Promise.all(stores.map(async (store) => store.destroy()));
});

describe('CurrentPersistence', () => {
  it('atomically saves metadata with a digest-validated snapshot and loads the latest world', async () => {
    const store = createStore('snapshot');
    const older = createSimulation({ seed: 'persistence-round-trip' });
    older.advanceDays(4);
    const oldSnapshot = older.snapshot();
    await store.saveWorldSnapshot({ worldId: 'world:primary', name: 'Primary Current', snapshot: oldSnapshot });

    older.advanceDays(3);
    const latestSnapshot = older.snapshot();
    const metadata = await store.saveWorldSnapshot({
      worldId: 'world:primary',
      snapshot: latestSnapshot,
    });

    expect(metadata.latestDay).toBe(7);
    expect(metadata.latestDigest).toBe(latestSnapshot.digest);
    expect(metadata.name).toBe('Primary Current');
    const loaded = await store.loadWorld('world:primary');
    expect(loaded?.world.latestSnapshotKey).toBe(metadata.latestSnapshotKey);
    expect(loaded?.snapshot).toEqual(latestSnapshot);
    expect((await store.loadLatestWorld())?.snapshot.digest).toBe(latestSnapshot.digest);

    await expect(
      store.saveWorldSnapshot({ worldId: 'world:primary', snapshot: oldSnapshot }),
    ).rejects.toThrow('Cannot move world');
  });

  it('round-trips world history, external inputs, preferences, and deterministic continuation through JSON', async () => {
    const source = createStore('export-source');
    const target = createStore('export-target');
    const simulation = createSimulation({ seed: 'portable-world' });
    simulation.advanceDays(8);
    const snapshot = simulation.snapshot();
    await source.saveWorldSnapshot({
      worldId: 'world:portable',
      name: 'Portable Current',
      snapshot,
    });
    await source.appendEventChunk('world:portable', simulation.eventsSince(0));
    await source.saveSignal('world:portable', signal);
    await source.saveIntervention('world:portable', intervention);
    await source.setPreference('camera.mode', { mode: 'orbital', overlays: true });

    const exported = await source.exportWorldJson('world:portable', {
      includePreferences: true,
    });
    const parsed = JSON.parse(exported) as {
      format: string;
      formatVersion: number;
      digest: string;
    };
    expect(parsed.format).toBe(WORLD_EXPORT_FORMAT);
    expect(parsed.formatVersion).toBe(WORLD_EXPORT_VERSION);
    expect(parsed.digest).toMatch(/^[a-f0-9]{16}$/);

    const imported = await target.importWorldJson(exported, { includePreferences: true });
    expect(imported.world.latestDigest).toBe(snapshot.digest);
    expect(imported.snapshot).toEqual(snapshot);
    expect(await target.listSnapshots('world:portable')).toHaveLength(1);
    expect(await target.listEventChunks('world:portable')).toHaveLength(1);
    expect(await target.listExternalInputs('world:portable')).toHaveLength(2);
    expect(await target.getPreference('camera.mode')).toEqual({ mode: 'orbital', overlays: true });

    const expectedContinuation = restoreSimulation(snapshot);
    expectedContinuation.advanceDays(5);
    const actualContinuation = restoreSimulation(imported.snapshot);
    actualContinuation.advanceDays(5);
    expect(actualContinuation.digest()).toBe(expectedContinuation.digest());
  });

  it('rejects tampered exports and cascades world deletion without removing preferences', async () => {
    const store = createStore('tamper-delete');
    const simulation = createSimulation({ seed: 'delete-world' });
    simulation.advanceDays(2);
    await store.saveWorldSnapshot({ worldId: 'world:delete', snapshot: simulation.snapshot() });
    await store.appendEventChunk('world:delete', simulation.eventsSince(0));
    await store.saveSignal('world:delete', signal);
    await store.setPreference('ui.density', 'compact');

    const exported = await store.exportWorldJson('world:delete');
    const tampered = JSON.parse(exported) as Record<string, unknown>;
    const world = tampered.world as Record<string, unknown>;
    world.name = 'Tampered without digest update';
    await expect(store.importWorldJson(JSON.stringify(tampered), { replaceExisting: true })).rejects.toThrow(
      'digest mismatch',
    );

    expect(await store.deleteWorld('world:delete')).toBe(true);
    expect(await store.loadWorld('world:delete')).toBeNull();
    expect(await store.listSnapshots('world:delete')).toEqual([]);
    expect(await store.listEventChunks('world:delete')).toEqual([]);
    expect(await store.listExternalInputs('world:delete')).toEqual([]);
    expect(await store.getPreference('ui.density')).toBe('compact');
    expect(await store.deleteWorld('world:delete')).toBe(false);
  });

  it('rejects a corrupted snapshot before opening a write transaction', async () => {
    const store = createStore('corrupt-snapshot');
    const simulation = createSimulation({ seed: 'corrupt-snapshot' });
    const corrupted = simulation.snapshot();
    corrupted.state.day += 1;

    await expect(
      store.saveWorldSnapshot({ worldId: 'world:corrupt', snapshot: corrupted }),
    ).rejects.toThrow(/day does not match|digest mismatch/);
    expect(await store.listWorlds()).toEqual([]);
  });
});
