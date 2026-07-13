import type { VehicleProjection } from '../app/types';
import { MAIN_ROADS, type RoadPath, type WorldProjection } from '../simulation';
import { terrainHeight } from './terrain';

export interface VehicleRoute {
  id: string;
  points: ReadonlyArray<{ x: number; z: number }>;
}

/**
 * Offset a road centerline sideways so vehicles drive in a lane on the road
 * surface instead of down the exact centerline. A positive offset is the
 * right-hand lane in the direction of travel; a negative offset drives the
 * opposite lane.
 */
function laneOffsetPolyline(road: RoadPath, offset: number): { x: number; z: number }[] {
  return road.points.map((point, index) => {
    const previous = road.points[Math.max(0, index - 1)] ?? point;
    const next = road.points[Math.min(road.points.length - 1, index + 1)] ?? point;
    const dx = next.x - previous.x;
    const dz = next.z - previous.z;
    const length = Math.hypot(dx, dz) || 1;
    return {
      x: point.x + (-dz / length) * offset,
      z: point.z + (dx / length) * offset,
    };
  });
}

/**
 * Vehicle routes are derived directly from the authoritative road network.
 * Each road contributes two lanes (one per direction), so carts on the same
 * road never share a lane, and because building placement keeps footprints
 * clear of road corridors, vehicles cannot pass through structures.
 */
export const VEHICLE_ROUTES: readonly VehicleRoute[] = MAIN_ROADS.flatMap((road) => {
  const lane = Math.max(0.7, road.halfWidth - 1.15);
  const forward = laneOffsetPolyline(road, lane);
  const reverse = laneOffsetPolyline(road, -lane).slice().reverse();
  return [
    { id: `${road.id}:east`, points: forward },
    { id: `${road.id}:west`, points: reverse },
  ];
});

export function positionOnRoute(route: VehicleRoute, progress: number) {
  const segmentCount = route.points.length - 1;
  const scaled = Math.max(0, Math.min(0.999_999, progress)) * segmentCount;
  const segment = Math.floor(scaled);
  const local = scaled - segment;
  const start = route.points[segment] ?? route.points[0] ?? { x: 0, z: 0 };
  const end = route.points[segment + 1] ?? start;
  const x = start.x + (end.x - start.x) * local;
  const z = start.z + (end.z - start.z) * local;
  return {
    position: { x, y: terrainHeight(x, z), z },
    yaw: Math.atan2(end.x - start.x, end.z - start.z),
  };
}

export function deriveVehicles(projection: WorldProjection): VehicleProjection[] {
  const activeCount = Math.max(1, Math.min(6, Math.floor(projection.resources.transport / 7)));
  const cargoKinds = ['food and seed', 'timber', 'stone and tools', 'market goods', 'medicine', 'reclaimed materials'];
  return Array.from({ length: activeCount }, (_, index) => {
    const route = VEHICLE_ROUTES[index % VEHICLE_ROUTES.length] ?? VEHICLE_ROUTES[0];
    if (route === undefined) throw new Error('At least one vehicle route is required');
    const routeProgress = (projection.day * 0.083 + index * 0.217) % 1;
    const placed = positionOnRoute(route, routeProgress);
    return {
      id: `transport-${index + 1}`,
      name: index % 3 === 0 ? `Confluence hauler ${index + 1}` : `Supply cart ${index + 1}`,
      cargo: cargoKinds[index % cargoKinds.length] ?? 'mixed goods',
      routeProgress,
      position: placed.position,
      yaw: placed.yaw,
      active: projection.resources.energy > 2 && projection.resources.transport > index * 5,
    };
  });
}
