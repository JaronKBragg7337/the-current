import type { DeepPartial, SimulationConfig } from './types';

export const DEFAULT_SIMULATION_CONFIG: SimulationConfig = {
  version: 1,
  ticksPerDay: 24,
  initialPopulation: 20,
  entrantsPerDay: 2,
  entrantAge: { min: 18, max: 32 },
  lifespan: { min: 65, max: 100 },
  lifeStages: {
    adolescent: 8,
    youngAdult: 16,
    adult: 30,
    olderAdult: 55,
    elder: 75,
  },
  needs: {
    foodPerAdult: 2,
    waterPerAdult: 3,
    energyPerAdult: 1,
    childConsumptionScale: 0.55,
    starvationDamage: 13,
    dehydrationDamage: 18,
    exposureDamage: 8,
  },
  relationships: {
    encountersPerPerson: 2,
    partnerAffinity: 58,
    partnerAttraction: 54,
    partnerTrust: 55,
    matureRelationshipDays: 5,
  },
  reproduction: {
    baseConceptionChance: 0.18,
    gestationDays: { min: 4, max: 8 },
    cooldownDays: { min: 8, max: 16 },
    minimumHousingSecurity: 0.65,
    minimumFoodDays: 2,
  },
  construction: {
    maxConcurrentProjects: 3,
    laborPerWorker: 5,
    materialDeliveryPerWorker: 6,
    housingTriggerRatio: 0.88,
    foodReserveTriggerDays: 5,
  },
  leadership: {
    electionIntervalDays: 7,
    minimumFollowers: 2,
    followerTrust: 52,
  },
  rarity: {
    strongLeader: 0.04,
    powerSeeker: 0.015,
    polymath: 0.004,
    exceptional: 0.0008,
  },
  breakthroughs: {
    attemptIntervalDays: 5,
    minimumKnowledge: 54,
    baseProgress: 8,
    failureChance: 0.13,
  },
  history: {
    maxEvents: 50_000,
    maxMemoriesPerPerson: 24,
    maxRelationshipMemories: 16,
  },
};

function mergeObject<T extends object>(base: T, patch: DeepPartial<T> | undefined): T {
  if (patch === undefined) return { ...base };
  const result = { ...base } as Record<string, unknown>;
  const source = patch as Record<string, unknown>;
  for (const key of Object.keys(source)) {
    const patchValue = source[key];
    if (patchValue === undefined) continue;
    const baseValue = result[key];
    if (
      patchValue !== null &&
      baseValue !== null &&
      typeof patchValue === 'object' &&
      typeof baseValue === 'object' &&
      !Array.isArray(patchValue) &&
      !Array.isArray(baseValue)
    ) {
      result[key] = mergeObject(baseValue as object, patchValue as DeepPartial<object>);
    } else {
      result[key] = patchValue;
    }
  }
  return result as T;
}

function requireRange(name: string, minimum: number, maximum: number): void {
  if (!Number.isFinite(minimum) || !Number.isFinite(maximum) || maximum < minimum) {
    throw new RangeError(`${name} must have a finite ascending range`);
  }
}

export function resolveSimulationConfig(patch?: DeepPartial<SimulationConfig>): SimulationConfig {
  const config = mergeObject<SimulationConfig>(DEFAULT_SIMULATION_CONFIG, patch);
  if (!Number.isInteger(config.initialPopulation) || config.initialPopulation < 0) {
    throw new RangeError('initialPopulation must be a non-negative integer');
  }
  if (!Number.isInteger(config.entrantsPerDay) || config.entrantsPerDay < 0) {
    throw new RangeError('entrantsPerDay must be a non-negative integer');
  }
  if (!Number.isInteger(config.ticksPerDay) || config.ticksPerDay < 1) {
    throw new RangeError('ticksPerDay must be a positive integer');
  }
  requireRange('lifespan', config.lifespan.min, config.lifespan.max);
  requireRange('entrantAge', config.entrantAge.min, config.entrantAge.max);
  requireRange('gestationDays', config.reproduction.gestationDays.min, config.reproduction.gestationDays.max);
  requireRange('cooldownDays', config.reproduction.cooldownDays.min, config.reproduction.cooldownDays.max);
  const probabilities = [
    config.reproduction.baseConceptionChance,
    config.breakthroughs.failureChance,
    config.rarity.strongLeader,
    config.rarity.powerSeeker,
    config.rarity.polymath,
    config.rarity.exceptional,
  ];
  if (probabilities.some((value) => value < 0 || value > 1)) {
    throw new RangeError('Simulation probabilities must be between zero and one');
  }
  return config;
}
