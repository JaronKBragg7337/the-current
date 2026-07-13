import { fetchJson } from '../http';
import type { ExternalObservation } from '../schema';
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

const DEFAULT_FEED =
  'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson';

export interface UsgsAdapterOptions {
  readonly feedUrl?: string;
  readonly maxEvents?: number;
}

export function createUsgsAdapter(options: UsgsAdapterOptions = {}): InformationAdapter {
  const feedUrl = options.feedUrl ?? DEFAULT_FEED;
  const maxEvents = Math.max(1, Math.min(500, options.maxEvents ?? 100));

  return {
    id: 'usgs-earthquakes',
    provider: 'U.S. Geological Survey',
    async fetch(context): Promise<readonly ExternalObservation[]> {
      const request = context.request ?? fetchJson;
      const payload = asRecord(
        await request(feedUrl, {
          headers: { 'User-Agent': DEFAULT_USER_AGENT },
          ...(context.signal === undefined ? {} : { signal: context.signal }),
        }),
      );
      const features = Array.isArray(payload?.features) ? payload.features.slice(0, maxEvents) : [];
      const ingestedAt = context.now.toISOString();
      const observations: ExternalObservation[] = [];

      for (const rawFeature of features) {
        const feature = asRecord(rawFeature);
        const properties = asRecord(feature?.properties);
        const geometry = asRecord(feature?.geometry);
        const coordinates = Array.isArray(geometry?.coordinates) ? geometry.coordinates : [];
        const upstreamId = nonEmptyString(feature?.id);
        const longitude = finiteNumber(coordinates[0]);
        const latitude = finiteNumber(coordinates[1]);
        const depthKm = finiteNumber(coordinates[2]);
        const magnitude = finiteNumber(properties?.mag);
        const observedAt = toIsoTimestamp(finiteNumber(properties?.time) ?? '');

        if (
          upstreamId === undefined ||
          observedAt === undefined ||
          latitude === undefined ||
          longitude === undefined ||
          latitude < -90 ||
          latitude > 90 ||
          longitude < -180 ||
          longitude > 180
        ) {
          continue;
        }

        const detailUrl = nonEmptyString(properties?.url) ?? `${feedUrl}#${encodeURIComponent(upstreamId)}`;
        const metrics: Record<string, number | string | boolean> = {
          ...(magnitude === undefined ? {} : { magnitude }),
          ...(depthKm === undefined ? {} : { depthKm }),
          ...(finiteNumber(properties?.sig) === undefined
            ? {}
            : { significance: finiteNumber(properties?.sig) as number }),
          ...(finiteNumber(properties?.felt) === undefined
            ? {}
            : { feltReports: finiteNumber(properties?.felt) as number }),
          tsunami: properties?.tsunami === 1,
        };

        observations.push(
          createObservation({
            id: `obs:usgs:${safeIdentifier(upstreamId)}`,
            observedAt,
            ingestedAt,
            domain: 'disaster',
            eventType: 'earthquake',
            geography: { kind: 'point', latitude, longitude },
            metrics,
            evidence: {
              directness: 1,
              timeliness: timeliness(observedAt, ingestedAt, 12),
              officialSource: 1,
            },
            source: {
              adapter: 'usgs-earthquakes',
              provider: 'U.S. Geological Survey',
              upstreamId,
              upstreamUrl: detailUrl,
              lineage: ['origin:usgs', `event:usgs:${upstreamId}`],
              attribution: {
                title: 'USGS Earthquake Hazards Program GeoJSON Feed',
                creator: 'U.S. Geological Survey',
                sourceUrl: feedUrl,
                license: 'U.S. government work; generally public domain',
                licenseUrl: 'https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits',
                retrievedAt: ingestedAt,
                redistribution: 'permitted',
                notes: 'Credit USGS. Source data is dynamic and carries no warranty.',
              },
            },
            tags: ['earthquake', 'geophysical'],
          }),
        );
      }

      return observations;
    },
  };
}
