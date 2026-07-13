import type { NormalizedSignal, PressureAxis } from '../simulation/types';
import type { CausalSignal, Geography, PressureVector } from './schema';

export interface SimulationSignalProjectionOptions {
  /** World-day timestamp chosen by the authoritative simulation host. */
  readonly timestampDay: number;
  /** Delayed entry into the causal loop; defaults to timestampDay. */
  readonly effectiveDay?: number;
}

function clampSigned(value: number): number {
  return Math.min(1, Math.max(-1, value));
}

function mapPressureVector(vector: PressureVector): Partial<Record<PressureAxis, number>> {
  const mapped: Partial<Record<PressureAxis, number>> = {};
  const add = (axis: PressureAxis, value: number): void => {
    mapped[axis] = clampSigned((mapped[axis] ?? 0) + value);
  };

  // The simulation's positive axes represent a problem demanding attention;
  // the external schema's "security/reliability/capacity" values are positive
  // when conditions improve, so those dimensions are intentionally inverted.
  add('food', -vector.foodSecurity);
  add('water', -vector.waterSecurity);
  add('health', -vector.publicHealth);
  add('construction', -vector.infrastructureReliability);
  add('safety', -vector.infrastructureReliability * 0.35);
  add('energy', -vector.energyReliability);
  add('transportation', -vector.transportCapacity);
  add('trade', -vector.tradeCapacity);
  add('sentiment', -vector.economicConfidence * 0.65);
  add('knowledge', vector.innovationMomentum);
  add('sentiment', -vector.socialCohesion * 0.7);
  add('sentiment', vector.publicFear);
  add('construction', vector.migrationPressure * 0.35);
  add('sentiment', vector.migrationPressure * 0.2);

  for (const axis of Object.keys(mapped) as PressureAxis[]) {
    if (mapped[axis] === 0) delete mapped[axis];
  }
  return mapped;
}

function serializeGeography(geography: Geography): string {
  if (geography.kind === 'global') return 'global';
  if (geography.kind === 'point') {
    const radius = geography.radiusKm === undefined ? '' : `;r=${geography.radiusKm}`;
    return `point:${geography.latitude},${geography.longitude}${radius}`;
  }
  const bounds = geography.bounds === undefined ? '' : `;bbox=${geography.bounds.join(',')}`;
  return `region:${geography.code}${bounds}`;
}

/**
 * Explicit boundary adapter for the authoritative simulation. The caller owns
 * real-time-to-world-day mapping; this function does not silently invent one.
 */
export function toSimulationSignal(
  signal: CausalSignal,
  options: SimulationSignalProjectionOptions,
): NormalizedSignal {
  if (!Number.isInteger(options.timestampDay) || options.timestampDay < 0) {
    throw new RangeError('timestampDay must be a non-negative whole world day');
  }
  const effectiveDay = options.effectiveDay ?? options.timestampDay;
  if (!Number.isInteger(effectiveDay) || effectiveDay < options.timestampDay) {
    throw new RangeError('effectiveDay must be a whole world day at or after timestampDay');
  }

  return {
    // A normalized source signal can be submitted on more than one world day.
    // The occurrence identity keeps the captured source lineage while making
    // persistence append-only across later submissions instead of overwriting
    // the first queued-day record under the source signal ID.
    id: `${signal.id}:queued:${options.timestampDay.toString()}:effective:${effectiveDay.toString()}`,
    sourceIds: [...signal.observationIds],
    domain: signal.domain,
    geography: serializeGeography(signal.geography),
    intensity: signal.intensity,
    confidence: signal.confidence,
    sourceAgreement: signal.sourceAgreement,
    novelty: signal.novelty,
    durationDays: signal.durationDays,
    halfLifeDays: signal.decay.halfLifeDays,
    timestampDay: options.timestampDay,
    effectiveDay,
    objectivePressure: mapPressureVector(signal.objectivePressure),
    beliefPressure: mapPressureVector(signal.beliefPressure),
  };
}
