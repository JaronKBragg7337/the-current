import { describe, expect, it } from 'vitest';

import { createOfflineObservations, createOfflineSnapshot } from './fixtures/offline';
import { normalizeObservations } from './normalize';
import { parseSnapshot } from './schema';
import { toSimulationSignal } from './to-simulation';

describe('external information normalization', () => {
  it('builds a deeply immutable, schema-valid, deterministic fixture', () => {
    const first = createOfflineSnapshot();
    const second = createOfflineSnapshot();

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(parseSnapshot(first)).toEqual(first);
    expect(first.fixtureVersion).toBe('synthetic-signals.v1');
    expect(first.observations).toHaveLength(5);
    expect(first.signals).toHaveLength(4);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.observations)).toBe(true);
    expect(Object.isFrozen(first.observations[0]?.source.lineage)).toBe(true);
  });

  it('corroborates nearby observations without losing lineage', () => {
    const earthquake = createOfflineSnapshot().signals.find(
      (signal) => signal.eventFamily === 'earthquake',
    );

    expect(earthquake).toBeDefined();
    expect(earthquake?.observationIds).toHaveLength(2);
    expect(earthquake?.sourceAgreement).toBe(0.75);
    expect(earthquake?.lineage).toContain('origin:synthetic-seismic-a');
    expect(earthquake?.lineage).toContain('origin:synthetic-seismic-b');
    expect(earthquake?.objectivePressure.infrastructureReliability).toBeLessThan(0);
  });

  it('keeps community attention in the belief channel', () => {
    const attention = createOfflineSnapshot().signals.find(
      (signal) => signal.eventFamily === 'community-technology-attention',
    );

    expect(attention?.beliefPressure.innovationMomentum).toBeGreaterThan(0);
    expect(Object.values(attention?.objectivePressure ?? {})).toEqual(
      expect.arrayContaining([0]),
    );
    expect(Object.values(attention?.objectivePressure ?? {}).every((value) => value === 0)).toBe(
      true,
    );
  });

  it('calculates novelty and revision against prior signals', () => {
    const observations = createOfflineObservations();
    const previousSignals = normalizeObservations(observations);
    const repeated = normalizeObservations(observations, { previousSignals });

    expect(repeated.every((signal) => signal.novelty === 0)).toBe(true);
    expect(repeated.every((signal) => signal.revision === 1)).toBe(true);
  });

  it('projects pressures into the simulation without bypassing world-day inputs', () => {
    const snapshot = createOfflineSnapshot();
    const earthquake = snapshot.signals.find((signal) => signal.eventFamily === 'earthquake');
    const attention = snapshot.signals.find(
      (signal) => signal.eventFamily === 'community-technology-attention',
    );
    expect(earthquake).toBeDefined();
    expect(attention).toBeDefined();
    if (earthquake === undefined || attention === undefined) {
      throw new Error('Expected synthetic fixture signals are missing');
    }

    const projectedEarthquake = toSimulationSignal(earthquake, {
      timestampDay: 12,
      effectiveDay: 13,
    });
    const projectedAttention = toSimulationSignal(attention, { timestampDay: 12 });
    expect(projectedEarthquake.objectivePressure.construction).toBeGreaterThan(0);
    expect(projectedEarthquake.effectiveDay).toBe(13);
    expect(projectedAttention.objectivePressure.knowledge).toBeUndefined();
    expect(projectedAttention.beliefPressure.knowledge).toBeGreaterThan(0);
  });
});
