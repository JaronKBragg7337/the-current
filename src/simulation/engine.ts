import { canonicalDigest, canonicalStringify, cloneSerializable } from './canonical';
import { resolveSimulationConfig } from './config';
import { DeterministicRng, deterministicStream } from './rng';
import {
  SIMULATION_ENGINE_VERSION,
  SIMULATION_SCHEMA_VERSION,
  type ActiveSignal,
  type BiologicalSex,
  type Breakthrough,
  type BreakthroughDomain,
  type BreakthroughEffects,
  type Building,
  type BuildingProjection,
  type BuildingType,
  type ConstructionStage,
  type DailySummary,
  type DayInputs,
  type DayResult,
  type DeepPartial,
  type EmergenceProfile,
  type EntityId,
  type EventDatum,
  type Household,
  type InfluenceSet,
  type Institution,
  type InstitutionKind,
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
  builder: 'workshop',
  caregiver: 'clinic',
  farmer: 'farm',
  healer: 'clinic',
  inventor: 'workshop',
  laborer: 'warehouse',
  mechanic: 'workshop',
  organizer: 'council-hall',
  researcher: 'school',
  teacher: 'school',
  trader: 'market',
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
    production: emptyResources(),
    valueProduced: 0,
    wagesPaid: 0,
    wasteCreated: 0,
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
      config,
      ids: { breakthrough: 0, building: 0, household: 0, institution: 0, person: 0 },
      people: {},
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

    for (const signal of [...inputs.signals].sort((a, b) => a.id.localeCompare(b.id))) this.queueSignal(signal);
    for (const intervention of [...inputs.interventions].sort((a, b) => a.id.localeCompare(b.id))) {
      this.queueIntervention(intervention);
    }

    this.updateSignalPressures();
    this.resolveDueInterventions();
    this.updateAgingAndNaturalDeaths();
    this.deliverDueBirths();
    this.addGuaranteedEntrants();
    this.assignHousing();
    this.assignEmployment();
    this.chooseTasksAndDestinations();
    this.runProductionAndEmployment();
    this.consumeResourcesAndUpdateHealth();
    this.runEncounters();
    this.formPartnerships();
    this.considerReproduction();
    this.planConstruction();
    this.progressConstruction();
    this.updateInstitutions();
    this.updateBreakthroughs();
    this.updateMovementAndPersonalGrowth();
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
      .reduce((sum, institution) => sum + Object.keys(institution.followerLoyalty).length, 0);
    const latest = this.stateValue.dailySummaries[this.stateValue.dailySummaries.length - 1];
    const saveApproximateBytes = this.suppressMetricSize ? 0 : canonicalStringify(this.stateValue).length;
    return {
      day: this.currentDay,
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
      relationships: Object.keys(this.stateValue.relationships).length,
      partnerships: alive.filter((person) => person.partnerId !== null).length / 2,
      pregnancies: alive.filter((person) => person.pregnancy !== null).length,
      housingCapacity,
      occupiedHousing,
      homeless: alive.filter((person) => person.homeBuildingId === null).length,
      employed: adults.filter((person) => person.employed).length,
      unemployedAdults: adults.filter((person) => !person.employed).length,
      foodStock: round(this.stateValue.settlement.resources.food),
      waterStock: round(this.stateValue.settlement.resources.water),
      foodProducedLastDay: latest?.foodProduced ?? 0,
      foodConsumedLastDay: latest?.foodConsumed ?? 0,
      wealthTotal: round(wealthTotal),
      wealthMedian: round(wealthMedian),
      wealthGini: round(wealthGini),
      inheritedValue: round(this.stateValue.counters.inheritedValue),
      buildingsComplete: complete,
      buildingsUnderConstruction: underConstruction,
      leaders,
      followerEdges,
      breakthroughAttempts: this.stateValue.counters.breakthroughAttempts,
      breakthroughAdoptions: this.stateValue.counters.breakthroughAdoptions,
      activeSignals: this.stateValue.activeSignals.length,
      resolvedInterventions: this.stateValue.interventions.filter((record) => record.resolvedDay !== null).length,
      eventCount: this.stateValue.eventSequence,
      saveApproximateBytes,
    };
  }

  projection(): WorldProjection {
    const people: PersonProjection[] = this.alivePeople().map((person) => ({
      id: person.id,
      name: person.name,
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
      occupied: building.occupiedByIds.length,
    }));
    return {
      schemaVersion: SIMULATION_SCHEMA_VERSION,
      day: this.currentDay,
      tick: this.stateValue.tick,
      settlementId: this.stateValue.settlement.id,
      settlementName: this.stateValue.settlement.name,
      population: people.length,
      people,
      buildings,
      resources: cloneSerializable(this.stateValue.settlement.resources),
      prices: cloneSerializable(this.stateValue.settlement.prices),
      pressure: cloneSerializable(this.stateValue.settlement.pressure),
      recentEvents: cloneSerializable(this.stateValue.events.slice(-24)),
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
    for (const definition of initialBuildings) {
      this.createBuilding(definition.type, { x: definition.x, y: 0, z: definition.z }, true, null);
    }
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

  private createPerson(
    origin: PersonOrigin,
    day: number,
    motherId: PersonId | null,
    fatherId: PersonId | null,
  ): Person {
    this.stateValue.ids.person += 1;
    const id = `person:${this.stateValue.ids.person.toString().padStart(6, '0')}`;
    const biologicalSex: BiologicalSex = this.rng.bool() ? 'female' : 'male';
    const ageAtEntry = origin === 'born'
      ? 0
      : this.rng.int(this.stateValue.config.entrantAge.min, this.stateValue.config.entrantAge.max);
    const birthDay = day - ageAtEntry;
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
    const position = origin === 'entrant'
      ? cloneSerializable(this.stateValue.settlement.entryPoint)
      : { x: this.rng.int(-24, 24), y: 0, z: this.rng.int(-22, 22) };
    const person: Person = {
      id,
      name: `${firstName} ${lastName} ${this.stateValue.ids.person.toString(36).toUpperCase()}`,
      origin,
      biologicalSex,
      birthDay,
      arrivalDay: day,
      naturalDeathDay: day + lifespan,
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
      position,
      destination: { x: 0, y: 0, z: 0 },
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
    const local = deterministicStream(this.seed, 'inheritance', child.id);
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

  private addGuaranteedEntrants(): void {
    for (let index = 0; index < this.stateValue.config.entrantsPerDay; index += 1) {
      const entrant = this.createPerson('entrant', this.currentDay, null, null);
      this.createHousehold([entrant.id]);
      this.stateValue.counters.entrants += 1;
      this.emit('arrival', [entrant.id], `${entrant.name} arrived through the western road.`, {
        guaranteed: true,
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
      const child = this.createPerson('born', this.currentDay, mother.id, father.id);
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
        sex: child.biologicalSex,
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
      const local = deterministicStream(this.seed, 'employment', this.currentDay, person.id);
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
    for (const person of this.alivePeople()) {
      let task: TaskType;
      let reason: string;
      if (person.lifeStage === 'child') {
        task = person.needs.social < 45 ? 'socialize' : 'learn';
        reason = task === 'learn' ? 'Learning from family and the settlement school.' : 'Seeking play and family contact.';
      } else if (person.lifeStage === 'adolescent') {
        task = person.needs.food < 35 ? 'eat' : 'learn';
        reason = task === 'eat' ? 'Hunger takes priority.' : 'Building skills before adult work.';
      } else if (person.needs.water < 30) {
        task = 'fetch-water'; reason = 'Thirst is an immediate survival pressure.';
      } else if (person.needs.food < 32) {
        task = 'eat'; reason = 'Food need is more urgent than paid work.';
      } else if (person.health < 45 || person.needs.health < 40) {
        task = 'heal'; reason = 'Poor health makes treatment the highest-value choice.';
      } else if (person.needs.energy < 26) {
        task = 'rest'; reason = 'Fatigue is limiting useful work.';
      } else if (person.homeBuildingId === null && (person.occupation === 'builder' || person.occupation === 'laborer')) {
        task = 'build'; reason = 'Housing insecurity creates direct construction incentive.';
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
        const project = this.activeConstructionProjects()[0];
        return project === undefined ? { x: 0, y: 0, z: 0 } : cloneSerializable(project.position);
      }
      case 'eat': buildingType = 'market'; break;
      case 'fetch-water': buildingType = 'well'; break;
      case 'govern': buildingType = 'council-hall'; break;
      case 'heal': case 'care': buildingType = 'clinic'; break;
      case 'learn': case 'research': buildingType = 'school'; break;
      case 'socialize': case 'trade': buildingType = 'market'; break;
      case 'rest': {
        const home = person.homeBuildingId === null ? undefined : this.stateValue.buildings[person.homeBuildingId];
        return home === undefined ? { x: 0, y: 0, z: 0 } : cloneSerializable(home.position);
      }
      case 'work': buildingType = OCCUPATION_BUILDING[person.occupation] ?? null; break;
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
    const pressure = this.stateValue.settlement.pressure;
    const modifiers = this.stateValue.settlement.modifiers;
    const buildings = this.completeBuildings();
    const farmCount = buildings.filter((building) => building.type === 'farm').length;
    const wellCount = buildings.filter((building) => building.type === 'well').length;
    const powerCount = buildings.filter((building) => building.type === 'power-station').length;
    const clinicCount = buildings.filter((building) => building.type === 'clinic').length;
    const workshopCount = buildings.filter((building) => building.type === 'workshop').length;
    economy.production.food += farmCount * 16 * modifiers.foodYield * (1 - Math.max(0, pressure.food) * 0.28);
    economy.production.water += wellCount * 82 * modifiers.waterYield * (1 - Math.max(0, pressure.water) * 0.3);
    economy.production.energy += (28 + powerCount * 55) * modifiers.energyEfficiency * (1 - Math.max(0, pressure.energy) * 0.22);
    economy.production.medicine += clinicCount * 2.2 * modifiers.healthCapacity;
    economy.production.tools += workshopCount * 1.4;

    for (const person of this.alivePeople()) {
      if (!isAdult(person) || !person.employed) continue;
      const skillDomain = OCCUPATION_SKILL[person.occupation];
      const skill = person.skills[skillDomain];
      const capacity = (0.62 + person.health / 250 + person.needs.energy / 400) * (0.8 + skill / 220);
      const local = deterministicStream(this.seed, 'task-success', this.currentDay, person.id);
      const successChance = clamp(0.48 + capacity * 0.32 + person.traits.patience / 500, 0.1, 0.97);
      person.lastTaskSuccess = local.bool(successChance);
      const output = person.lastTaskSuccess ? capacity : capacity * 0.42;
      switch (person.currentTask) {
        case 'work':
          this.produceForOccupation(person.occupation, output, economy.production);
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
    for (const resource of RESOURCE_KINDS) {
      economy.production[resource] = round(Math.max(0, economy.production[resource]));
      this.stateValue.settlement.resources[resource] = round(this.stateValue.settlement.resources[resource] + economy.production[resource]);
    }
    this.stateValue.settlement.treasury += economy.valueProduced * 0.16;
  }

  private produceForOccupation(occupation: Occupation, output: number, ledger: ResourceLedger): void {
    switch (occupation) {
      case 'farmer': ledger.food += 7.5 * output; break;
      case 'hunter': ledger.food += 3.8 * output; ledger.medicine += 0.15 * output; break;
      case 'builder': case 'laborer': ledger.wood += 2.1 * output; ledger.stone += 1.5 * output; break;
      case 'mechanic': case 'inventor': ledger.tools += 0.8 * output; ledger.energy += 1.2 * output; break;
      case 'healer': ledger.medicine += 0.65 * output; break;
      case 'trader': ledger.transport += 0.18 * output; break;
      case 'explorer': ledger.food += 0.8 * output; ledger.wood += 0.7 * output; break;
      case 'artist': case 'caregiver': case 'organizer': case 'researcher': case 'teacher': case 'unemployed': break;
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
    let shortageEmitted = false;
    for (const person of this.alivePeople()) {
      const scale = isAdult(person) ? 1 : config.childConsumptionScale;
      const foodNeeded = config.foodPerAdult * scale;
      const waterNeeded = config.waterPerAdult * scale;
      const energyNeeded = config.energyPerAdult * scale;
      const foodRatio = this.consumeForPerson(person, 'food', foodNeeded);
      const waterRatio = this.consumeForPerson(person, 'water', waterNeeded);
      const energyRatio = this.consumeForPerson(person, 'energy', energyNeeded);
      economy.consumption.food += foodNeeded * foodRatio;
      economy.consumption.water += waterNeeded * waterRatio;
      economy.consumption.energy += energyNeeded * energyRatio;
      person.needs.food = clamp(person.needs.food + foodRatio * 16 - 11);
      person.needs.water = clamp(person.needs.water + waterRatio * 18 - 13);
      person.needs.energy = clamp(person.needs.energy + energyRatio * 8 - (person.currentTask === 'build' || person.currentTask === 'work' ? 10 : 6));
      person.needs.social = clamp(person.needs.social + (person.currentTask === 'socialize' || person.currentTask === 'care' ? 14 : -4));
      person.needs.safety = clamp(person.needs.safety + (this.stateValue.settlement.safety - 50) / 18);
      if (person.currentTask === 'rest') person.needs.energy = clamp(person.needs.energy + 24);
      if (person.currentTask === 'heal' && this.stateValue.settlement.resources.medicine >= 0.3) {
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
      const healerCount = this.alivePeople().filter((candidate) => candidate.currentTask === 'heal').length;
      const recovery = person.needs.food > 50 && person.needs.water > 50 ? 1.2 + healerCount * 0.04 : 0;
      person.health = clamp(person.health + recovery - damage);
      person.needs.health = clamp(person.needs.health + recovery - damage * 0.8);
      person.emotion = clamp(person.emotion + (person.needs.social - 50) / 40 + (person.needs.shelter - 50) / 55 - damage * 0.5);
      if ((foodRatio < 0.99 || waterRatio < 0.99) && !shortageEmitted) {
        shortageEmitted = true;
        this.emit('shortage', [SETTLEMENT_ID], 'Residents could not obtain all required food or water.', {
          foodStock: round(this.stateValue.settlement.resources.food),
          waterStock: round(this.stateValue.settlement.resources.water),
        });
      }
      if (person.health <= 0) {
        deaths.push({ person, cause: person.needs.water < 10 ? 'dehydration' : person.needs.food < 10 ? 'starvation' : 'illness and exposure' });
      } else if (person.health < 18) {
        const risk = clamp((18 - person.health) / 125, 0, 0.12);
        if (deterministicStream(this.seed, 'early-death', this.currentDay, person.id).bool(risk)) {
          deaths.push({ person, cause: person.needs.water < person.needs.food ? 'dehydration' : 'medical failure' });
        }
      }
    }
    for (const resource of RESOURCE_KINDS) economy.consumption[resource] = round(economy.consumption[resource]);
    for (const death of deaths) if (death.person.alive) this.killPerson(death.person, death.cause, false);
  }

  private consumeForPerson(person: Person, resource: ResourceKind, amount: number): number {
    const available = this.stateValue.settlement.resources[resource];
    const supplied = Math.min(amount, available);
    this.stateValue.settlement.resources[resource] = round(available - supplied);
    const price = this.stateValue.settlement.prices[resource] * supplied;
    const payment = Math.min(person.wealth, price);
    person.wealth -= payment;
    this.stateValue.settlement.treasury += payment;
    return amount <= 0 ? 1 : supplied / amount;
  }

  private runEncounters(): void {
    const people = this.alivePeople();
    const processed = new Set<string>();
    const existingByPerson = new Map<PersonId, Relationship[]>();
    for (const relationship of sortedRecordValues(this.stateValue.relationships)) {
      const left = existingByPerson.get(relationship.personAId) ?? [];
      left.push(relationship);
      existingByPerson.set(relationship.personAId, left);
      const right = existingByPerson.get(relationship.personBId) ?? [];
      right.push(relationship);
      existingByPerson.set(relationship.personBId, right);
    }
    const occupationGroups = new Map<Occupation, Person[]>();
    for (const person of people) {
      const group = occupationGroups.get(person.occupation) ?? [];
      group.push(person);
      occupationGroups.set(person.occupation, group);
    }
    for (let personIndex = 0; personIndex < people.length; personIndex += 1) {
      const person = people[personIndex];
      if (person === undefined) continue;
      const candidateMap = new Map<PersonId, Person>();
      const existing = (existingByPerson.get(person.id) ?? [])
        .sort((left, right) => right.affinity + right.trust - left.affinity - left.trust || left.id.localeCompare(right.id))
        .slice(0, 3);
      for (const relationship of existing) {
        const otherId = relationship.personAId === person.id ? relationship.personBId : relationship.personAId;
        const other = this.stateValue.people[otherId];
        if (other?.alive) candidateMap.set(other.id, other);
      }
      if (person.householdId !== null) {
        const household = this.stateValue.households[person.householdId];
        for (const memberId of household?.memberIds ?? []) {
          const member = this.stateValue.people[memberId];
          if (member?.alive && member.id !== person.id) candidateMap.set(member.id, member);
        }
      }
      const coworkers = occupationGroups.get(person.occupation) ?? [];
      const coworkerIndex = coworkers.findIndex((candidate) => candidate.id === person.id);
      for (const offset of [-1, 1]) {
        const coworker = coworkers[(coworkerIndex + offset + coworkers.length) % Math.max(1, coworkers.length)];
        if (coworker !== undefined && coworker.id !== person.id) candidateMap.set(coworker.id, coworker);
      }
      if (people.length > 1 && this.currentDay % 3 === Number.parseInt(person.id.slice(-1), 10) % 3) {
        const newcomer = people[(personIndex + this.currentDay * 7 + 1) % people.length];
        if (newcomer !== undefined && newcomer.id !== person.id) candidateMap.set(newcomer.id, newcomer);
      }
      const candidates = [...candidateMap.values()]
        .map((candidate) => ({
          candidate,
          score:
            (candidate.householdId !== null && candidate.householdId === person.householdId ? 100 : 0) +
            (candidate.currentTask === person.currentTask ? 45 : 0) +
            (candidate.occupation === person.occupation ? 35 : 0) +
            (this.stateValue.relationships[relationshipId(person.id, candidate.id)]?.affinity ?? 0) * 0.8 -
            Math.min(40, Math.sqrt(distanceSquared(candidate.destination, person.destination))),
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
    if (relationship === undefined) {
      const local = deterministicStream(this.seed, 'first-meeting', id);
      const compatibility = this.personCompatibility(personA, personB);
      relationship = {
        id,
        personAId: personA.id < personB.id ? personA.id : personB.id,
        personBId: personA.id < personB.id ? personB.id : personA.id,
        kind: personA.occupation === personB.occupation ? 'coworker' : 'acquaintance',
        affinity: clamp(28 + compatibility * 34 + local.int(-8, 8)),
        attraction: clamp(30 + compatibility * 35 + local.int(-9, 10)),
        trust: clamp(25 + compatibility * 28 + local.int(-6, 7)),
        conflict: clamp(local.int(0, 16) + Math.abs(personA.traits.aggression - personB.traits.aggression) * 0.08),
        dependency: personA.householdId === personB.householdId ? 20 : 0,
        encounters: 0,
        startedDay: this.currentDay,
        lastInteractionDay: this.currentDay,
        sharedWorkDays: 0,
        memories: [{ day: this.currentDay, delta: 3, summary: `${personA.name} and ${personB.name} first met.`, type: 'first-meeting' }],
      };
      this.stateValue.relationships[id] = relationship;
      this.emit('encounter', [personA.id, personB.id], `${personA.name} and ${personB.name} met for the first time.`, { relationshipId: id });
      this.addPersonMemory(personA, { day: this.currentDay, importance: 35, subjectId: personB.id, summary: `First met ${personB.name}.`, type: 'arrival' });
      this.addPersonMemory(personB, { day: this.currentDay, importance: 35, subjectId: personA.id, summary: `First met ${personA.name}.`, type: 'arrival' });
    }
    const local = deterministicStream(this.seed, 'encounter', this.currentDay, id);
    const sharedWork = personA.currentTask === personB.currentTask && ['work', 'build', 'research', 'govern'].includes(personA.currentTask);
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
      relationship.attraction = clamp(relationship.attraction + this.personCompatibility(personA, personB) * 2.2 + local.float() * 0.8);
      relationship.conflict = clamp(relationship.conflict - 0.35);
      if (sharedWork && local.bool(0.08)) this.addRelationshipMemory(relationship, { day: this.currentDay, delta: 3, summary: 'Successful work together strengthened the relationship.', type: 'cooperation' });
    }
    relationship.encounters += 1;
    relationship.lastInteractionDay = this.currentDay;
    const previousKind = relationship.kind;
    if (relationship.kind !== 'partner' && relationship.kind !== 'spouse') {
      if (relationship.trust > 72 && relationship.affinity > 74) relationship.kind = 'close-friend';
      else if (relationship.trust > 57 && relationship.affinity > 60) relationship.kind = 'friend';
      else if (relationship.attraction > 54 && relationship.affinity > 52 && isAdult(personA) && isAdult(personB)) relationship.kind = 'romantic-interest';
      else if (sharedWork) relationship.kind = 'coworker';
    }
    if (!firstMeeting && previousKind !== relationship.kind) {
      this.emit('relationship-changed', [personA.id, personB.id], `${personA.name} and ${personB.name} became ${relationship.kind.replaceAll('-', ' ')}s.`, {
        previous: previousKind,
        current: relationship.kind,
      });
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
      if (!deterministicStream(this.seed, 'conception', this.currentDay, mother.id, father.id).bool(chance)) continue;
      const local = deterministicStream(this.seed, 'gestation', this.currentDay, mother.id, father.id);
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
    let type: BuildingType | null = null;
    if (this.foodReserveDays() < this.stateValue.config.construction.foodReserveTriggerDays && !queuedTypes.has('farm')) type = 'farm';
    else if (housingRatio > this.stateValue.config.construction.housingTriggerRatio) type = 'house';
    else if (this.waterReserveDays() < 5 && !queuedTypes.has('well')) type = 'well';
    else if (alive >= 55 && this.completeBuildings().filter((building) => building.type === 'school').length < 2 && !queuedTypes.has('school')) type = 'school';
    else if (alive >= 70 && this.completeBuildings().filter((building) => building.type === 'clinic').length < 2 && !queuedTypes.has('clinic')) type = 'clinic';
    else if (alive >= 80 && this.completeBuildings().filter((building) => building.type === 'power-station').length < 1 && !queuedTypes.has('power-station')) type = 'power-station';
    if (type === null) return;
    const local = deterministicStream(this.seed, 'building-site', this.currentDay, type, this.stateValue.ids.building + 1);
    const position = { x: local.int(-58, 58), y: 0, z: local.int(-48, 52) };
    const commissioner = this.primaryInstitution()?.id ?? null;
    const building = this.createBuilding(type, position, false, commissioner);
    this.emit('construction-proposed', [building.id], `${building.name} was commissioned in response to ${type === 'house' ? 'housing demand' : `${type} capacity pressure`}.`, {
      type,
    });
  }

  private progressConstruction(): void {
    const projects = this.activeConstructionProjects().slice(0, this.stateValue.config.construction.maxConcurrentProjects);
    const builders = this.alivePeople().filter((person) => person.currentTask === 'build' && isAdult(person));
    for (let projectIndex = 0; projectIndex < projects.length; projectIndex += 1) {
      const building = projects[projectIndex];
      if (building === undefined) continue;
      const assigned = builders.filter((_, index) => index % Math.max(1, projects.length) === projectIndex);
      building.builderIds = assigned.map((person) => person.id).sort();
      const deliveryCapacity = assigned.length * this.stateValue.config.construction.materialDeliveryPerWorker;
      let deliveredTotal = 0;
      for (const resource of ['wood', 'stone', 'tools'] as const) {
        const need = building.requiredMaterials[resource] - building.deliveredMaterials[resource];
        const delivered = Math.min(need, this.stateValue.settlement.resources[resource], deliveryCapacity / 3);
        building.deliveredMaterials[resource] = round(building.deliveredMaterials[resource] + delivered);
        this.stateValue.settlement.resources[resource] = round(this.stateValue.settlement.resources[resource] - delivered);
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
      const needsElection = institution.leaderId === null || !this.stateValue.people[institution.leaderId]?.alive ||
        this.currentDay % this.stateValue.config.leadership.electionIntervalDays === 0;
      if (needsElection) this.electLeader(institution);
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
      institution.followerLoyalty = {};
      return;
    }
    const support = new Map<PersonId, { count: number; loyalty: number }>();
    institution.followerLoyalty = {};
    for (const memberId of institution.memberIds) {
      const member = this.stateValue.people[memberId];
      if (member === undefined || !member.alive) continue;
      const choice = candidates
        .map((candidate) => ({ candidate, score: this.followScore(member, candidate, institution) }))
        .sort((left, right) => right.score - left.score || left.candidate.id.localeCompare(right.candidate.id))[0];
      if (choice === undefined || choice.score < this.stateValue.config.leadership.followerTrust) continue;
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
    for (const candidate of candidates) candidate.followersIds = [];
    for (const followerId of Object.keys(institution.followerLoyalty).sort()) {
      const follower = this.stateValue.people[followerId];
      if (follower === undefined || institution.leaderId === null || follower.id === institution.leaderId) continue;
      const leader = this.stateValue.people[institution.leaderId];
      if (leader !== undefined && !leader.followersIds.includes(follower.id)) leader.followersIds.push(follower.id);
    }
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

  private leadershipPotential(person: Person): number {
    const rareBonus = person.rarePotential === 'strong-leader' ? 18 : person.rarePotential === 'power-seeker' ? 15 : person.rarePotential === 'exceptional' ? 22 : 0;
    return person.traits.charisma * 0.22 + person.traits.strategicThinking * 0.2 + person.traits.ambition * 0.13 +
      person.traits.empathy * 0.1 + person.skills.governance * 0.18 + person.influence.social * 0.1 +
      person.influence.economic * 0.07 + rareBonus + (person.lastTaskSuccess ? 4 : 0);
  }

  private followScore(follower: Person, candidate: Person, institution: Institution): number {
    const relationship = this.stateValue.relationships[relationshipId(follower.id, candidate.id)];
    const trust = relationship?.trust ?? 32;
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
      const local = deterministicStream(this.seed, 'breakthrough-progress', this.currentDay, breakthrough.id);
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

  private updateMovementAndPersonalGrowth(): void {
    for (const person of this.alivePeople()) {
      const dx = person.destination.x - person.position.x;
      const dz = person.destination.z - person.position.z;
      const distance = Math.sqrt(dx * dx + dz * dz);
      const ageFactor = person.lifeStage === 'child' ? 0.68 : person.lifeStage === 'elder' ? 0.62 : person.lifeStage === 'older-adult' ? 0.82 : 1;
      const healthFactor = 0.45 + person.health / 180;
      const step = Math.min(distance, 5.2 * ageFactor * healthFactor);
      if (distance > 0.0001) {
        person.position.x = round(person.position.x + dx / distance * step);
        person.position.z = round(person.position.z + dz / distance * step);
        person.yaw = round(Math.atan2(dx, dz));
      }
      if (person.currentTask === 'learn') {
        const teachers = this.alivePeople().filter((candidate) => candidate.occupation === 'teacher' && candidate.currentTask === 'work').length;
        person.knowledge = clamp(person.knowledge + (0.28 + teachers * 0.08) * this.stateValue.settlement.modifiers.knowledgeGrowth);
        const interest = person.interests[(this.currentDay + Number.parseInt(person.id.slice(-2), 10)) % person.interests.length];
        if (interest !== undefined) person.skills[interest] = clamp(person.skills[interest] + 0.22);
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
      const local = deterministicStream(this.seed, 'intervention', intervention.id);
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
    switch (intervention.payloadType) {
      case 'contamination':
        this.stateValue.settlement.resources.water = Math.max(0, this.stateValue.settlement.resources.water - damage);
        this.stateValue.settlement.pressure.health = clamp(this.stateValue.settlement.pressure.health + intervention.intensity * 0.35, -1, 1);
        break;
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
      return `${intervention.payloadType.replaceAll('-', ' ')} caused damage but also provoked an observable cooperative response.`;
    }
    return `${intervention.payloadType.replaceAll('-', ' ')} entered the causal economy as damage, scarcity, and contested information.`;
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
    economy.wasteCreated = round(economy.consumption.food * 0.05 + economy.production.tools * 0.08);
    this.stateValue.settlement.waste = round(this.stateValue.settlement.waste + economy.wasteCreated - this.alivePeople().filter((person) => person.occupation === 'laborer').length * 0.15);
    if (this.stateValue.settlement.waste > this.alivePeople().length * 2) {
      this.stateValue.settlement.modifiers.diseaseRisk = round(clamp(this.stateValue.settlement.modifiers.diseaseRisk + 0.006, 0.65, 2));
    } else {
      this.stateValue.settlement.modifiers.diseaseRisk = round(clamp(this.stateValue.settlement.modifiers.diseaseRisk - 0.002, 0.65, 2));
    }
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
    for (const institution of sortedRecordValues(this.stateValue.institutions)) {
      institution.memberIds = institution.memberIds.filter((id) => id !== person.id);
      delete institution.followerLoyalty[person.id];
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
      entrants: events.filter((event) => event.type === 'arrival' && event.data.guaranteed === true).length,
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

  private workplaceFor(person: Person): Building | undefined {
    const type = OCCUPATION_BUILDING[person.occupation];
    return type === undefined ? undefined : this.completeBuildings().find((building) => building.type === type);
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
