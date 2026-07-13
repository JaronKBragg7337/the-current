import type { Building, BuildingType, Position3 } from './types';
import type { DeterministicRng } from './rng';

/**
 * Authoritative physical layout data.
 *
 * The simulation — not the renderer — owns building footprints and road
 * corridors so that site selection, vehicle routing, and rendering all agree
 * on where structures and roads physically exist. The renderer imports these
 * tables instead of duplicating them.
 */

export interface Footprint {
  width: number;
  depth: number;
}

export const BUILDING_FOOTPRINTS: Record<BuildingType, Footprint> = {
  clinic: { width: 11, depth: 8 },
  'council-hall': { width: 14, depth: 10 },
  farm: { width: 15, depth: 11 },
  house: { width: 7.2, depth: 8.2 },
  market: { width: 12, depth: 9 },
  'power-station': { width: 13, depth: 9 },
  road: { width: 8, depth: 4 },
  school: { width: 13, depth: 9 },
  warehouse: { width: 14, depth: 10 },
  well: { width: 4, depth: 4 },
  workshop: { width: 11, depth: 8 },
};

/** Minimum clear ground between any two building footprints, in meters. */
export const BUILDING_SETBACK_METERS = 4;

/** Extra clear ground between a building footprint and a road edge. */
export const ROAD_CLEARANCE_METERS = 1.5;

export interface RoadPoint {
  x: number;
  z: number;
}

export interface RoadPath {
  id: string;
  halfWidth: number;
  points: readonly RoadPoint[];
}

/**
 * The settlement's main road network. Vehicles drive exactly on these
 * polylines and buildings must keep clear of them.
 */
export const MAIN_ROADS: readonly RoadPath[] = [
  {
    id: 'confluence-way',
    halfWidth: 2.45,
    points: [
      { x: -128, z: 18 },
      { x: -105, z: 18 },
      { x: -74, z: 12 },
      { x: -42, z: 3 },
      { x: -8, z: 0 },
      { x: 32, z: 4 },
      { x: 68, z: 15 },
    ],
  },
  {
    id: 'river-road',
    halfWidth: 1.65,
    points: [
      { x: -8, z: -55 },
      { x: -5, z: -30 },
      { x: -8, z: 0 },
      { x: -2, z: 28 },
      { x: 18, z: 58 },
    ],
  },
  {
    id: 'workshop-row',
    halfWidth: 1.65,
    points: [
      { x: -44, z: -18 },
      { x: -18, z: -12 },
      { x: 12, z: -13 },
      { x: 42, z: -22 },
    ],
  },
];

export interface PlacementBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export const SETTLEMENT_BOUNDS: PlacementBounds = { minX: -58, maxX: 58, minZ: -48, maxZ: 52 };

interface Rect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export function footprintRect(type: BuildingType, position: { x: number; z: number }): Rect {
  const footprint = BUILDING_FOOTPRINTS[type];
  return {
    minX: position.x - footprint.width / 2,
    maxX: position.x + footprint.width / 2,
    minZ: position.z - footprint.depth / 2,
    maxZ: position.z + footprint.depth / 2,
  };
}

function rectsOverlap(a: Rect, b: Rect, margin: number): boolean {
  return a.minX - margin < b.maxX && a.maxX + margin > b.minX &&
    a.minZ - margin < b.maxZ && a.maxZ + margin > b.minZ;
}

function distanceToSegment(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const abx = bx - ax;
  const abz = bz - az;
  const lengthSquared = abx * abx + abz * abz;
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * abx + (pz - az) * abz) / lengthSquared));
  const cx = ax + abx * t;
  const cz = az + abz * t;
  return Math.hypot(px - cx, pz - cz);
}

export function distanceToRoad(x: number, z: number, road: RoadPath): number {
  let best = Number.POSITIVE_INFINITY;
  for (let index = 0; index < road.points.length - 1; index += 1) {
    const start = road.points[index];
    const end = road.points[index + 1];
    if (start === undefined || end === undefined) continue;
    best = Math.min(best, distanceToSegment(x, z, start.x, start.z, end.x, end.z));
  }
  return best;
}

function rectClearOfRoads(rect: Rect, clearance: number): boolean {
  const samples: readonly [number, number][] = [
    [rect.minX, rect.minZ],
    [rect.minX, rect.maxZ],
    [rect.maxX, rect.minZ],
    [rect.maxX, rect.maxZ],
    [(rect.minX + rect.maxX) / 2, (rect.minZ + rect.maxZ) / 2],
    [(rect.minX + rect.maxX) / 2, rect.minZ],
    [(rect.minX + rect.maxX) / 2, rect.maxZ],
    [rect.minX, (rect.minZ + rect.maxZ) / 2],
    [rect.maxX, (rect.minZ + rect.maxZ) / 2],
  ];
  for (const road of MAIN_ROADS) {
    for (const [x, z] of samples) {
      if (distanceToRoad(x, z, road) < road.halfWidth + clearance) return false;
    }
  }
  return true;
}

export interface PlacementObstacle {
  type: BuildingType;
  position: { x: number; z: number };
}

export function isValidSite(
  type: BuildingType,
  position: { x: number; z: number },
  obstacles: readonly PlacementObstacle[],
  setback: number = BUILDING_SETBACK_METERS,
  roadClearance: number = ROAD_CLEARANCE_METERS,
  bounds: PlacementBounds = SETTLEMENT_BOUNDS,
): boolean {
  const rect = footprintRect(type, position);
  if (rect.minX < bounds.minX || rect.maxX > bounds.maxX || rect.minZ < bounds.minZ || rect.maxZ > bounds.maxZ) {
    return false;
  }
  if (!rectClearOfRoads(rect, roadClearance)) return false;
  for (const obstacle of obstacles) {
    if (obstacle.type === 'road') continue;
    if (rectsOverlap(rect, footprintRect(obstacle.type, obstacle.position), setback)) return false;
  }
  return true;
}

/**
 * Deterministically choose a construction site that does not overlap any
 * existing building (with setback) and keeps clear of road corridors.
 *
 * Sampling is rejection-based from the provided RNG stream, so the result is
 * a pure function of (rng state, existing buildings). If the settlement is so
 * dense that no fully compliant site exists, the setback relaxes in stages
 * before falling back to the least-crowded sampled candidate, so construction
 * never deadlocks.
 */
export function findBuildingSite(
  rng: DeterministicRng,
  type: BuildingType,
  buildings: readonly Pick<Building, 'type' | 'position'>[],
  bounds: PlacementBounds = SETTLEMENT_BOUNDS,
): Position3 | null {
  const obstacles: PlacementObstacle[] = buildings
    .filter((building) => building.type !== 'road')
    .map((building) => ({ type: building.type, position: { x: building.position.x, z: building.position.z } }));
  const footprint = BUILDING_FOOTPRINTS[type];
  // When the founding district fills up, the settlement physically expands
  // outward in growth rings rather than ever stacking two buildings on the
  // same ground. Construction therefore remains visible as outward growth.
  const growthRings: PlacementBounds[] = [
    bounds,
    { minX: bounds.minX - 30, maxX: bounds.maxX + 30, minZ: bounds.minZ - 26, maxZ: bounds.maxZ + 26 },
    { minX: bounds.minX - 62, maxX: bounds.maxX + 62, minZ: bounds.minZ - 54, maxZ: bounds.maxZ + 54 },
    { minX: bounds.minX - 100, maxX: bounds.maxX + 100, minZ: bounds.minZ - 90, maxZ: bounds.maxZ + 90 },
  ];
  const setbacks = [BUILDING_SETBACK_METERS, 2.5, 1, 0.25];
  for (const setback of setbacks) {
    for (const ring of growthRings) {
      const sampleBounds: PlacementBounds = {
        minX: Math.ceil(ring.minX + footprint.width / 2),
        maxX: Math.floor(ring.maxX - footprint.width / 2),
        minZ: Math.ceil(ring.minZ + footprint.depth / 2),
        maxZ: Math.floor(ring.maxZ - footprint.depth / 2),
      };
      for (let attempt = 0; attempt < 80; attempt += 1) {
        const candidate = {
          x: rng.int(sampleBounds.minX, sampleBounds.maxX),
          y: 0,
          z: rng.int(sampleBounds.minZ, sampleBounds.maxZ),
        };
        if (isValidSite(type, candidate, obstacles, setback, ROAD_CLEARANCE_METERS, ring)) {
          return candidate;
        }
      }
    }
  }
  // Exhaustive deterministic sweep of the widest ring as a final safety net;
  // construction is skipped entirely rather than allowed to overlap.
  const widest = growthRings[growthRings.length - 1] ?? bounds;
  for (let x = Math.ceil(widest.minX + footprint.width / 2); x <= widest.maxX - footprint.width / 2; x += 4) {
    for (let z = Math.ceil(widest.minZ + footprint.depth / 2); z <= widest.maxZ - footprint.depth / 2; z += 4) {
      if (isValidSite(type, { x, z }, obstacles, 0.25, ROAD_CLEARANCE_METERS, widest)) {
        return { x, y: 0, z };
      }
    }
  }
  return null;
}

/**
 * Push a traveler out of any building footprint they are merely passing
 * through. People whose destination lies at (or inside) a building are
 * legitimately entering it and are left alone; everyone else is moved to the
 * nearest footprint edge so nobody rests inside an unrelated structure.
 * Pure math — deterministic.
 */
export function resolveTravelerPosition(
  position: { x: number; z: number },
  destination: { x: number; z: number },
  obstacles: readonly PlacementObstacle[],
): { x: number; z: number } {
  const clearance = 0.6;
  let x = position.x;
  let z = position.z;
  for (const obstacle of obstacles) {
    if (obstacle.type === 'road') continue;
    const rect = footprintRect(obstacle.type, obstacle.position);
    const inside = x > rect.minX && x < rect.maxX && z > rect.minZ && z < rect.maxZ;
    if (!inside) continue;
    const destinationInside = destination.x >= rect.minX - 1 && destination.x <= rect.maxX + 1 &&
      destination.z >= rect.minZ - 1 && destination.z <= rect.maxZ + 1;
    if (destinationInside) continue;
    const exits = [
      { x: rect.minX - clearance, z, cost: x - rect.minX },
      { x: rect.maxX + clearance, z, cost: rect.maxX - x },
      { x, z: rect.minZ - clearance, cost: z - rect.minZ },
      { x, z: rect.maxZ + clearance, cost: rect.maxZ - z },
    ];
    exits.sort((a, b) => a.cost - b.cost);
    const exit = exits[0];
    if (exit !== undefined) {
      x = exit.x;
      z = exit.z;
    }
  }
  return { x, z };
}

/**
 * Resolve a preferred (hand-authored) position to the nearest valid site.
 * Used at bootstrap so the founding layout obeys the same spacing rules as
 * everything built later. Deterministic spiral search — no randomness.
 */
export function resolveNearValidSite(
  type: BuildingType,
  preferred: { x: number; z: number },
  obstacles: readonly PlacementObstacle[],
  bounds: PlacementBounds = SETTLEMENT_BOUNDS,
): Position3 {
  if (isValidSite(type, preferred, obstacles, BUILDING_SETBACK_METERS, ROAD_CLEARANCE_METERS, bounds)) {
    return { x: preferred.x, y: 0, z: preferred.z };
  }
  for (let radius = 1; radius <= 60; radius += 1) {
    for (let step = 0; step < radius * 8; step += 1) {
      const angle = (step / (radius * 8)) * Math.PI * 2;
      const candidate = {
        x: Math.round(preferred.x + Math.cos(angle) * radius),
        z: Math.round(preferred.z + Math.sin(angle) * radius),
      };
      if (isValidSite(type, candidate, obstacles, BUILDING_SETBACK_METERS, ROAD_CLEARANCE_METERS, bounds)) {
        return { x: candidate.x, y: 0, z: candidate.z };
      }
    }
  }
  return { x: preferred.x, y: 0, z: preferred.z };
}
