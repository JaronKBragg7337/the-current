import { describe, expect, it } from 'vitest';

import { MAIN_ROADS, distanceToRoad, footprintRect } from '../simulation';
import { accessPathForBuilding } from './roadAccess';

describe('building access paths', () => {
  it('starts outside the nearest road and ends at the building edge', () => {
    const building = { type: 'house' as const, position: { x: 0, y: 0, z: 20 } };
    const path = accessPathForBuilding(building);

    expect(path).not.toBeNull();
    if (path === null) return;
    const roadEdge = path[0];
    const buildingEdge = path[1];
    expect(roadEdge).toBeDefined();
    expect(buildingEdge).toBeDefined();
    if (roadEdge === undefined || buildingEdge === undefined) return;
    const nearestRoadClearance = Math.min(
      ...MAIN_ROADS.map((road) => distanceToRoad(roadEdge.x, roadEdge.z, road) - road.halfWidth),
    );
    const footprint = footprintRect(building.type, building.position);
    const endsOutsideBuilding = buildingEdge.x <= footprint.minX || buildingEdge.x >= footprint.maxX ||
      buildingEdge.z <= footprint.minZ || buildingEdge.z >= footprint.maxZ;

    expect(nearestRoadClearance).toBeGreaterThan(0.75);
    expect(endsOutsideBuilding).toBe(true);
  });
});
