import { z } from 'zod';

export const OBSERVATION_SCHEMA_VERSION = 'observation.v1' as const;
export const SIGNAL_SCHEMA_VERSION = 'causal-signal.v1' as const;
export const SNAPSHOT_SCHEMA_VERSION = 'signal-snapshot.v1' as const;
export const NORMALIZER_VERSION = 'normalizer.v1' as const;
export const OFFLINE_FIXTURE_VERSION = 'synthetic-signals.v1' as const;

export const INFORMATION_DOMAINS = [
  'economy',
  'agriculture',
  'climate',
  'disaster',
  'conflict',
  'health',
  'technology',
  'energy',
  'transportation',
  'trade',
  'social',
  'space',
] as const;

export const PRESSURE_DIMENSIONS = [
  'foodSecurity',
  'waterSecurity',
  'publicHealth',
  'infrastructureReliability',
  'energyReliability',
  'transportCapacity',
  'tradeCapacity',
  'economicConfidence',
  'innovationMomentum',
  'socialCohesion',
  'publicFear',
  'migrationPressure',
] as const;

const IsoTimestampSchema = z.string().datetime({ offset: true });
const UnitIntervalSchema = z.number().finite().min(0).max(1);
const SignedUnitSchema = z.number().finite().min(-1).max(1);

export const InformationDomainSchema = z.enum(INFORMATION_DOMAINS);
export const PressureDimensionSchema = z.enum(PRESSURE_DIMENSIONS);

export const GeographySchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('global') }).strict(),
  z
    .object({
      kind: z.literal('point'),
      latitude: z.number().finite().min(-90).max(90),
      longitude: z.number().finite().min(-180).max(180),
      radiusKm: z.number().finite().positive().max(20_100).optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal('region'),
      code: z.string().trim().min(1).max(80),
      name: z.string().trim().min(1).max(160).optional(),
      bounds: z
        .tuple([
          z.number().finite().min(-180).max(180),
          z.number().finite().min(-90).max(90),
          z.number().finite().min(-180).max(180),
          z.number().finite().min(-90).max(90),
        ])
        .optional(),
    })
    .strict(),
]);

export const AttributionSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    creator: z.string().trim().min(1).max(200),
    sourceUrl: z.string().url(),
    license: z.string().trim().min(1).max(200),
    licenseUrl: z.string().url().optional(),
    retrievedAt: IsoTimestampSchema,
    redistribution: z.enum(['permitted', 'conditional', 'metadata-only', 'unknown']),
    notes: z.string().trim().min(1).max(600).optional(),
  })
  .strict();

export const ObservationSourceSchema = z
  .object({
    adapter: z.string().trim().min(1).max(80),
    provider: z.string().trim().min(1).max(160),
    upstreamId: z.string().trim().min(1).max(300),
    upstreamUrl: z.string().url(),
    lineage: z.array(z.string().trim().min(1).max(400)).min(1).max(32),
    attribution: AttributionSchema,
  })
  .strict();

const MetricValueSchema = z.union([
  z.number().finite(),
  z.string().trim().max(300),
  z.boolean(),
]);

export const ExternalObservationSchema = z
  .object({
    schemaVersion: z.literal(OBSERVATION_SCHEMA_VERSION),
    id: z.string().trim().min(1).max(300),
    observedAt: IsoTimestampSchema,
    publishedAt: IsoTimestampSchema.optional(),
    ingestedAt: IsoTimestampSchema,
    domain: InformationDomainSchema,
    eventType: z.string().trim().min(1).max(120),
    geography: GeographySchema,
    metrics: z.record(z.string().trim().min(1).max(80), MetricValueSchema),
    evidence: z
      .object({
        directness: UnitIntervalSchema,
        timeliness: UnitIntervalSchema,
        officialSource: UnitIntervalSchema,
      })
      .strict(),
    source: ObservationSourceSchema,
    tags: z.array(z.string().trim().min(1).max(80)).max(32),
  })
  .strict();

const PressureVectorSchema = z
  .object({
    foodSecurity: SignedUnitSchema,
    waterSecurity: SignedUnitSchema,
    publicHealth: SignedUnitSchema,
    infrastructureReliability: SignedUnitSchema,
    energyReliability: SignedUnitSchema,
    transportCapacity: SignedUnitSchema,
    tradeCapacity: SignedUnitSchema,
    economicConfidence: SignedUnitSchema,
    innovationMomentum: SignedUnitSchema,
    socialCohesion: SignedUnitSchema,
    publicFear: SignedUnitSchema,
    migrationPressure: SignedUnitSchema,
  })
  .strict();

export const CausalSignalSchema = z
  .object({
    schemaVersion: z.literal(SIGNAL_SCHEMA_VERSION),
    normalizerVersion: z.literal(NORMALIZER_VERSION),
    id: z.string().trim().min(1).max(300),
    asOf: IsoTimestampSchema,
    domain: InformationDomainSchema,
    eventFamily: z.string().trim().min(1).max(120),
    geography: GeographySchema,
    intensity: UnitIntervalSchema,
    confidence: UnitIntervalSchema,
    sourceAgreement: UnitIntervalSchema,
    novelty: UnitIntervalSchema,
    durationDays: z.number().finite().positive().max(36_500),
    decay: z
      .object({
        model: z.literal('exponential-half-life'),
        halfLifeDays: z.number().finite().positive().max(36_500),
      })
      .strict(),
    objectivePressure: PressureVectorSchema,
    beliefPressure: PressureVectorSchema,
    observationIds: z.array(z.string().trim().min(1).max(300)).min(1),
    lineage: z.array(z.string().trim().min(1).max(400)).min(1),
    rationale: z.string().trim().min(1).max(500),
    revision: z.number().int().nonnegative(),
  })
  .strict();

export const SourceRunSchema = z
  .object({
    adapter: z.string().trim().min(1).max(80),
    provider: z.string().trim().min(1).max(160),
    status: z.enum(['success', 'failed', 'skipped', 'synthetic']),
    observationCount: z.number().int().nonnegative(),
    startedAt: IsoTimestampSchema,
    finishedAt: IsoTimestampSchema,
    error: z.string().trim().min(1).max(500).optional(),
  })
  .strict();

export const SignalSnapshotSchema = z
  .object({
    schemaVersion: z.literal(SNAPSHOT_SCHEMA_VERSION),
    normalizerVersion: z.literal(NORMALIZER_VERSION),
    generatedAt: IsoTimestampSchema,
    mode: z.enum(['offline', 'live', 'mixed']),
    fixture: z.boolean(),
    fixtureVersion: z.literal(OFFLINE_FIXTURE_VERSION).optional(),
    sources: z.array(SourceRunSchema),
    observations: z.array(ExternalObservationSchema),
    signals: z.array(CausalSignalSchema),
  })
  .strict();

export type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly [unknown, ...unknown[]]
    ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
  : T extends readonly (infer Item)[]
    ? readonly DeepReadonly<Item>[]
    : T extends object
      ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
      : T;

export type InformationDomain = z.infer<typeof InformationDomainSchema>;
export type Geography = DeepReadonly<z.infer<typeof GeographySchema>>;
export type PressureDimension = z.infer<typeof PressureDimensionSchema>;
export type PressureVector = DeepReadonly<z.infer<typeof PressureVectorSchema>>;
export type ExternalObservation = DeepReadonly<z.infer<typeof ExternalObservationSchema>>;
export type CausalSignal = DeepReadonly<z.infer<typeof CausalSignalSchema>>;
export type SourceRun = DeepReadonly<z.infer<typeof SourceRunSchema>>;
export type SignalSnapshot = DeepReadonly<z.infer<typeof SignalSnapshotSchema>>;

function freezeRecursively(value: unknown): void {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) {
    return;
  }

  for (const child of Object.values(value as Record<string, unknown>)) {
    freezeRecursively(child);
  }

  Object.freeze(value);
}

function parseAndFreeze<Schema extends z.ZodType>(
  schema: Schema,
  value: unknown,
): DeepReadonly<z.infer<Schema>> {
  const parsed: z.infer<Schema> = schema.parse(value);
  freezeRecursively(parsed);
  return parsed as DeepReadonly<z.infer<Schema>>;
}

export function parseObservation(value: unknown): ExternalObservation {
  return parseAndFreeze(ExternalObservationSchema, value);
}

export function parseSignal(value: unknown): CausalSignal {
  return parseAndFreeze(CausalSignalSchema, value);
}

export function parseSnapshot(value: unknown): SignalSnapshot {
  return parseAndFreeze(SignalSnapshotSchema, value);
}

export function emptyPressureVector(): Record<PressureDimension, number> {
  return Object.fromEntries(PRESSURE_DIMENSIONS.map((key) => [key, 0])) as Record<
    PressureDimension,
    number
  >;
}
