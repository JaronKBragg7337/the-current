import { BUILDING_FOOTPRINTS, MAIN_ROADS, type BuildingProjection } from '../simulation';
import type { RoadPoint } from './roadGeometry';

function closestPointOnSegment(point: RoadPoint, start: RoadPoint, end: RoadPoint): RoadPoint {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const lengthSquared = dx * dx + dz * dz;
  if (lengthSquared === 0) return start;
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.z - start.z) * dz) / lengthSquared));
  return { x: start.x + dx * t, z: start.z + dz * t };
}

/**
 * Gives each building a short walkable approach from a road edge to its
 * footprint, rather than drawing a strip through every road corridor.
 */
export function accessPathForBuilding(
  building: Pick<BuildingProjection, 'position' | 'type'>,
): RoadPoint[] | null {
  const center = { x: building.position.x, z: building.position.z };
  let closest: { point: RoadPoint; halfWidth: number } | null = null;
  let closestDistanceSquared = Number.POSITIVE_INFINITY;

  for (const road of MAIN_ROADS) {
    for (let index = 0; index < road.points.length - 1; index += 1) {
      const start = road.points[index];
      const end = road.points[index + 1];
      if (start === undefined || end === undefined) continue;
      const point = closestPointOnSegment(center, start, end);
      const distanceSquared = (center.x - point.x) ** 2 + (center.z - point.z) ** 2;
      if (distanceSquared < closestDistanceSquared) {
        closestDistanceSquared = distanceSquared;
        closest = { point, halfWidth: road.halfWidth };
      }
    }
  }

  if (closest === null || closestDistanceSquared < 0.01) return null;
  const distance = Math.sqrt(closestDistanceSquared);
  const normal = {
    x: (center.x - closest.point.x) / distance,
    z: (center.z - closest.point.z) / distance,
  };
  const footprint = BUILDING_FOOTPRINTS[building.type];
  const edgeDistance = Math.abs(normal.x) * footprint.width / 2 + Math.abs(normal.z) * footprint.depth / 2;
  const roadEdge = {
    x: closest.point.x + normal.x * (closest.halfWidth + 0.9),
    z: closest.point.z + normal.z * (closest.halfWidth + 0.9),
  };
  const buildingEdge = {
    x: center.x - normal.x * (edgeDistance + 0.7),
    z: center.z - normal.z * (edgeDistance + 0.7),
  };
  const pathLength = Math.hypot(buildingEdge.x - roadEdge.x, buildingEdge.z - roadEdge.z);
  return pathLength > 0.45 ? [roadEdge, buildingEdge] : null;
}
