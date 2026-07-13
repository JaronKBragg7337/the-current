import { OBSERVATION_SCHEMA_VERSION, parseObservation } from '../schema';
import type {
  ExternalObservation,
  Geography,
  InformationDomain,
} from '../schema';

export const DEFAULT_USER_AGENT =
  'The-Current/0.1 (+https://github.com/Heartbeat-Observatory/the-current; public research project)';

export interface ObservationInput {
  readonly id: string;
  readonly observedAt: string;
  readonly publishedAt?: string;
  readonly ingestedAt: string;
  readonly domain: InformationDomain;
  readonly eventType: string;
  readonly geography: Geography;
  readonly metrics: Readonly<Record<string, number | string | boolean>>;
  readonly evidence: {
    readonly directness: number;
    readonly timeliness: number;
    readonly officialSource: number;
  };
  readonly source: {
    readonly adapter: string;
    readonly provider: string;
    readonly upstreamId: string;
    readonly upstreamUrl: string;
    readonly lineage: readonly string[];
    readonly attribution: {
      readonly title: string;
      readonly creator: string;
      readonly sourceUrl: string;
      readonly license: string;
      readonly licenseUrl?: string;
      readonly retrievedAt: string;
      readonly redistribution: 'permitted' | 'conditional' | 'metadata-only' | 'unknown';
      readonly notes?: string;
    };
  };
  readonly tags: readonly string[];
}

export function clamp(value: number, minimum = 0, maximum = 1): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function safeIdentifier(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9:._/-]+/g, '-').slice(0, 260);
}

export function toIsoTimestamp(value: string | number | Date): string | undefined {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export function toUtcIsoTimestamp(value: string): string | undefined {
  const normalized = value.trim().replace(' ', 'T');
  if (normalized === '') return undefined;
  const timestampWithZone = /[zZ]|[+-]\d{2}:?\d{2}$/.test(normalized)
    ? normalized
    : `${normalized}Z`;
  return toIsoTimestamp(timestampWithZone);
}

export function timeliness(observedAt: string, ingestedAt: string, usefulHours = 24): number {
  const elapsedHours = Math.max(
    0,
    (new Date(ingestedAt).getTime() - new Date(observedAt).getTime()) / 3_600_000,
  );
  return clamp(Math.exp((-Math.LN2 * elapsedHours) / usefulHours));
}

export function createObservation(input: ObservationInput): ExternalObservation {
  return parseObservation({
    schemaVersion: OBSERVATION_SCHEMA_VERSION,
    ...input,
  });
}

export function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

export function finiteNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

export function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

export function hostnameFromUrl(value: unknown): string | undefined {
  const text = nonEmptyString(value);
  if (text === undefined) {
    return undefined;
  }
  try {
    return new URL(text).hostname.toLowerCase();
  } catch {
    return undefined;
  }
}
