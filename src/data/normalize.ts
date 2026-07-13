import {
  NORMALIZER_VERSION,
  SIGNAL_SCHEMA_VERSION,
  emptyPressureVector,
  parseSignal,
} from './schema';
import type {
  CausalSignal,
  ExternalObservation,
  Geography,
  PressureDimension,
} from './schema';
import { clamp } from './adapters/common';

interface CandidateSignal {
  readonly observation: ExternalObservation;
  readonly eventFamily: string;
  readonly intensity: number;
  readonly objective: Readonly<Record<PressureDimension, number>>;
  readonly belief: Readonly<Record<PressureDimension, number>>;
  readonly durationDays: number;
  readonly halfLifeDays: number;
  readonly rationale: string;
}

export interface NormalizeOptions {
  readonly previousSignals?: readonly CausalSignal[];
}

function metric(observation: ExternalObservation, name: string): number | undefined {
  const value = observation.metrics[name];
  return typeof value === 'number' ? value : undefined;
}

function applyPressure(
  vector: Record<PressureDimension, number>,
  values: Partial<Record<PressureDimension, number>>,
): void {
  for (const [dimension, value] of Object.entries(values)) {
    if (typeof value === 'number') {
      const key = dimension as PressureDimension;
      vector[key] = clamp(value, -1, 1);
    }
  }
}

function normalizeEventFamily(eventType: string): string {
  const normalized = eventType.toLowerCase();
  if (normalized.includes('earthquake')) return 'earthquake';
  if (normalized.includes('wildfire')) return 'wildfire';
  if (normalized.includes('drought')) return 'drought';
  if (normalized.includes('flood')) return 'flood';
  if (normalized.includes('storm')) return 'severe-storm';
  if (normalized.includes('volcano')) return 'volcano';
  if (normalized.includes('landslide')) return 'landslide';
  if (normalized.includes('temperature')) return 'temperature-extreme';
  return normalized;
}

function candidateFromObservation(observation: ExternalObservation): CandidateSignal {
  const objective = emptyPressureVector();
  const belief = emptyPressureVector();
  const eventFamily = normalizeEventFamily(observation.eventType);
  let intensity = 0.35;
  let durationDays = 7;
  let halfLifeDays = 2;
  let rationale =
    'Measured conditions become bounded pressures; settlements interpret them through local knowledge, capacity, and interests.';

  if (eventFamily === 'earthquake') {
    intensity = clamp(((metric(observation, 'magnitude') ?? 4) - 2) / 6);
    durationDays = 3;
    halfLifeDays = 1;
    applyPressure(objective, {
      infrastructureReliability: -intensity,
      transportCapacity: -0.65 * intensity,
      publicHealth: -0.35 * intensity,
      economicConfidence: -0.25 * intensity,
    });
    applyPressure(belief, {
      publicFear: 0.7 * intensity,
      migrationPressure: 0.3 * intensity,
      economicConfidence: -0.2 * intensity,
    });
    rationale =
      'Earthquake magnitude raises bounded infrastructure, transport, health, and fear pressures without directly damaging simulated assets.';
  } else if (eventFamily === 'wildfire') {
    intensity = clamp(metric(observation, 'magnitude') ?? 0.6);
    durationDays = 14;
    halfLifeDays = 5;
    applyPressure(objective, {
      publicHealth: -0.7 * intensity,
      infrastructureReliability: -0.45 * intensity,
      transportCapacity: -0.35 * intensity,
      foodSecurity: -0.25 * intensity,
    });
    applyPressure(belief, {
      publicFear: 0.75 * intensity,
      migrationPressure: 0.5 * intensity,
    });
    rationale =
      'Wildfire observations increase environmental hazard and displacement concern; institutions still choose whether and how to respond.';
  } else if (eventFamily === 'drought') {
    intensity = clamp(metric(observation, 'magnitude') ?? 0.55);
    durationDays = 60;
    halfLifeDays = 20;
    applyPressure(objective, {
      waterSecurity: -intensity,
      foodSecurity: -0.8 * intensity,
      publicHealth: -0.25 * intensity,
      tradeCapacity: -0.2 * intensity,
    });
    applyPressure(belief, {
      publicFear: 0.45 * intensity,
      migrationPressure: 0.55 * intensity,
      economicConfidence: -0.35 * intensity,
    });
    rationale =
      'Drought metadata creates slowly decaying water and food pressures that settlements interpret against their own reserves and technology.';
  } else if (
    eventFamily === 'flood' ||
    eventFamily === 'severe-storm' ||
    eventFamily === 'landslide' ||
    eventFamily === 'volcano'
  ) {
    intensity = clamp(metric(observation, 'magnitude') ?? 0.55);
    durationDays = eventFamily === 'flood' ? 10 : 7;
    halfLifeDays = eventFamily === 'flood' ? 4 : 2;
    applyPressure(objective, {
      infrastructureReliability: -0.75 * intensity,
      transportCapacity: -0.7 * intensity,
      publicHealth: -0.4 * intensity,
      tradeCapacity: -0.3 * intensity,
    });
    applyPressure(belief, {
      publicFear: 0.7 * intensity,
      migrationPressure: 0.35 * intensity,
    });
    rationale =
      'Natural-hazard metadata creates temporary logistics, infrastructure, health, and belief pressures rather than scripted disasters.';
  } else if (eventFamily === 'geomagnetic-activity') {
    const kp = clamp(metric(observation, 'kpIndex') ?? 0, 0, 9);
    intensity = kp / 9;
    const operationalSeverity = clamp((kp - 4) / 5);
    durationDays = 1;
    halfLifeDays = 0.25;
    applyPressure(objective, {
      energyReliability: -0.55 * operationalSeverity,
      infrastructureReliability: -0.35 * operationalSeverity,
      transportCapacity: -0.15 * operationalSeverity,
    });
    applyPressure(belief, {
      publicFear: 0.15 * operationalSeverity,
      innovationMomentum: 0.08 * intensity,
    });
    rationale =
      'The planetary K-index becomes short-lived grid and navigation pressure only above elevated levels; it never directly disables systems.';
  } else if (eventFamily === 'community-technology-attention') {
    const score = Math.max(0, metric(observation, 'score') ?? 0);
    const comments = Math.max(0, metric(observation, 'commentCount') ?? 0);
    const rank = Math.max(1, metric(observation, 'rank') ?? 30);
    intensity = clamp(
      (Math.log1p(score) / 8 + Math.log1p(comments) / 8 + 1 / Math.sqrt(rank)) / 3,
    );
    durationDays = 1;
    halfLifeDays = 0.4;
    applyPressure(belief, {
      innovationMomentum: 0.7 * intensity,
      economicConfidence: 0.12 * intensity,
    });
    rationale =
      'Aggregate public attention supplies a brief belief and curiosity pressure; it conveys no claim that a technology is valid or useful.';
  } else if (eventFamily === 'weather-conditions') {
    const temperature = metric(observation, 'temperatureC') ?? 20;
    const precipitation = Math.max(0, metric(observation, 'precipitationMm') ?? 0);
    const wind = Math.max(
      metric(observation, 'windSpeedKmh') ?? 0,
      metric(observation, 'windGustKmh') ?? 0,
    );
    const heatSeverity = clamp((temperature - 32) / 16);
    const coldSeverity = clamp((2 - temperature) / 22);
    const rainSeverity = clamp(precipitation / 25);
    const windSeverity = clamp(wind / 100);
    intensity = Math.max(0.05, heatSeverity, coldSeverity, rainSeverity, windSeverity);
    durationDays = 0.75;
    halfLifeDays = 0.25;
    applyPressure(objective, {
      publicHealth: -0.45 * Math.max(heatSeverity, coldSeverity),
      infrastructureReliability: -0.35 * Math.max(rainSeverity, windSeverity),
      transportCapacity: -0.45 * Math.max(rainSeverity, windSeverity),
      waterSecurity: rainSeverity > 0.15 ? 0.15 * rainSeverity : 0,
      energyReliability: -0.25 * Math.max(heatSeverity, coldSeverity),
    });
    applyPressure(belief, { publicFear: 0.18 * intensity });
    rationale =
      'Current weather becomes local, rapidly decaying operating pressure; simulated exposure and infrastructure determine consequences.';
  } else {
    switch (observation.domain) {
      case 'economy':
        applyPressure(belief, { economicConfidence: -0.35 * intensity });
        break;
      case 'agriculture':
        applyPressure(objective, { foodSecurity: -0.4 * intensity });
        break;
      case 'health':
        applyPressure(objective, { publicHealth: -0.5 * intensity });
        applyPressure(belief, { publicFear: 0.3 * intensity });
        break;
      case 'technology':
        applyPressure(belief, { innovationMomentum: 0.4 * intensity });
        break;
      case 'energy':
        applyPressure(objective, { energyReliability: -0.45 * intensity });
        break;
      case 'transportation':
        applyPressure(objective, { transportCapacity: -0.45 * intensity });
        break;
      case 'trade':
        applyPressure(objective, { tradeCapacity: -0.45 * intensity });
        break;
      case 'social':
      case 'conflict':
        applyPressure(belief, {
          socialCohesion: -0.4 * intensity,
          publicFear: 0.35 * intensity,
        });
        break;
      case 'climate':
      case 'disaster':
      case 'space':
        applyPressure(objective, { infrastructureReliability: -0.3 * intensity });
        break;
    }
  }

  return {
    observation,
    eventFamily,
    intensity,
    objective,
    belief,
    durationDays,
    halfLifeDays,
    rationale,
  };
}

function geographyKey(geography: Geography): string {
  if (geography.kind === 'global') return 'global';
  if (geography.kind === 'region') {
    if (geography.bounds === undefined) return `region:${geography.code.toLowerCase()}`;
    const centerLongitude = (geography.bounds[0] + geography.bounds[2]) / 2;
    const centerLatitude = (geography.bounds[1] + geography.bounds[3]) / 2;
    return `cell:${centerLatitude.toFixed(1)}:${centerLongitude.toFixed(1)}`;
  }
  return `cell:${geography.latitude.toFixed(1)}:${geography.longitude.toFixed(1)}`;
}

function timeBucket(observation: ExternalObservation, eventFamily: string): number {
  const bucketHours =
    eventFamily === 'community-technology-attention'
      ? 24
      : eventFamily === 'weather-conditions' || eventFamily === 'earthquake'
        ? 6
        : eventFamily === 'geomagnetic-activity'
          ? 3
          : 24;
  return Math.floor(new Date(observation.observedAt).getTime() / (bucketHours * 3_600_000));
}

function identityLineage(observation: ExternalObservation): string {
  return (
    observation.source.lineage.find((item) =>
      /^(event|measurement|item|forecast-cell):/.test(item),
    ) ?? observation.id
  );
}

function deduplicateObservations(
  observations: readonly ExternalObservation[],
): readonly ExternalObservation[] {
  const byIdentity = new Map<string, ExternalObservation>();
  for (const observation of [...observations].sort(
    (left, right) =>
      left.ingestedAt.localeCompare(right.ingestedAt) || left.id.localeCompare(right.id),
  )) {
    byIdentity.set(identityLineage(observation), observation);
  }
  return [...byIdentity.values()].sort((left, right) => left.id.localeCompare(right.id));
}

function independentOrigins(observations: readonly ExternalObservation[]): readonly string[] {
  const origins = new Set<string>();
  for (const observation of observations) {
    const upstreamOrigins = observation.source.lineage.filter((item) =>
      item.startsWith('origin:eonet-source:'),
    );
    if (upstreamOrigins.length > 0) {
      upstreamOrigins.forEach((item) => origins.add(item));
    } else {
      origins.add(`adapter:${observation.source.adapter}`);
    }
  }
  return [...origins].sort();
}

function combinePressures(
  candidates: readonly CandidateSignal[],
  field: 'objective' | 'belief',
): Record<PressureDimension, number> {
  const output = emptyPressureVector();
  const weights = candidates.map(
    ({ observation }) =>
      0.4 * observation.evidence.directness +
      0.25 * observation.evidence.timeliness +
      0.35 * observation.evidence.officialSource,
  );
  const totalWeight = Math.max(Number.EPSILON, weights.reduce((sum, value) => sum + value, 0));
  for (const dimension of Object.keys(output) as PressureDimension[]) {
    output[dimension] = clamp(
      candidates.reduce(
        (sum, candidate, index) =>
          sum + (candidate[field][dimension] ?? 0) * (weights[index] ?? 0),
        0,
      ) / totalWeight,
      -1,
      1,
    );
  }
  return output;
}

function fnv1a(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function average(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

function chooseGeography(candidates: readonly CandidateSignal[]): Geography {
  return (
    candidates.find((candidate) => candidate.observation.geography.kind === 'point')
      ?.observation.geography ??
    candidates.find((candidate) => candidate.observation.geography.kind === 'region')
      ?.observation.geography ?? { kind: 'global' }
  );
}

function matchingPreviousSignal(
  eventFamily: string,
  geography: Geography,
  previousSignals: readonly CausalSignal[],
): CausalSignal | undefined {
  const key = geographyKey(geography);
  return [...previousSignals]
    .filter(
      (signal) => signal.eventFamily === eventFamily && geographyKey(signal.geography) === key,
    )
    .sort((left, right) => right.asOf.localeCompare(left.asOf))[0];
}

/**
 * Converts observations into pressures only. It deliberately cannot mutate the
 * world: simulation institutions and NPCs consume these signals later.
 */
export function normalizeObservations(
  observations: readonly ExternalObservation[],
  options: NormalizeOptions = {},
): readonly CausalSignal[] {
  const candidates = deduplicateObservations(observations).map(candidateFromObservation);
  const groups = new Map<string, CandidateSignal[]>();
  for (const candidate of candidates) {
    const key = [
      candidate.observation.domain,
      candidate.eventFamily,
      geographyKey(candidate.observation.geography),
      timeBucket(candidate.observation, candidate.eventFamily),
    ].join('|');
    const group = groups.get(key) ?? [];
    group.push(candidate);
    groups.set(key, group);
  }

  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([groupKey, group]) => {
      const ordered = [...group].sort((left, right) =>
        left.observation.id.localeCompare(right.observation.id),
      );
      const observationsInGroup = ordered.map((candidate) => candidate.observation);
      const sourceCount = independentOrigins(observationsInGroup).length;
      const sourceAgreement = clamp(1 - 0.5 ** sourceCount);
      const evidenceScores = observationsInGroup.map(
        (observation) =>
          0.4 * observation.evidence.directness +
          0.25 * observation.evidence.timeliness +
          0.35 * observation.evidence.officialSource,
      );
      const maximumIntensity = Math.max(...ordered.map((candidate) => candidate.intensity));
      const intensity = clamp(
        0.7 * maximumIntensity + 0.3 * average(ordered.map((candidate) => candidate.intensity)),
      );
      const confidence = clamp(average(evidenceScores) * (0.65 + 0.35 * sourceAgreement));
      const geography = chooseGeography(ordered);
      const eventFamily = ordered[0]?.eventFamily ?? 'unknown';
      const asOf = observationsInGroup
        .map((observation) => observation.observedAt)
        .sort()
        .at(-1) as string;
      const durationDays = Math.max(...ordered.map((candidate) => candidate.durationDays));
      const halfLifeDays = Math.max(...ordered.map((candidate) => candidate.halfLifeDays));
      const previous = matchingPreviousSignal(
        eventFamily,
        geography,
        options.previousSignals ?? [],
      );
      const elapsedDays =
        previous === undefined
          ? Number.POSITIVE_INFINITY
          : Math.max(
              0,
              (new Date(asOf).getTime() - new Date(previous.asOf).getTime()) / 86_400_000,
            );
      const novelty =
        previous === undefined
          ? 1
          : clamp(
              Math.abs(intensity - previous.intensity) * 0.7 +
                Math.min(1, elapsedDays / halfLifeDays) * 0.3,
            );
      const lineage = [...new Set(observationsInGroup.flatMap((item) => item.source.lineage))].sort();

      return parseSignal({
        schemaVersion: SIGNAL_SCHEMA_VERSION,
        normalizerVersion: NORMALIZER_VERSION,
        id: `signal:${fnv1a(groupKey)}`,
        asOf,
        domain: observationsInGroup[0]?.domain ?? 'social',
        eventFamily,
        geography,
        intensity,
        confidence,
        sourceAgreement,
        novelty,
        durationDays,
        decay: { model: 'exponential-half-life', halfLifeDays },
        objectivePressure: combinePressures(ordered, 'objective'),
        beliefPressure: combinePressures(ordered, 'belief'),
        observationIds: observationsInGroup.map((item) => item.id),
        lineage,
        rationale: ordered[0]?.rationale ?? 'Normalized external pressure.',
        revision: (previous?.revision ?? -1) + 1,
      });
    });
}
