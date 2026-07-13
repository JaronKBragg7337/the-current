import { fetchJson } from '../http';
import type { ExternalObservation, Geography, InformationDomain } from '../schema';
import {
  DEFAULT_USER_AGENT,
  asRecord,
  createObservation,
  finiteNumber,
  nonEmptyString,
  safeIdentifier,
  timeliness,
  toIsoTimestamp,
} from './common';
import type { InformationAdapter } from './types';

const DEFAULT_ENDPOINT = 'https://eonet.gsfc.nasa.gov/api/v3/events';

export interface EonetAdapterOptions {
  readonly days?: number;
  readonly maxEvents?: number;
  readonly endpoint?: string;
}

interface CoordinatePoint {
  readonly longitude: number;
  readonly latitude: number;
}

function collectCoordinatePoints(value: unknown, output: CoordinatePoint[]): void {
  if (!Array.isArray(value)) {
    return;
  }

  const longitude = finiteNumber(value[0]);
  const latitude = finiteNumber(value[1]);
  if (
    longitude !== undefined &&
    latitude !== undefined &&
    longitude >= -180 &&
    longitude <= 180 &&
    latitude >= -90 &&
    latitude <= 90
  ) {
    output.push({ longitude, latitude });
    return;
  }

  for (const child of value) {
    collectCoordinatePoints(child, output);
  }
}

function eventGeography(eventId: string, geometry: Record<string, unknown>): Geography {
  const points: CoordinatePoint[] = [];
  collectCoordinatePoints(geometry.coordinates, points);
  if (points.length === 1 && points[0] !== undefined) {
    return { kind: 'point', ...points[0] };
  }
  if (points.length > 1) {
    const longitudes = points.map((point) => point.longitude);
    const latitudes = points.map((point) => point.latitude);
    return {
      kind: 'region',
      code: `eonet:${eventId}`,
      bounds: [
        Math.min(...longitudes),
        Math.min(...latitudes),
        Math.max(...longitudes),
        Math.max(...latitudes),
      ],
    };
  }
  return { kind: 'global' };
}

function categoryDomain(categoryId: string): InformationDomain {
  const normalized = categoryId.toLowerCase();
  if (normalized.includes('drought')) return 'agriculture';
  if (
    normalized.includes('ice') ||
    normalized.includes('snow') ||
    normalized.includes('temperature') ||
    normalized.includes('watercolor')
  ) {
    return 'climate';
  }
  return 'disaster';
}

function latestGeometry(value: unknown): Record<string, unknown> | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  return value
    .map(asRecord)
    .filter((item): item is Record<string, unknown> => item !== undefined)
    .sort((left, right) => {
      const leftDate = toIsoTimestamp(nonEmptyString(left.date) ?? '') ?? '';
      const rightDate = toIsoTimestamp(nonEmptyString(right.date) ?? '') ?? '';
      return rightDate.localeCompare(leftDate);
    })[0];
}

export function createEonetAdapter(options: EonetAdapterOptions = {}): InformationAdapter {
  const endpoint = options.endpoint ?? DEFAULT_ENDPOINT;
  const days = Math.max(1, Math.min(365, options.days ?? 30));
  const maxEvents = Math.max(1, Math.min(500, options.maxEvents ?? 100));

  return {
    id: 'nasa-eonet',
    provider: 'NASA Earth Observatory Natural Event Tracker',
    async fetch(context): Promise<readonly ExternalObservation[]> {
      const url = new URL(endpoint);
      url.searchParams.set('status', 'open');
      url.searchParams.set('days', String(days));
      url.searchParams.set('limit', String(maxEvents));
      const request = context.request ?? fetchJson;
      const payload = asRecord(
        await request(url, {
          headers: { 'User-Agent': DEFAULT_USER_AGENT },
          ...(context.signal === undefined ? {} : { signal: context.signal }),
        }),
      );
      const events = Array.isArray(payload?.events) ? payload.events : [];
      const ingestedAt = context.now.toISOString();
      const observations: ExternalObservation[] = [];

      for (const rawEvent of events.slice(0, maxEvents)) {
        const event = asRecord(rawEvent);
        const eventId = nonEmptyString(event?.id);
        const geometry = latestGeometry(event?.geometry);
        const observedAt = toIsoTimestamp(nonEmptyString(geometry?.date) ?? '');
        if (eventId === undefined || geometry === undefined || observedAt === undefined) {
          continue;
        }

        const rawCategories = Array.isArray(event?.categories) ? event.categories : [];
        const categoryIds = rawCategories
          .map((item) => nonEmptyString(asRecord(item)?.id))
          .filter((item): item is string => item !== undefined);
        const primaryCategory = categoryIds[0] ?? 'natural-event';
        const rawSources = Array.isArray(event?.sources) ? event.sources : [];
        const sourceLineage = rawSources
          .flatMap((item) => {
            const source = asRecord(item);
            const id = nonEmptyString(source?.id);
            const sourceUrl = nonEmptyString(source?.url);
            return [
              ...(id === undefined ? [] : [`origin:eonet-source:${id}`]),
              ...(sourceUrl === undefined ? [] : [`reference:${sourceUrl}`]),
            ];
          })
          .slice(0, 20);
        const eventUrl = nonEmptyString(event?.link) ?? `${endpoint}/${encodeURIComponent(eventId)}`;
        const magnitude = finiteNumber(geometry.magnitudeValue);
        const magnitudeUnit = nonEmptyString(geometry.magnitudeUnit);

        observations.push(
          createObservation({
            id: `obs:eonet:${safeIdentifier(eventId)}`,
            observedAt,
            ingestedAt,
            domain: categoryDomain(primaryCategory),
            eventType: `eonet-${safeIdentifier(primaryCategory).toLowerCase()}`,
            geography: eventGeography(eventId, geometry),
            metrics: {
              geometryCount: Array.isArray(event?.geometry) ? event.geometry.length : 1,
              corroboratingSourceCount: rawSources.length,
              ...(magnitude === undefined ? {} : { magnitude }),
              ...(magnitudeUnit === undefined ? {} : { magnitudeUnit }),
            },
            evidence: {
              directness: 0.85,
              timeliness: timeliness(observedAt, ingestedAt, 72),
              officialSource: 0.95,
            },
            source: {
              adapter: 'nasa-eonet',
              provider: 'NASA Earth Observatory Natural Event Tracker',
              upstreamId: eventId,
              upstreamUrl: eventUrl,
              lineage: ['origin:nasa-eonet', `event:eonet:${eventId}`, ...sourceLineage],
              attribution: {
                title: 'NASA EONET API v3',
                creator: 'NASA Earth Science Data Systems',
                sourceUrl: url.toString(),
                license: 'NASA media/data usage guidelines; upstream source rights may vary',
                licenseUrl: 'https://www.nasa.gov/nasa-brand-center/images-and-media/',
                retrievedAt: ingestedAt,
                redistribution: 'conditional',
                notes: 'EONET aggregates third-party event sources; preserve upstream lineage and verify source-specific rights before republishing content.',
              },
            },
            tags: ['natural-event', ...categoryIds.map((id) => safeIdentifier(id).toLowerCase())],
          }),
        );
      }

      return observations;
    },
  };
}
