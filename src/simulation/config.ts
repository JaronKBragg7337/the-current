import type { DeepPartial, SimulationConfig } from './types';

export const DEFAULT_SIMULATION_CONFIG: SimulationConfig = {
  version: 2,
  ticksPerDay: 24,
  initialPopulation: 20,
  entrantAge: { min: 18 * 365, max: 55 * 365 },
  lifespan: { min: 65 * 365, max: 100 * 365 },
  lifeStages: {
    adolescent: 13 * 365,
    youngAdult: 18 * 365,
    adult: 30 * 365,
    olderAdult: 55 * 365,
    elder: 75 * 365,
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
    matureRelationshipDays: 30,
    inactiveAcquaintanceDays: 365,
    romanticChemistryThreshold: 78,
  },
  migration: {
    baseDailyRate: 0.16,
    maxArrivalsPerDay: 3,
    minimumAttraction: 0.18,
  },
  reproduction: {
    baseConceptionChance: 0.004,
    gestationDays: { min: 260, max: 294 },
    cooldownDays: { min: 365, max: 3 * 365 },
    minimumHousingSecurity: 0.65,
    minimumFoodDays: 2,
  },
  construction: {
    maxConcurrentProjects: 3,
    laborPerWorker: 5,
    materialDeliveryPerWorker: 6,
    housingTriggerRatio: 0.88,
    foodReserveTriggerDays: 5,
    proposalDeferralWeight: 0.32,
  },
  environment: {
    farmWaterPerDay: 1.2,
    farmToolsPerDay: 0.05,
    workshopEnergyPerDay: 0.6,
    powerToolsPerDay: 0.12,
    sanitationPerWorker: 1.2,
    sanitationEnergyPerWaste: 0.08,
    wastePerFoodConsumed: 0.025,
    wastePerToolProduced: 0.08,
  },
  storage: {
    baseCapacity: {
      energy: 600,
      food: 600,
      medicine: 120,
      stone: 600,
      tools: 200,
      transport: 100,
      water: 1_200,
      wood: 800,
    },
    warehouseCapacity: {
      energy: 300,
      food: 700,
      medicine: 200,
      stone: 800,
      tools: 300,
      transport: 200,
      water: 1_200,
      wood: 1_000,
    },
    spoilageRate: {
      energy: 0,
      food: 0.0015,
      medicine: 0.001,
      stone: 0,
      tools: 0.0002,
      transport: 0,
      water: 0.0002,
      wood: 0.0002,
    },
  },
  leadership: {
    electionIntervalDays: 4 * 365,
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
    attemptIntervalDays: 30,
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
  if (config.entrantsPerDay !== undefined && (!Number.isInteger(config.entrantsPerDay) || config.entrantsPerDay < 0)) {
    throw new RangeError('entrantsPerDay must remain a non-negative legacy override');
  }
  if (!Number.isInteger(config.ticksPerDay) || config.ticksPerDay < 1) {
    throw new RangeError('ticksPerDay must be a positive integer');
  }
  requireRange('lifespan', config.lifespan.min, config.lifespan.max);
  requireRange('entrantAge', config.entrantAge.min, config.entrantAge.max);
  requireRange('gestationDays', config.reproduction.gestationDays.min, config.reproduction.gestationDays.max);
  requireRange('cooldownDays', config.reproduction.cooldownDays.min, config.reproduction.cooldownDays.max);
  if (!Number.isFinite(config.migration.baseDailyRate) || config.migration.baseDailyRate < 0) {
    throw new RangeError('migration.baseDailyRate must be finite and non-negative');
  }
  if (!Number.isInteger(config.migration.maxArrivalsPerDay) || config.migration.maxArrivalsPerDay < 0) {
    throw new RangeError('migration.maxArrivalsPerDay must be a non-negative integer');
  }
  if (!Number.isFinite(config.construction.proposalDeferralWeight) || config.construction.proposalDeferralWeight < 0) {
    throw new RangeError('construction.proposalDeferralWeight must be finite and non-negative');
  }
  const probabilities = [
    config.reproduction.baseConceptionChance,
    config.breakthroughs.failureChance,
    config.rarity.strongLeader,
    config.rarity.powerSeeker,
    config.rarity.polymath,
    config.rarity.exceptional,
    config.migration.minimumAttraction,
  ];
  if (probabilities.some((value) => value < 0 || value > 1)) {
    throw new RangeError('Simulation probabilities must be between zero and one');
  }
  if (Object.values(config.environment).some((value) => !Number.isFinite(value) || value < 0)) {
    throw new RangeError('Environment flow values must be finite and non-negative');
  }
  for (const ledger of [config.storage.baseCapacity, config.storage.warehouseCapacity, config.storage.spoilageRate]) {
    if (Object.values(ledger).some((value) => !Number.isFinite(value) || value < 0)) {
      throw new RangeError('Storage values must be finite and non-negative');
    }
  }
  if (Object.values(config.storage.spoilageRate).some((value) => value > 1)) {
    throw new RangeError('Storage spoilage rates cannot exceed one');
  }
  return config;
}
