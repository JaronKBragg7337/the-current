import { describe, expect, it } from 'vitest';

import { createSimulation, MAIN_ROADS, distanceToRoad, footprintRect } from '../simulation';
import { positionOnRoute, VEHICLE_ROUTES } from './vehicles';

describe('vehicle routing', () => {
  it('derives two lanes per authoritative road', () => {
    expect(VEHICLE_ROUTES.length).toBe(MAIN_ROADS.length * 2);
  });

  it('keeps every lane on its road surface', () => {
    for (const route of VEHICLE_ROUTES) {
      const roadId = route.id.split(':')[0];
      const road = MAIN_ROADS.find((candidate) => candidate.id === roadId);
      expect(road, `road for ${route.id}`).toBeDefined();
      if (road === undefined) continue;
      for (let sample = 0; sample <= 40; sample += 1) {
        const placed = positionOnRoute(route, sample / 40);
        expect(
          distanceToRoad(placed.position.x, placed.position.z, road),
          `${route.id} leaves the road at progress ${sample / 40}`,
        ).toBeLessThanOrEqual(road.halfWidth + 0.01);
      }
    }
  });

  it('never drives through buildings, even after long construction runs', () => {
    const simulation = createSimulation({ seed: 'vehicle-collision-check' });
    for (let day = 0; day < 200; day += 1) simulation.advanceDay();
    const buildings = Object.values(simulation.snapshot().state.buildings)
      .filter((building) => building.type !== 'road');
    for (const route of VEHICLE_ROUTES) {
      for (let sample = 0; sample <= 120; sample += 1) {
        const placed = positionOnRoute(route, sample / 120);
        for (const building of buildings) {
          const rect = footprintRect(building.type, building.position);
          const inside = placed.position.x > rect.minX && placed.position.x < rect.maxX &&
            placed.position.z > rect.minZ && placed.position.z < rect.maxZ;
          expect(inside, `${route.id} passes through ${building.name}`).toBe(false);
        }
      }
    }
  }, 60_000);
});
