import { describe, expect, it } from 'vitest';

import {
  DETAILED_PERSON_DISTANCE_METERS,
  shouldRenderDetailedPerson,
  shouldRenderFarPerson,
} from './populationTiers';

describe('population render tiers', () => {
  it('assigns every unselected person to exactly one tier at the cutoff', () => {
    const cutoffSquared = DETAILED_PERSON_DISTANCE_METERS ** 2;

    for (const distanceSquared of [cutoffSquared - 0.01, cutoffSquared, cutoffSquared + 0.01]) {
      const detailed = shouldRenderDetailedPerson(distanceSquared, false, false);
      const far = shouldRenderFarPerson(distanceSquared, false, false);

      expect(Number(detailed) + Number(far)).toBe(1);
    }
  });

  it('keeps a selected person detailed at any distance without duplicating it', () => {
    const distant = (DETAILED_PERSON_DISTANCE_METERS * 10) ** 2;

    expect(shouldRenderDetailedPerson(distant, true, false)).toBe(true);
    expect(shouldRenderFarPerson(distant, true, false)).toBe(false);
  });

  it('hides the selected body from both tiers in first-person mode', () => {
    expect(shouldRenderDetailedPerson(0, true, true)).toBe(false);
    expect(shouldRenderFarPerson(0, true, true)).toBe(false);
  });
});
