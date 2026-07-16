import { describe, expect, it } from 'vitest';

import type { PersonProjection } from '../simulation';
import { presentDailyTravel } from './travelPresentation';

const PERSON = {
  id: 'person:travel',
  previousPosition: { x: 0, y: 0, z: 0 },
  position: { x: 10, y: 0, z: 0 },
} as PersonProjection;

describe('daily travel presentation', () => {
  it('keeps the simulation endpoints and exposes a journey between them', () => {
    const started = '2026-07-16T00:00:00.000Z';
    const duration = 86_400_000;
    const samples = Array.from({ length: 101 }, (_, index) =>
      presentDailyTravel(PERSON, 1, started, duration, Date.parse(started) + duration * index / 100).position.x,
    );
    expect(samples[0]).toBe(0);
    expect(samples.at(-1)).toBe(10);
    expect(samples.some((position) => position > 0 && position < 10)).toBe(true);
  });

  it('does not invent movement without an authoritative clock', () => {
    expect(presentDailyTravel(PERSON, 1, null, null, Date.now())).toBe(PERSON);
  });
});
