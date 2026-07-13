export { canonicalDigest, canonicalStringify } from './canonical';
export { DEFAULT_SIMULATION_CONFIG, resolveSimulationConfig } from './config';
export { CurrentSimulation } from './engine';
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
