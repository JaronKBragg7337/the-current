import { describe, expect, it } from 'vitest';

import type { BuildingProjection, PersonProjection } from '../simulation';
import { personInsideBuilding, spreadCoLocatedPeople } from './crowdLayout';
import { createRoadRibbonGeometry } from './roadGeometry';
import { resourceTier } from './visualProjection';

describe('visual projection systems', () => {
  it('maps resource stocks to stable aggregate quantity tiers', () => {
    expect([0, 4, 5, 18, 19, 55, 56, 500].map(resourceTier)).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
  });

  it('winds authoritative road ribbons upward for spectator cameras', () => {
    const geometry = createRoadRibbonGeometry([{ x: -4, z: 0 }, { x: 4, z: 0 }], 2);
    const normal = geometry.getAttribute('normal');
    expect(normal).toBeDefined();
    for (let index = 0; index < (normal?.count ?? 0); index += 1) {
      expect(normal?.getY(index)).toBeGreaterThan(0.99);
    }
    geometry.dispose();
  });
});

describe('crowd visual projection', () => {
  const person = (id: string): PersonProjection => ({
    id: id as PersonProjection['id'],
    name: id,
    position: { x: 16, y: 0, z: 12 },
    destination: { x: 16, y: 0, z: 12 },
    yaw: 0,
    heightMeters: 1.72,
    lifeStage: 'adult',
    biologicalSex: 'female',
    occupation: 'trader',
    task: 'trade',
    health: 100,
    emotion: 0,
    householdId: null,
    homeBuildingId: null,
    partnerId: null,
    decisionReason: '',
    rareEvidence: 0,
  });
  const market: BuildingProjection = {
    id: 'building:market' as BuildingProjection['id'],
    name: 'Market',
    type: 'market',
    position: { x: 16, y: 0, z: 12 },
    stage: 'complete',
    progress: 1,
    capacity: 12,
    condition: 100,
    environment: { fertility: 78, waterQuality: 92, contamination: 1, wasteLoad: 0, status: 'healthy' },
    occupied: 3,
  };

  it('spreads co-located people deterministically inside a workplace footprint', () => {
    const people = [person('person:1'), person('person:2'), person('person:3')];
    const first = spreadCoLocatedPeople(people, [market]);
    const second = spreadCoLocatedPeople(people, [market]);
    expect(first.map((entry) => entry.position)).toEqual(second.map((entry) => entry.position));
    expect(new Set(first.map((entry) => `${entry.position.x}:${entry.position.z}`)).size).toBe(3);
    expect(first.every((entry) => personInsideBuilding(entry, market))).toBe(true);
  });
});
