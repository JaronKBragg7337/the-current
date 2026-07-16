export const SIMULATION_SCHEMA_VERSION = 2 as const;
export const SIMULATION_ENGINE_VERSION = '0.3.0' as const;

export type EntityId = string;
export type PersonId = EntityId;
export type HouseholdId = EntityId;
export type BuildingId = EntityId;
export type InstitutionId = EntityId;
export type BreakthroughId = EntityId;

export type BiologicalSex = 'female' | 'male';
export type PersonOrigin = 'born' | 'entrant' | 'founder';
export type LifeStage =
  | 'child'
  | 'adolescent'
  | 'young-adult'
  | 'adult'
  | 'older-adult'
  | 'elder';

export type Occupation =
  | 'artist'
  | 'builder'
  | 'caregiver'
  | 'explorer'
  | 'farmer'
  | 'healer'
  | 'hunter'
  | 'inventor'
  | 'laborer'
  | 'mechanic'
  | 'organizer'
  | 'researcher'
  | 'teacher'
  | 'trader'
  | 'unemployed';

export type EmergenceProfile =
  | Occupation
  | 'criminally-inclined'
  | 'militarily-inclined'
  | 'opportunist'
  | 'political-thinker'
  | 'religious-thinker'
  | 'unskilled-generalist';

export type SkillDomain =
  | 'agriculture'
  | 'art'
  | 'care'
  | 'construction'
  | 'education'
  | 'engineering'
  | 'governance'
  | 'logistics'
  | 'medicine'
  | 'research'
  | 'security'
  | 'trade';

export type TaskType =
  | 'build'
  | 'care'
  | 'eat'
  | 'fetch-water'
  | 'govern'
  | 'heal'
  | 'idle'
  | 'learn'
  | 'research'
  | 'rest'
  | 'socialize'
  | 'trade'
  | 'travel'
  | 'work';

export type ResourceKind =
  | 'energy'
  | 'food'
  | 'medicine'
  | 'stone'
  | 'tools'
  | 'transport'
  | 'water'
  | 'wood';

export type RelationshipKind =
  | 'acquaintance'
  | 'business-partner'
  | 'close-friend'
  | 'coworker'
  | 'enemy'
  | 'friend'
  | 'mentor'
  | 'partner'
  | 'political-ally'
  | 'rival'
  | 'romantic-interest'
  | 'spouse'
  | 'student';

export type RelationshipMemoryType =
  | 'argument'
  | 'assistance'
  | 'betrayal'
  | 'birth'
  | 'business-failure'
  | 'cooperation'
  | 'death'
  | 'first-meeting'
  | 'gift'
  | 'partnership'
  | 'shared-danger';

export type BuildingType =
  | 'clinic'
  | 'council-hall'
  | 'farm'
  | 'house'
  | 'market'
  | 'power-station'
  | 'road'
  | 'school'
  | 'warehouse'
  | 'well'
  | 'workshop';

export type ConstructionStage =
  | 'planned'
  | 'site-selection'
  | 'foundation'
  | 'frame'
  | 'walls'
  | 'roof'
  | 'interior'
  | 'utilities'
  | 'complete';

export type InstitutionKind =
  | 'builders-guild'
  | 'clinic'
  | 'council'
  | 'research-circle'
  | 'school'
  | 'trade-cooperative';

export type InfluenceDomain =
  | 'cultural'
  | 'economic'
  | 'informational'
  | 'political'
  | 'social'
  | 'technical';

export type RarePotential =
  | 'exceptional'
  | 'ordinary'
  | 'power-seeker'
  | 'polymath'
  | 'strong-leader';

export type BreakthroughDomain =
  | 'agriculture'
  | 'communication'
  | 'construction'
  | 'education'
  | 'energy'
  | 'finance'
  | 'governance'
  | 'medicine'
  | 'transportation'
  | 'water';

export type BreakthroughStage =
  | 'adopted'
  | 'demonstrated'
  | 'failed'
  | 'hypothesis'
  | 'idea'
  | 'prototype'
  | 'trial';

export type SignalDomain =
  | 'agriculture'
  | 'climate'
  | 'conflict'
  | 'disaster'
  | 'economy'
  | 'energy'
  | 'health'
  | 'social'
  | 'space'
  | 'technology'
  | 'trade'
  | 'transportation';

export type PressureAxis =
  | 'construction'
  | 'energy'
  | 'food'
  | 'health'
  | 'knowledge'
  | 'safety'
  | 'sentiment'
  | 'trade'
  | 'transportation'
  | 'water';

export type InterventionKind = 'help' | 'sabotage' | 'spice';

export type InterventionPayloadType =
  | 'art-movement'
  | 'construction-materials'
  | 'contamination'
  | 'debt-relief'
  | 'education-funding'
  | 'emergency-energy'
  | 'experimental-technology'
  | 'false-information'
  | 'festival'
  | 'food'
  | 'infrastructure-failure'
  | 'medicine'
  | 'mysterious-broadcast'
  | 'rare-discovery'
  | 'rumor'
  | 'skilled-arrivals'
  | 'trade-obstruction'
  | 'water';

export interface Position3 {
  x: number;
  y: number;
  z: number;
}

export interface ResourceLedger {
  energy: number;
  food: number;
  medicine: number;
  stone: number;
  tools: number;
  transport: number;
  water: number;
  wood: number;
}

export interface TraitSet {
  adaptability: number;
  aggression: number;
  ambition: number;
  charisma: number;
  curiosity: number;
  empathy: number;
  moralConcern: number;
  patience: number;
  politicalDrive: number;
  riskTolerance: number;
  sociability: number;
  strategicThinking: number;
  trustThreshold: number;
  desireForChildren: number;
  desireForControl: number;
  desireForPower: number;
}

export type SkillSet = Record<SkillDomain, number>;
export type InfluenceSet = Record<InfluenceDomain, number>;

export interface NeedSet {
  energy: number;
  food: number;
  health: number;
  safety: number;
  shelter: number;
  social: number;
  water: number;
}

export interface AppearanceProfile {
  bodyBuild: number;
  hairTone: number;
  heightMeters: number;
  skinTone: number;
  visualSeed: number;
}

export interface Pregnancy {
  conceivedDay: number;
  dueDay: number;
  otherParentId: PersonId;
}

export interface PersonMemory {
  day: number;
  importance: number;
  subjectId: EntityId;
  summary: string;
  type: RelationshipMemoryType | 'achievement' | 'arrival' | 'discovery' | 'inheritance' | 'intervention' | 'migration';
}

export interface Person {
  id: PersonId;
  name: string;
  origin: PersonOrigin;
  biologicalSex: BiologicalSex;
  birthDay: number;
  arrivalDay: number;
  naturalDeathDay: number;
  alive: boolean;
  deathDay: number | null;
  deathCause: string | null;
  ageDays: number;
  lifeStage: LifeStage;
  appearance: AppearanceProfile;
  emergenceProfile: EmergenceProfile;
  occupation: Occupation;
  employed: boolean;
  employerId: EntityId | null;
  householdId: HouseholdId | null;
  homeBuildingId: BuildingId | null;
  settlementId: EntityId;
  motherId: PersonId | null;
  fatherId: PersonId | null;
  partnerId: PersonId | null;
  childrenIds: PersonId[];
  traits: TraitSet;
  aptitudes: SkillSet;
  skills: SkillSet;
  knowledge: number;
  health: number;
  emotion: number;
  needs: NeedSet;
  wealth: number;
  debt: number;
  possessions: ResourceLedger;
  currentTask: TaskType;
  decisionReason: string;
  previousPosition: Position3;
  position: Position3;
  destination: Position3;
  yaw: number;
  lastTaskSuccess: boolean;
  pregnancy: Pregnancy | null;
  reproductiveCooldownUntil: number;
  influence: InfluenceSet;
  followersIds: PersonId[];
  rarePotential: RarePotential;
  interests: SkillDomain[];
  memories: PersonMemory[];
  historicalSignificance: number;
}

export interface RelationshipMemory {
  day: number;
  delta: number;
  summary: string;
  type: RelationshipMemoryType;
}

export interface Relationship {
  id: EntityId;
  personAId: PersonId;
  personBId: PersonId;
  kind: RelationshipKind;
  affinity: number;
  attraction: number;
  chemistry: number;
  trust: number;
  conflict: number;
  dependency: number;
  encounters: number;
  startedDay: number;
  lastInteractionDay: number;
  endedDay: number | null;
  sharedWorkDays: number;
  memories: RelationshipMemory[];
}

export interface Household {
  id: HouseholdId;
  foundedDay: number;
  memberIds: PersonId[];
  homeBuildingId: BuildingId | null;
  sharedFood: number;
  sharedWealth: number;
  stability: number;
}

export interface MaterialRequirement {
  stone: number;
  tools: number;
  wood: number;
}

export interface BuildingHistoryEntry {
  day: number;
  event: string;
  personIds: PersonId[];
}

export type EnvironmentalStatus = 'healthy' | 'stressed' | 'hazardous';

export interface EnvironmentalCondition {
  fertility: number;
  waterQuality: number;
  contamination: number;
  wasteLoad: number;
  status: EnvironmentalStatus;
}

export interface Building {
  id: BuildingId;
  type: BuildingType;
  name: string;
  settlementId: EntityId;
  position: Position3;
  commissionedDay: number;
  commissionedById: PersonId | InstitutionId | null;
  ownerId: PersonId | HouseholdId | InstitutionId | null;
  builderIds: PersonId[];
  stage: ConstructionStage;
  stageIndex: number;
  stageProgress: number;
  laborCompleted: number;
  laborRequired: number;
  requiredMaterials: MaterialRequirement;
  deliveredMaterials: MaterialRequirement;
  capacity: number;
  condition: number;
  environment: EnvironmentalCondition;
  occupiedByIds: EntityId[];
  history: BuildingHistoryEntry[];
}

export interface LegacyArtifact {
  id: EntityId;
  name: string;
  sourceEra: string;
  description: string;
  position: Position3;
  domains: SkillDomain[];
  discoveredDay: number | null;
  discoveredById: PersonId | null;
  studyDays: number;
  studiedByIds: PersonId[];
}

export interface InstitutionPolicy {
  birthIncentive: number;
  constructionPriority: BuildingType;
  educationFunding: number;
  foodSubsidy: number;
  informationOpenness: number;
  wealthRedistribution: number;
}

export interface Institution {
  id: InstitutionId;
  kind: InstitutionKind;
  name: string;
  foundedDay: number;
  founderIds: PersonId[];
  memberIds: PersonId[];
  leaderId: PersonId | null;
  /** Candidate currently supported by each follower in this institution. */
  followerCandidateIds: Record<PersonId, PersonId>;
  followerLoyalty: Record<PersonId, number>;
  legitimacy: number;
  corruption: number;
  treasury: number;
  policy: InstitutionPolicy;
  history: string[];
}

export interface BreakthroughEffects {
  constructionEfficiency: number;
  energyEfficiency: number;
  foodYield: number;
  healthCapacity: number;
  knowledgeGrowth: number;
  tradeEfficiency: number;
  waterYield: number;
}

export interface Breakthrough {
  id: BreakthroughId;
  domain: BreakthroughDomain;
  title: string;
  inventorIds: PersonId[];
  institutionId: InstitutionId | null;
  problem: PressureAxis;
  startedDay: number;
  lastProgressDay: number;
  stage: BreakthroughStage;
  progress: number;
  failures: number;
  resourceInvestment: number;
  adoption: number;
  effects: BreakthroughEffects;
  harmfulSideEffect: PressureAxis | null;
  history: string[];
}

export interface NormalizedSignal {
  id: string;
  sourceIds: string[];
  domain: SignalDomain;
  geography: string;
  intensity: number;
  confidence: number;
  sourceAgreement: number;
  novelty: number;
  durationDays: number;
  halfLifeDays: number;
  timestampDay: number;
  effectiveDay: number;
  objectivePressure: Partial<Record<PressureAxis, number>>;
  beliefPressure: Partial<Record<PressureAxis, number>>;
}

export interface ActiveSignal {
  signal: NormalizedSignal;
  receivedDay: number;
}

export interface ObserverIntervention {
  id: string;
  kind: InterventionKind;
  payloadType: InterventionPayloadType;
  effectiveDay: number;
  amount: number;
  intensity: number;
  targetSettlementId: string;
  note: string;
}

export interface InterventionRecord {
  intervention: ObserverIntervention;
  queuedDay: number;
  resolvedDay: number | null;
  outcome: string;
}

export interface PressureState {
  construction: number;
  energy: number;
  food: number;
  health: number;
  knowledge: number;
  safety: number;
  sentiment: number;
  trade: number;
  transportation: number;
  water: number;
}

export interface SettlementModifiers extends BreakthroughEffects {
  diseaseRisk: number;
  socialCohesion: number;
}

export interface SettlementDailyEconomy {
  consumption: ResourceLedger;
  losses: ResourceLedger;
  overflow: ResourceLedger;
  production: ResourceLedger;
  wagesPaid: number;
  valueProduced: number;
  wasteCreated: number;
  wasteRemoved: number;
}

export interface Settlement {
  id: EntityId;
  name: string;
  foundedDay: number;
  resources: ResourceLedger;
  prices: ResourceLedger;
  treasury: number;
  debt: number;
  waste: number;
  drinkingWaterQuality: number;
  safety: number;
  publicTrust: number;
  pressure: PressureState;
  modifiers: SettlementModifiers;
  buildingIds: BuildingId[];
  institutionIds: InstitutionId[];
  constructionQueue: BuildingId[];
  entryPoint: Position3;
  dailyEconomy: SettlementDailyEconomy;
}

export type SimulationEventType =
  | 'arrival'
  | 'artifact-discovered'
  | 'artifact-studied'
  | 'birth'
  | 'breakthrough-adopted'
  | 'breakthrough-attempt'
  | 'breakthrough-failed'
  | 'breakthrough-progress'
  | 'building-completed'
  | 'construction-proposed'
  | 'construction-stage'
  | 'death'
  | 'employment-changed'
  | 'encounter'
  | 'entropy-mixed'
  | 'environment-degraded'
  | 'environment-recovered'
  | 'inheritance'
  | 'institution-founded'
  | 'intervention-resolved'
  | 'leadership-changed'
  | 'material-delivered'
  | 'migration-deferred'
  | 'partnership-formed'
  | 'pregnancy'
  | 'relationship-changed'
  | 'relationship-ended'
  | 'resource-loss'
  | 'sanitation-cleanup'
  | 'signal-received'
  | 'shortage';

export type EventDatum = boolean | null | number | string;

export interface SimulationEvent {
  sequence: number;
  day: number;
  tick: number;
  type: SimulationEventType;
  entityIds: EntityId[];
  summary: string;
  data: Record<string, EventDatum>;
}

export interface DailySummary {
  day: number;
  population: number;
  entrants: number;
  births: number;
  deaths: number;
  households: number;
  partnerships: number;
  foodProduced: number;
  foodConsumed: number;
  housingCapacity: number;
  homeless: number;
  employed: number;
  constructionProjects: number;
  eventSequence: number;
}

export interface CumulativeCounters {
  archivedRelationships: number;
  artifactStudyDays: number;
  births: number;
  breakthroughAdoptions: number;
  breakthroughAttempts: number;
  buildingsCompleted: number;
  deaths: number;
  earlyDeaths: number;
  entrants: number;
  inheritances: number;
  inheritedValue: number;
  naturalDeaths: number;
  partnerships: number;
  pregnancies: number;
}

export interface IdCounters {
  artifact: number;
  breakthrough: number;
  building: number;
  household: number;
  institution: number;
  person: number;
}

/**
 * Accumulated hidden-entropy chains. Both values are hash chains over every
 * entropy input the world has ever received. `surface` reseeds the ordinary
 * daily randomness; `deep` is a second, independently chained layer reserved
 * for rare high-impact outcomes (early deaths, breakthroughs, intervention
 * consequences) so even a party who observed one day's entropy input cannot
 * reconstruct those outcomes without the entire history.
 */
export interface EntropyState {
  surface: string;
  deep: string;
}

export interface WorldState {
  schemaVersion: typeof SIMULATION_SCHEMA_VERSION;
  engineVersion: string;
  seed: string;
  day: number;
  tick: number;
  eventSequence: number;
  rngState: number;
  entropy: EntropyState;
  config: SimulationConfig;
  ids: IdCounters;
  people: Record<PersonId, Person>;
  artifacts: Record<EntityId, LegacyArtifact>;
  relationships: Record<EntityId, Relationship>;
  households: Record<HouseholdId, Household>;
  buildings: Record<BuildingId, Building>;
  institutions: Record<InstitutionId, Institution>;
  breakthroughs: Record<BreakthroughId, Breakthrough>;
  settlement: Settlement;
  activeSignals: ActiveSignal[];
  interventions: InterventionRecord[];
  events: SimulationEvent[];
  dailySummaries: DailySummary[];
  counters: CumulativeCounters;
}

export interface SimulationConfig {
  version: number;
  ticksPerDay: number;
  initialPopulation: number;
  /** Legacy test override. Era One does not create guaranteed entrants. */
  entrantsPerDay?: number;
  entrantAge: { min: number; max: number };
  lifespan: { min: number; max: number };
  lifeStages: {
    adolescent: number;
    youngAdult: number;
    adult: number;
    olderAdult: number;
    elder: number;
  };
  needs: {
    foodPerAdult: number;
    waterPerAdult: number;
    energyPerAdult: number;
    childConsumptionScale: number;
    starvationDamage: number;
    dehydrationDamage: number;
    exposureDamage: number;
  };
  relationships: {
    encountersPerPerson: number;
    partnerAffinity: number;
    partnerAttraction: number;
    partnerTrust: number;
    matureRelationshipDays: number;
    inactiveAcquaintanceDays: number;
    romanticChemistryThreshold: number;
  };
  migration: {
    baseDailyRate: number;
    maxArrivalsPerDay: number;
    minimumAttraction: number;
  };
  reproduction: {
    baseConceptionChance: number;
    gestationDays: { min: number; max: number };
    cooldownDays: { min: number; max: number };
    minimumHousingSecurity: number;
    minimumFoodDays: number;
  };
  construction: {
    maxConcurrentProjects: number;
    laborPerWorker: number;
    materialDeliveryPerWorker: number;
    housingTriggerRatio: number;
    foodReserveTriggerDays: number;
    proposalDeferralWeight: number;
  };
  environment: {
    farmWaterPerDay: number;
    farmToolsPerDay: number;
    workshopEnergyPerDay: number;
    powerToolsPerDay: number;
    sanitationPerWorker: number;
    sanitationEnergyPerWaste: number;
    wastePerFoodConsumed: number;
    wastePerToolProduced: number;
  };
  storage: {
    baseCapacity: ResourceLedger;
    warehouseCapacity: ResourceLedger;
    spoilageRate: ResourceLedger;
  };
  leadership: {
    electionIntervalDays: number;
    minimumFollowers: number;
    followerTrust: number;
  };
  rarity: {
    strongLeader: number;
    powerSeeker: number;
    polymath: number;
    exceptional: number;
  };
  breakthroughs: {
    attemptIntervalDays: number;
    minimumKnowledge: number;
    baseProgress: number;
    failureChance: number;
  };
  history: {
    maxEvents: number;
    maxMemoriesPerPerson: number;
    maxRelationshipMemories: number;
  };
}

export type DeepPartial<T> = T extends readonly unknown[]
  ? T
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T;

export interface SimulationCreateOptions {
  seed?: string;
  config?: DeepPartial<SimulationConfig>;
}

export interface WorldSnapshot {
  schemaVersion: typeof SIMULATION_SCHEMA_VERSION;
  engineVersion: string;
  day: number;
  digest: string;
  state: WorldState;
}

export interface DayInputs {
  signals: NormalizedSignal[];
  interventions: ObserverIntervention[];
  /**
   * Optional hidden entropy for this day, drawn by the authoritative host
   * from a cryptographic source. When present it is mixed into the world's
   * entropy chains before the day runs, making the future uncomputable from
   * the seed alone while keeping replay of the recorded past exact. When
   * absent the day advances fully deterministically (test/replay mode).
   */
  entropy?: string;
}

export interface DayResult {
  day: number;
  summary: DailySummary;
  events: SimulationEvent[];
  digest: string;
}

export interface SimulationMetrics {
  day: number;
  initialPopulation: number;
  population: number;
  foundersAndEntrantsAlive: number;
  bornPopulationAlive: number;
  totalEntrants: number;
  births: number;
  deaths: number;
  naturalDeaths: number;
  earlyDeaths: number;
  households: number;
  relationships: number;
  activeSocialTies: number;
  historicalSocialTies: number;
  romanticInterests: number;
  partnerships: number;
  lifetimePartnerships: number;
  pregnancies: number;
  housingCapacity: number;
  occupiedHousing: number;
  homeless: number;
  employed: number;
  unemployedAdults: number;
  foodStock: number;
  waterStock: number;
  resourceStock: ResourceLedger;
  resourceCapacity: ResourceLedger;
  resourceProductionLastDay: ResourceLedger;
  resourceConsumptionLastDay: ResourceLedger;
  resourceLossLastDay: ResourceLedger;
  foodProducedLastDay: number;
  foodConsumedLastDay: number;
  wealthTotal: number;
  wealthMedian: number;
  wealthGini: number;
  inheritances: number;
  inheritedValue: number;
  buildingsComplete: number;
  buildingsUnderConstruction: number;
  leaders: number;
  followerEdges: number;
  breakthroughAttempts: number;
  breakthroughAdoptions: number;
  totalArtifacts: number;
  discoveredArtifacts: number;
  artifactStudyDays: number;
  activeSignals: number;
  resolvedInterventions: number;
  eventCount: number;
  saveApproximateBytes: number;
  averageFertility: number;
  averageWaterQuality: number;
  averageContamination: number;
  drinkingWaterQuality: number;
  storedWaste: number;
  wasteCreatedLastDay: number;
  wasteRemovedLastDay: number;
}

export interface PersonProjection {
  id: PersonId;
  name: string;
  previousPosition: Position3;
  position: Position3;
  destination: Position3;
  yaw: number;
  heightMeters: number;
  lifeStage: LifeStage;
  biologicalSex: BiologicalSex;
  occupation: Occupation;
  task: TaskType;
  health: number;
  emotion: number;
  householdId: HouseholdId | null;
  homeBuildingId: BuildingId | null;
  partnerId: PersonId | null;
  decisionReason: string;
  rareEvidence: number;
}

export interface BuildingProjection {
  id: BuildingId;
  name: string;
  type: BuildingType;
  position: Position3;
  stage: ConstructionStage;
  progress: number;
  capacity: number;
  condition: number;
  environment: EnvironmentalCondition;
  occupied: number;
}

export type LegacyArtifactProjection = LegacyArtifact;

export interface WorldProjection {
  schemaVersion: typeof SIMULATION_SCHEMA_VERSION;
  day: number;
  tick: number;
  dayStartedAtUtc: string | null;
  worldDayDurationMs: number | null;
  settlementId: EntityId;
  settlementName: string;
  population: number;
  people: PersonProjection[];
  artifacts: LegacyArtifactProjection[];
  buildings: BuildingProjection[];
  resources: ResourceLedger;
  prices: ResourceLedger;
  pressure: PressureState;
  recentEvents: SimulationEvent[];
  metrics: SimulationMetrics;
  digest: string;
}

export type SimulationCommand =
  | { type: 'advance'; days: number }
  | { type: 'intervene'; intervention: ObserverIntervention }
  | { type: 'signal'; signal: NormalizedSignal }
  | { type: 'snapshot' }
  | { type: 'inspect-person'; personId: PersonId };
