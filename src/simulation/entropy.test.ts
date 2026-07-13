import { describe, expect, it } from 'vitest';

import { canonicalStringify } from './canonical';
import { createSimulation, restoreSimulation } from './index';
import type { DayInputs } from './types';
import type { WorldSnapshot } from './types';

const EMPTY: DayInputs = { signals: [], interventions: [] };

describe('hidden entropy layers', () => {
  it('stays fully deterministic when no entropy is provided', () => {
    const a = createSimulation({ seed: 'entropy-baseline' });
    const b = createSimulation({ seed: 'entropy-baseline' });
    for (let day = 0; day < 40; day += 1) {
      a.advanceDay(EMPTY);
      b.advanceDay(EMPTY);
    }
    expect(a.snapshot().digest).toBe(b.snapshot().digest);
  });

  it('diverges permanently once entropy is mixed, even with an identical seed', () => {
    const plain = createSimulation({ seed: 'entropy-divergence' });
    const salted = createSimulation({ seed: 'entropy-divergence' });
    for (let day = 1; day <= 40; day += 1) {
      plain.advanceDay(EMPTY);
      salted.advanceDay(day === 10 ? { ...EMPTY, entropy: 'c0ffee-day-10' } : EMPTY);
      if (day < 10) {
        expect(salted.snapshot().digest, `day ${day} should match before entropy`).toBe(plain.snapshot().digest);
      }
    }
    expect(salted.snapshot().digest).not.toBe(plain.snapshot().digest);
  });

  it('replays exactly when the recorded entropy inputs are replayed', () => {
    const inputsForDay = (day: number): DayInputs =>
      day % 7 === 0 ? { ...EMPTY, entropy: `recorded-${day}` } : EMPTY;
    const first = createSimulation({ seed: 'entropy-replay' });
    const second = createSimulation({ seed: 'entropy-replay' });
    for (let day = 1; day <= 50; day += 1) {
      first.advanceDay(inputsForDay(day));
      second.advanceDay(inputsForDay(day));
    }
    expect(first.snapshot().digest).toBe(second.snapshot().digest);
  });

  it('resumes from a snapshot with its entropy chains intact', () => {
    const original = createSimulation({ seed: 'entropy-resume' });
    for (let day = 1; day <= 20; day += 1) {
      original.advanceDay(day === 5 ? { ...EMPTY, entropy: 'mid-run' } : EMPTY);
    }
    const resumed = restoreSimulation(original.snapshot());
    for (let day = 21; day <= 40; day += 1) {
      original.advanceDay(EMPTY);
      resumed.advanceDay(EMPTY);
    }
    expect(resumed.snapshot().digest).toBe(original.snapshot().digest);
  });

  it('continues identically after a key-order-normalizing round trip (Postgres jsonb)', () => {
    const original = createSimulation({ seed: 'entropy-jsonb' });
    for (let day = 1; day <= 15; day += 1) {
      original.advanceDay(day % 4 === 0 ? { ...EMPTY, entropy: `jsonb-${day}` } : EMPTY);
    }
    // Postgres jsonb does not preserve object key order; canonicalStringify
    // sorts keys, which reproduces that normalization.
    const roundTripped = JSON.parse(canonicalStringify(original.snapshot())) as WorldSnapshot;
    const resumed = restoreSimulation(roundTripped);
    for (let day = 16; day <= 40; day += 1) {
      const inputs = day % 4 === 0 ? { ...EMPTY, entropy: `jsonb-${day}` } : EMPTY;
      original.advanceDay(inputs);
      resumed.advanceDay(inputs);
    }
    expect(resumed.snapshot().digest).toBe(original.snapshot().digest);
  });

  it('different entropy values on the same day produce different futures', () => {
    const a = createSimulation({ seed: 'entropy-branch' });
    const b = createSimulation({ seed: 'entropy-branch' });
    for (let day = 1; day <= 30; day += 1) {
      a.advanceDay(day === 3 ? { ...EMPTY, entropy: 'branch-a' } : EMPTY);
      b.advanceDay(day === 3 ? { ...EMPTY, entropy: 'branch-b' } : EMPTY);
    }
    expect(a.snapshot().digest).not.toBe(b.snapshot().digest);
  });
});
