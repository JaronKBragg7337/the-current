import { describe, expect, it } from 'vitest';

import {
  DeterministicRng,
  SIMULATION_SCHEMA_VERSION,
  createSimulation,
  restoreSimulation,
} from '../../src/simulation';

describe('deterministic simulation', () => {
  it('produces stable seeded random streams without ambient randomness', () => {
    const left = DeterministicRng.fromSeed('audit-seed');
    const right = DeterministicRng.fromSeed('audit-seed');
    expect(Array.from({ length: 32 }, () => left.nextUint32())).toEqual(
      Array.from({ length: 32 }, () => right.nextUint32()),
    );

    const originalRandom = Math.random;
    Math.random = () => {
      throw new Error('The authoritative simulation must not use Math.random');
    };
    try {
      const simulation = createSimulation({ seed: 'no-ambient-randomness' });
      simulation.advanceDays(3);
      expect(simulation.currentDay).toBe(3);
    } finally {
      Math.random = originalRandom;
    }
  });

  it('starts with 20 reproducible people whose hidden lifespans use real day units', () => {
    const first = createSimulation({ seed: 'population-audit' });
    const second = createSimulation({ seed: 'population-audit' });
    const snapshot = first.snapshot();

    expect(snapshot.schemaVersion).toBe(SIMULATION_SCHEMA_VERSION);
    expect(first.digest()).toBe(second.digest());
    expect(first.metrics().population).toBe(20);
    expect(Object.values(snapshot.state.people)).toHaveLength(20);
    for (const person of Object.values(snapshot.state.people)) {
      // Lifespan is measured from birth, so a founder who starts already aged
      // still carries a full human lifespan rather than a fresh one from day zero.
      expect(person.naturalDeathDay - person.birthDay).toBeGreaterThanOrEqual(snapshot.state.config.lifespan.min);
      expect(person.naturalDeathDay - person.birthDay).toBeLessThanOrEqual(snapshot.state.config.lifespan.max);
      expect(person.name.length).toBeGreaterThan(3);
    }
  });

  it('replays 150 days exactly and resumes a snapshot without divergence', () => {
    const initial = createSimulation({ seed: 'current-public-001' });
    const initialMetrics = initial.metrics();
    const mirror = createSimulation({ seed: 'current-public-001' });

    const firstHalf = initial.advanceDays(75);
    const mirrorFirstHalf = mirror.advanceDays(75);
    expect(firstHalf.map((result) => result.digest)).toEqual(mirrorFirstHalf.map((result) => result.digest));

    const checkpoint = mirror.snapshot();
    const restored = restoreSimulation(checkpoint);
    const secondHalf = initial.advanceDays(75);
    const mirrorSecondHalf = mirror.advanceDays(75);
    const restoredSecondHalf = restored.advanceDays(75);

    expect(secondHalf.map((result) => result.digest)).toEqual(mirrorSecondHalf.map((result) => result.digest));
    expect(restoredSecondHalf.map((result) => result.digest)).toEqual(mirrorSecondHalf.map((result) => result.digest));
    expect(initial.digest()).toBe(mirror.digest());
    expect(restored.digest()).toBe(mirror.digest());

    const results = [...firstHalf, ...secondHalf];
    expect(results).toHaveLength(150);
    for (const result of results) {
      expect(result.summary.entrants).toBeGreaterThanOrEqual(0);
      expect(result.summary.entrants).toBeLessThanOrEqual(initial.snapshot().state.config.migration.maxArrivalsPerDay);
      expect(result.events.some((event) => event.type === 'arrival' && event.data.guaranteed === true)).toBe(false);
    }

    const metrics = initial.metrics();
    expect(metrics.day).toBe(150);
    expect(metrics.totalEntrants).toBe(results.reduce((sum, result) => sum + result.summary.entrants, 0));
    expect(metrics.totalEntrants).toBeGreaterThan(0);
    expect(results.some((result) => result.summary.entrants === 0)).toBe(true);
    expect(metrics.activeSocialTies).toBeGreaterThan(0);
    expect(metrics.housingCapacity).toBeGreaterThanOrEqual(initialMetrics.housingCapacity);
    expect(metrics.buildingsComplete).toBeGreaterThanOrEqual(initialMetrics.buildingsComplete);
    expect(metrics.leaders).toBeGreaterThan(0);
    expect(metrics.followerEdges).toBeGreaterThan(0);
    for (const resource of Object.keys(metrics.resourceStock) as (keyof typeof metrics.resourceStock)[]) {
      expect(metrics.resourceStock[resource]).toBeGreaterThanOrEqual(0);
      expect(metrics.resourceStock[resource]).toBeLessThanOrEqual(metrics.resourceCapacity[resource]);
    }
    const foodReserveDays = metrics.foodStock / Math.max(1, metrics.foodConsumedLastDay);
    expect(metrics.foodProducedLastDay >= metrics.foodConsumedLastDay * 0.9 || foodReserveDays >= 2).toBe(true);
    expect(metrics.population).toBeGreaterThan(0);

    const projection = initial.projection();
    expect(projection.people).toHaveLength(metrics.population);
    expect(projection.people.every((person) => initial.inspectPerson(person.id)?.alive === true)).toBe(true);
    expect(projection.people.every((person) => person.decisionReason.length > 0)).toBe(true);
  }, 180_000);

  it('rejects altered save data and separates different seeds', () => {
    const source = createSimulation({ seed: 'save-integrity' });
    source.advanceDays(5);
    const altered = source.snapshot();
    altered.state.settlement.resources.food += 1;
    expect(() => restoreSimulation(altered)).toThrow(/digest/i);

    const other = createSimulation({ seed: 'different-seed' });
    other.advanceDays(5);
    expect(source.digest()).not.toBe(other.digest());
  });
});
