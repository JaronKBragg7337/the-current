import { canonicalDigest, canonicalStringify, cloneSerializable } from './canonical';
import { resolveSimulationConfig } from './config';
import {
  advanceEnvironmentalCondition,
  compareEnvironmentalStatus,
  environmentalHealthBurden,
  environmentalStatus,
  facilityEnvironmentFactor,
  initialEnvironmentalCondition,
  summarizeEnvironment,
} from './environment';
import {
  BUILDING_FOOTPRINTS,
  findBuildingSite,
  resolveNearValidSite,
  resolveTravelerPosition,
  type PlacementObstacle,
} from './placement';
import { DeterministicRng, deterministicStream, hashSeed } from './rng';
import {
  SIMULATION_ENGINE_VERSION,
  SIMULATION_SCHEMA_VERSION,
  type ActiveSignal,
  type BiologicalSex,
  type Breakthrough,
  type BreakthroughDomain,
  type BreakthroughEffects,
  type Building,
  type BuildingId,
  type BuildingProjection,
  type BuildingType,
  type ConstructionStage,
  type DailySummary,
  type DayInputs,
  type DayResult,
  type DeepPartial,
  type EmergenceProfile,
  type EntityId,
  type EnvironmentalCondition,
  type EventDatum,
  type Household,
  type InfluenceSet,
  type Institution,
  type InstitutionKind,
  type LegacyArtifact,
  type LifeStage,
  type MaterialRequirement,
  type NormalizedSignal,
  type ObserverIntervention,
  type Occupation,
  type Person,
  type PersonId,
  type PersonMemory,
  type PersonOrigin,
  type PersonProjection,
  type Position3,
  type PressureAxis,
  type PressureState,
  type RarePotential,
  type Relationship,
  type RelationshipMemory,
  type ResourceKind,
  type ResourceLedger,
  type Settlement,
  type SettlementDailyEconomy,
  type SettlementModifiers,
  type SimulationConfig,
  type SimulationCreateOptions,
  type SimulationEvent,
  type SimulationEventType,
  type SimulationMetrics,
  type SkillDomain,
  type SkillSet,
  type TaskType,
  type TraitSet,
  type WorldProjection,
  type WorldSnapshot,
  type WorldState,
} from './types';

const SETTLEMENT_ID = 'settlement:current';

const RESOURCE_KINDS: readonly ResourceKind[] = [
  'energy',
  'food',
  'medicine',
  'stone',
  'tools',
  'transport',
  'water',
  'wood',
];

const SKILL_DOMAINS: readonly SkillDomain[] = [
  'agriculture',
  'art',
  'care',
  'construction',
  'education',
  'engineering',
  'governance',
  'logistics',
  'medicine',
  'research',
  'security',
  'trade',
];

const EMERGENCE_PROFILES: readonly EmergenceProfile[] = [
  'builder',
  'farmer',
  'hunter',
  'researcher',
  'trader',
  'healer',
  'mechanic',
  'artist',
  'teacher',
  'organizer',
  'explorer',
  'laborer',
  'inventor',
  'caregiver',
  'opportunist',
  'political-thinker',
  'religious-thinker',
  'criminally-inclined',
  'militarily-inclined',
  'unskilled-generalist',
];

const CONSTRUCTION_STAGES: readonly ConstructionStage[] = [
  'planned',
  'site-selection',
  'foundation',
  'frame',
  'walls',
  'roof',
  'interior',
  'utilities',
  'complete',
];

const FIRST_NAMES: readonly string[] = [
  'Ada', 'Alden', 'Amara', 'Ansel', 'Ari', 'Aya', 'Bea', 'Cal', 'Cora', 'Dara', 'Dorian', 'Eli',
  'Elowen', 'Emil', 'Esme', 'Fara', 'Finn', 'Galen', 'Hana', 'Ilya', 'Imani', 'Jae', 'Jora', 'Kai',
  'Kira', 'Leo', 'Lina', 'Mara', 'Milo', 'Nadi', 'Niko', 'Noor', 'Orin', 'Pia', 'Quin', 'Rhea',
  'Rin', 'Sage', 'Sela', 'Sol', 'Tala', 'Tariq', 'Uma', 'Vale', 'Vera', 'Wren', 'Xan', 'Yara', 'Zev',
];

const LAST_NAMES: readonly string[] = [
  'Ash', 'Bell', 'Cairn', 'Dawn', 'Ember', 'Field', 'Grove', 'Hale', 'Ives', 'Jade', 'Kestrel',
  'Lake', 'Morrow', 'North', 'Orr', 'Pine', 'Quarry', 'Reed', 'Stone', 'Thorn', 'Umber', 'Vale',
  'West', 'Yew', 'Zephyr',
];

const BUILDING_CAPACITY: Record<BuildingType, number> = {
  clinic: 6,
  'council-hall': 16,
  farm: 8,
  house: 6,
  market: 12,
  'power-station': 8,
  road: 0,
  school: 12,
  warehouse: 60,
  well: 10,
  workshop: 10,
};

const BUILDING_STORAGE_CAPACITY: Partial<Record<BuildingType, Partial<ResourceLedger>>> = {
  clinic: { medicine: 60 },
  farm: { food: 50 },
  market: { food: 100, medicine: 20 },
  'power-station': { energy: 120 },
  well: { water: 180 },
  workshop: { tools: 80 },
};

const BUILDING_REQUIREMENTS: Record<BuildingType, { labor: number; materials: MaterialRequirement }> = {
  clinic: { labor: 100, materials: { stone: 35, tools: 14, wood: 55 } },
  'council-hall': { labor: 120, materials: { stone: 55, tools: 14, wood: 65 } },
  farm: { labor: 62, materials: { stone: 8, tools: 8, wood: 34 } },
  house: { labor: 72, materials: { stone: 22, tools: 7, wood: 50 } },
  market: { labor: 78, materials: { stone: 24, tools: 9, wood: 45 } },
  'power-station': { labor: 130, materials: { stone: 65, tools: 24, wood: 38 } },
  road: { labor: 42, materials: { stone: 28, tools: 4, wood: 4 } },
  school: { labor: 96, materials: { stone: 32, tools: 11, wood: 56 } },
  warehouse: { labor: 82, materials: { stone: 28, tools: 8, wood: 58 } },
  well: { labor: 68, materials: { stone: 45, tools: 9, wood: 18 } },
  workshop: { labor: 92, materials: { stone: 32, tools: 13, wood: 54 } },
};

const PROFILE_OCCUPATION: Partial<Record<EmergenceProfile, Occupation>> = {
  artist: 'artist',
  builder: 'builder',
  caregiver: 'caregiver',
  explorer: 'explorer',
  farmer: 'farmer',
  healer: 'healer',
  hunter: 'hunter',
  inventor: 'inventor',
  laborer: 'laborer',
  mechanic: 'mechanic',
  organizer: 'organizer',
  researcher: 'researcher',
  teacher: 'teacher',
  trader: 'trader',
};

const OCCUPATION_SKILL: Record<Occupation, SkillDomain> = {
  artist: 'art',
  builder: 'construction',
  caregiver: 'care',
  explorer: 'logistics',
  farmer: 'agriculture',
  healer: 'medicine',
  hunter: 'security',
  inventor: 'engineering',
  laborer: 'construction',
  mechanic: 'engineering',
  organizer: 'governance',
  researcher: 'research',
  teacher: 'education',
  trader: 'trade',
  unemployed: 'logistics',
};

const OCCUPATION_BUILDING: Partial<Record<Occupation, BuildingType>> = {
  artist: 'market',
  builder: 'workshop',
  caregiver: 'clinic',
  explorer: 'warehouse',
  farmer: 'farm',
  healer: 'clinic',
  hunter: 'warehouse',
  inventor: 'workshop',
  laborer: 'warehouse',
  mechanic: 'workshop',
  organizer: 'council-hall',
  researcher: 'school',
  teacher: 'school',
  trader: 'market',
  unemployed: 'market',
};

const BASE_PRICES: ResourceLedger = {
  energy: 1.4,
  food: 1,
  medicine: 4,
  stone: 1.8,
  tools: 3.2,
  transport: 5,
  water: 0.7,
  wood: 1.3,
};

const EMPTY_INPUTS: DayInputs = { signals: [], interventions: [] };

const TASK_SITE_RADIUS_METERS = 3;
// A well shaft only supports so many people drawing at once; beyond this the
// extra crowd waits without adding output.
const WELL_HAULERS_PER_WELL = 26;
const WATER_HAULED_PER_HAULER = 5;
const ENCOUNTER_RADIUS_METERS = 5.5;
const SHARED_CONTEXT_RADIUS_METERS = 4;
const ENVIRONMENT_CONTEXT_RADIUS_METERS = 18;
const DAILY_TRAVEL_METERS = 140;
const SANITATION_TASK_REASON = 'Accumulated waste needs collection before it contaminates homes, farms, and water.';

function clamp(value: number, minimum = 0, maximum = 100): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function round(value: number, places = 4): number {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}

function emptyResources(): ResourceLedger {
  return { energy: 0, food: 0, medicine: 0, stone: 0, tools: 0, transport: 0, water: 0, wood: 0 };
}

function emptyPressure(): PressureState {
  return {
    construction: 0,
    energy: 0,
    food: 0,
    health: 0,
    knowledge: 0,
    safety: 0,
    sentiment: 0,
    trade: 0,
    transportation: 0,
    water: 0,
  };
}

function emptyModifiers(): SettlementModifiers {
  return {
    constructionEfficiency: 1,
    diseaseRisk: 1,
    energyEfficiency: 1,
    foodYield: 1,
    healthCapacity: 1,
    knowledgeGrowth: 1,
    socialCohesion: 1,
    tradeEfficiency: 1,
    waterYield: 1,
  };
}

function emptyDailyEconomy(): SettlementDailyEconomy {
  return {
    consumption: emptyResources(),
    losses: emptyResources(),
    overflow: emptyResources(),
    production: emptyResources(),
    valueProduced: 0,
    wagesPaid: 0,
    wasteCreated: 0,
    wasteRemoved: 0,
  };
}

function emptySkills(value = 0): SkillSet {
  return {
    agriculture: value,
    art: value,
    care: value,
    construction: value,
    education: value,
    engineering: value,
    governance: value,
    logistics: value,
    medicine: value,
    research: value,
    security: value,
    trade: value,
  };
}

function emptyInfluence(): InfluenceSet {
  return { cultural: 0, economic: 0, informational: 0, political: 0, social: 0, technical: 0 };
}

function sortedRecordValues<T extends { id: string }>(record: Record<string, T>): T[] {
  return Object.values(record).sort((left, right) => left.id.localeCompare(right.id));
}

function relationshipId(personAId: PersonId, personBId: PersonId): string {
  return personAId < personBId ? `relationship:${personAId}:${personBId}` : `relationship:${personBId}:${personAId}`;
}

function distanceSquared(left: Position3, right: Position3): number {
  const x = left.x - right.x;
  const z = left.z - right.z;
  return x * x + z * z;
}

function pressureEntries(pressure: PressureState): [PressureAxis, number][] {
  return (Object.entries(pressure) as [PressureAxis, number][]).sort(([left], [right]) => left.localeCompare(right));
}

function materialFraction(building: Building): number {
  const required = building.requiredMaterials;
  const delivered = building.deliveredMaterials;
  const requiredTotal = required.stone + required.tools + required.wood;
  if (requiredTotal <= 0) return 1;
  return clamp((delivered.stone + delivered.tools + delivered.wood) / requiredTotal, 0, 1);
}

function lifeStageForAge(ageDays: number, config: SimulationConfig): LifeStage {
  if (ageDays < config.lifeStages.adolescent) return 'child';
  if (ageDays < config.lifeStages.youngAdult) return 'adolescent';
  if (ageDays < config.lifeStages.adult) return 'young-adult';
  if (ageDays < config.lifeStages.olderAdult) return 'adult';
  if (ageDays < config.lifeStages.elder) return 'older-adult';
  return 'elder';
}

function isAdult(person: Person): boolean {
  return person.lifeStage !== 'child' && person.lifeStage !== 'adolescent';
}

function effectsForDomain(domain: BreakthroughDomain): BreakthroughEffects {
  const effects: BreakthroughEffects = {
    constructionEfficiency: 1,
    energyEfficiency: 1,
    foodYield: 1,
    healthCapacity: 1,
    knowledgeGrowth: 1,
    tradeEfficiency: 1,
    waterYield: 1,
  };
  switch (domain) {
    case 'agriculture': effects.foodYield = 1.12; break;
    case 'communication': effects.knowledgeGrowth = 1.1; break;
    case 'construction': effects.constructionEfficiency = 1.12; break;
    case 'education': effects.knowledgeGrowth = 1.14; break;
    case 'energy': effects.energyEfficiency = 1.13; break;
    case 'finance': effects.tradeEfficiency = 1.11; break;
    case 'governance': effects.tradeEfficiency = 1.06; break;
    case 'medicine': effects.healthCapacity = 1.14; break;
    case 'transportation': effects.tradeEfficiency = 1.08; break;
    case 'water': effects.waterYield = 1.14; break;
  }
  return effects;
}

function domainForProblem(problem: PressureAxis): BreakthroughDomain {
  switch (problem) {
    case 'construction': return 'construction';
    case 'energy': return 'energy';
    case 'food': return 'agriculture';
    case 'health': return 'medicine';
    case 'knowledge': return 'education';
    case 'safety': return 'governance';
    case 'sentiment': return 'communication';
    case 'trade': return 'finance';
    case 'transportation': return 'transportation';
    case 'water': return 'water';
  }
}

export class CurrentSimulation {
  private stateValue: WorldState;
  private rng: DeterministicRng;
  private suppressMetricSize = false;
  private sanitationCoverageToday = new Map<BuildingId, number>();
  private facilityProductionToday = new Map<BuildingId, ResourceLedger>();

  private constructor(state: WorldState, rng: DeterministicRng) {
    this.stateValue = state;
    this.rng = rng;
  }

  static create(options: SimulationCreateOptions = {}): CurrentSimulation {
    const seed = options.seed ?? 'current-public-001';
    const config = resolveSimulationConfig(options.config);
    const rng = DeterministicRng.fromSeed(seed);
    const settlement: Settlement = {
      id: SETTLEMENT_ID,
      name: 'Confluence',
      foundedDay: 0,
      resources: {
        energy: 420,
        food: 420,
        medicine: 70,
        stone: 360,
        tools: 130,
        transport: 28,
        water: 850,
        wood: 560,
      },
      prices: cloneSerializable(BASE_PRICES),
      treasury: 5_000,
      debt: 0,
      waste: 0,
      drinkingWaterQuality: 92,
      safety: 78,
      publicTrust: 58,
      pressure: emptyPressure(),
      modifiers: emptyModifiers(),
      buildingIds: [],
      institutionIds: [],
      constructionQueue: [],
      entryPoint: { x: -110, y: 0, z: 18 },
      dailyEconomy: emptyDailyEconomy(),
    };
    const state: WorldState = {
      schemaVersion: SIMULATION_SCHEMA_VERSION,
      engineVersion: SIMULATION_ENGINE_VERSION,
      seed,
      day: 0,
      tick: 0,
      eventSequence: 0,
      rngState: rng.snapshot(),
      entropy: { surface: '', deep: '' },
      config,
      ids: { artifact: 0, breakthrough: 0, building: 0, household: 0, institution: 0, person: 0 },
      people: {},
      artifacts: {},
      relationships: {},
      households: {},
      buildings: {},
      institutions: {},
      breakthroughs: {},
      settlement,
      activeSignals: [],
      interventions: [],
      events: [],
      dailySummaries: [],
      counters: {
        archivedRelationships: 0,
        artifactStudyDays: 0,
        births: 0,
        breakthroughAdoptions: 0,
        breakthroughAttempts: 0,
        buildingsCompleted: 0,
        deaths: 0,
        earlyDeaths: 0,
        entrants: 0,
        inheritances: 0,
        inheritedValue: 0,
        naturalDeaths: 0,
        partnerships: 0,
        pregnancies: 0,
      },
    };
    const simulation = new CurrentSimulation(state, rng);
    simulation.bootstrap();
    return simulation;
  }

  static restore(snapshot: WorldSnapshot): CurrentSimulation {
    if (snapshot.schemaVersion !== SIMULATION_SCHEMA_VERSION || snapshot.state.schemaVersion !== SIMULATION_SCHEMA_VERSION) {
      throw new Error(`Unsupported simulation schema ${snapshot.schemaVersion}`);
    }
    const state = cloneSerializable(snapshot.state);
    const actualDigest = canonicalDigest(state);
    if (snapshot.digest !== actualDigest) throw new Error('Snapshot digest does not match its world state');
    state.config = resolveSimulationConfig(state.config as DeepPartial<SimulationConfig>);
    if ((state as Partial<WorldState>).entropy === undefined) {
      state.entropy = { surface: '', deep: '' };
    }
    const legacyState = state as WorldState & { artifacts?: Record<EntityId, LegacyArtifact> };
    if (legacyState.artifacts === undefined) legacyState.artifacts = {};
    const legacyIds = state.ids as typeof state.ids & { artifact?: number };
    if (legacyIds.artifact === undefined) legacyIds.artifact = Object.keys(legacyState.artifacts).length;
    const legacyCounters = state.counters as typeof state.counters & { artifactStudyDays?: number };
    if (legacyCounters.artifactStudyDays === undefined) legacyCounters.artifactStudyDays = 0;
    for (const person of sortedRecordValues(state.people)) {
      const legacy = person as Person & { previousPosition?: Position3 };
      if (legacy.previousPosition === undefined) legacy.previousPosition = cloneSerializable(person.position);
    }
    for (const institution of sortedRecordValues(state.institutions)) {
      const legacy = institution as Institution & { followerCandidateIds?: Record<PersonId, PersonId> };
      if (legacy.followerCandidateIds === undefined) {
        legacy.followerCandidateIds = {};
        if (institution.leaderId !== null) {
          for (const followerId of Object.keys(institution.followerLoyalty).sort()) {
            if (followerId !== institution.leaderId) legacy.followerCandidateIds[followerId] = institution.leaderId;
          }
        }
      }
    }
    let hadLocalizedWaste = false;
    for (const building of sortedRecordValues(state.buildings)) {
      const legacy = building as Building & { environment?: EnvironmentalCondition };
      if (legacy.environment === undefined) {
        legacy.environment = initialEnvironmentalCondition(building.type);
      } else {
        const legacyEnvironment = legacy.environment as EnvironmentalCondition & {
          status?: EnvironmentalCondition['status'];
          wasteLoad?: number;
        };
        if (legacyEnvironment.wasteLoad === undefined) legacyEnvironment.wasteLoad = 0;
        else hadLocalizedWaste = true;
        if (
          legacyEnvironment.status !== 'healthy' && legacyEnvironment.status !== 'stressed' &&
          legacyEnvironment.status !== 'hazardous'
        ) {
          legacyEnvironment.status = environmentalStatus(legacyEnvironment, building.type);
        }
      }
    }
    if (!hadLocalizedWaste && state.settlement.waste > 0) {
      const sites = sortedRecordValues(state.buildings)
        .filter((building) => building.stage === 'complete' && building.type !== 'road');
      let remaining = state.settlement.waste;
      for (let index = 0; index < sites.length; index += 1) {
        const site = sites[index];
        if (site === undefined) continue;
        const share = index === sites.length - 1
          ? remaining
          : round(state.settlement.waste / Math.max(1, sites.length));
        site.environment.wasteLoad = Math.max(0, share);
        site.environment.status = environmentalStatus(site.environment, site.type);
        remaining = round(remaining - share);
      }
    }
    const legacySettlement = state.settlement as Settlement & { drinkingWaterQuality?: number };
    if (legacySettlement.drinkingWaterQuality === undefined) legacySettlement.drinkingWaterQuality = 92;
    const legacyEconomy = state.settlement.dailyEconomy as SettlementDailyEconomy & { wasteRemoved?: number };
    if (legacyEconomy.wasteRemoved === undefined) legacyEconomy.wasteRemoved = 0;
    state.engineVersion = SIMULATION_ENGINE_VERSION;
    return new CurrentSimulation(state, DeterministicRng.restore(state.rngState));
  }

  get currentDay(): number {
    return this.stateValue.day;
  }

  get seed(): string {
    return this.stateValue.seed;
  }

  advanceDay(inputs: DayInputs = EMPTY_INPUTS): DayResult {
    const startSequence = this.stateValue.eventSequence;
    this.stateValue.day += 1;
    this.stateValue.tick = this.stateValue.day * this.stateValue.config.ticksPerDay;
    this.stateValue.settlement.dailyEconomy = emptyDailyEconomy();
    this.sanitationCoverageToday = new Map();
    this.facilityProductionToday = new Map();

    if (inputs.entropy !== undefined && inputs.entropy !== '') this.mixEntropy(inputs.entropy);

    for (const signal of [...inputs.signals].sort((a, b) => a.id.localeCompare(b.id))) this.queueSignal(signal);
    for (const intervention of [...inputs.interventions].sort((a, b) => a.id.localeCompare(b.id))) {
      this.queueIntervention(intervention);
    }

    this.updateSignalPressures();
    this.resolveDueInterventions();
    this.updateAgingAndNaturalDeaths();
    this.deliverDueBirths();
    this.evaluateMigration();
    this.assignHousing();
    this.assignEmployment();
    this.planConstruction();
    this.chooseTasksAndDestinations();
    this.updateMovement();
    this.runProductionAndEmployment();
    this.runSanitation();
    this.consumeResourcesAndUpdateHealth();
    this.runEncounters();
    this.fadeInactiveRelationships();
    this.formPartnerships();
    this.considerReproduction();
    this.progressConstruction();
    this.updateInstitutions();
    this.updateBreakthroughs();
    this.updatePersonalGrowth();
    this.updateLegacyArtifacts();
    this.applyStorageLimitsAndLosses();
    this.updatePricesAndEnvironment();
    this.assignHousing();
    this.pruneHistory();

    this.stateValue.rngState = this.rng.snapshot();
    const events = this.eventsSince(startSequence);
    const summary = this.makeDailySummary(events);
    this.stateValue.dailySummaries.push(summary);
    const dayDigest = canonicalDigest({
      seed: this.seed,
      day: this.currentDay,
      eventSequence: this.stateValue.eventSequence,
      rngState: this.rng.snapshot(),
      summary,
    });
    return { day: this.currentDay, summary: cloneSerializable(summary), events, digest: dayDigest };
  }

  /**
   * Fold one day's hidden entropy into the world's two entropy chains.
   *
   * The surface chain reseeds ordinary daily randomness. The deep chain is a
   * second randomizer layered on top: it hashes the new surface value again
   * with its own history, and only rare high-impact draws consume it. The
   * mix is recorded as an ordinary timestamped event, so the past replays
   * exactly from saved history while the future stays uncomputable — the
   * entropy for tomorrow does not exist yet anywhere.
   */
  private mixEntropy(entropy: string): void {
    const surface = hashSeed(`${this.stateValue.entropy.surface}|${entropy}|${this.stateValue.day}`).toString(16);
    const deep = hashSeed(`${this.stateValue.entropy.deep}|${surface}|${entropy}|deep`).toString(16);
    this.stateValue.entropy = { surface, deep };
    // Perturb the sequential world RNG (identity generation, trait rolls)
    // as well, so entrants and their hidden lifespans also become
    // uncomputable ahead of time.
    this.rng = DeterministicRng.restore((this.rng.snapshot() ^ hashSeed(surface)) >>> 0);
    this.stateValue.rngState = this.rng.snapshot();
    this.emit('entropy-mixed', [], 'Outside chance entered the world; the future shifted unknowably.', {
      entropy,
    });
  }

  /** Seed for ordinary daily randomness, shifted by the surface entropy chain. */
  private streamSeed(): string {
    const surface = this.stateValue.entropy.surface;
    return surface === '' ? this.seed : `${this.seed}~e:${surface}`;
  }

  /** Seed for rare high-impact randomness, shifted by the deep entropy chain. */
  private deepStreamSeed(): string {
    const deep = this.stateValue.entropy.deep;
    return deep === '' ? this.seed : `${this.seed}~deep:${deep}`;
  }

  advanceDays(count: number, inputProvider?: (day: number) => DayInputs | undefined): DayResult[] {
    if (!Number.isInteger(count) || count < 0) throw new RangeError('advanceDays count must be a non-negative integer');
    const results: DayResult[] = [];
    for (let index = 0; index < count; index += 1) {
      const nextDay = this.currentDay + 1;
      results.push(this.advanceDay(inputProvider?.(nextDay) ?? EMPTY_INPUTS));
    }
    return results;
  }

  queueSignal(signal: NormalizedSignal): void {
    if (this.stateValue.activeSignals.some((active) => active.signal.id === signal.id)) return;
    const normalized = cloneSerializable(signal);
    normalized.intensity = clamp(normalized.intensity, 0, 1);
    normalized.confidence = clamp(normalized.confidence, 0, 1);
    normalized.sourceAgreement = clamp(normalized.sourceAgreement, 0, 1);
    normalized.novelty = clamp(normalized.novelty, 0, 1);
    normalized.durationDays = Math.max(0, normalized.durationDays);
    normalized.halfLifeDays = Math.max(0.25, normalized.halfLifeDays);
    this.stateValue.activeSignals.push({ signal: normalized, receivedDay: this.currentDay });
    this.stateValue.activeSignals.sort((a, b) => a.signal.id.localeCompare(b.signal.id));
    this.emit('signal-received', [], `External ${normalized.domain} signal ${normalized.id} entered public knowledge.`, {
      confidence: normalized.confidence,
      intensity: normalized.intensity,
      signalId: normalized.id,
    });
  }

  queueIntervention(intervention: ObserverIntervention): void {
    if (this.stateValue.interventions.some((record) => record.intervention.id === intervention.id)) return;
    this.stateValue.interventions.push({
      intervention: cloneSerializable(intervention),
      queuedDay: this.currentDay,
      resolvedDay: null,
      outcome: 'pending',
    });
    this.stateValue.interventions.sort((a, b) => a.intervention.id.localeCompare(b.intervention.id));
  }

  snapshot(): WorldSnapshot {
    this.stateValue.rngState = this.rng.snapshot();
    const state = cloneSerializable(this.stateValue);
    return {
      schemaVersion: SIMULATION_SCHEMA_VERSION,
      engineVersion: SIMULATION_ENGINE_VERSION,
      day: state.day,
      digest: canonicalDigest(state),
      state,
    };
  }

  digest(): string {
    this.stateValue.rngState = this.rng.snapshot();
    return canonicalDigest(this.stateValue);
  }

  eventsSince(sequence: number): SimulationEvent[] {
    return cloneSerializable(this.stateValue.events.filter((event) => event.sequence > sequence));
  }

  inspectPerson(personId: PersonId): Person | null {
    const person = this.stateValue.people[personId];
    return person === undefined ? null : cloneSerializable(person);
  }

  metrics(): SimulationMetrics {
    const alive = this.alivePeople();
    const adults = alive.filter(isAdult);
    const completeBuildings = this.completeBuildings();
    const houses = completeBuildings.filter((building) => building.type === 'house');
    const housingCapacity = houses.reduce((sum, building) => sum + building.capacity, 0);
    const occupiedHousing = houses.reduce((sum, building) => sum + building.occupiedByIds.length, 0);
    const wealth = alive.map((person) => Math.max(0, person.wealth - person.debt)).sort((a, b) => a - b);
    const wealthTotal = wealth.reduce((sum, value) => sum + value, 0);
    const wealthMedian = wealth.length === 0
      ? 0
      : wealth.length % 2 === 1
        ? (wealth[Math.floor(wealth.length / 2)] ?? 0)
        : ((wealth[wealth.length / 2 - 1] ?? 0) + (wealth[wealth.length / 2] ?? 0)) / 2;
    let absoluteDifference = 0;
    for (const left of wealth) for (const right of wealth) absoluteDifference += Math.abs(left - right);
    const wealthGini = wealth.length === 0 || wealthTotal === 0
      ? 0
      : absoluteDifference / (2 * wealth.length * wealthTotal);
    const complete = completeBuildings.length;
    const underConstruction = sortedRecordValues(this.stateValue.buildings).filter((building) => building.stage !== 'complete').length;
    const leaders = sortedRecordValues(this.stateValue.institutions).filter((institution) => institution.leaderId !== null).length;
    const followerEdges = sortedRecordValues(this.stateValue.institutions)
      .reduce((sum, institution) => sum + Object.keys(institution.followerCandidateIds).length, 0);
    const relationships = sortedRecordValues(this.stateValue.relationships);
    const activeSocialTies = relationships.filter((relationship) =>
      relationship.endedDay === null &&
      this.stateValue.people[relationship.personAId]?.alive === true &&
      this.stateValue.people[relationship.personBId]?.alive === true).length;
    const romanticInterests = relationships.filter((relationship) =>
      relationship.endedDay === null && relationship.kind === 'romantic-interest').length;
    const latest = this.stateValue.dailySummaries[this.stateValue.dailySummaries.length - 1];
    const saveApproximateBytes = this.suppressMetricSize ? 0 : canonicalStringify(this.stateValue).length;
    const environment = summarizeEnvironment(completeBuildings);
    return {
      day: this.currentDay,
      initialPopulation: this.stateValue.config.initialPopulation,
      population: alive.length,
      foundersAndEntrantsAlive: alive.filter((person) => person.origin !== 'born').length,
      bornPopulationAlive: alive.filter((person) => person.origin === 'born').length,
      totalEntrants: this.stateValue.counters.entrants,
      births: this.stateValue.counters.births,
      deaths: this.stateValue.counters.deaths,
      naturalDeaths: this.stateValue.counters.naturalDeaths,
      earlyDeaths: this.stateValue.counters.earlyDeaths,
      households: sortedRecordValues(this.stateValue.households).filter((household) =>
        household.memberIds.some((personId) => this.stateValue.people[personId]?.alive === true),
      ).length,
      relationships: relationships.length,
      activeSocialTies,
      historicalSocialTies: relationships.length - activeSocialTies,
      romanticInterests,
      partnerships: alive.filter((person) => person.partnerId !== null).length / 2,
      lifetimePartnerships: this.stateValue.counters.partnerships,
      pregnancies: alive.filter((person) => person.pregnancy !== null).length,
      housingCapacity,
      occupiedHousing,
      homeless: alive.filter((person) => person.homeBuildingId === null).length,
      employed: adults.filter((person) => person.employed).length,
      unemployedAdults: adults.filter((person) => !person.employed).length,
      foodStock: round(this.stateValue.settlement.resources.food),
      waterStock: round(this.stateValue.settlement.resources.water),
      resourceStock: cloneSerializable(this.stateValue.settlement.resources),
      resourceCapacity: this.resourceCapacity(),
      resourceProductionLastDay: cloneSerializable(this.stateValue.settlement.dailyEconomy.production),
      resourceConsumptionLastDay: cloneSerializable(this.stateValue.settlement.dailyEconomy.consumption),
      resourceLossLastDay: RESOURCE_KINDS.reduce((ledger, resource) => {
        ledger[resource] = round(
          this.stateValue.settlement.dailyEconomy.losses[resource] +
          this.stateValue.settlement.dailyEconomy.overflow[resource],
        );
        return ledger;
      }, emptyResources()),
      foodProducedLastDay: latest?.foodProduced ?? 0,
      foodConsumedLastDay: latest?.foodConsumed ?? 0,
      wealthTotal: round(wealthTotal),
      wealthMedian: round(wealthMedian),
      wealthGini: round(wealthGini),
      inheritances: this.stateValue.counters.inheritances,
      inheritedValue: round(this.stateValue.counters.inheritedValue),
      buildingsComplete: complete,
      buildingsUnderConstruction: underConstruction,
      leaders,
      followerEdges,
      breakthroughAttempts: this.stateValue.counters.breakthroughAttempts,
      breakthroughAdoptions: this.stateValue.counters.breakthroughAdoptions,
      totalArtifacts: Object.keys(this.stateValue.artifacts).length,
      discoveredArtifacts: sortedRecordValues(this.stateValue.artifacts)
        .filter((artifact) => artifact.discoveredDay !== null).length,
      artifactStudyDays: round(this.stateValue.counters.artifactStudyDays),
      activeSignals: this.stateValue.activeSignals.length,
      resolvedInterventions: this.stateValue.interventions.filter((record) => record.resolvedDay !== null).length,
      eventCount: this.stateValue.eventSequence,
      saveApproximateBytes,
      ...environment,
      drinkingWaterQuality: round(this.stateValue.settlement.drinkingWaterQuality),
      storedWaste: round(this.stateValue.settlement.waste),
      wasteCreatedLastDay: round(this.stateValue.settlement.dailyEconomy.wasteCreated),
      wasteRemovedLastDay: round(this.stateValue.settlement.dailyEconomy.wasteRemoved),
    };
  }

  projection(): WorldProjection {
    const people: PersonProjection[] = this.alivePeople().map((person) => ({
      id: person.id,
      name: person.name,
      previousPosition: cloneSerializable(person.previousPosition),
      position: cloneSerializable(person.position),
      destination: cloneSerializable(person.destination),
      yaw: person.yaw,
      heightMeters: this.visibleHeight(person),
      lifeStage: person.lifeStage,
      biologicalSex: person.biologicalSex,
      occupation: person.occupation,
      task: person.currentTask,
      health: round(person.health),
      emotion: round(person.emotion),
      householdId: person.householdId,
      homeBuildingId: person.homeBuildingId,
      partnerId: person.partnerId,
      decisionReason: person.decisionReason,
      rareEvidence: round(this.rareEvidence(person)),
    }));
    const buildings: BuildingProjection[] = sortedRecordValues(this.stateValue.buildings).map((building) => ({
      id: building.id,
      name: building.name,
      type: building.type,
      position: cloneSerializable(building.position),
      stage: building.stage,
      progress: round(building.stage === 'complete' ? 1 : building.laborCompleted / building.laborRequired),
      capacity: building.capacity,
      condition: round(building.condition),
      environment: cloneSerializable(building.environment),
      occupied: building.occupiedByIds.length,
    }));
    return {
      schemaVersion: SIMULATION_SCHEMA_VERSION,
      day: this.currentDay,
      tick: this.stateValue.tick,
      dayStartedAtUtc: null,
      worldDayDurationMs: null,
      settlementId: this.stateValue.settlement.id,
      settlementName: this.stateValue.settlement.name,
      population: people.length,
      people,
      artifacts: cloneSerializable(sortedRecordValues(this.stateValue.artifacts)),
      buildings,
      resources: cloneSerializable(this.stateValue.settlement.resources),
      prices: cloneSerializable(this.stateValue.settlement.prices),
      pressure: cloneSerializable(this.stateValue.settlement.pressure),
      // Keep enough history for consequential events to remain inspectable
      // after two busy world days. Environmental and social events can easily
      // exceed the old 24-entry window without invalidating the underlying
      // persisted record.
      recentEvents: cloneSerializable(this.stateValue.events.slice(-64)),
      metrics: this.metrics(),
      digest: this.digest(),
    };
  }

  private bootstrap(): void {
    const initialBuildings: readonly { type: BuildingType; x: number; z: number }[] = [
      { type: 'house', x: -22, z: -18 },
      { type: 'house', x: -8, z: -18 },
      { type: 'house', x: 8, z: -18 },
      { type: 'house', x: 22, z: -18 },
      { type: 'farm', x: -36, z: 28 },
      { type: 'farm', x: -15, z: 34 },
      { type: 'well', x: 0, z: 2 },
      { type: 'market', x: 14, z: 4 },
      { type: 'workshop', x: 28, z: 12 },
      { type: 'warehouse', x: 37, z: 24 },
      { type: 'school', x: -12, z: 8 },
      { type: 'clinic', x: 4, z: 13 },
      { type: 'council-hall', x: 18, z: -7 },
      { type: 'road', x: 0, z: -4 },
    ];
    const placedObstacles: PlacementObstacle[] = [];
    for (const definition of initialBuildings) {
      const position = definition.type === 'road'
        ? { x: definition.x, y: 0, z: definition.z }
        : resolveNearValidSite(definition.type, definition, placedObstacles);
      this.createBuilding(definition.type, position, true, null);
      if (definition.type !== 'road') {
        placedObstacles.push({ type: definition.type, position: { x: position.x, z: position.z } });
      }
    }
    this.bootstrapLegacyArtifacts();
    const council = this.createInstitution('council', 'Confluence Civic Council', []);
    this.stateValue.settlement.institutionIds.push(council.id);

    const founders: Person[] = [];
    for (let index = 0; index < this.stateValue.config.initialPopulation; index += 1) {
      founders.push(this.createPerson('founder', 0, null, null));
    }
    for (let index = 0; index < founders.length; index += 2) {
      const members = founders.slice(index, index + 2).map((person) => person.id);
      this.createHousehold(members);
    }
    council.memberIds = founders.filter(isAdult).map((person) => person.id);
    this.assignHousing();
    this.assignEmployment(true);
    this.chooseTasksAndDestinations();
    this.stateValue.rngState = this.rng.snapshot();
  }

  private bootstrapLegacyArtifacts(): void {
    const definitions: readonly Omit<LegacyArtifact, 'id' | 'discoveredById' | 'discoveredDay' | 'studiedByIds' | 'studyDays'>[] = [
      {
        name: 'Buried settlement foundations',
        sourceEra: 'Era Zero',
        description: 'Weathered foundations preserve an earlier settlement grid and its geometric mistakes.',
        position: { x: -56, y: 0, z: -34 },
        domains: ['construction', 'engineering', 'research'],
      },
      {
        name: 'Old well ring',
        sourceEra: 'Era Zero',
        description: 'A sealed stone ring retains mineral layers, tool marks, and evidence of past water use.',
        position: { x: 49, y: 0, z: -38 },
        domains: ['engineering', 'medicine', 'research'],
      },
      {
        name: 'Survey marker fragments',
        sourceEra: 'Era Zero',
        description: 'Aligned fragments encode distance, orientation, and the vanished town boundary.',
        position: { x: 55, y: 0, z: 43 },
        domains: ['education', 'logistics', 'research'],
      },
    ];
    for (const definition of definitions) {
      this.stateValue.ids.artifact += 1;
      const id = `artifact:${this.stateValue.ids.artifact.toString().padStart(3, '0')}`;
      this.stateValue.artifacts[id] = {
        ...cloneSerializable(definition),
        id,
        discoveredDay: null,
        discoveredById: null,
        studyDays: 0,
        studiedByIds: [],
      };
    }
  }

  private createPerson(
    origin: PersonOrigin,
    day: number,
    motherId: PersonId | null,
    fatherId: PersonId | null,
    positionOverride?: Position3,
  ): Person {
    this.stateValue.ids.person += 1;
    const id = `person:${this.stateValue.ids.person.toString().padStart(6, '0')}`;
    const biologicalSex: BiologicalSex = this.rng.bool() ? 'female' : 'male';
    const ageAtEntry = origin === 'born'
      ? 0
      : this.rng.int(this.stateValue.config.entrantAge.min, this.stateValue.config.entrantAge.max);
    const birthDay = day - ageAtEntry;
    // Lifespan is measured from birth, not arrival, so an immigrant who walks in
    // already aged shares the same human ceiling as anyone born here. A drawn
    // lifespan always exceeds the configured maximum entry age, so no entrant
    // arrives already past their natural death day.
    const lifespan = this.rng.int(this.stateValue.config.lifespan.min, this.stateValue.config.lifespan.max);
    const profile = origin === 'born' ? 'unskilled-generalist' : this.rng.pick(EMERGENCE_PROFILES);
    const traits = this.randomTraits();
    const aptitudes = this.randomSkills(profile, origin === 'born' ? 8 : 24);
    const skills = emptySkills();
    for (const domain of SKILL_DOMAINS) skills[domain] = origin === 'born' ? 0 : round(aptitudes[domain] * 0.45);
    const rarePotential = this.generateRarePotential();
    const interests = [...SKILL_DOMAINS]
      .sort((left, right) => aptitudes[right] - aptitudes[left] || left.localeCompare(right))
      .slice(0, rarePotential === 'polymath' || rarePotential === 'exceptional' ? 4 : 2);
    const emergenceOccupation = PROFILE_OCCUPATION[profile] ?? 'unemployed';
    const firstName = this.rng.pick(FIRST_NAMES);
    const lastName = this.rng.pick(LAST_NAMES);
    const position = positionOverride !== undefined
      ? cloneSerializable(positionOverride)
      : origin === 'entrant'
        ? cloneSerializable(this.stateValue.settlement.entryPoint)
        : { x: this.rng.int(-24, 24), y: 0, z: this.rng.int(-22, 22) };
    const person: Person = {
      id,
      name: `${firstName} ${lastName} ${this.stateValue.ids.person.toString(36).toUpperCase()}`,
      origin,
      biologicalSex,
      birthDay,
      arrivalDay: day,
      naturalDeathDay: birthDay + lifespan,
      alive: true,
      deathDay: null,
      deathCause: null,
      ageDays: ageAtEntry,
      lifeStage: lifeStageForAge(ageAtEntry, this.stateValue.config),
      appearance: {
        bodyBuild: this.rng.int(25, 80),
        hairTone: this.rng.int(0, 100),
        heightMeters: round(1.48 + this.rng.float() * 0.48, 3),
        skinTone: this.rng.int(8, 92),
        visualSeed: this.rng.nextUint32(),
      },
      emergenceProfile: profile,
      occupation: emergenceOccupation,
      employed: emergenceOccupation !== 'unemployed' && origin !== 'born',
      employerId: null,
      householdId: null,
      homeBuildingId: null,
      settlementId: SETTLEMENT_ID,
      motherId,
      fatherId,
      partnerId: null,
      childrenIds: [],
      traits,
      aptitudes,
      skills,
      knowledge: origin === 'born' ? 0 : this.rng.int(18, 58),
      health: this.rng.int(72, 100),
      emotion: this.rng.int(52, 82),
      needs: { energy: 78, food: 82, health: 86, safety: 72, shelter: 70, social: 58, water: 84 },
      wealth: origin === 'born' ? 0 : this.rng.int(18, 85),
      debt: origin === 'born' ? 0 : this.rng.int(0, 18),
      possessions: {
        energy: this.rng.int(0, 2),
        food: this.rng.int(1, 4),
        medicine: this.rng.int(0, 1),
        stone: 0,
        tools: this.rng.int(0, 2),
        transport: 0,
        water: this.rng.int(1, 4),
        wood: this.rng.int(0, 2),
      },
      currentTask: origin === 'entrant' ? 'travel' : origin === 'born' ? 'care' : 'idle',
      decisionReason: origin === 'entrant' ? 'Searching for food, shelter, and useful work.' : 'Assessing immediate needs.',
      previousPosition: cloneSerializable(position),
      position,
      destination: origin === 'born' ? cloneSerializable(position) : { x: 0, y: 0, z: 0 },
      yaw: 0,
      lastTaskSuccess: false,
      pregnancy: null,
      reproductiveCooldownUntil: 0,
      influence: emptyInfluence(),
      followersIds: [],
      rarePotential,
      interests,
      memories: [{ day, importance: 75, subjectId: SETTLEMENT_ID, summary: origin === 'born' ? 'Was born in Confluence.' : 'Entered Confluence.', type: origin === 'born' ? 'achievement' : 'arrival' }],
      historicalSignificance: 0,
    };
    if (origin === 'born' && motherId !== null && fatherId !== null) this.inheritPersonTraits(person, motherId, fatherId);
    this.stateValue.people[id] = person;
    return person;
  }

  private randomTraits(): TraitSet {
    const trait = (): number => this.rng.int(12, 92);
    return {
      adaptability: trait(), aggression: trait(), ambition: trait(), charisma: trait(), curiosity: trait(),
      empathy: trait(), moralConcern: trait(), patience: trait(), politicalDrive: trait(), riskTolerance: trait(),
      sociability: trait(), strategicThinking: trait(), trustThreshold: trait(), desireForChildren: trait(),
      desireForControl: trait(), desireForPower: trait(),
    };
  }

  private randomSkills(profile: EmergenceProfile, baseline: number): SkillSet {
    const skills = emptySkills();
    for (const domain of SKILL_DOMAINS) skills[domain] = clamp(baseline + this.rng.int(-12, 32));
    const occupation = PROFILE_OCCUPATION[profile];
    if (occupation !== undefined) {
      const focus = OCCUPATION_SKILL[occupation];
      skills[focus] = clamp(skills[focus] + this.rng.int(22, 42));
    }
    if (profile === 'political-thinker' || profile === 'religious-thinker') skills.governance = clamp(skills.governance + 30);
    if (profile === 'militarily-inclined' || profile === 'criminally-inclined') skills.security = clamp(skills.security + 26);
    if (profile === 'opportunist') skills.trade = clamp(skills.trade + 24);
    return skills;
  }

  private generateRarePotential(): RarePotential {
    const roll = this.rng.float();
    const rates = this.stateValue.config.rarity;
    if (roll < rates.exceptional) return 'exceptional';
    if (roll < rates.exceptional + rates.polymath) return 'polymath';
    if (roll < rates.exceptional + rates.polymath + rates.powerSeeker) return 'power-seeker';
    if (roll < rates.exceptional + rates.polymath + rates.powerSeeker + rates.strongLeader) return 'strong-leader';
    return 'ordinary';
  }

  private inheritPersonTraits(child: Person, motherId: PersonId, fatherId: PersonId): void {
    const mother = this.stateValue.people[motherId];
    const father = this.stateValue.people[fatherId];
    if (mother === undefined || father === undefined) return;
    const local = deterministicStream(this.streamSeed(), 'inheritance', child.id);
    const traitKeys = Object.keys(child.traits).sort() as (keyof TraitSet)[];
    for (const key of traitKeys) child.traits[key] = clamp((mother.traits[key] + father.traits[key]) / 2 + local.int(-14, 14));
    for (const domain of SKILL_DOMAINS) {
      child.aptitudes[domain] = clamp((mother.aptitudes[domain] + father.aptitudes[domain]) / 2 + local.int(-18, 18));
    }
    child.appearance.heightMeters = round((mother.appearance.heightMeters + father.appearance.heightMeters) / 2 + (local.float() - 0.5) * 0.16, 3);
    child.appearance.skinTone = clamp((mother.appearance.skinTone + father.appearance.skinTone) / 2 + local.int(-10, 10));
    child.appearance.hairTone = clamp((mother.appearance.hairTone + father.appearance.hairTone) / 2 + local.int(-12, 12));
  }

  private createHousehold(memberIds: PersonId[]): Household {
    this.stateValue.ids.household += 1;
    const id = `household:${this.stateValue.ids.household.toString().padStart(5, '0')}`;
    const household: Household = {
      id,
      foundedDay: this.currentDay,
      memberIds: [...memberIds].sort(),
      homeBuildingId: null,
      sharedFood: 0,
      sharedWealth: 0,
      stability: 55,
    };
    this.stateValue.households[id] = household;
    for (const personId of household.memberIds) {
      const person = this.stateValue.people[personId];
      if (person !== undefined) person.householdId = id;
    }
    return household;
  }

  private createBuilding(type: BuildingType, position: Position3, complete: boolean, commissioner: EntityId | null): Building {
    this.stateValue.ids.building += 1;
    const id = `building:${this.stateValue.ids.building.toString().padStart(5, '0')}`;
    const requirements = BUILDING_REQUIREMENTS[type];
    const building: Building = {
      id,
      type,
      name: `${type.replaceAll('-', ' ')} ${this.stateValue.ids.building}`,
      settlementId: SETTLEMENT_ID,
      position: cloneSerializable(position),
      commissionedDay: this.currentDay,
      commissionedById: commissioner,
      ownerId: commissioner,
      builderIds: [],
      stage: complete ? 'complete' : 'planned',
      stageIndex: complete ? CONSTRUCTION_STAGES.length - 1 : 0,
      stageProgress: complete ? 1 : 0,
      laborCompleted: complete ? requirements.labor : 0,
      laborRequired: requirements.labor,
      requiredMaterials: cloneSerializable(requirements.materials),
      deliveredMaterials: complete ? cloneSerializable(requirements.materials) : { stone: 0, tools: 0, wood: 0 },
      capacity: BUILDING_CAPACITY[type],
      condition: 100,
      environment: this.environmentForNewSite(type, position),
      occupiedByIds: [],
      history: [{ day: this.currentDay, event: complete ? 'Present at founding' : 'Commissioned', personIds: [] }],
    };
    this.stateValue.buildings[id] = building;
    this.stateValue.settlement.buildingIds.push(id);
    this.stateValue.settlement.buildingIds.sort();
    if (!complete) this.stateValue.settlement.constructionQueue.push(id);
    return building;
  }

  private createInstitution(kind: InstitutionKind, name: string, founders: PersonId[]): Institution {
    this.stateValue.ids.institution += 1;
    const id = `institution:${this.stateValue.ids.institution.toString().padStart(4, '0')}`;
    const institution: Institution = {
      id,
      kind,
      name,
      foundedDay: this.currentDay,
      founderIds: [...founders].sort(),
      memberIds: [...founders].sort(),
      leaderId: null,
      followerCandidateIds: {},
      followerLoyalty: {},
      legitimacy: 52,
      corruption: 8,
      treasury: kind === 'council' ? 800 : 120,
      policy: {
        birthIncentive: 0,
        constructionPriority: 'house',
        educationFunding: 0.12,
        foodSubsidy: 0.08,
        informationOpenness: 0.65,
        wealthRedistribution: 0.08,
      },
      history: [`Founded on world day ${this.currentDay}.`],
    };
    this.stateValue.institutions[id] = institution;
    this.emit('institution-founded', [id, ...founders], `${name} was founded.`, { kind });
    return institution;
  }

  private emit(
    type: SimulationEventType,
    entityIds: EntityId[],
    summary: string,
    data: Record<string, EventDatum> = {},
  ): void {
    this.stateValue.eventSequence += 1;
    this.stateValue.events.push({
      sequence: this.stateValue.eventSequence,
      day: this.currentDay,
      tick: this.stateValue.tick,
      type,
      entityIds: [...entityIds].sort(),
      summary,
      data,
    });
  }

  private evaluateMigration(): void {
    const config = this.stateValue.config.migration;
    if (this.stateValue.config.entrantsPerDay === 0 || config.maxArrivalsPerDay === 0 || config.baseDailyRate === 0) return;
    const population = Math.max(1, this.alivePeople().length);
    const housingRoom = clamp((this.housingCapacity() - population) / population, 0, 1);
    const foodSecurity = clamp(this.foodReserveDays() / 12, 0, 1);
    const waterSecurity = clamp(this.waterReserveDays() / 12, 0, 1);
    const safety = clamp(this.stateValue.settlement.safety / 100, 0, 1);
    const trust = clamp(this.stateValue.settlement.publicTrust / 100, 0, 1);
    const healthSecurity = 1 - clamp(Math.max(0, this.stateValue.settlement.pressure.health), 0, 1);
    const attraction = clamp(
      housingRoom * 0.2 + foodSecurity * 0.19 + waterSecurity * 0.19 +
      safety * 0.16 + trust * 0.12 + healthSecurity * 0.14,
      0,
      1,
    );
    if (attraction < config.minimumAttraction) return;
    const local = deterministicStream(this.streamSeed(), 'migration', this.currentDay);
    // Conditions outside the visible settlement remain incomplete information.
    // Daily entropy makes their effect unknowable before this day is resolved.
    const outsidePressure = 0.55 + local.float() * 0.9;
    const expected = config.baseDailyRate * outsidePressure *
      clamp((attraction - config.minimumAttraction) / Math.max(0.01, 1 - config.minimumAttraction), 0, 1.5);
    let arrivals = 0;
    let remainder = expected;
    while (arrivals < config.maxArrivalsPerDay && remainder > 0) {
      const chance = clamp(remainder, 0, 0.82);
      if (!local.bool(chance)) break;
      arrivals += 1;
      remainder = Math.max(0, remainder - 0.72);
    }
    for (let index = 0; index < arrivals; index += 1) {
      const entrant = this.createPerson('entrant', this.currentDay, null, null);
      this.createHousehold([entrant.id]);
      this.stateValue.counters.entrants += 1;
      this.emit('arrival', [entrant.id], `${entrant.name} arrived through the western road.`, {
        attraction: round(attraction),
        guaranteed: false,
        outsidePressure: round(outsidePressure),
        profile: entrant.emergenceProfile,
        sex: entrant.biologicalSex,
      });
    }
  }

  private updateAgingAndNaturalDeaths(): void {
    for (const person of this.alivePeople()) {
      person.ageDays = this.currentDay - person.birthDay;
      person.lifeStage = lifeStageForAge(person.ageDays, this.stateValue.config);
      if (this.currentDay >= person.naturalDeathDay) this.killPerson(person, 'natural causes', true);
    }
  }

  private deliverDueBirths(): void {
    const mothers = this.alivePeople().filter((person) => person.pregnancy !== null && person.pregnancy.dueDay <= this.currentDay);
    for (const mother of mothers) {
      const pregnancy = mother.pregnancy;
      if (pregnancy === null) continue;
      const father = this.stateValue.people[pregnancy.otherParentId];
      if (father === undefined || !father.alive) {
        mother.pregnancy = null;
        continue;
      }
      const home = mother.homeBuildingId === null ? undefined : this.stateValue.buildings[mother.homeBuildingId];
      const birthPosition = cloneSerializable(home?.position ?? mother.position);
      const child = this.createPerson('born', this.currentDay, mother.id, father.id, birthPosition);
      mother.childrenIds.push(child.id);
      father.childrenIds.push(child.id);
      mother.childrenIds.sort();
      father.childrenIds.sort();
      child.householdId = mother.householdId;
      if (mother.householdId !== null) {
        const household = this.stateValue.households[mother.householdId];
        if (household !== undefined && !household.memberIds.includes(child.id)) {
          household.memberIds.push(child.id);
          household.memberIds.sort();
        }
      } else {
        this.createHousehold([mother.id, child.id]);
      }
      mother.pregnancy = null;
      mother.reproductiveCooldownUntil = this.currentDay + this.rng.int(
        this.stateValue.config.reproduction.cooldownDays.min,
        this.stateValue.config.reproduction.cooldownDays.max,
      );
      father.reproductiveCooldownUntil = mother.reproductiveCooldownUntil;
      this.addPersonMemory(mother, { day: this.currentDay, importance: 90, subjectId: child.id, summary: `${child.name} was born.`, type: 'achievement' });
      this.addPersonMemory(father, { day: this.currentDay, importance: 90, subjectId: child.id, summary: `${child.name} was born.`, type: 'achievement' });
      this.stateValue.counters.births += 1;
      this.emit('birth', [child.id, mother.id, father.id], `${child.name} was born to ${mother.name} and ${father.name}.`, {
        birthLocation: home === undefined ? 'mother-position' : 'home',
        homeBuildingId: home?.id ?? '',
        sex: child.biologicalSex,
        x: birthPosition.x,
        z: birthPosition.z,
      });
    }
  }

  private assignHousing(): void {
    const houses = this.completeBuildings().filter((building) => building.type === 'house');
    for (const house of houses) house.occupiedByIds = [];
    const households = sortedRecordValues(this.stateValue.households).filter((household) => household.memberIds.some((id) => this.stateValue.people[id]?.alive));
    for (const household of households) {
      household.memberIds = household.memberIds.filter((id) => this.stateValue.people[id]?.alive).sort();
      let selected = household.homeBuildingId === null ? undefined : this.stateValue.buildings[household.homeBuildingId];
      if (
        selected === undefined || selected.stage !== 'complete' || selected.type !== 'house' ||
        selected.capacity - selected.occupiedByIds.length < household.memberIds.length
      ) {
        selected = houses.find((house) => house.capacity - house.occupiedByIds.length >= household.memberIds.length);
      }
      household.homeBuildingId = selected?.id ?? null;
      household.stability = clamp(household.stability + (selected === undefined ? -3 : 1));
      if (selected !== undefined) selected.occupiedByIds.push(...household.memberIds);
      for (const personId of household.memberIds) {
        const person = this.stateValue.people[personId];
        if (person === undefined) continue;
        person.homeBuildingId = selected?.id ?? null;
        person.needs.shelter = clamp(person.needs.shelter + (selected === undefined ? -10 : 8));
      }
    }
  }

  private assignEmployment(force = false): void {
    const projects = this.activeConstructionProjects().length;
    const pressure = this.stateValue.settlement.pressure;
    const foodNeed = clamp((5 - this.foodReserveDays()) / 5, 0, 1);
    const housingNeed = clamp(this.alivePeople().length / Math.max(1, this.housingCapacity()) - 0.8, 0, 1.5);
    for (const person of this.alivePeople()) {
      if (!isAdult(person)) {
        person.occupation = 'unemployed';
        person.employed = false;
        person.employerId = null;
        continue;
      }
      if (!force && person.employed && this.currentDay % 7 !== 0) continue;
      const choices: { value: Occupation; weight: number }[] = [
        { value: 'farmer', weight: person.aptitudes.agriculture + 35 + pressure.food * 40 + foodNeed * 75 },
        { value: 'builder', weight: person.aptitudes.construction + projects * 38 + pressure.construction * 25 + housingNeed * 50 },
        { value: 'healer', weight: person.aptitudes.medicine + pressure.health * 45 },
        { value: 'researcher', weight: person.aptitudes.research + person.traits.curiosity * 0.35 + pressure.knowledge * 25 },
        { value: 'trader', weight: person.aptitudes.trade + pressure.trade * 25 },
        { value: 'teacher', weight: person.aptitudes.education + this.alivePeople().filter((candidate) => candidate.lifeStage === 'child').length * 2 },
        { value: 'mechanic', weight: person.aptitudes.engineering + pressure.energy * 20 },
        { value: 'organizer', weight: person.aptitudes.governance + person.traits.politicalDrive * 0.4 },
        { value: 'caregiver', weight: person.aptitudes.care + pressure.health * 20 },
        { value: 'hunter', weight: person.aptitudes.security + pressure.food * 18 },
        { value: 'laborer', weight: 42 + projects * 22 },
        { value: 'artist', weight: person.aptitudes.art + Math.max(0, -pressure.sentiment) * 20 },
      ];
      const local = deterministicStream(this.streamSeed(), 'employment', this.currentDay, person.id);
      const occupation = local.weightedPick(choices);
      if (occupation !== person.occupation) {
        const previous = person.occupation;
        person.occupation = occupation;
        this.emit('employment-changed', [person.id], `${person.name} changed work from ${previous} to ${occupation}.`, { previous, occupation });
      }
      person.employed = true;
      person.employerId = this.workplaceFor(person)?.id ?? this.primaryInstitution()?.id ?? null;
    }
  }

  private chooseTasksAndDestinations(): void {
    const council = this.primaryInstitution();
    // With empty stores, standing at the market feeds nobody; hungry people
    // stay available for the work that restocks it instead.
    const foodAvailable = this.stateValue.settlement.resources.food >= 1;
    for (const person of this.alivePeople()) {
      let task: TaskType;
      let reason: string;
      if (person.origin === 'born' && person.ageDays === 0) {
        task = 'care';
        reason = 'A newborn remains with their household for immediate care.';
      } else if (person.lifeStage === 'child') {
        task = person.needs.social < 45 ? 'socialize' : 'learn';
        reason = task === 'learn' ? 'Learning from family and the settlement school.' : 'Seeking play and family contact.';
      } else if (person.lifeStage === 'adolescent') {
        task = person.needs.food < 35 && foodAvailable ? 'eat' : 'learn';
        reason = task === 'eat' ? 'Hunger takes priority.' : 'Building skills before adult work.';
      } else if (person.needs.water < 30) {
        task = 'fetch-water'; reason = 'Thirst is an immediate survival pressure.';
      } else if (person.needs.food < 32 && foodAvailable) {
        task = 'eat'; reason = 'Food need is more urgent than paid work.';
      } else if (person.health < 45 || person.needs.health < 40) {
        task = 'heal'; reason = 'Poor health makes treatment the highest-value choice.';
      } else if (person.needs.energy < 26) {
        task = 'rest'; reason = 'Fatigue is limiting useful work.';
      } else if (person.homeBuildingId === null && (person.occupation === 'builder' || person.occupation === 'laborer')) {
        task = 'build'; reason = 'Housing insecurity creates direct construction incentive.';
      } else if (this.shouldAssignToSanitation(person)) {
        task = 'work'; reason = SANITATION_TASK_REASON;
      } else if (this.activeConstructionProjects().length > 0 && (person.occupation === 'builder' || person.occupation === 'laborer')) {
        task = 'build'; reason = 'A funded construction project needs labor and materials.';
      } else if (council?.leaderId === person.id || person.occupation === 'organizer') {
        task = 'govern'; reason = 'Institutional responsibilities and public pressure require coordination.';
      } else if (person.occupation === 'researcher' || person.occupation === 'inventor') {
        task = 'research'; reason = 'Skills and unresolved settlement problems make experimentation worthwhile.';
      } else if (person.needs.social < 36 || (person.traits.sociability > 76 && this.currentDay % 5 === 0)) {
        task = 'socialize'; reason = 'Social isolation and trust-building outweigh another work shift.';
      } else if (person.occupation === 'trader') {
        task = 'trade'; reason = 'Price differences and shortages create exchange opportunities.';
      } else if (person.occupation === 'healer' || person.occupation === 'caregiver') {
        task = person.occupation === 'healer' ? 'heal' : 'care';
        reason = 'Care skills are needed by vulnerable residents.';
      } else {
        task = 'work'; reason = 'Income and settlement production are the strongest available opportunity.';
      }
      person.currentTask = task;
      person.decisionReason = reason;
      person.destination = this.destinationForTask(person, task);
    }
  }

  private destinationForTask(person: Person, task: TaskType): Position3 {
    let buildingType: BuildingType | null = null;
    switch (task) {
      case 'build': {
        const project = this.constructionProjectFor(person);
        return project === undefined ? { x: 0, y: 0, z: 0 } : this.constructionWorksitePosition(person, project);
      }
      case 'eat': buildingType = 'market'; break;
      case 'fetch-water': buildingType = 'well'; break;
      case 'govern': buildingType = 'council-hall'; break;
      case 'heal': buildingType = 'clinic'; break;
      case 'care': {
        if (person.origin === 'born' && person.ageDays === 0) {
          const home = person.homeBuildingId === null ? undefined : this.stateValue.buildings[person.homeBuildingId];
          return cloneSerializable(home?.position ?? person.position);
        }
        buildingType = 'clinic';
        break;
      }
      case 'learn': case 'research': buildingType = 'school'; break;
      case 'socialize': case 'trade': buildingType = 'market'; break;
      case 'rest': {
        const home = person.homeBuildingId === null ? undefined : this.stateValue.buildings[person.homeBuildingId];
        return home === undefined ? { x: 0, y: 0, z: 0 } : cloneSerializable(home.position);
      }
      case 'work': {
        const workplace = this.isAssignedToSanitation(person)
          ? this.sanitationSiteFor(person)
          : this.workplaceFor(person);
        return workplace === undefined ? cloneSerializable(person.position) : cloneSerializable(workplace.position);
      }
      case 'idle': case 'travel': return { x: 0, y: 0, z: 0 };
    }
    if (buildingType !== null) {
      const building = this.completeBuildings().find((candidate) => candidate.type === buildingType);
      if (building !== undefined) return cloneSerializable(building.position);
    }
    return { x: 0, y: 0, z: 0 };
  }

  private runProductionAndEmployment(): void {
    const economy = this.stateValue.settlement.dailyEconomy;
    const modifiers = this.stateValue.settlement.modifiers;
    const buildings = this.completeBuildings();
    const farms = buildings.filter((building) => building.type === 'farm');
    const wells = buildings.filter((building) => building.type === 'well');
    const powerStations = buildings.filter((building) => building.type === 'power-station');
    const clinicCount = buildings.filter((building) => building.type === 'clinic').length;
    const workshops = buildings.filter((building) => building.type === 'workshop');
    const environmentConfig = this.stateValue.config.environment;
    const farmWaterRatio = this.consumeFacilityResource('water', farms.length * environmentConfig.farmWaterPerDay);
    const workshopEnergyRatio = this.consumeFacilityResource('energy', workshops.length * environmentConfig.workshopEnergyPerDay);
    const sharedToolsRatio = this.consumeFacilityResource(
      'tools',
      farms.length * environmentConfig.farmToolsPerDay + powerStations.length * environmentConfig.powerToolsPerDay,
    );
    const farmToolsRatio = sharedToolsRatio;
    const powerToolsRatio = sharedToolsRatio;
    const farmInputFactor = farms.length === 0 ? 1 : 0.72 + Math.min(farmWaterRatio, farmToolsRatio) * 0.28;
    const workshopInputFactor = workshops.length === 0 ? 1 : 0.65 + workshopEnergyRatio * 0.35;
    const powerInputFactor = powerStations.length === 0 ? 1 : 0.7 + powerToolsRatio * 0.3;
    const wellEnvironmentFactor = wells.length === 0
      ? 1
      : wells.reduce((sum, building) => sum + facilityEnvironmentFactor(building.type, building.environment), 0) /
        wells.length;
    for (const farm of farms) {
      const output = 16 * modifiers.foodYield * farmInputFactor * facilityEnvironmentFactor(farm.type, farm.environment);
      economy.production.food += output;
      this.recordFacilityProduction(farm, 'food', output);
    }
    const storedWaterBeforeProduction = this.stateValue.settlement.resources.water;
    const storedWaterQuality = this.stateValue.settlement.drinkingWaterQuality;
    let producedWaterQualityMass = 0;
    for (const well of wells) {
      const output = 82 * modifiers.waterYield * facilityEnvironmentFactor(well.type, well.environment);
      economy.production.water += output;
      producedWaterQualityMass += output * well.environment.waterQuality;
      this.recordFacilityProduction(well, 'water', output);
    }
    economy.production.energy += 28 * modifiers.energyEfficiency;
    for (const powerStation of powerStations) {
      const output = 55 * powerInputFactor * facilityEnvironmentFactor(powerStation.type, powerStation.environment) *
        modifiers.energyEfficiency;
      economy.production.energy += output;
      this.recordFacilityProduction(powerStation, 'energy', output);
    }
    economy.production.medicine += clinicCount * 2.2 * modifiers.healthCapacity;
    for (const workshop of workshops) {
      const output = 1.4 * workshopInputFactor * facilityEnvironmentFactor(workshop.type, workshop.environment);
      economy.production.tools += output;
      this.recordFacilityProduction(workshop, 'tools', output);
    }

    for (const person of this.alivePeople()) person.lastTaskSuccess = false;
    // Fetching water is real labor, not queueing: every adult who reached the
    // well hauls water into the settlement stock, so a thirst crisis raises
    // supply instead of freezing the town around a dry well.
    const haulers = this.alivePeople().filter((person) =>
      person.currentTask === 'fetch-water' && isAdult(person) && this.isAtTaskWorksite(person));
    const activeHaulers = haulers.slice(0, wells.length * WELL_HAULERS_PER_WELL);
    for (const person of activeHaulers) person.lastTaskSuccess = true;
    let hauledWater = 0;
    for (const person of activeHaulers) {
      const well = this.buildingForTask(person, 'fetch-water');
      const localFactor = well === undefined ? wellEnvironmentFactor : facilityEnvironmentFactor(well.type, well.environment);
      const output = WATER_HAULED_PER_HAULER * modifiers.waterYield * localFactor;
      producedWaterQualityMass += output * (well?.environment.waterQuality ?? this.stateValue.settlement.drinkingWaterQuality);
      hauledWater += output;
      if (well !== undefined) this.recordFacilityProduction(well, 'water', output);
    }
    economy.production.water += hauledWater;
    for (const person of this.alivePeople()) {
      const sanitationAssignment = this.isAssignedToSanitation(person);
      if (
        !isAdult(person) ||
        (!person.employed && !sanitationAssignment) ||
        (!sanitationAssignment && !this.canPerformProductiveTask(person)) ||
        !this.isAtTaskWorksite(person)
      ) continue;
      const skillDomain = OCCUPATION_SKILL[person.occupation];
      const skill = person.skills[skillDomain];
      const capacity = (0.62 + person.health / 250 + person.needs.energy / 400) * (0.8 + skill / 220);
      const local = deterministicStream(this.streamSeed(), 'task-success', this.currentDay, person.id);
      const successChance = clamp(0.48 + capacity * 0.32 + person.traits.patience / 500, 0.1, 0.97);
      person.lastTaskSuccess = local.bool(successChance);
      const output = person.lastTaskSuccess ? capacity : capacity * 0.42;
      switch (person.currentTask) {
        case 'work':
          this.produceForOccupation(person, output, economy.production, {
            farm: farmInputFactor,
            workshop: workshopInputFactor,
          });
          break;
        case 'trade':
          economy.valueProduced += 7 * output * modifiers.tradeEfficiency;
          economy.production.transport += 0.15 * output;
          break;
        case 'heal':
          economy.production.medicine += 0.55 * output;
          break;
        case 'care':
          this.restoreVulnerableNeeds(2.4 * output);
          break;
        case 'govern':
          this.stateValue.settlement.publicTrust = clamp(this.stateValue.settlement.publicTrust + (person.lastTaskSuccess ? 0.35 : -0.25));
          break;
        case 'research':
          person.knowledge = clamp(person.knowledge + 0.35 * output * modifiers.knowledgeGrowth);
          break;
        case 'build':
          // Builders can recover and shape local timber and stone at the site;
          // the same arrived workers must then deliver those units below.
          economy.production.wood += 0.8 * output;
          economy.production.stone += 0.5 * output;
          break;
        default:
          break;
      }
      const skillGain = (person.lastTaskSuccess ? 0.3 : 0.14) * (0.75 + person.traits.adaptability / 150);
      person.skills[skillDomain] = clamp(person.skills[skillDomain] + skillGain);
      const wage = round(2.2 + skill / 22 + (person.lastTaskSuccess ? 1.1 : 0));
      const paid = Math.min(wage, this.stateValue.settlement.treasury);
      this.stateValue.settlement.treasury -= paid;
      person.wealth += paid;
      economy.wagesPaid += paid;
      if (paid < wage) this.stateValue.settlement.debt += wage - paid;
      economy.valueProduced += output * 4;
    }
    const rawWaterProduction = economy.production.water;
    this.curtailProductionToUsableCapacity();
    const waterProductionRatio = rawWaterProduction <= 0 ? 1 : economy.production.water / rawWaterProduction;
    producedWaterQualityMass *= waterProductionRatio;
    const waterAfterProduction = storedWaterBeforeProduction + economy.production.water;
    if (waterAfterProduction > 0) {
      this.stateValue.settlement.drinkingWaterQuality = round(clamp(
        (storedWaterBeforeProduction * storedWaterQuality + producedWaterQualityMass) / waterAfterProduction,
      ));
    }
    for (const resource of RESOURCE_KINDS) {
      economy.production[resource] = round(Math.max(0, economy.production[resource]));
      this.stateValue.settlement.resources[resource] = round(this.stateValue.settlement.resources[resource] + economy.production[resource]);
    }
    this.stateValue.settlement.treasury += economy.valueProduced * 0.16;
  }

  /**
   * Facilities respond to stores and expected household use instead of making
   * goods that cannot be used or stored. External shocks and donations may
   * still overflow later; ordinary production no longer manufactures waste
   * merely because a warehouse is full.
   */
  private curtailProductionToUsableCapacity(): void {
    const economy = this.stateValue.settlement.dailyEconomy;
    const capacity = this.resourceCapacity();
    const people = this.alivePeople();
    const equivalentAdults = people.reduce(
      (sum, person) => sum + (isAdult(person) ? 1 : this.stateValue.config.needs.childConsumptionScale),
      0,
    );
    const expectedUse: ResourceLedger = {
      energy: equivalentAdults * this.stateValue.config.needs.energyPerAdult,
      food: equivalentAdults * this.stateValue.config.needs.foodPerAdult,
      medicine: Math.max(0, this.stateValue.settlement.pressure.health) * people.length * 0.08,
      stone: 0,
      tools: 0,
      transport: 0,
      water: equivalentAdults * this.stateValue.config.needs.waterPerAdult,
      wood: 0,
    };
    for (const project of this.activeConstructionProjects()) {
      expectedUse.wood += Math.max(0, project.requiredMaterials.wood - project.deliveredMaterials.wood);
      expectedUse.stone += Math.max(0, project.requiredMaterials.stone - project.deliveredMaterials.stone);
      expectedUse.tools += Math.max(0, project.requiredMaterials.tools - project.deliveredMaterials.tools);
    }
    for (const resource of RESOURCE_KINDS) {
      const produced = economy.production[resource];
      const usable = Math.max(
        0,
        capacity[resource] - this.stateValue.settlement.resources[resource] + expectedUse[resource],
      );
      if (produced <= usable) continue;
      const ratio = produced <= 0 ? 1 : usable / produced;
      economy.production[resource] = round(usable);
      for (const facility of this.facilityProductionToday.values()) {
        facility[resource] = round(facility[resource] * ratio);
      }
    }
  }

  private produceForOccupation(
    person: Person,
    output: number,
    ledger: ResourceLedger,
    inputFactors: { farm: number; workshop: number },
  ): void {
    const workplace = this.workplaceFor(person);
    const localFactor = workplace === undefined ? 1 : facilityEnvironmentFactor(workplace.type, workplace.environment);
    switch (person.occupation) {
      case 'farmer': {
        const produced = 7.5 * output * inputFactors.farm * localFactor;
        ledger.food += produced;
        if (workplace?.type === 'farm') this.recordFacilityProduction(workplace, 'food', produced);
        break;
      }
      case 'hunter': ledger.food += 3.8 * output; ledger.medicine += 0.15 * output; break;
      case 'builder':
        ledger.wood += 2.1 * output; ledger.stone += 1.5 * output; break;
      case 'laborer':
        if (!this.isAssignedToSanitation(person)) {
          ledger.wood += 2.1 * output;
          ledger.stone += 1.5 * output;
        }
        break;
      case 'mechanic': case 'inventor': {
        const tools = 0.8 * output * inputFactors.workshop * localFactor;
        const energy = 1.2 * output * inputFactors.workshop * localFactor;
        ledger.tools += tools;
        ledger.energy += energy;
        if (workplace?.type === 'workshop') {
          this.recordFacilityProduction(workplace, 'tools', tools);
          this.recordFacilityProduction(workplace, 'energy', energy);
        }
        break;
      }
      case 'healer': ledger.medicine += 0.65 * output; break;
      case 'trader': ledger.transport += 0.18 * output; break;
      case 'explorer': ledger.food += 0.8 * output; ledger.wood += 0.7 * output; break;
      case 'artist': case 'caregiver': case 'organizer': case 'researcher': case 'teacher': case 'unemployed': break;
    }
  }

  private recordFacilityProduction(building: Building, resource: ResourceKind, amount: number): void {
    if (amount <= 0) return;
    const ledger = this.facilityProductionToday.get(building.id) ?? emptyResources();
    ledger[resource] += amount;
    this.facilityProductionToday.set(building.id, ledger);
  }

  private consumeFacilityResource(resource: ResourceKind, amount: number): number {
    if (amount <= 0) return 1;
    const available = this.stateValue.settlement.resources[resource];
    const supplied = Math.min(amount, available);
    this.stateValue.settlement.resources[resource] = round(available - supplied);
    this.stateValue.settlement.dailyEconomy.consumption[resource] += supplied;
    return supplied / amount;
  }

  private runSanitation(): void {
    const workers = this.alivePeople().filter((person) =>
      this.isAssignedToSanitation(person) && person.lastTaskSuccess && this.isAtTaskWorksite(person));
    if (workers.length === 0) return;
    const assignments = new Map<BuildingId, { site: Building; workers: Person[] }>();
    for (const worker of workers) {
      const site = this.buildingForTask(worker, 'work');
      if (site === undefined) continue;
      const assignment = assignments.get(site.id) ?? { site, workers: [] };
      assignment.workers.push(worker);
      assignments.set(site.id, assignment);
    }
    const assignedWorkers = [...assignments.values()].reduce((sum, assignment) => sum + assignment.workers.length, 0);
    const targetWaste = [...assignments.values()]
      .reduce((sum, assignment) => sum + assignment.site.environment.wasteLoad, 0);
    if (assignedWorkers === 0 || targetWaste <= 0) return;

    const environmentConfig = this.stateValue.config.environment;
    const baseCapacity = assignedWorkers * environmentConfig.sanitationPerWorker;
    const transportNeed = Math.min(baseCapacity, targetWaste) * 0.08;
    const transportRatio = transportNeed <= 0
      ? 1
      : Math.min(1, this.stateValue.settlement.resources.transport / transportNeed);
    const capacityBeforePower = Math.min(targetWaste, baseCapacity * (0.25 + transportRatio * 0.75));
    const energyNeed = capacityBeforePower * environmentConfig.sanitationEnergyPerWaste;
    const energyAvailable = this.stateValue.settlement.resources.energy;
    const energyOffered = Math.min(energyNeed, energyAvailable);
    const energyRatio = energyNeed <= 0 ? 1 : energyOffered / energyNeed;
    const totalCapacity = capacityBeforePower * (0.35 + energyRatio * 0.65);
    const capacityPerWorker = totalCapacity / assignedWorkers;
    let wasteRemoved = 0;
    const removals: { assignment: { site: Building; workers: Person[] }; amount: number; before: number }[] = [];
    for (const assignment of [...assignments.values()].sort((left, right) => left.site.id.localeCompare(right.site.id))) {
      const before = assignment.site.environment.wasteLoad;
      const amount = Math.min(before, capacityPerWorker * assignment.workers.length);
      assignment.site.environment.wasteLoad = round(Math.max(0, before - amount));
      wasteRemoved += amount;
      removals.push({ assignment, amount, before });
    }
    wasteRemoved = round(wasteRemoved);
    if (wasteRemoved <= 0) return;
    const actualEnergyUsed = totalCapacity <= 0 ? 0 : energyOffered * (wasteRemoved / totalCapacity);
    this.stateValue.settlement.resources.energy = round(energyAvailable - actualEnergyUsed);
    this.stateValue.settlement.dailyEconomy.consumption.energy = round(
      this.stateValue.settlement.dailyEconomy.consumption.energy + actualEnergyUsed,
    );
    this.stateValue.settlement.dailyEconomy.wasteRemoved = wasteRemoved;
    this.stateValue.settlement.waste = round(sortedRecordValues(this.stateValue.buildings)
      .reduce((sum, building) => sum + building.environment.wasteLoad, 0));

    for (const removal of removals) {
      if (removal.amount <= 0) continue;
      const workerIds = removal.assignment.workers.map((worker) => worker.id).sort();
      this.sanitationCoverageToday.set(
        removal.assignment.site.id,
        removal.before <= 0 ? 0 : clamp(removal.amount / removal.before, 0, 1),
      );
      const siteEnergy = wasteRemoved <= 0 ? 0 : actualEnergyUsed * (removal.amount / wasteRemoved);
      removal.assignment.site.history.push({
        day: this.currentDay,
        event: `Sanitation removed ${round(removal.amount)} waste units`,
        personIds: workerIds,
      });
      this.emit(
        'sanitation-cleanup',
        [removal.assignment.site.id, ...workerIds],
        `${workerIds.length} sanitation worker(s) removed ${round(removal.amount)} waste units from ${removal.assignment.site.name}.`,
        { energyUsed: round(siteEnergy), wasteRemoved: round(removal.amount) },
      );
    }
  }

  private restoreVulnerableNeeds(amount: number): void {
    const vulnerable = this.alivePeople()
      .filter((person) => person.lifeStage === 'child' || person.lifeStage === 'elder' || person.health < 55)
      .slice(0, 4);
    for (const person of vulnerable) {
      person.needs.health = clamp(person.needs.health + amount);
      person.emotion = clamp(person.emotion + amount * 0.5);
    }
  }

  private consumeResourcesAndUpdateHealth(): void {
    const economy = this.stateValue.settlement.dailyEconomy;
    const config = this.stateValue.config.needs;
    const deaths: { person: Person; cause: string }[] = [];
    const people = this.alivePeople();
    const equivalentAdults = people.reduce(
      (sum, person) => sum + (isAdult(person) ? 1 : config.childConsumptionScale),
      0,
    );
    const demand = {
      food: equivalentAdults * config.foodPerAdult,
      water: equivalentAdults * config.waterPerAdult,
      energy: equivalentAdults * config.energyPerAdult,
    };
    const ratios = {
      food: demand.food <= 0 ? 1 : Math.min(1, this.stateValue.settlement.resources.food / demand.food),
      water: demand.water <= 0 ? 1 : Math.min(1, this.stateValue.settlement.resources.water / demand.water),
      energy: demand.energy <= 0 ? 1 : Math.min(1, this.stateValue.settlement.resources.energy / demand.energy),
    };
    for (const resource of ['food', 'water', 'energy'] as const) {
      const supplied = round(demand[resource] * ratios[resource]);
      this.stateValue.settlement.resources[resource] = round(
        Math.max(0, this.stateValue.settlement.resources[resource] - supplied),
      );
      economy.consumption[resource] = round(economy.consumption[resource] + supplied);
    }
    if (ratios.food < 0.99 || ratios.water < 0.99 || ratios.energy < 0.99) {
      this.emit('shortage', [SETTLEMENT_ID], 'Shared essentials were rationed across the settlement.', {
        energyRatio: round(ratios.energy),
        foodRatio: round(ratios.food),
        waterRatio: round(ratios.water),
      });
    }
    const drinkingWaterDamage = clamp((72 - this.stateValue.settlement.drinkingWaterQuality) / 32, 0, 1) * 2.4;
    for (const person of people) {
      const scale = isAdult(person) ? 1 : config.childConsumptionScale;
      const foodNeeded = config.foodPerAdult * scale;
      const waterNeeded = config.waterPerAdult * scale;
      const energyNeeded = config.energyPerAdult * scale;
      const foodRatio = ratios.food;
      const waterRatio = ratios.water;
      const energyRatio = ratios.energy;
      for (const [resource, supplied] of [
        ['food', foodNeeded * foodRatio],
        ['water', waterNeeded * waterRatio],
        ['energy', energyNeeded * energyRatio],
      ] as const) {
        const price = this.stateValue.settlement.prices[resource] * supplied;
        const payment = Math.min(person.wealth, price);
        person.wealth -= payment;
        this.stateValue.settlement.treasury += payment;
      }
      person.needs.food = clamp(person.needs.food + foodRatio * 16 - 11);
      person.needs.water = clamp(person.needs.water + waterRatio * 18 - 13);
      person.needs.energy = clamp(person.needs.energy + energyRatio * 8 - (person.currentTask === 'build' || person.currentTask === 'work' ? 10 : 6));
      person.needs.social = clamp(person.needs.social + (person.currentTask === 'socialize' || person.currentTask === 'care' ? 14 : -4));
      person.needs.safety = clamp(person.needs.safety + (this.stateValue.settlement.safety - 50) / 18);
      if (person.currentTask === 'rest') person.needs.energy = clamp(person.needs.energy + 24);
      if (person.currentTask === 'heal' && this.isAtTaskWorksite(person) && this.stateValue.settlement.resources.medicine >= 0.3) {
        this.stateValue.settlement.resources.medicine -= 0.3;
        economy.consumption.medicine += 0.3;
        person.health = clamp(person.health + 7 * this.stateValue.settlement.modifiers.healthCapacity);
        person.needs.health = clamp(person.needs.health + 14);
      }
      let damage = 0;
      if (person.needs.food < 20) damage += config.starvationDamage * (1 - person.needs.food / 20);
      if (person.needs.water < 20) damage += config.dehydrationDamage * (1 - person.needs.water / 20);
      if (person.homeBuildingId === null) damage += config.exposureDamage * 0.25;
      damage += Math.max(0, this.stateValue.settlement.pressure.health) * this.stateValue.settlement.modifiers.diseaseRisk * 2.5;
      const localEnvironment = this.environmentalContextFor(person);
      const localBurden = localEnvironment === undefined ? 0 : environmentalHealthBurden(localEnvironment.environment);
      damage += (localBurden * 0.8 + drinkingWaterDamage * waterRatio) *
        this.stateValue.settlement.modifiers.diseaseRisk;
      const healerCount = this.alivePeople().filter((candidate) => candidate.currentTask === 'heal').length;
      const recovery = person.needs.food > 50 && person.needs.water > 50 ? 1.2 + healerCount * 0.04 : 0;
      person.health = clamp(person.health + recovery - damage);
      person.needs.health = clamp(person.needs.health + recovery - damage * 0.8);
      person.emotion = clamp(person.emotion + (person.needs.social - 50) / 40 + (person.needs.shelter - 50) / 55 - damage * 0.5);
      if (person.health <= 0) {
        deaths.push({ person, cause: person.needs.water < 10 ? 'dehydration' : person.needs.food < 10 ? 'starvation' : 'illness and exposure' });
      } else if (person.health < 18) {
        const risk = clamp((18 - person.health) / 125, 0, 0.12);
        if (deterministicStream(this.deepStreamSeed(), 'early-death', this.currentDay, person.id).bool(risk)) {
          deaths.push({ person, cause: person.needs.water < person.needs.food ? 'dehydration' : 'medical failure' });
        }
      }
    }
    for (const resource of RESOURCE_KINDS) economy.consumption[resource] = round(economy.consumption[resource]);
    for (const death of deaths) if (death.person.alive) this.killPerson(death.person, death.cause, false);
  }

  private runEncounters(): void {
    const people = this.alivePeople();
    const processed = new Set<string>();
    const spatialBuckets = new Map<string, Person[]>();
    const contextGroups = new Map<string, Person[]>();
    for (const person of people) {
      const key = this.spatialBucketKey(person.position);
      const bucket = spatialBuckets.get(key) ?? [];
      bucket.push(person);
      spatialBuckets.set(key, bucket);
      for (const contextId of [this.actualHomeContextId(person), this.actualWorkContextId(person)]) {
        if (contextId === null) continue;
        const group = contextGroups.get(contextId) ?? [];
        group.push(person);
        contextGroups.set(contextId, group);
      }
    }
    for (const person of people) {
      if (person === undefined) continue;
      const candidateMap = new Map<PersonId, Person>();
      const bucketX = Math.floor(person.position.x / ENCOUNTER_RADIUS_METERS);
      const bucketZ = Math.floor(person.position.z / ENCOUNTER_RADIUS_METERS);
      for (let xOffset = -1; xOffset <= 1; xOffset += 1) {
        for (let zOffset = -1; zOffset <= 1; zOffset += 1) {
          const nearby = spatialBuckets.get(`${bucketX + xOffset}:${bucketZ + zOffset}`) ?? [];
          for (const candidate of nearby) {
            if (candidate.id !== person.id && this.canEncounter(person, candidate)) candidateMap.set(candidate.id, candidate);
          }
        }
      }

      // Site groups catch opposite edges of a large workplace or home without
      // turning institutional membership into nonlocal interaction.
      for (const contextId of [this.actualHomeContextId(person), this.actualWorkContextId(person)]) {
        if (contextId === null) continue;
        for (const candidate of contextGroups.get(contextId) ?? []) {
          if (candidate.id !== person.id) candidateMap.set(candidate.id, candidate);
        }
      }
      const candidates = [...candidateMap.values()]
        .map((candidate) => ({
          candidate,
          score:
            (this.shareActualHomeContext(person, candidate) ? 100 : 0) +
            (this.shareActualWorkContext(person, candidate) ? 65 : 0) +
            (this.stateValue.relationships[relationshipId(person.id, candidate.id)]?.affinity ?? 0) * 0.8 -
            Math.min(40, Math.sqrt(distanceSquared(candidate.position, person.position))),
        }))
        .sort((left, right) => right.score - left.score || left.candidate.id.localeCompare(right.candidate.id));
      const encounterCount = Math.min(this.stateValue.config.relationships.encountersPerPerson, candidates.length);
      for (let offset = 0; offset < encounterCount; offset += 1) {
        const candidate = candidates[offset]?.candidate;
        if (candidate === undefined) continue;
        const id = relationshipId(person.id, candidate.id);
        if (processed.has(id)) continue;
        processed.add(id);
        this.updateRelationship(person, candidate, id);
      }
    }
  }

  private updateRelationship(personA: Person, personB: Person, id: string): void {
    let relationship = this.stateValue.relationships[id];
    const firstMeeting = relationship === undefined;
    const sharedWork = this.shareActualWorkContext(personA, personB);
    if (relationship === undefined) {
      const local = deterministicStream(this.streamSeed(), 'first-meeting', id);
      const compatibility = this.personCompatibility(personA, personB);
      relationship = {
        id,
        personAId: personA.id < personB.id ? personA.id : personB.id,
        personBId: personA.id < personB.id ? personB.id : personA.id,
        kind: sharedWork ? 'coworker' : 'acquaintance',
        affinity: clamp(28 + compatibility * 34 + local.int(-8, 8)),
        chemistry: clamp(compatibility * 48 + local.int(0, 52)),
        attraction: clamp(18 + compatibility * 24 + local.int(-8, 12)),
        trust: clamp(25 + compatibility * 28 + local.int(-6, 7)),
        conflict: clamp(local.int(0, 16) + Math.abs(personA.traits.aggression - personB.traits.aggression) * 0.08),
        dependency: personA.householdId === personB.householdId ? 20 : 0,
        encounters: 0,
        startedDay: this.currentDay,
        lastInteractionDay: this.currentDay,
        endedDay: null,
        sharedWorkDays: 0,
        memories: [{ day: this.currentDay, delta: 3, summary: `${personA.name} and ${personB.name} first met.`, type: 'first-meeting' }],
      };
      this.stateValue.relationships[id] = relationship;
      this.emit('encounter', [personA.id, personB.id], `${personA.name} and ${personB.name} met for the first time.`, { relationshipId: id });
      this.addPersonMemory(personA, { day: this.currentDay, importance: 35, subjectId: personB.id, summary: `First met ${personB.name}.`, type: 'arrival' });
      this.addPersonMemory(personB, { day: this.currentDay, importance: 35, subjectId: personA.id, summary: `First met ${personA.name}.`, type: 'arrival' });
    } else if (relationship.endedDay !== null) {
      relationship.endedDay = null;
      relationship.kind = sharedWork ? 'coworker' : 'acquaintance';
    }
    const local = deterministicStream(this.streamSeed(), 'encounter', this.currentDay, id);
    if (sharedWork) relationship.sharedWorkDays += 1;
    const empathy = (personA.traits.empathy + personB.traits.empathy) / 200;
    const sociability = (personA.traits.sociability + personB.traits.sociability) / 200;
    const success = personA.lastTaskSuccess || personB.lastTaskSuccess;
    const cooperationDelta = 0.7 + empathy * 1.3 + sociability + (sharedWork ? 1.2 : 0) + (success ? 0.4 : 0);
    const conflictChance = clamp((personA.traits.aggression + personB.traits.aggression - personA.traits.patience - personB.traits.patience + relationship.conflict) / 600, 0.01, 0.22);
    const conflict = local.bool(conflictChance);
    if (conflict) {
      relationship.affinity = clamp(relationship.affinity - local.int(2, 7));
      relationship.trust = clamp(relationship.trust - local.int(1, 6));
      relationship.conflict = clamp(relationship.conflict + local.int(3, 8));
      this.addRelationshipMemory(relationship, { day: this.currentDay, delta: -4, summary: 'A disagreement damaged trust.', type: 'argument' });
    } else {
      relationship.affinity = clamp(relationship.affinity + cooperationDelta);
      relationship.trust = clamp(relationship.trust + cooperationDelta * 0.72);
      const chemistryPull = (relationship.chemistry - relationship.attraction) * 0.045;
      relationship.attraction = clamp(
        relationship.attraction + chemistryPull + (success ? this.personCompatibility(personA, personB) * 0.18 : 0) +
        local.int(-2, 2) * 0.08,
      );
      relationship.conflict = clamp(relationship.conflict - 0.35);
      if (sharedWork && local.bool(0.08)) this.addRelationshipMemory(relationship, { day: this.currentDay, delta: 3, summary: 'Successful work together strengthened the relationship.', type: 'cooperation' });
    }
    relationship.encounters += 1;
    relationship.lastInteractionDay = this.currentDay;
    const previousKind = relationship.kind;
    if (relationship.kind !== 'partner' && relationship.kind !== 'spouse') {
      if (
        relationship.chemistry >= this.stateValue.config.relationships.romanticChemistryThreshold &&
        relationship.attraction > this.stateValue.config.relationships.partnerAttraction &&
        relationship.trust > 48 && relationship.affinity > 52 && isAdult(personA) && isAdult(personB)
      ) relationship.kind = 'romantic-interest';
      else if (relationship.trust > 72 && relationship.affinity > 74) relationship.kind = 'close-friend';
      else if (relationship.trust > 57 && relationship.affinity > 60) relationship.kind = 'friend';
      else if (sharedWork) relationship.kind = 'coworker';
      else relationship.kind = 'acquaintance';
    }
    if (!firstMeeting && previousKind !== relationship.kind) {
      this.emit('relationship-changed', [personA.id, personB.id], `${personA.name} and ${personB.name} became ${relationship.kind.replaceAll('-', ' ')}s.`, {
        previous: previousKind,
        current: relationship.kind,
      });
    }
  }

  private fadeInactiveRelationships(): void {
    const threshold = this.stateValue.config.relationships.inactiveAcquaintanceDays;
    for (const relationship of sortedRecordValues(this.stateValue.relationships)) {
      if (relationship.endedDay !== null || relationship.kind === 'partner' || relationship.kind === 'spouse') continue;
      if (this.currentDay - relationship.lastInteractionDay < threshold) continue;
      relationship.endedDay = this.currentDay;
      this.stateValue.counters.archivedRelationships += 1;
      this.emit(
        'relationship-ended',
        [relationship.personAId, relationship.personBId],
        'A social tie faded after a long period without contact.',
        { relationshipId: relationship.id },
      );
    }
  }

  private personCompatibility(left: Person, right: Person): number {
    const differences = [
      Math.abs(left.traits.empathy - right.traits.empathy),
      Math.abs(left.traits.sociability - right.traits.sociability),
      Math.abs(left.traits.moralConcern - right.traits.moralConcern),
      Math.abs(left.traits.riskTolerance - right.traits.riskTolerance),
      Math.abs(left.traits.patience - right.traits.patience),
    ];
    const personality = 1 - differences.reduce((sum, value) => sum + value, 0) / (differences.length * 100);
    const sharedInterests = left.interests.filter((interest) => right.interests.includes(interest)).length;
    return clamp(personality * 0.78 + sharedInterests * 0.09, 0, 1);
  }

  private formPartnerships(): void {
    const config = this.stateValue.config.relationships;
    for (const relationship of sortedRecordValues(this.stateValue.relationships)) {
      if (relationship.endedDay !== null) continue;
      if (relationship.kind !== 'romantic-interest' && relationship.kind !== 'close-friend') continue;
      const left = this.stateValue.people[relationship.personAId];
      const right = this.stateValue.people[relationship.personBId];
      if (left === undefined || right === undefined || !left.alive || !right.alive || !isAdult(left) || !isAdult(right)) continue;
      if (left.partnerId !== null || right.partnerId !== null) continue;
      if (this.currentDay - relationship.startedDay < config.matureRelationshipDays) continue;
      if (relationship.affinity < config.partnerAffinity || relationship.attraction < config.partnerAttraction || relationship.trust < config.partnerTrust) continue;
      const practicalBond = relationship.sharedWorkDays > 2 || relationship.dependency > 12 || relationship.encounters >= config.matureRelationshipDays;
      if (!practicalBond) continue;
      left.partnerId = right.id;
      right.partnerId = left.id;
      relationship.kind = 'partner';
      relationship.dependency = clamp(relationship.dependency + 20);
      this.mergePartnerHouseholds(left, right);
      this.addRelationshipMemory(relationship, { day: this.currentDay, delta: 12, summary: 'They formed a committed partnership.', type: 'partnership' });
      this.stateValue.counters.partnerships += 1;
      this.emit('partnership-formed', [left.id, right.id], `${left.name} and ${right.name} formed a partnership.`, {
        relationshipId: relationship.id,
      });
    }
  }

  private mergePartnerHouseholds(left: Person, right: Person): void {
    if (left.householdId !== null && left.householdId === right.householdId) return;
    const memberIds = new Set<PersonId>([left.id, right.id]);
    for (const person of [left, right]) {
      if (person.householdId === null) continue;
      const old = this.stateValue.households[person.householdId];
      if (old === undefined) continue;
      for (const id of old.memberIds) {
        const member = this.stateValue.people[id];
        if (member?.alive && (member.motherId === left.id || member.fatherId === left.id || member.motherId === right.id || member.fatherId === right.id)) {
          memberIds.add(id);
        }
      }
      old.memberIds = old.memberIds.filter((id) => !memberIds.has(id));
    }
    this.createHousehold([...memberIds].sort());
  }

  private considerReproduction(): void {
    const foodDays = this.foodReserveDays();
    const housingCapacity = this.housingCapacity();
    const housingSecurity = housingCapacity === 0 ? 0 : 1 - this.metricsWithoutSaveSize().homeless / Math.max(1, this.alivePeople().length);
    for (const mother of this.alivePeople()) {
      if (mother.biologicalSex !== 'female' || !isAdult(mother) || mother.pregnancy !== null || mother.partnerId === null) continue;
      const father = this.stateValue.people[mother.partnerId];
      if (father === undefined || !father.alive || father.biologicalSex !== 'male' || !isAdult(father)) continue;
      if (this.currentDay < mother.reproductiveCooldownUntil || this.currentDay < father.reproductiveCooldownUntil) continue;
      const relationship = this.stateValue.relationships[relationshipId(mother.id, father.id)];
      if (relationship === undefined || relationship.kind !== 'partner') continue;
      if (this.currentDay - relationship.startedDay < this.stateValue.config.relationships.matureRelationshipDays) continue;
      const config = this.stateValue.config.reproduction;
      if (housingSecurity < config.minimumHousingSecurity || foodDays < config.minimumFoodDays) continue;
      const council = this.primaryInstitution();
      const desire = (mother.traits.desireForChildren + father.traits.desireForChildren) / 200;
      const stability = (relationship.trust + relationship.affinity) / 200;
      const wealthSecurity = clamp((mother.wealth + father.wealth - mother.debt - father.debt + 30) / 130, 0.2, 1.25);
      const existingChildren = new Set([...mother.childrenIds, ...father.childrenIds]).size;
      const careerTradeoff = ((mother.occupation === 'researcher' || mother.occupation === 'organizer') ? 0.72 : 1) *
        ((father.occupation === 'researcher' || father.occupation === 'organizer') ? 0.84 : 1);
      const chance = clamp(
        config.baseConceptionChance * desire * stability * wealthSecurity * careerTradeoff *
        (1 + (council?.policy.birthIncentive ?? 0)) / (1 + existingChildren * 0.36),
        0,
        0.32,
      );
      if (!deterministicStream(this.streamSeed(), 'conception', this.currentDay, mother.id, father.id).bool(chance)) continue;
      const local = deterministicStream(this.streamSeed(), 'gestation', this.currentDay, mother.id, father.id);
      mother.pregnancy = {
        conceivedDay: this.currentDay,
        dueDay: this.currentDay + local.int(config.gestationDays.min, config.gestationDays.max),
        otherParentId: father.id,
      };
      this.stateValue.counters.pregnancies += 1;
      this.emit('pregnancy', [mother.id, father.id], `${mother.name} and ${father.name} are expecting a child.`, {
        dueDay: mother.pregnancy.dueDay,
      });
    }
  }

  private planConstruction(): void {
    const active = this.activeConstructionProjects();
    if (active.length >= this.stateValue.config.construction.maxConcurrentProjects) return;
    const alive = this.alivePeople().length;
    const housingRatio = alive / Math.max(1, this.housingCapacity());
    const queuedTypes = new Set(active.map((building) => building.type));
    const complete = this.completeBuildings();
    const completeCount = (type: BuildingType): number => complete.filter((building) => building.type === type).length;
    const equivalentAdults = this.alivePeople().reduce(
      (sum, person) => sum + (isAdult(person) ? 1 : this.stateValue.config.needs.childConsumptionScale),
      0,
    );
    const foodDemand = equivalentAdults * this.stateValue.config.needs.foodPerAdult;
    const waterDemand = equivalentAdults * this.stateValue.config.needs.waterPerAdult;
    const energyDemand = equivalentAdults * this.stateValue.config.needs.energyPerAdult;
    const futureCount = (type: BuildingType): number => completeCount(type) + active.filter((building) => building.type === type).length * 0.7;
    const projectedFood = futureCount('farm') * 16;
    const projectedWater = futureCount('well') * 82;
    const projectedEnergy = 28 + futureCount('power-station') * 48 +
      this.alivePeople().filter((person) => person.occupation === 'mechanic' || person.occupation === 'inventor').length * 0.9;
    const candidates: { value: BuildingType; weight: number; reason: string }[] = [];
    const addCandidate = (type: BuildingType, weight: number, reason: string): void => {
      if (weight <= 0 || queuedTypes.has(type)) return;
      const policyBonus = this.primaryInstitution()?.policy.constructionPriority === type ? 0.18 : 0;
      candidates.push({ value: type, weight: Math.max(0.01, weight + policyBonus), reason });
    };
    const foodCapacityGap = foodDemand <= 0 ? 0 : clamp((foodDemand * 1.12 - projectedFood) / (foodDemand * 1.12), 0, 1);
    const waterCapacityGap = waterDemand <= 0 ? 0 : clamp((waterDemand * 1.12 - projectedWater) / (waterDemand * 1.12), 0, 1);
    const energyCapacityGap = energyDemand <= 0 ? 0 : clamp((energyDemand * 1.12 - projectedEnergy) / (energyDemand * 1.12), 0, 1);
    addCandidate(
      'farm',
      Math.max(foodCapacityGap, clamp((this.stateValue.config.construction.foodReserveTriggerDays - this.foodReserveDays()) / 5, 0, 1)),
      'Food reserves and projected farm output are being compared with expected demand.',
    );
    addCandidate(
      'well',
      Math.max(waterCapacityGap, clamp((5 - this.waterReserveDays()) / 5, 0, 1)),
      'Water storage and the output of completed and active wells may not cover expected demand.',
    );
    addCandidate(
      'power-station',
      Math.max(energyCapacityGap, clamp((3 - this.energyReserveDays()) / 3, 0, 1)),
      'Stored energy and projected generation may not cover expected demand.',
    );
    addCandidate(
      'house',
      clamp((housingRatio - this.stateValue.config.construction.housingTriggerRatio) /
        Math.max(0.05, 1.2 - this.stateValue.config.construction.housingTriggerRatio), 0, 1.2),
      'Household formation and current occupancy are reducing available housing.',
    );
    if (alive >= 55 && completeCount('school') < Math.ceil(alive / 45)) {
      addCandidate('school', 0.34, 'Education capacity is falling behind the settlement population.');
    }
    if (alive >= 70 && completeCount('clinic') < Math.ceil(alive / 55)) {
      addCandidate('clinic', 0.38 + Math.max(0, this.stateValue.settlement.pressure.health) * 0.4, 'Care capacity and health pressure justify a clinic proposal.');
    }
    if (candidates.length === 0) return;
    const decision = deterministicStream(this.streamSeed(), 'construction-proposal', this.currentDay, this.stateValue.ids.building + 1);
    const selected = decision.weightedPick<{ type: BuildingType; reason: string } | null>([
      ...candidates.map((candidate) => ({
        value: { type: candidate.value, reason: candidate.reason },
        weight: candidate.weight,
      })),
      { value: null, weight: this.stateValue.config.construction.proposalDeferralWeight },
    ]);
    if (selected === null) return;
    const type = selected.type;
    const siteLocal = deterministicStream(this.streamSeed(), 'building-site', this.currentDay, type, this.stateValue.ids.building + 1);
    const position = findBuildingSite(siteLocal, type, sortedRecordValues(this.stateValue.buildings));
    if (position === null) return;
    const possibleProposers = this.alivePeople().filter((person) =>
      person.occupation === 'organizer' || person.occupation === 'builder' || person.occupation === 'laborer');
    const proposer = possibleProposers.length === 0
      ? undefined
      : decision.weightedPick(possibleProposers.map((person) => ({
        value: person,
        weight: 1 + person.influence.political / 20 + person.skills.construction / 35 + person.traits.ambition / 100,
      })));
    const commissioner = proposer?.id ?? this.primaryInstitution()?.id ?? null;
    const building = this.createBuilding(type, position, false, commissioner);
    this.emit('construction-proposed', [building.id, ...(proposer === undefined ? [] : [proposer.id])], `${proposer?.name ?? 'The civic council'} proposed ${building.name}.`, {
      reason: selected.reason,
      type,
    });
  }

  private progressConstruction(): void {
    const projects = this.activeConstructionProjects().slice(0, this.stateValue.config.construction.maxConcurrentProjects);
    const builders = this.alivePeople().filter((person) => person.currentTask === 'build' && isAdult(person));
    for (let projectIndex = 0; projectIndex < projects.length; projectIndex += 1) {
      const building = projects[projectIndex];
      if (building === undefined) continue;
      const assigned = builders.filter((person) =>
        this.constructionProjectFor(person, projects)?.id === building.id &&
        this.isAtTaskWorksite(person),
      );
      building.builderIds = assigned.map((person) => person.id).sort();
      const deliveryCapacity = assigned.length * this.stateValue.config.construction.materialDeliveryPerWorker;
      let deliveredTotal = 0;
      for (const resource of ['wood', 'stone', 'tools'] as const) {
        const need = building.requiredMaterials[resource] - building.deliveredMaterials[resource];
        const delivered = Math.min(need, this.stateValue.settlement.resources[resource], deliveryCapacity / 3);
        building.deliveredMaterials[resource] = round(building.deliveredMaterials[resource] + delivered);
        this.stateValue.settlement.resources[resource] = round(this.stateValue.settlement.resources[resource] - delivered);
        this.stateValue.settlement.dailyEconomy.consumption[resource] = round(
          this.stateValue.settlement.dailyEconomy.consumption[resource] + delivered,
        );
        deliveredTotal += delivered;
      }
      if (deliveredTotal > 0) {
        this.emit('material-delivered', [building.id, ...building.builderIds], `${round(deliveredTotal)} material units reached ${building.name}.`, {
          amount: round(deliveredTotal),
        });
      }
      const materialReady = materialFraction(building) >= (building.stageIndex + 1) / (CONSTRUCTION_STAGES.length - 1);
      if (assigned.length > 0 && materialReady) {
        const averageSkill = assigned.reduce((sum, person) => sum + person.skills.construction, 0) / assigned.length;
        const labor = assigned.length * this.stateValue.config.construction.laborPerWorker *
          (0.72 + averageSkill / 180) * this.stateValue.settlement.modifiers.constructionEfficiency *
          (1 - Math.max(0, this.stateValue.settlement.pressure.construction) * 0.3);
        building.laborCompleted = round(Math.min(building.laborRequired, building.laborCompleted + labor));
      }
      const progress = building.laborCompleted / building.laborRequired;
      const targetIndex = Math.min(CONSTRUCTION_STAGES.length - 1, Math.floor(progress * (CONSTRUCTION_STAGES.length - 1)));
      if (targetIndex > building.stageIndex) {
        for (let index = building.stageIndex + 1; index <= targetIndex; index += 1) {
          const stage = CONSTRUCTION_STAGES[index];
          if (stage === undefined) continue;
          building.stage = stage;
          building.stageIndex = index;
          building.stageProgress = progress;
          building.history.push({ day: this.currentDay, event: `Reached ${stage}`, personIds: [...building.builderIds] });
          this.emit('construction-stage', [building.id, ...building.builderIds], `${building.name} reached the ${stage.replaceAll('-', ' ')} stage.`, { stage });
        }
      }
      if (building.laborCompleted >= building.laborRequired && materialFraction(building) >= 0.999) {
        building.stage = 'complete';
        building.stageIndex = CONSTRUCTION_STAGES.length - 1;
        building.stageProgress = 1;
        building.condition = 100;
        this.stateValue.settlement.constructionQueue = this.stateValue.settlement.constructionQueue.filter((id) => id !== building.id);
        this.stateValue.counters.buildingsCompleted += 1;
        this.emit('building-completed', [building.id, ...building.builderIds], `${building.name} opened after physical construction.`, {
          type: building.type,
        });
      }
    }
  }

  private updateInstitutions(): void {
    this.maybeFoundInstitutions();
    for (const person of this.alivePeople()) person.followersIds = [];
    for (const institution of sortedRecordValues(this.stateValue.institutions)) {
      institution.memberIds = institution.memberIds.filter((id) => this.stateValue.people[id]?.alive).sort();
      if (institution.kind === 'council') institution.memberIds = this.alivePeople().filter(isAdult).map((person) => person.id);
      this.pruneInstitutionFollowers(institution);
      const needsElection = institution.leaderId === null || !this.stateValue.people[institution.leaderId]?.alive ||
        this.currentDay % this.stateValue.config.leadership.electionIntervalDays === 0;
      if (needsElection) this.electLeader(institution);
      this.synchronizeInstitutionFollowers(institution);
      this.updateInstitutionPolicy(institution);
      institution.corruption = clamp(institution.corruption + this.institutionCorruptionDelta(institution));
    }
  }

  private maybeFoundInstitutions(): void {
    const population = this.alivePeople().length;
    const existing = new Set(sortedRecordValues(this.stateValue.institutions).map((institution) => institution.kind));
    const definitions: readonly { kind: InstitutionKind; threshold: number; occupations: Occupation[]; name: string }[] = [
      { kind: 'builders-guild', threshold: 28, occupations: ['builder', 'laborer', 'mechanic'], name: 'Confluence Builders Guild' },
      { kind: 'trade-cooperative', threshold: 36, occupations: ['trader', 'farmer'], name: 'Open Market Cooperative' },
      { kind: 'research-circle', threshold: 44, occupations: ['researcher', 'inventor', 'teacher'], name: 'Current Research Circle' },
      { kind: 'school', threshold: 50, occupations: ['teacher', 'caregiver'], name: 'Common Learning Assembly' },
      { kind: 'clinic', threshold: 58, occupations: ['healer', 'caregiver'], name: 'Confluence Care Trust' },
    ];
    for (const definition of definitions) {
      if (population < definition.threshold || existing.has(definition.kind)) continue;
      const founders = this.alivePeople().filter((person) => definition.occupations.includes(person.occupation)).slice(0, 5).map((person) => person.id);
      if (founders.length < 2) continue;
      const institution = this.createInstitution(definition.kind, definition.name, founders);
      institution.memberIds = this.alivePeople().filter((person) => definition.occupations.includes(person.occupation)).map((person) => person.id);
      this.stateValue.settlement.institutionIds.push(institution.id);
      this.stateValue.settlement.institutionIds.sort();
      existing.add(definition.kind);
    }
  }

  private electLeader(institution: Institution): void {
    const candidates = institution.memberIds
      .map((id) => this.stateValue.people[id])
      .filter((person): person is Person => person !== undefined && person.alive && isAdult(person))
      .sort((left, right) => this.leadershipPotential(right) - this.leadershipPotential(left) || left.id.localeCompare(right.id))
      .slice(0, 8);
    if (candidates.length === 0) {
      institution.leaderId = null;
      institution.followerCandidateIds = {};
      institution.followerLoyalty = {};
      return;
    }
    const support = new Map<PersonId, { count: number; loyalty: number }>();
    institution.followerCandidateIds = {};
    institution.followerLoyalty = {};
    for (const memberId of institution.memberIds) {
      const member = this.stateValue.people[memberId];
      if (member === undefined || !member.alive) continue;
      const choice = candidates
        .filter((candidate) => candidate.id !== member.id)
        .map((candidate) => ({ candidate, score: this.followScore(member, candidate, institution) }))
        .sort((left, right) => right.score - left.score || left.candidate.id.localeCompare(right.candidate.id))[0];
      // "Lack of alternatives" is a real follow reason: a leaderless
      // institution lowers the bar people apply to imperfect candidates,
      // which lets a settlement of strangers rebuild leadership after a
      // founding generation dies out.
      const trustThreshold = this.stateValue.config.leadership.followerTrust -
        (institution.leaderId === null ? 10 : 0);
      if (choice === undefined || choice.score < trustThreshold) continue;
      institution.followerCandidateIds[member.id] = choice.candidate.id;
      institution.followerLoyalty[member.id] = round(choice.score);
      const record = support.get(choice.candidate.id) ?? { count: 0, loyalty: 0 };
      record.count += 1;
      record.loyalty += choice.score;
      support.set(choice.candidate.id, record);
    }
    const winner = candidates
      .map((candidate) => ({ candidate, support: support.get(candidate.id) ?? { count: 0, loyalty: 0 } }))
      .filter((entry) => entry.support.count >= this.stateValue.config.leadership.minimumFollowers)
      .sort((left, right) =>
        right.support.count - left.support.count ||
        right.support.loyalty - left.support.loyalty ||
        this.leadershipPotential(right.candidate) - this.leadershipPotential(left.candidate) ||
        left.candidate.id.localeCompare(right.candidate.id),
      )[0];
    const previous = institution.leaderId;
    institution.leaderId = winner?.candidate.id ?? null;
    if (institution.leaderId !== null) {
      const leader = this.stateValue.people[institution.leaderId];
      if (leader !== undefined) {
        leader.influence.political = clamp(leader.influence.political + 4);
        leader.historicalSignificance += 2;
      }
    }
    if (previous !== institution.leaderId) {
      const leaderName = institution.leaderId === null ? 'no successor' : this.stateValue.people[institution.leaderId]?.name ?? institution.leaderId;
      this.emit('leadership-changed', [institution.id, ...(institution.leaderId === null ? [] : [institution.leaderId])], `${institution.name} selected ${leaderName} as leader.`, {
        previousLeaderId: previous,
        leaderId: institution.leaderId,
      });
    }
  }

  private pruneInstitutionFollowers(institution: Institution): void {
    const members = new Set(institution.memberIds);
    for (const followerId of Object.keys(institution.followerCandidateIds).sort()) {
      const candidateId = institution.followerCandidateIds[followerId];
      const follower = this.stateValue.people[followerId];
      const candidate = candidateId === undefined ? undefined : this.stateValue.people[candidateId];
      if (
        follower === undefined || !follower.alive || !members.has(followerId) ||
        candidate === undefined || !candidate.alive || !members.has(candidate.id) ||
        follower.id === candidate.id
      ) {
        delete institution.followerCandidateIds[followerId];
        delete institution.followerLoyalty[followerId];
      }
    }
    for (const followerId of Object.keys(institution.followerLoyalty).sort()) {
      if (institution.followerCandidateIds[followerId] === undefined) delete institution.followerLoyalty[followerId];
    }
  }

  private synchronizeInstitutionFollowers(institution: Institution): void {
    for (const [followerId, candidateId] of Object.entries(institution.followerCandidateIds).sort(([left], [right]) => left.localeCompare(right))) {
      const candidate = this.stateValue.people[candidateId];
      if (candidate !== undefined && candidate.alive && followerId !== candidateId && !candidate.followersIds.includes(followerId)) {
        candidate.followersIds.push(followerId);
        candidate.followersIds.sort();
      }
    }
  }

  private leadershipPotential(person: Person): number {
    const rareBonus = person.rarePotential === 'strong-leader' ? 18 : person.rarePotential === 'power-seeker' ? 15 : person.rarePotential === 'exceptional' ? 22 : 0;
    return person.traits.charisma * 0.22 + person.traits.strategicThinking * 0.2 + person.traits.ambition * 0.13 +
      person.traits.empathy * 0.1 + person.skills.governance * 0.18 + person.influence.social * 0.1 +
      person.influence.economic * 0.07 + rareBonus + (person.lastTaskSuccess ? 4 : 0);
  }

  private followScore(follower: Person, candidate: Person, institution: Institution): number {
    const relationship = this.stateValue.relationships[relationshipId(follower.id, candidate.id)];
    // People who never met a candidate personally can still follow them by
    // reputation: visible influence and past significance substitute for
    // first-hand trust once a settlement outgrows personal acquaintance.
    const reputation = clamp(
      24 + candidate.influence.social * 0.35 + candidate.influence.political * 0.3 +
      Math.min(20, candidate.historicalSignificance * 0.5),
      0,
      72,
    );
    const trust = relationship?.trust ?? reputation;
    const sharedBelief = 100 - Math.abs(follower.traits.politicalDrive - candidate.traits.politicalDrive);
    const materialBenefit = follower.employerId === institution.id ? 12 : 0;
    const fear = candidate.traits.desireForControl * follower.traits.riskTolerance / 500;
    return clamp(trust * 0.42 + candidate.traits.charisma * 0.19 + sharedBelief * 0.12 +
      candidate.influence.social * 0.12 + candidate.influence.economic * 0.08 + materialBenefit + fear * 0.07);
  }

  private updateInstitutionPolicy(institution: Institution): void {
    const leader = institution.leaderId === null ? undefined : this.stateValue.people[institution.leaderId];
    const pressure = this.stateValue.settlement.pressure;
    institution.policy.foodSubsidy = clamp(0.06 + Math.max(0, pressure.food) * 0.45 + (leader?.traits.empathy ?? 50) / 500, 0, 0.8);
    institution.policy.educationFunding = clamp(0.08 + Math.max(0, pressure.knowledge) * 0.35 + (leader?.traits.curiosity ?? 50) / 600, 0, 0.7);
    institution.policy.birthIncentive = clamp((this.housingCapacity() - this.alivePeople().length) / Math.max(20, this.housingCapacity()) * 0.25 - Math.max(0, pressure.food) * 0.2, -0.25, 0.35);
    institution.policy.wealthRedistribution = clamp((leader?.traits.empathy ?? 50) / 300 - (leader?.traits.desireForControl ?? 30) / 700, 0, 0.5);
    institution.policy.informationOpenness = clamp(0.45 + (leader?.traits.moralConcern ?? 50) / 250 - (leader?.traits.desireForControl ?? 30) / 180, 0.08, 0.95);
    institution.policy.constructionPriority = pressure.food > pressure.construction ? 'farm' : this.alivePeople().length > this.housingCapacity() * 0.85 ? 'house' : 'workshop';
  }

  private institutionCorruptionDelta(institution: Institution): number {
    const leader = institution.leaderId === null ? undefined : this.stateValue.people[institution.leaderId];
    if (leader === undefined) return -0.08;
    const temptation = (leader.traits.desireForPower + leader.traits.desireForControl - leader.traits.moralConcern - leader.traits.empathy) / 950;
    const accountability = institution.policy.informationOpenness / 8 + institution.legitimacy / 900;
    return temptation - accountability + (leader.followersIds.length > 12 ? 0.03 : 0);
  }

  private updateBreakthroughs(): void {
    if (this.currentDay % this.stateValue.config.breakthroughs.attemptIntervalDays === 0) this.startBreakthroughAttempts();
    for (const breakthrough of sortedRecordValues(this.stateValue.breakthroughs)) {
      if (breakthrough.stage === 'adopted' || breakthrough.stage === 'failed') continue;
      const inventors = breakthrough.inventorIds
        .map((id) => this.stateValue.people[id])
        .filter((person): person is Person => person !== undefined && person.alive);
      if (inventors.length === 0) {
        breakthrough.stage = 'failed';
        breakthrough.history.push(`Failed on day ${this.currentDay} after all contributors were lost.`);
        this.emit('breakthrough-failed', [breakthrough.id], `${breakthrough.title} was abandoned after its contributors were lost.`, { failures: breakthrough.failures });
        continue;
      }
      const local = deterministicStream(this.deepStreamSeed(), 'breakthrough-progress', this.currentDay, breakthrough.id);
      const averageKnowledge = inventors.reduce((sum, person) => sum + person.knowledge, 0) / inventors.length;
      const crossDomain = new Set(inventors.flatMap((person) => person.interests)).size;
      const institutionSupport = breakthrough.institutionId === null ? 0 : (this.stateValue.institutions[breakthrough.institutionId]?.treasury ?? 0) > 30 ? 2 : 0;
      if (breakthrough.stage !== 'demonstrated' && local.bool(this.stateValue.config.breakthroughs.failureChance * (1 - averageKnowledge / 180))) {
        breakthrough.failures += 1;
        breakthrough.progress = Math.max(0, breakthrough.progress - local.int(2, 6));
        breakthrough.history.push(`Experiment failed on day ${this.currentDay}.`);
        if (breakthrough.failures >= 4) {
          breakthrough.stage = 'failed';
          this.emit('breakthrough-failed', [breakthrough.id, ...breakthrough.inventorIds], `${breakthrough.title} failed after repeated experiments.`, { failures: breakthrough.failures });
        }
        continue;
      }
      if (breakthrough.stage === 'demonstrated') {
        const socialReach = inventors.reduce((sum, person) => sum + person.influence.social + person.influence.technical, 0) / inventors.length;
        breakthrough.adoption = clamp(breakthrough.adoption + 3 + socialReach / 28 + institutionSupport);
        if (breakthrough.adoption >= 60) this.adoptBreakthrough(breakthrough);
        continue;
      }
      const progress = this.stateValue.config.breakthroughs.baseProgress * (0.5 + averageKnowledge / 150) *
        (0.8 + crossDomain / 8) + institutionSupport;
      breakthrough.progress = clamp(breakthrough.progress + progress);
      breakthrough.lastProgressDay = this.currentDay;
      const previousStage = breakthrough.stage;
      if (breakthrough.progress >= 80) breakthrough.stage = 'demonstrated';
      else if (breakthrough.progress >= 58) breakthrough.stage = 'trial';
      else if (breakthrough.progress >= 34) breakthrough.stage = 'prototype';
      else if (breakthrough.progress >= 15) breakthrough.stage = 'hypothesis';
      if (previousStage !== breakthrough.stage) {
        breakthrough.history.push(`Reached ${breakthrough.stage} on day ${this.currentDay}.`);
        this.emit('breakthrough-progress', [breakthrough.id, ...breakthrough.inventorIds], `${breakthrough.title} reached the ${breakthrough.stage} stage.`, {
          stage: breakthrough.stage,
        });
      }
    }
  }

  private startBreakthroughAttempts(): void {
    const activeInventors = new Set(sortedRecordValues(this.stateValue.breakthroughs)
      .filter((breakthrough) => breakthrough.stage !== 'adopted' && breakthrough.stage !== 'failed')
      .flatMap((breakthrough) => breakthrough.inventorIds));
    const candidates = this.alivePeople()
      .filter((person) => isAdult(person) && !activeInventors.has(person.id))
      .filter((person) => {
        const crossDomainAptitudes = SKILL_DOMAINS.filter((domain) => person.aptitudes[domain] >= 52).length;
        const rare = person.rarePotential === 'polymath' || person.rarePotential === 'exceptional';
        return (rare || crossDomainAptitudes >= 2) &&
          person.knowledge >= this.stateValue.config.breakthroughs.minimumKnowledge - (rare ? 16 : 0);
      })
      .sort((left, right) => this.breakthroughPotential(right) - this.breakthroughPotential(left) || left.id.localeCompare(right.id));
    const inventor = candidates[0];
    if (inventor === undefined || this.stateValue.settlement.resources.tools < 3 || this.stateValue.settlement.resources.energy < 6) return;
    const problem = pressureEntries(this.stateValue.settlement.pressure)
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0]?.[0] ?? 'knowledge';
    const domain = domainForProblem(problem);
    const collaborators = this.alivePeople()
      .filter((person) => person.id !== inventor.id && isAdult(person))
      .map((person) => ({ person, score: this.collaborationScore(inventor, person) }))
      .filter((entry) => entry.score >= 54)
      .sort((left, right) => right.score - left.score || left.person.id.localeCompare(right.person.id))
      .slice(0, 2)
      .map((entry) => entry.person.id);
    this.stateValue.ids.breakthrough += 1;
    const id = `breakthrough:${this.stateValue.ids.breakthrough.toString().padStart(4, '0')}`;
    const titles: Record<BreakthroughDomain, string> = {
      agriculture: 'Resilient Field Cycle', communication: 'Open Signal Ledger', construction: 'Interlocking Frame Method',
      education: 'Distributed Apprenticeship', energy: 'Recaptured Current System', finance: 'Mutual Risk Ledger',
      governance: 'Participatory Provision Charter', medicine: 'Community Triage Protocol',
      transportation: 'Adaptive Freight Routing', water: 'Layered Water Recovery',
    };
    const institution = sortedRecordValues(this.stateValue.institutions).find((candidate) => candidate.kind === 'research-circle') ?? this.primaryInstitution();
    const breakthrough: Breakthrough = {
      id,
      domain,
      title: titles[domain],
      inventorIds: [inventor.id, ...collaborators].sort(),
      institutionId: institution?.id ?? null,
      problem,
      startedDay: this.currentDay,
      lastProgressDay: this.currentDay,
      stage: 'idea',
      progress: 4,
      failures: 0,
      resourceInvestment: 9,
      adoption: 0,
      effects: effectsForDomain(domain),
      harmfulSideEffect: domain === 'energy' ? 'health' : domain === 'transportation' ? 'health' : domain === 'finance' ? 'trade' : null,
      history: [`Idea formed on day ${this.currentDay} in response to ${problem} pressure.`],
    };
    this.stateValue.breakthroughs[id] = breakthrough;
    this.stateValue.settlement.resources.tools -= 3;
    this.stateValue.settlement.resources.energy -= 6;
    this.stateValue.counters.breakthroughAttempts += 1;
    inventor.historicalSignificance += 1;
    this.emit('breakthrough-attempt', [id, ...breakthrough.inventorIds], `${inventor.name} began ${breakthrough.title} with ${collaborators.length} collaborator(s).`, {
      domain,
      problem,
    });
  }

  private breakthroughPotential(person: Person): number {
    const topSkills = SKILL_DOMAINS.map((domain) => person.skills[domain]).sort((a, b) => b - a).slice(0, 4);
    const rareBonus = person.rarePotential === 'exceptional' ? 30 : person.rarePotential === 'polymath' ? 22 : 0;
    return person.knowledge * 0.4 + topSkills.reduce((sum, value) => sum + value, 0) * 0.12 +
      person.traits.curiosity * 0.18 + person.traits.patience * 0.08 + rareBonus;
  }

  private collaborationScore(inventor: Person, candidate: Person): number {
    const relationship = this.stateValue.relationships[relationshipId(inventor.id, candidate.id)];
    const complementary = candidate.interests.filter((interest) => !inventor.interests.includes(interest)).length;
    return (relationship?.trust ?? 28) * 0.48 + candidate.knowledge * 0.24 + complementary * 9 + candidate.traits.patience * 0.1;
  }

  private adoptBreakthrough(breakthrough: Breakthrough): void {
    breakthrough.stage = 'adopted';
    breakthrough.adoption = 100;
    breakthrough.history.push(`Adopted on day ${this.currentDay}.`);
    const effects = breakthrough.effects;
    const modifiers = this.stateValue.settlement.modifiers;
    modifiers.constructionEfficiency = round(modifiers.constructionEfficiency * effects.constructionEfficiency);
    modifiers.energyEfficiency = round(modifiers.energyEfficiency * effects.energyEfficiency);
    modifiers.foodYield = round(modifiers.foodYield * effects.foodYield);
    modifiers.healthCapacity = round(modifiers.healthCapacity * effects.healthCapacity);
    modifiers.knowledgeGrowth = round(modifiers.knowledgeGrowth * effects.knowledgeGrowth);
    modifiers.tradeEfficiency = round(modifiers.tradeEfficiency * effects.tradeEfficiency);
    modifiers.waterYield = round(modifiers.waterYield * effects.waterYield);
    if (breakthrough.harmfulSideEffect !== null) {
      this.stateValue.settlement.pressure[breakthrough.harmfulSideEffect] = clamp(
        this.stateValue.settlement.pressure[breakthrough.harmfulSideEffect] + 0.08,
        -1,
        1,
      );
    }
    for (const inventorId of breakthrough.inventorIds) {
      const inventor = this.stateValue.people[inventorId];
      if (inventor === undefined) continue;
      inventor.influence.technical = clamp(inventor.influence.technical + 18);
      inventor.historicalSignificance += 15;
    }
    this.stateValue.counters.breakthroughAdoptions += 1;
    this.emit('breakthrough-adopted', [breakthrough.id, ...breakthrough.inventorIds], `${breakthrough.title} was adopted after demonstration and social persuasion.`, {
      domain: breakthrough.domain,
    });
  }

  private updateMovement(): void {
    const obstacles: PlacementObstacle[] = sortedRecordValues(this.stateValue.buildings)
      .filter((building) => building.type !== 'road')
      .map((building) => ({ type: building.type, position: { x: building.position.x, z: building.position.z } }));
    for (const person of this.alivePeople()) {
      person.previousPosition = cloneSerializable(person.position);
      const dx = person.destination.x - person.position.x;
      const dz = person.destination.z - person.position.z;
      const distance = Math.sqrt(dx * dx + dz * dz);
      const ageFactor = person.lifeStage === 'child' ? 0.68 : person.lifeStage === 'elder' ? 0.62 : person.lifeStage === 'older-adult' ? 0.82 : 1;
      const healthFactor = 0.45 + person.health / 180;
      const step = Math.min(distance, DAILY_TRAVEL_METERS * ageFactor * healthFactor);
      if (distance > 0.0001) {
        const stepped = resolveTravelerPosition(
          {
            x: person.position.x + dx / distance * step,
            z: person.position.z + dz / distance * step,
          },
          person.destination,
          obstacles,
        );
        person.position.x = round(stepped.x);
        person.position.z = round(stepped.z);
        person.yaw = round(Math.atan2(dx, dz));
      }
    }
  }

  private updatePersonalGrowth(): void {
    for (const person of this.alivePeople()) {
      if (person.currentTask === 'learn') {
        const school = this.buildingForTask(person, 'learn');
        if (school !== undefined && distanceSquared(person.position, school.position) <= TASK_SITE_RADIUS_METERS ** 2) {
          const teachers = this.alivePeople().filter((candidate) =>
            candidate.occupation === 'teacher' && candidate.currentTask === 'work' && this.isAtTaskWorksite(candidate),
          ).length;
          person.knowledge = clamp(person.knowledge + (0.28 + teachers * 0.08) * this.stateValue.settlement.modifiers.knowledgeGrowth);
          const interest = person.interests[(this.currentDay + Number.parseInt(person.id.slice(-2), 10)) % person.interests.length];
          if (interest !== undefined) person.skills[interest] = clamp(person.skills[interest] + 0.22);
        }
      }
      if (person.lastTaskSuccess) {
        person.influence.social = clamp(person.influence.social + 0.08 + person.traits.charisma / 1000);
        person.influence.economic = clamp(person.influence.economic + Math.max(0, person.wealth - 50) / 10_000);
        if (person.currentTask === 'research') person.influence.technical = clamp(person.influence.technical + 0.18);
        if (person.currentTask === 'govern') person.influence.political = clamp(person.influence.political + 0.16);
      }
      person.historicalSignificance = round(person.historicalSignificance + person.followersIds.length * 0.01);
    }
  }

  private updateLegacyArtifacts(): void {
    const investigators = this.alivePeople()
      .filter((person) => isAdult(person) && person.lastTaskSuccess && (
        person.occupation === 'explorer' || person.occupation === 'researcher' || person.occupation === 'inventor'
      ))
      .sort((left, right) => left.id.localeCompare(right.id));
    for (const artifact of sortedRecordValues(this.stateValue.artifacts)) {
      if (artifact.discoveredDay !== null || investigators.length === 0) continue;
      const local = deterministicStream(this.deepStreamSeed(), 'artifact-discovery', this.currentDay, artifact.id);
      const investigator = local.pick(investigators);
      const chance = clamp(0.002 + (investigator.traits.curiosity + investigator.knowledge) / 15_000, 0.002, 0.03);
      if (!local.bool(chance)) continue;
      artifact.discoveredDay = this.currentDay;
      artifact.discoveredById = investigator.id;
      artifact.studiedByIds = [investigator.id];
      this.emit(
        'artifact-discovered',
        [artifact.id, investigator.id],
        `${investigator.name} recognized ${artifact.name.toLowerCase()} as material from Era Zero.`,
        { domains: artifact.domains.join(','), sourceEra: artifact.sourceEra },
      );
      this.addPersonMemory(investigator, {
        day: this.currentDay,
        importance: 82,
        subjectId: artifact.id,
        summary: `Discovered ${artifact.name}.`,
        type: 'discovery',
      });
    }

    const discovered = sortedRecordValues(this.stateValue.artifacts)
      .filter((artifact) => artifact.discoveredDay !== null);
    if (discovered.length === 0) return;
    const researchers = investigators.filter((person) =>
      person.currentTask === 'research' && (person.occupation === 'researcher' || person.occupation === 'inventor'),
    );
    for (const researcher of researchers) {
      const artifact = discovered[this.personAssignmentIndex(researcher, discovered.length)];
      if (artifact === undefined) continue;
      const effort = round(0.35 + researcher.knowledge / 220);
      const previousStudyDays = artifact.studyDays;
      artifact.studyDays = round(artifact.studyDays + effort);
      this.stateValue.counters.artifactStudyDays = round(this.stateValue.counters.artifactStudyDays + effort);
      if (!artifact.studiedByIds.includes(researcher.id)) artifact.studiedByIds.push(researcher.id);
      artifact.studiedByIds.sort();
      researcher.knowledge = clamp(researcher.knowledge + 0.08 * effort);
      for (const domain of artifact.domains) {
        researcher.skills[domain] = clamp(researcher.skills[domain] + 0.035 * effort);
      }
      const previousMilestone = Math.floor(previousStudyDays / 25);
      const currentMilestone = Math.floor(artifact.studyDays / 25);
      if (currentMilestone > previousMilestone) {
        this.emit(
          'artifact-studied',
          [artifact.id, researcher.id],
          `Study of ${artifact.name.toLowerCase()} connected Era Zero evidence to present knowledge.`,
          { studyDays: round(artifact.studyDays) },
        );
      }
    }
  }

  private updateSignalPressures(): void {
    const pressure = emptyPressure();
    const active: ActiveSignal[] = [];
    for (const activeSignal of this.stateValue.activeSignals) {
      const signal = activeSignal.signal;
      if (this.currentDay < signal.effectiveDay) {
        active.push(activeSignal);
        continue;
      }
      const age = this.currentDay - signal.effectiveDay;
      const lifetime = signal.durationDays + signal.halfLifeDays * 6;
      if (age > lifetime) continue;
      active.push(activeSignal);
      const decayAge = Math.max(0, age - signal.durationDays);
      const decay = 2 ** (-decayAge / signal.halfLifeDays);
      const evidence = signal.intensity * signal.confidence * (0.45 + signal.sourceAgreement * 0.55) *
        (0.72 + signal.novelty * 0.28) * decay;
      for (const [axis, value] of Object.entries(signal.objectivePressure) as [PressureAxis, number][]) {
        pressure[axis] += value * evidence;
      }
      for (const [axis, value] of Object.entries(signal.beliefPressure) as [PressureAxis, number][]) {
        const openness = this.primaryInstitution()?.policy.informationOpenness ?? 0.6;
        pressure[axis] += value * evidence * 0.38 * openness;
      }
    }
    const environment = summarizeEnvironment(this.completeBuildings());
    const wastePerResident = this.stateValue.settlement.waste / Math.max(1, this.alivePeople().length);
    const unsafeWater = clamp((72 - this.stateValue.settlement.drinkingWaterQuality) / 72, 0, 1);
    pressure.food += clamp((5 - this.foodReserveDays()) / 5, 0, 1) * 0.8;
    pressure.water += clamp((5 - this.waterReserveDays()) / 5, 0, 1) * 0.8;
    pressure.energy += clamp((3 - this.energyReserveDays()) / 3, 0, 1) * 0.85;
    pressure.water += unsafeWater * 0.55;
    pressure.health += clamp(
      wastePerResident * 0.12 + environment.averageContamination / 100 * 0.5,
      0,
      0.75,
    );
    for (const [axis, value] of pressureEntries(pressure)) pressure[axis] = round(clamp(value, -1, 1));
    this.stateValue.activeSignals = active.sort((a, b) => a.signal.id.localeCompare(b.signal.id));
    this.stateValue.settlement.pressure = pressure;
    this.stateValue.settlement.safety = clamp(this.stateValue.settlement.safety - pressure.safety * 2.2 - pressure.health * 0.5 + 0.2);
    this.stateValue.settlement.publicTrust = clamp(this.stateValue.settlement.publicTrust - Math.max(0, pressure.sentiment) * 1.3 + Math.max(0, -pressure.sentiment) * 0.4);
  }

  private resolveDueInterventions(): void {
    for (const record of this.stateValue.interventions) {
      if (record.resolvedDay !== null || record.intervention.effectiveDay > this.currentDay) continue;
      const intervention = record.intervention;
      const council = this.primaryInstitution();
      const corruption = (council?.corruption ?? 0) / 100;
      const local = deterministicStream(this.deepStreamSeed(), 'intervention', intervention.id);
      let outcome: string;
      if (intervention.kind === 'help') {
        const diversion = clamp(corruption * (0.3 + local.float() * 0.5), 0, 0.7);
        const delivered = intervention.amount * (1 - diversion);
        outcome = this.applyHelp(intervention, delivered, diversion);
      } else if (intervention.kind === 'spice') {
        outcome = this.applySpice(intervention);
      } else {
        outcome = this.applySabotage(intervention, local);
      }
      record.resolvedDay = this.currentDay;
      record.outcome = outcome;
      this.emit('intervention-resolved', [SETTLEMENT_ID], outcome, {
        interventionId: intervention.id,
        kind: intervention.kind,
        payload: intervention.payloadType,
      });
    }
  }

  private applyHelp(intervention: ObserverIntervention, delivered: number, diversion: number): string {
    const resourceMap: Partial<Record<ObserverIntervention['payloadType'], ResourceKind>> = {
      food: 'food', water: 'water', medicine: 'medicine', 'construction-materials': 'wood', 'emergency-energy': 'energy',
    };
    const resource = resourceMap[intervention.payloadType];
    if (resource !== undefined) this.stateValue.settlement.resources[resource] += delivered;
    if (intervention.payloadType === 'construction-materials') {
      this.stateValue.settlement.resources.stone += delivered * 0.55;
      this.stateValue.settlement.resources.tools += delivered * 0.12;
    } else if (intervention.payloadType === 'debt-relief') {
      const relief = Math.min(delivered, this.stateValue.settlement.debt);
      this.stateValue.settlement.debt -= relief;
    } else if (intervention.payloadType === 'education-funding') {
      const school = sortedRecordValues(this.stateValue.institutions).find((institution) => institution.kind === 'school');
      if (school !== undefined) school.treasury += delivered;
      this.stateValue.settlement.pressure.knowledge = clamp(this.stateValue.settlement.pressure.knowledge - intervention.intensity * 0.2, -1, 1);
    } else if (intervention.payloadType === 'skilled-arrivals') {
      const count = Math.max(1, Math.min(3, Math.floor(delivered / 20)));
      for (let index = 0; index < count; index += 1) {
        const entrant = this.createPerson('entrant', this.currentDay, null, null);
        entrant.knowledge = clamp(entrant.knowledge + 22);
        this.createHousehold([entrant.id]);
        this.emit('arrival', [entrant.id], `${entrant.name} arrived through an observer-supported migration program.`, { guaranteed: false, profile: entrant.emergenceProfile });
      }
    }
    const diverted = round(intervention.amount * diversion);
    if (diverted > 0) {
      const leader = this.primaryInstitution()?.leaderId;
      if (leader !== null && leader !== undefined) {
        const person = this.stateValue.people[leader];
        if (person !== undefined) person.wealth += diverted;
      }
    }
    return `${intervention.payloadType.replaceAll('-', ' ')} assistance delivered ${round(delivered)} units; ${diverted} were diverted through existing power networks.`;
  }

  private applySpice(intervention: ObserverIntervention): string {
    const amount = clamp(intervention.intensity, 0, 1);
    if (intervention.payloadType === 'festival' || intervention.payloadType === 'art-movement') {
      for (const person of this.alivePeople()) {
        person.needs.social = clamp(person.needs.social + 8 * amount);
        person.emotion = clamp(person.emotion + 6 * amount);
        person.influence.cultural = clamp(person.influence.cultural + (person.occupation === 'artist' ? 2 : 0.2) * amount);
      }
      this.stateValue.settlement.modifiers.socialCohesion = round(clamp(this.stateValue.settlement.modifiers.socialCohesion + 0.03 * amount, 0.7, 1.5));
    } else if (intervention.payloadType === 'experimental-technology' || intervention.payloadType === 'rare-discovery') {
      this.stateValue.settlement.pressure.knowledge = clamp(this.stateValue.settlement.pressure.knowledge - 0.16 * amount, -1, 1);
      this.stateValue.settlement.resources.tools += intervention.amount * 0.2;
    } else {
      this.stateValue.settlement.pressure.sentiment = clamp(this.stateValue.settlement.pressure.sentiment + (amount - 0.5) * 0.2, -1, 1);
    }
    return `${intervention.payloadType.replaceAll('-', ' ')} altered social attention; residents still chose their own response.`;
  }

  private applySabotage(intervention: ObserverIntervention, local: DeterministicRng): string {
    const damage = intervention.amount * clamp(intervention.intensity, 0, 1);
    let outcomeDetail = '';
    switch (intervention.payloadType) {
      case 'contamination': {
        this.stateValue.settlement.resources.water = Math.max(0, this.stateValue.settlement.resources.water - damage);
        this.stateValue.settlement.pressure.health = clamp(this.stateValue.settlement.pressure.health + intervention.intensity * 0.35, -1, 1);
        const wells = this.completeBuildings().filter((building) => building.type === 'well');
        const target = wells.length === 0 ? undefined : local.pick(wells);
        if (target !== undefined) {
          const previousStatus = target.environment.status;
          target.environment.contamination = round(clamp(target.environment.contamination + damage * 0.8));
          target.environment.waterQuality = round(clamp(target.environment.waterQuality - damage * 0.55));
          target.environment.wasteLoad = round(Math.max(0, target.environment.wasteLoad + damage * 0.1));
          target.environment.status = environmentalStatus(target.environment, target.type, previousStatus);
          this.stateValue.settlement.waste = round(sortedRecordValues(this.stateValue.buildings)
            .reduce((sum, building) => sum + building.environment.wasteLoad, 0));
          const statusChange = compareEnvironmentalStatus(previousStatus, target.environment.status);
          if (statusChange > 0) {
            this.emit(
              'environment-degraded',
              [target.id],
              `${target.name} became ${target.environment.status} after local water contamination.`,
              {
                contamination: target.environment.contamination,
                waterQuality: target.environment.waterQuality,
              },
            );
            target.history.push({
              day: this.currentDay,
              event: `Local environment became ${target.environment.status} after contamination`,
              personIds: [],
            });
          }
          outcomeDetail = ` It directly damaged ${target.name}'s water quality.`;
        }
        break;
      }
      case 'infrastructure-failure': {
        const targets = this.completeBuildings().filter((building) => building.type !== 'house');
        const target = targets.length === 0 ? undefined : local.pick(targets);
        if (target !== undefined) target.condition = clamp(target.condition - damage);
        break;
      }
      case 'trade-obstruction':
        this.stateValue.settlement.pressure.trade = clamp(this.stateValue.settlement.pressure.trade + intervention.intensity * 0.5, -1, 1);
        this.stateValue.settlement.resources.transport = Math.max(0, this.stateValue.settlement.resources.transport - damage * 0.2);
        break;
      case 'false-information': case 'rumor': case 'mysterious-broadcast':
        this.stateValue.settlement.pressure.sentiment = clamp(this.stateValue.settlement.pressure.sentiment + intervention.intensity * 0.45, -1, 1);
        this.stateValue.settlement.publicTrust = clamp(this.stateValue.settlement.publicTrust - damage * 0.08);
        break;
      default:
        this.stateValue.settlement.pressure.safety = clamp(this.stateValue.settlement.pressure.safety + intervention.intensity * 0.28, -1, 1);
        break;
    }
    if (this.stateValue.settlement.publicTrust < 35) {
      this.stateValue.settlement.modifiers.socialCohesion = round(clamp(this.stateValue.settlement.modifiers.socialCohesion + 0.02, 0.7, 1.5));
      return `${intervention.payloadType.replaceAll('-', ' ')} caused damage but also provoked an observable cooperative response.${outcomeDetail}`;
    }
    return `${intervention.payloadType.replaceAll('-', ' ')} entered the causal economy as damage, scarcity, and contested information.${outcomeDetail}`;
  }

  private depositWasteLoad(
    amount: number,
    weightedSources: readonly { site: Building; weight: number }[],
    sites: readonly Building[],
  ): void {
    if (amount <= 0 || weightedSources.length === 0) return;
    const sources = [...weightedSources]
      .filter(({ weight }) => weight > 0)
      .sort((left, right) => left.site.id.localeCompare(right.site.id));
    const totalSourceWeight = sources.reduce((sum, source) => sum + source.weight, 0);
    if (totalSourceWeight <= 0) return;
    const additions = new Map<BuildingId, number>();
    const add = (site: Building, value: number): void => {
      additions.set(site.id, (additions.get(site.id) ?? 0) + value);
    };
    for (const source of sources) {
      const sourceAmount = amount * source.weight / totalSourceWeight;
      const neighbors = sites
        .filter((candidate) => candidate.id !== source.site.id)
        .map((candidate) => ({
          site: candidate,
          distance: Math.sqrt(distanceSquared(candidate.position, source.site.position)),
        }))
        .filter(({ distance }) => distance <= 24)
        .sort((left, right) => left.site.id.localeCompare(right.site.id));
      if (neighbors.length === 0) {
        add(source.site, sourceAmount);
        continue;
      }
      add(source.site, sourceAmount * 0.7);
      const neighborWeights = neighbors.map((neighbor) => ({
        ...neighbor,
        weight: 1 / (1 + neighbor.distance),
      }));
      const totalNeighborWeight = neighborWeights.reduce((sum, neighbor) => sum + neighbor.weight, 0);
      for (const neighbor of neighborWeights) {
        add(neighbor.site, sourceAmount * 0.3 * neighbor.weight / totalNeighborWeight);
      }
    }
    for (const site of sites) {
      site.environment.wasteLoad = round(Math.max(0, site.environment.wasteLoad + (additions.get(site.id) ?? 0)));
    }
  }

  private depositDailyWaste(foodWaste: number, toolWaste: number, sites: readonly Building[]): void {
    if (sites.length === 0) return;
    const occupants = new Map<BuildingId, number>();
    let peopleWithoutHomes = 0;
    for (const person of this.alivePeople()) {
      if (person.homeBuildingId === null || this.stateValue.buildings[person.homeBuildingId]?.stage !== 'complete') {
        peopleWithoutHomes += 1;
      } else {
        occupants.set(person.homeBuildingId, (occupants.get(person.homeBuildingId) ?? 0) + 1);
      }
    }
    const foodSources: { site: Building; weight: number }[] = [];
    for (const site of sites) {
      const occupantCount = occupants.get(site.id) ?? 0;
      if (site.type === 'house' && occupantCount > 0) foodSources.push({ site, weight: occupantCount });
    }
    const publicSite = sites.find((site) => site.stage === 'complete' && site.type === 'market') ??
      sites.find((site) => site.stage === 'complete' && site.type === 'warehouse') ??
      sites.find((site) => site.stage === 'complete') ?? sites[0];
    if (publicSite !== undefined && (peopleWithoutHomes > 0 || foodSources.length === 0)) {
      foodSources.push({ site: publicSite, weight: Math.max(1, peopleWithoutHomes) });
    }
    this.depositWasteLoad(foodWaste, foodSources, sites);

    const industrialSources = sites
      .filter((site) => site.stage === 'complete' && site.type === 'workshop')
      .map((site) => ({ site, weight: this.facilityProductionToday.get(site.id)?.tools ?? 0 }))
      .filter(({ weight }) => weight > 0);
    const locatedToolProduction = industrialSources.reduce((sum, source) => sum + source.weight, 0);
    const totalToolProduction = Math.max(0, this.stateValue.settlement.dailyEconomy.production.tools);
    const locatedToolWaste = totalToolProduction <= 0
      ? 0
      : toolWaste * clamp(locatedToolProduction / totalToolProduction, 0, 1);
    this.depositWasteLoad(locatedToolWaste, industrialSources, sites);
    if (publicSite !== undefined) {
      this.depositWasteLoad(Math.max(0, toolWaste - locatedToolWaste), [{ site: publicSite, weight: 1 }], sites);
    }
  }

  private resourceCapacity(): ResourceLedger {
    const capacity = cloneSerializable(this.stateValue.config.storage.baseCapacity);
    for (const building of this.completeBuildings()) {
      if (building.type === 'warehouse') {
        for (const resource of RESOURCE_KINDS) {
          capacity[resource] += this.stateValue.config.storage.warehouseCapacity[resource];
        }
      }
      const local = BUILDING_STORAGE_CAPACITY[building.type];
      if (local === undefined) continue;
      for (const resource of RESOURCE_KINDS) capacity[resource] += local[resource] ?? 0;
    }
    for (const resource of RESOURCE_KINDS) capacity[resource] = round(capacity[resource]);
    return capacity;
  }

  private applyStorageLimitsAndLosses(): void {
    const economy = this.stateValue.settlement.dailyEconomy;
    const capacity = this.resourceCapacity();
    const eventData: Record<string, EventDatum> = {};
    let totalLoss = 0;
    let totalOverflow = 0;
    for (const resource of RESOURCE_KINDS) {
      const stock = this.stateValue.settlement.resources[resource];
      const loss = round(Math.min(stock, stock * this.stateValue.config.storage.spoilageRate[resource]));
      const afterLoss = round(Math.max(0, stock - loss));
      const overflow = round(Math.max(0, afterLoss - capacity[resource]));
      this.stateValue.settlement.resources[resource] = round(afterLoss - overflow);
      economy.losses[resource] = round(economy.losses[resource] + loss);
      economy.overflow[resource] = round(economy.overflow[resource] + overflow);
      if (loss > 0) eventData[`${resource}Loss`] = loss;
      if (overflow > 0) eventData[`${resource}Overflow`] = overflow;
      totalLoss += loss;
      totalOverflow += overflow;
    }
    if (totalLoss > 0 || totalOverflow > 0) {
      this.emit(
        'resource-loss',
        [SETTLEMENT_ID],
        `Storage lost ${round(totalLoss)} units and rejected ${round(totalOverflow)} overflow units.`,
        eventData,
      );
    }
  }

  private updatePricesAndEnvironment(): void {
    const economy = this.stateValue.settlement.dailyEconomy;
    for (const resource of RESOURCE_KINDS) {
      const demand = economy.consumption[resource] + 0.2;
      const dailySupply = economy.production[resource] + this.stateValue.settlement.resources[resource] * 0.08 + 0.2;
      const scarcity = clamp(demand / dailySupply, 0.18, 6);
      const target = BASE_PRICES[resource] * (0.55 + scarcity * 0.75);
      this.stateValue.settlement.prices[resource] = round(clamp(this.stateValue.settlement.prices[resource] * 0.78 + target * 0.22, 0.1, 100));
    }
    const environmentConfig = this.stateValue.config.environment;
    const foodWaste = economy.consumption.food * environmentConfig.wastePerFoodConsumed +
      economy.losses.food + economy.overflow.food;
    const toolWaste = economy.production.tools * environmentConfig.wastePerToolProduced;
    economy.wasteCreated = round(foodWaste + toolWaste);
    const buildings = sortedRecordValues(this.stateValue.buildings);
    const sites = buildings.filter((building) => building.type !== 'road');
    this.depositDailyWaste(foodWaste, toolWaste, sites);

    const previousEnvironments = new Map(sites.map((building) => [building.id, cloneSerializable(building.environment)]));
    for (const building of sites) {
      const previousStatus = building.environment.status;
      const localProduction = this.facilityProductionToday.get(building.id);
      let productionPressure = 0;
      if (building.type === 'farm') {
        productionPressure = (localProduction?.food ?? 0) / 70;
      } else if (building.type === 'well') {
        productionPressure = (localProduction?.water ?? 0) / 160;
      } else if (building.type === 'workshop') {
        productionPressure = (localProduction?.tools ?? 0) / 8;
      } else if (building.type === 'power-station') {
        productionPressure = (localProduction?.energy ?? 0) / 120;
      }
      const neighbors = sites
        .filter((candidate) => candidate.id !== building.id)
        .map((candidate) => ({
          candidate,
          distance: Math.sqrt(distanceSquared(candidate.position, building.position)),
        }))
        .filter(({ distance }) => distance <= 24);
      const neighborWeight = neighbors.reduce((sum, neighbor) => sum + 1 / (1 + neighbor.distance), 0);
      const previous = previousEnvironments.get(building.id) ?? building.environment;
      const neighborContamination = neighborWeight <= 0
        ? previous.contamination
        : neighbors.reduce((sum, neighbor) => {
          const environment = previousEnvironments.get(neighbor.candidate.id) ?? neighbor.candidate.environment;
          return sum + environment.contamination / (1 + neighbor.distance);
        }, 0) / neighborWeight;
      const constructionActive = building.builderIds.some((builderId) => {
        const builder = this.stateValue.people[builderId];
        return builder?.alive === true && builder.currentTask === 'build' &&
          distanceSquared(builder.position, this.constructionWorksitePosition(builder, building)) <= TASK_SITE_RADIUS_METERS ** 2;
      });
      building.environment = advanceEnvironmentalCondition(previous, building.type, {
        constructionActive,
        neighborContamination,
        productionPressure,
        sanitationCoverage: this.sanitationCoverageToday.get(building.id) ?? 0,
        wasteLoad: building.environment.wasteLoad,
      });
      const statusChange = compareEnvironmentalStatus(previousStatus, building.environment.status);
      if (building.type !== 'road' && statusChange !== 0) {
        const recovered = statusChange < 0;
        this.emit(
          recovered ? 'environment-recovered' : 'environment-degraded',
          [building.id],
          `${building.name}'s local environment ${recovered ? 'recovered to' : 'degraded to'} ${building.environment.status}.`,
          {
            contamination: building.environment.contamination,
            fertility: building.environment.fertility,
            waterQuality: building.environment.waterQuality,
          },
        );
        building.history.push({
          day: this.currentDay,
          event: `Local environment ${recovered ? 'recovered to' : 'degraded to'} ${building.environment.status}`,
          personIds: [],
        });
      }
    }
    this.stateValue.settlement.waste = round(sites.reduce((sum, building) => sum + building.environment.wasteLoad, 0));
    const aliveCount = Math.max(1, this.alivePeople().length);
    const wastePerResident = this.stateValue.settlement.waste / aliveCount;
    const environment = summarizeEnvironment(sites);
    const targetDiseaseRisk = clamp(
      0.65 + wastePerResident * 0.22 + environment.averageContamination / 100 * 0.6 +
      (100 - environment.averageWaterQuality) / 100 * 0.5,
      0.65,
      2,
    );
    this.stateValue.settlement.modifiers.diseaseRisk = round(clamp(
      this.stateValue.settlement.modifiers.diseaseRisk * 0.9 + targetDiseaseRisk * 0.1,
      0.65,
      2,
    ));
    for (const building of this.completeBuildings()) {
      building.condition = clamp(building.condition - 0.015 - Math.max(0, this.stateValue.settlement.pressure.construction) * 0.03);
    }
  }

  private killPerson(person: Person, cause: string, natural: boolean): void {
    if (!person.alive) return;
    person.alive = false;
    person.deathDay = this.currentDay;
    person.deathCause = cause;
    person.currentTask = 'idle';
    person.pregnancy = null;
    person.employed = false;
    person.followersIds = [];
    this.stateValue.counters.deaths += 1;
    if (natural) this.stateValue.counters.naturalDeaths += 1;
    else this.stateValue.counters.earlyDeaths += 1;
    const inherited = this.distributeInheritance(person);
    if (person.partnerId !== null) {
      const partner = this.stateValue.people[person.partnerId];
      if (partner !== undefined) {
        partner.partnerId = null;
        partner.emotion = clamp(partner.emotion - 24);
        this.addPersonMemory(partner, { day: this.currentDay, importance: 100, subjectId: person.id, summary: `${person.name} died.`, type: 'inheritance' });
      }
    }
    for (const relationship of sortedRecordValues(this.stateValue.relationships)) {
      if (
        relationship.endedDay === null &&
        (relationship.personAId === person.id || relationship.personBId === person.id)
      ) {
        relationship.endedDay = this.currentDay;
        this.stateValue.counters.archivedRelationships += 1;
      }
    }
    for (const institution of sortedRecordValues(this.stateValue.institutions)) {
      institution.memberIds = institution.memberIds.filter((id) => id !== person.id);
      delete institution.followerCandidateIds[person.id];
      delete institution.followerLoyalty[person.id];
      for (const followerId of Object.keys(institution.followerCandidateIds).sort()) {
        if (institution.followerCandidateIds[followerId] === person.id) {
          delete institution.followerCandidateIds[followerId];
          delete institution.followerLoyalty[followerId];
        }
      }
      if (institution.leaderId === person.id) institution.leaderId = null;
    }
    this.emit('death', [person.id], `${person.name} died from ${cause}.`, { cause, natural, inherited: round(inherited) });
  }

  private distributeInheritance(person: Person): number {
    const heirs = person.childrenIds
      .map((id) => this.stateValue.people[id])
      .filter((candidate): candidate is Person => candidate !== undefined && candidate.alive);
    if (heirs.length === 0 && person.partnerId !== null) {
      const partner = this.stateValue.people[person.partnerId];
      if (partner?.alive) heirs.push(partner);
    }
    if (heirs.length === 0 && person.householdId !== null) {
      const household = this.stateValue.households[person.householdId];
      if (household !== undefined) {
        heirs.push(...household.memberIds
          .map((id) => this.stateValue.people[id])
          .filter((candidate): candidate is Person => candidate !== undefined && candidate.alive && candidate.id !== person.id));
      }
    }
    const uniqueHeirs = [...new Map(heirs.map((heir) => [heir.id, heir])).values()].sort((left, right) => left.id.localeCompare(right.id));
    const estate = Math.max(0, person.wealth);
    if (uniqueHeirs.length > 0) {
      const share = estate / uniqueHeirs.length;
      const debtShare = Math.max(0, person.debt) / uniqueHeirs.length;
      for (const heir of uniqueHeirs) {
        heir.wealth += share;
        heir.debt += debtShare;
        this.addPersonMemory(heir, { day: this.currentDay, importance: 62, subjectId: person.id, summary: `Inherited ${round(share)} and ${round(debtShare)} debt from ${person.name}.`, type: 'inheritance' });
      }
      for (const building of sortedRecordValues(this.stateValue.buildings)) {
        if (building.ownerId === person.id) building.ownerId = uniqueHeirs[0]?.id ?? null;
      }
      this.stateValue.counters.inheritances += 1;
      this.stateValue.counters.inheritedValue += estate;
      this.emit('inheritance', [person.id, ...uniqueHeirs.map((heir) => heir.id)], `${person.name}'s estate passed to ${uniqueHeirs.length} heir(s), including its debts.`, {
        estate: round(estate),
        debt: round(person.debt),
      });
    } else {
      this.stateValue.settlement.treasury += estate;
      this.stateValue.settlement.debt += person.debt;
    }
    person.wealth = 0;
    person.debt = 0;
    return estate;
  }

  private makeDailySummary(events: SimulationEvent[]): DailySummary {
    const alive = this.alivePeople();
    const metrics = this.metricsWithoutSaveSize();
    return {
      day: this.currentDay,
      population: alive.length,
      entrants: events.filter((event) => event.type === 'arrival').length,
      births: events.filter((event) => event.type === 'birth').length,
      deaths: events.filter((event) => event.type === 'death').length,
      households: metrics.households,
      partnerships: metrics.partnerships,
      foodProduced: round(this.stateValue.settlement.dailyEconomy.production.food),
      foodConsumed: round(this.stateValue.settlement.dailyEconomy.consumption.food),
      housingCapacity: metrics.housingCapacity,
      homeless: metrics.homeless,
      employed: metrics.employed,
      constructionProjects: metrics.buildingsUnderConstruction,
      eventSequence: this.stateValue.eventSequence,
    };
  }

  private metricsWithoutSaveSize(): Omit<SimulationMetrics, 'saveApproximateBytes'> {
    this.suppressMetricSize = true;
    const metrics = this.metrics();
    this.suppressMetricSize = false;
    const { saveApproximateBytes: _ignored, ...rest } = metrics;
    return rest;
  }

  private addPersonMemory(person: Person, memory: PersonMemory): void {
    person.memories.push(memory);
    person.memories.sort((left, right) => left.day - right.day || right.importance - left.importance || left.subjectId.localeCompare(right.subjectId));
    if (person.memories.length > this.stateValue.config.history.maxMemoriesPerPerson) {
      person.memories = person.memories
        .sort((left, right) => right.importance - left.importance || right.day - left.day)
        .slice(0, this.stateValue.config.history.maxMemoriesPerPerson)
        .sort((left, right) => left.day - right.day || left.subjectId.localeCompare(right.subjectId));
    }
  }

  private addRelationshipMemory(relationship: Relationship, memory: RelationshipMemory): void {
    relationship.memories.push(memory);
    if (relationship.memories.length > this.stateValue.config.history.maxRelationshipMemories) {
      relationship.memories = relationship.memories.slice(-this.stateValue.config.history.maxRelationshipMemories);
    }
  }

  private pruneHistory(): void {
    const excess = this.stateValue.events.length - this.stateValue.config.history.maxEvents;
    if (excess > 0) this.stateValue.events.splice(0, excess);
    for (const building of sortedRecordValues(this.stateValue.buildings)) {
      if (building.history.length > 32) building.history = building.history.slice(-32);
    }
  }

  private alivePeople(): Person[] {
    return sortedRecordValues(this.stateValue.people).filter((person) => person.alive);
  }

  private completeBuildings(): Building[] {
    return sortedRecordValues(this.stateValue.buildings).filter((building) => building.stage === 'complete');
  }

  private activeConstructionProjects(): Building[] {
    return sortedRecordValues(this.stateValue.buildings).filter((building) => building.stage !== 'complete');
  }

  private primaryInstitution(): Institution | undefined {
    return sortedRecordValues(this.stateValue.institutions).find((institution) => institution.kind === 'council');
  }

  private personAssignmentIndex(person: Person, count: number): number {
    if (count <= 1) return 0;
    const serial = Number.parseInt(person.id.split(':').at(-1) ?? '1', 10);
    return (Number.isFinite(serial) ? Math.max(0, serial - 1) : 0) % count;
  }

  private workplaceFor(person: Person): Building | undefined {
    const type = OCCUPATION_BUILDING[person.occupation];
    if (type === undefined) return undefined;
    const workplaces = this.completeBuildings().filter((building) => building.type === type);
    return workplaces[this.personAssignmentIndex(person, workplaces.length)];
  }

  private isAssignedToSanitation(person: Person): boolean {
    return person.currentTask === 'work' && person.decisionReason === SANITATION_TASK_REASON;
  }

  private shouldAssignToSanitation(person: Person): boolean {
    if (!isAdult(person)) return false;
    const population = Math.max(1, this.alivePeople().length);
    const wastePerResident = this.stateValue.settlement.waste / population;
    if (wastePerResident <= 0.35) return false;
    const eligible = this.alivePeople()
      .filter((candidate) => isAdult(candidate) && (
        wastePerResident > 1.5 ||
        candidate.occupation === 'laborer' ||
        candidate.occupation === 'unemployed' ||
        candidate.occupation === 'explorer' ||
        (candidate.occupation === 'builder' && wastePerResident > 2)
      ))
      .sort((left, right) => left.id.localeCompare(right.id));
    const requiredWorkers = Math.ceil(
      Math.min(this.stateValue.settlement.waste, population * 3) /
      Math.max(0.01, this.stateValue.config.environment.sanitationPerWorker),
    );
    return eligible.slice(0, requiredWorkers).some((candidate) => candidate.id === person.id);
  }

  private sanitationSiteFor(person: Person): Building | undefined {
    const sites = this.completeBuildings()
      .filter((building) => building.type !== 'road' && building.environment.wasteLoad > 0)
      .sort((left, right) => {
        const leftSeverity = left.environment.wasteLoad * 10 + left.environment.contamination + (100 - left.environment.waterQuality) * 0.2;
        const rightSeverity = right.environment.wasteLoad * 10 + right.environment.contamination + (100 - right.environment.waterQuality) * 0.2;
        return rightSeverity - leftSeverity || left.id.localeCompare(right.id);
      });
    const slots = sites.flatMap((site) => {
      const count = Math.max(1, Math.min(12, Math.ceil(
        site.environment.wasteLoad / Math.max(0.01, this.stateValue.config.environment.sanitationPerWorker),
      )));
      return Array.from({ length: count }, () => site);
    });
    return slots[this.personAssignmentIndex(person, slots.length)];
  }

  private sanitationSiteAtDestination(person: Person): Building | undefined {
    return this.completeBuildings().find((building) =>
      building.type !== 'road' && distanceSquared(building.position, person.destination) <= 0.01);
  }

  private environmentalContextFor(person: Person): Building | undefined {
    const taskSite = this.buildingForTask(person, person.currentTask);
    if (taskSite !== undefined && distanceSquared(person.position, taskSite.position) <= SHARED_CONTEXT_RADIUS_METERS ** 2) {
      return taskSite;
    }
    if (person.homeBuildingId !== null) {
      const home = this.stateValue.buildings[person.homeBuildingId];
      if (home !== undefined && distanceSquared(person.position, home.position) <= SHARED_CONTEXT_RADIUS_METERS ** 2) return home;
    }
    return this.completeBuildings()
      .filter((building) => building.type !== 'road')
      .map((building) => ({ building, distance: distanceSquared(building.position, person.position) }))
      .filter(({ distance }) => distance <= ENVIRONMENT_CONTEXT_RADIUS_METERS ** 2)
      .sort((left, right) => left.distance - right.distance || left.building.id.localeCompare(right.building.id))[0]?.building;
  }

  private environmentForNewSite(type: BuildingType, position: Position3): EnvironmentalCondition {
    const nearby = sortedRecordValues(this.stateValue.buildings)
      .filter((building) => building.type !== 'road')
      .map((building) => ({
        building,
        distance: Math.sqrt(distanceSquared(building.position, position)),
      }))
      .filter(({ distance }) => distance <= 30);
    if (nearby.length === 0) return initialEnvironmentalCondition(type);
    let totalWeight = 0;
    let fertility = 0;
    let waterQuality = 0;
    let contamination = 0;
    for (const { building, distance } of nearby) {
      const weight = 1 / (1 + distance);
      totalWeight += weight;
      fertility += building.environment.fertility * weight;
      waterQuality += building.environment.waterQuality * weight;
      contamination += building.environment.contamination * weight;
    }
    const condition = {
      fertility: round(fertility / totalWeight),
      waterQuality: round(waterQuality / totalWeight),
      contamination: round(contamination / totalWeight),
      wasteLoad: 0,
    };
    return { ...condition, status: environmentalStatus(condition, type) };
  }

  private constructionProjectFor(person: Person, projects = this.activeConstructionProjects()): Building | undefined {
    return projects[this.personAssignmentIndex(person, projects.length)];
  }

  private constructionWorksitePosition(person: Person, building: Building): Position3 {
    const footprint = BUILDING_FOOTPRINTS[building.type];
    const clearance = building.type === 'well' ? 0.9 : 1.05;
    const halfWidth = footprint.width / 2 + clearance;
    const halfDepth = footprint.depth / 2 + clearance;
    const slots: readonly [number, number][] = [
      [-halfWidth, -halfDepth * 0.45],
      [0, -halfDepth],
      [halfWidth, -halfDepth * 0.45],
      [halfWidth, halfDepth * 0.45],
      [0, halfDepth],
      [-halfWidth, halfDepth * 0.45],
      [-halfWidth * 0.45, -halfDepth],
      [halfWidth * 0.45, halfDepth],
    ];
    const [x = 0, z = 0] = slots[this.personAssignmentIndex(person, slots.length)] ?? [];
    return {
      x: round(building.position.x + x),
      y: building.position.y,
      z: round(building.position.z + z),
    };
  }

  private buildingForTask(person: Person, task: TaskType): Building | undefined {
    switch (task) {
      case 'build': return this.constructionProjectFor(person);
      case 'work': return this.isAssignedToSanitation(person)
        ? this.sanitationSiteAtDestination(person)
        : this.workplaceFor(person);
      case 'trade': case 'socialize': case 'eat':
        return this.completeBuildings().find((building) => building.type === 'market');
      case 'heal': case 'care':
        return this.completeBuildings().find((building) => building.type === 'clinic');
      case 'govern':
        return this.completeBuildings().find((building) => building.type === 'council-hall');
      case 'learn': case 'research':
        return this.completeBuildings().find((building) => building.type === 'school');
      case 'fetch-water':
        return this.completeBuildings().find((building) => building.type === 'well');
      case 'rest':
        return person.homeBuildingId === null ? undefined : this.stateValue.buildings[person.homeBuildingId];
      case 'idle': case 'travel':
        return undefined;
    }
  }

  private isAtTaskWorksite(person: Person): boolean {
    const worksite = this.buildingForTask(person, person.currentTask);
    if (worksite !== undefined && person.currentTask === 'build') {
      return distanceSquared(person.position, this.constructionWorksitePosition(person, worksite)) <= TASK_SITE_RADIUS_METERS ** 2;
    }
    return worksite !== undefined && distanceSquared(person.position, worksite.position) <= TASK_SITE_RADIUS_METERS ** 2;
  }

  private canPerformProductiveTask(person: Person): boolean {
    switch (person.currentTask) {
      case 'work': return true;
      case 'build': return person.occupation === 'builder' || person.occupation === 'laborer';
      case 'care': return person.occupation === 'caregiver';
      case 'govern': return person.occupation === 'organizer' || this.primaryInstitution()?.leaderId === person.id;
      case 'heal': return person.occupation === 'healer';
      case 'research': return person.occupation === 'researcher' || person.occupation === 'inventor';
      case 'trade': return person.occupation === 'trader';
      case 'eat': case 'fetch-water': case 'idle': case 'learn': case 'rest': case 'socialize': case 'travel':
        return false;
    }
  }

  private spatialBucketKey(position: Position3): string {
    return `${Math.floor(position.x / ENCOUNTER_RADIUS_METERS)}:${Math.floor(position.z / ENCOUNTER_RADIUS_METERS)}`;
  }

  private actualHomeContextId(person: Person): string | null {
    if (person.householdId === null || person.homeBuildingId === null) return null;
    const home = this.stateValue.buildings[person.homeBuildingId];
    if (home === undefined) return null;
    const radiusSquared = SHARED_CONTEXT_RADIUS_METERS ** 2;
    return distanceSquared(person.position, home.position) <= radiusSquared ? `home:${person.householdId}:${home.id}` : null;
  }

  private actualWorkContextId(person: Person): string | null {
    const productiveTasks: readonly TaskType[] = ['build', 'care', 'govern', 'heal', 'research', 'trade', 'work'];
    if (!productiveTasks.includes(person.currentTask)) return null;
    const site = this.buildingForTask(person, person.currentTask);
    if (site === undefined) return null;
    if (person.currentTask === 'build') return this.isAtTaskWorksite(person) ? `work:${site.id}` : null;
    const radiusSquared = SHARED_CONTEXT_RADIUS_METERS ** 2;
    return distanceSquared(person.position, site.position) <= radiusSquared ? `work:${site.id}` : null;
  }

  private shareActualHomeContext(left: Person, right: Person): boolean {
    const contextId = this.actualHomeContextId(left);
    return contextId !== null && contextId === this.actualHomeContextId(right);
  }

  private shareActualWorkContext(left: Person, right: Person): boolean {
    const contextId = this.actualWorkContextId(left);
    return contextId !== null && contextId === this.actualWorkContextId(right);
  }

  private canEncounter(left: Person, right: Person): boolean {
    return distanceSquared(left.position, right.position) <= ENCOUNTER_RADIUS_METERS ** 2 ||
      this.shareActualHomeContext(left, right) || this.shareActualWorkContext(left, right);
  }

  private housingCapacity(): number {
    return this.completeBuildings().filter((building) => building.type === 'house').reduce((sum, building) => sum + building.capacity, 0);
  }

  private foodReserveDays(): number {
    const demand = this.alivePeople().reduce((sum, person) => sum + (isAdult(person) ? 1 : this.stateValue.config.needs.childConsumptionScale), 0) * this.stateValue.config.needs.foodPerAdult;
    return demand <= 0 ? 999 : this.stateValue.settlement.resources.food / demand;
  }

  private waterReserveDays(): number {
    const demand = this.alivePeople().reduce((sum, person) => sum + (isAdult(person) ? 1 : this.stateValue.config.needs.childConsumptionScale), 0) * this.stateValue.config.needs.waterPerAdult;
    return demand <= 0 ? 999 : this.stateValue.settlement.resources.water / demand;
  }

  private energyReserveDays(): number {
    const demand = this.alivePeople().reduce((sum, person) => sum + (isAdult(person) ? 1 : this.stateValue.config.needs.childConsumptionScale), 0) * this.stateValue.config.needs.energyPerAdult;
    return demand <= 0 ? 999 : this.stateValue.settlement.resources.energy / demand;
  }

  private visibleHeight(person: Person): number {
    const ageScale: Record<LifeStage, number> = {
      child: clamp(0.48 + person.ageDays / Math.max(1, this.stateValue.config.lifeStages.adolescent) * 0.28, 0.48, 0.76),
      adolescent: 0.82,
      'young-adult': 1,
      adult: 1,
      'older-adult': 0.98,
      elder: 0.95,
    };
    return round(person.appearance.heightMeters * ageScale[person.lifeStage], 3);
  }

  private rareEvidence(person: Person): number {
    const observed = person.influence.social + person.influence.political + person.influence.technical + person.historicalSignificance;
    return clamp(observed / 4, 0, 100);
  }
}
