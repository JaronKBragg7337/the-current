export { canonicalDigest, canonicalStringify } from './canonical';
export { DEFAULT_SIMULATION_CONFIG, resolveSimulationConfig } from './config';
export { CurrentSimulation } from './engine';
export {
  BUILDING_FOOTPRINTS,
  BUILDING_SETBACK_METERS,
  MAIN_ROADS,
  ROAD_CLEARANCE_METERS,
  SETTLEMENT_BOUNDS,
  distanceToRoad,
  findBuildingSite,
  footprintRect,
  isValidSite,
  resolveNearValidSite,
  type Footprint,
  type PlacementBounds,
  type PlacementObstacle,
  type RoadPath,
  type RoadPoint,
} from './placement';
export { DeterministicRng, deterministicStream, hashSeed } from './rng';
export * from './types';

import { CurrentSimulation } from './engine';
import type { SimulationCreateOptions, WorldSnapshot } from './types';

export function createSimulation(options: SimulationCreateOptions = {}): CurrentSimulation {
  return CurrentSimulation.create(options);
}

export function restoreSimulation(snapshot: WorldSnapshot): CurrentSimulation {
  return CurrentSimulation.restore(snapshot);
}
