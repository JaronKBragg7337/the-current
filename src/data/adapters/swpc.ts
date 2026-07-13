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
  toUtcIsoTimestamp,
} from './common';
import type { InformationAdapter } from './types';

const DEFAULT_ENDPOINT =
  'https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json';

export interface SwpcAdapterOptions {
  readonly endpoint?: string;
}

function recordsFromPayload(payload: unknown): readonly Record<string, unknown>[] {
  if (!Array.isArray(payload) || payload.length === 0) {
    return [];
  }
  const first = payload[0];
  if (Array.isArray(first)) {
    const headers = first.map((value) => String(value));
    return payload.slice(1).flatMap((row) => {
      if (!Array.isArray(row)) return [];
      return [Object.fromEntries(headers.map((header, index) => [header, row[index]]))];
    });
  }
  return payload
    .map(asRecord)
    .filter((item): item is Record<string, unknown> => item !== undefined);
}

export function createSwpcAdapter(options: SwpcAdapterOptions = {}): InformationAdapter {
  const endpoint = options.endpoint ?? DEFAULT_ENDPOINT;

  return {
    id: 'noaa-swpc-kp',
    provider: 'NOAA Space Weather Prediction Center',
    async fetch(context): Promise<readonly ExternalObservation[]> {
      const request = context.request ?? fetchJson;
      const payload = await request(endpoint, {
        headers: { 'User-Agent': DEFAULT_USER_AGENT },
        ...(context.signal === undefined ? {} : { signal: context.signal }),
      });
      const records = recordsFromPayload(payload);
      const latest = records
        .map((record) => {
          const observedAt = toUtcIsoTimestamp(
            nonEmptyString(record.time_tag) ?? nonEmptyString(record.timeTag) ?? '',
          );
          return observedAt === undefined ? undefined : { record, observedAt };
        })
        .filter(
          (item): item is { record: Record<string, unknown>; observedAt: string } =>
            item !== undefined,
        )
        .sort((left, right) => right.observedAt.localeCompare(left.observedAt))[0];

      if (latest === undefined) {
        return [];
      }

      const kp =
        finiteNumber(latest.record.Kp) ??
        finiteNumber(latest.record.kp) ??
        finiteNumber(latest.record.kp_index) ??
        finiteNumber(latest.record.estimated_kp);
      if (kp === undefined) {
        return [];
      }

      const ingestedAt = context.now.toISOString();
      const aRunning =
        finiteNumber(latest.record.a_running) ?? finiteNumber(latest.record.aRunning);
      const stationCount =
        finiteNumber(latest.record.station_count) ?? finiteNumber(latest.record.stationCount);

      return [
        createObservation({
          id: `obs:swpc:kp:${safeIdentifier(latest.observedAt)}`,
          observedAt: latest.observedAt,
          ingestedAt,
          domain: 'space',
          eventType: 'geomagnetic-activity',
          geography: { kind: 'global' },
          metrics: {
            kpIndex: kp,
            ...(aRunning === undefined ? {} : { aRunning }),
            ...(stationCount === undefined ? {} : { stationCount }),
          },
          evidence: {
            directness: 1,
            timeliness: timeliness(latest.observedAt, ingestedAt, 3),
            officialSource: 1,
          },
          source: {
            adapter: 'noaa-swpc-kp',
            provider: 'NOAA Space Weather Prediction Center',
            upstreamId: `planetary-k-index:${latest.observedAt}`,
            upstreamUrl: endpoint,
            lineage: ['origin:noaa-swpc', `measurement:planetary-kp:${latest.observedAt}`],
            attribution: {
              title: 'NOAA Planetary K-index',
              creator: 'NOAA Space Weather Prediction Center',
              sourceUrl: endpoint,
              license: 'U.S. government work; generally public domain',
              licenseUrl: 'https://www.noaa.gov/disclaimer',
              retrievedAt: ingestedAt,
              redistribution: 'permitted',
              notes: 'Credit NOAA/SWPC. Operational products may be revised and carry no warranty.',
            },
          },
          tags: ['space-weather', 'geomagnetic'],
        }),
      ];
    },
  };
}
