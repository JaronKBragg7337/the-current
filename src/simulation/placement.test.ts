import { describe, expect, it } from 'vitest';

import { createSimulation } from './index';
import {
  BUILDING_FOOTPRINTS,
  BUILDING_SETBACK_METERS,
  MAIN_ROADS,
  distanceToRoad,
  findBuildingSite,
  footprintRect,
  isValidSite,
} from './placement';
import { DeterministicRng } from './rng';
import type { Building } from './types';

function rectsOverlap(a: ReturnType<typeof footprintRect>, b: ReturnType<typeof footprintRect>, margin: number): boolean {
  return a.minX - margin < b.maxX && a.maxX + margin > b.minX &&
    a.minZ - margin < b.maxZ && a.maxZ + margin > b.minZ;
}

function assertNoOverlaps(buildings: readonly Pick<Building, 'type' | 'position' | 'name'>[], margin: number): void {
  const placeable = buildings.filter((building) => building.type !== 'road');
  for (let i = 0; i < placeable.length; i += 1) {
    for (let j = i + 1; j < placeable.length; j += 1) {
      const a = placeable[i];
      const b = placeable[j];
      if (a === undefined || b === undefined) continue;
      const overlap = rectsOverlap(footprintRect(a.type, a.position), footprintRect(b.type, b.position), margin);
      expect(overlap, `${a.name} overlaps ${b.name}`).toBe(false);
    }
  }
}

describe('building placement', () => {
  it('bootstrap layout has no overlapping footprints', () => {
    const simulation = createSimulation({ seed: 'placement-bootstrap' });
    const buildings = Object.values(simulation.snapshot().state.buildings);
    assertNoOverlaps(buildings, 0);
  });

  it('bootstrap buildings keep clear of road corridors', () => {
    const simulation = createSimulation({ seed: 'placement-bootstrap' });
    const buildings = Object.values(simulation.snapshot().state.buildings);
    for (const building of buildings) {
      if (building.type === 'road') continue;
      const rect = footprintRect(building.type, building.position);
      const corners: readonly [number, number][] = [
        [rect.minX, rect.minZ],
        [rect.minX, rect.maxZ],
        [rect.maxX, rect.minZ],
        [rect.maxX, rect.maxZ],
      ];
      for (const road of MAIN_ROADS) {
        for (const [x, z] of corners) {
          expect(
            distanceToRoad(x, z, road),
            `${building.name} intrudes on ${road.id}`,
          ).toBeGreaterThanOrEqual(road.halfWidth);
        }
      }
    }
  });

  it('long simulations never construct overlapping buildings', () => {
    const simulation = createSimulation({ seed: 'placement-long-run' });
    for (let day = 0; day < 200; day += 1) simulation.advanceDay();
    const buildings = Object.values(simulation.snapshot().state.buildings);
    expect(buildings.length).toBeGreaterThan(14);
    assertNoOverlaps(buildings, 0);
  }, 60_000);

  it('findBuildingSite is deterministic for identical inputs', () => {
    const buildings = [
      { type: 'house', position: { x: 0, y: 0, z: 0 } },
      { type: 'farm', position: { x: 20, y: 0, z: 20 } },
    ] as const;
    const first = findBuildingSite(DeterministicRng.fromSeed('site'), 'house', buildings);
    const second = findBuildingSite(DeterministicRng.fromSeed('site'), 'house', buildings);
    expect(first).not.toBeNull();
    expect(first).toEqual(second);
  });

  it('findBuildingSite respects setbacks in a crowded field', () => {
    const obstacles: { type: 'house'; position: { x: number; y: number; z: number } }[] = [];
    for (let x = -40; x <= 40; x += 16) {
      for (let z = -30; z <= 40; z += 16) {
        obstacles.push({ type: 'house', position: { x, y: 0, z } });
      }
    }
    const site = findBuildingSite(DeterministicRng.fromSeed('crowded'), 'house', obstacles);
    expect(site).not.toBeNull();
    if (site === null) return;
    const rect = footprintRect('house', site);
    for (const obstacle of obstacles) {
      const other = footprintRect(obstacle.type, obstacle.position);
      expect(rectsOverlap(rect, other, 0)).toBe(false);
    }
  });

  it('isValidSite rejects overlapping and road-intruding candidates', () => {
    const obstacles = [{ type: 'house' as const, position: { x: -45, z: -40 } }];
    // Overlapping the obstacle: rejected.
    expect(isValidSite('house', { x: -43, z: -40 }, obstacles)).toBe(false);
    // Clear of the obstacle by more than depth + setback, away from roads: accepted.
    expect(
      isValidSite('house', { x: -45, z: -40 + BUILDING_FOOTPRINTS.house.depth + BUILDING_SETBACK_METERS + 1 }, obstacles),
    ).toBe(true);
    // Sitting directly on the main road: rejected even with no obstacles.
    expect(isValidSite('house', { x: -8, z: 0 }, [])).toBe(false);
  });
});
