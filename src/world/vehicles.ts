import type { VehicleProjection } from '../app/types';
import type { WorldProjection } from '../simulation';
import { terrainHeight } from './terrain';

export interface VehicleRoute {
  id: string;
  points: ReadonlyArray<{ x: number; z: number }>;
}
export const VEHICLE_ROUTES: readonly VehicleRoute[] = [
  {
    id: 'west-market',
    points: [
      { x: -112, z: 18 },
      { x: -74, z: 12 },
      { x: -38, z: 3 },
      { x: 2, z: 0 },
      { x: 44, z: 9 },
    ],
  },
  {
    id: 'farm-warehouse',
    points: [
      { x: -8, z: -52 },
      { x: -6, z: -24 },
      { x: -8, z: 0 },
      { x: -1, z: 26 },
      { x: 17, z: 55 },
    ],
  },
  {
    id: 'workshop-loop',
    points: [
      { x: -44, z: -18 },
      { x: -12, z: -12 },
      { x: 20, z: -14 },
      { x: 42, z: -22 },
      { x: 14, z: -13 },
      { x: -20, z: -13 },
    ],
  },
] as const;

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
