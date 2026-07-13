import { createObservation } from '../adapters/common';
import { normalizeObservations } from '../normalize';
import {
  NORMALIZER_VERSION,
  OFFLINE_FIXTURE_VERSION,
  SNAPSHOT_SCHEMA_VERSION,
  parseSnapshot,
} from '../schema';
import type { ExternalObservation, SignalSnapshot } from '../schema';

const FIXTURE_TIME = '2026-01-15T12:00:00.000Z';
const PROJECT_URL = 'https://www.heartbeatobservatory.com/worlds/the-current/';

function attribution(adapter: string) {
  return {
    title: `The Current synthetic ${adapter} fixture`,
    creator: 'The Current contributors',
    sourceUrl: PROJECT_URL,
    license: 'CC0-1.0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    retrievedAt: FIXTURE_TIME,
    redistribution: 'permitted' as const,
    notes: 'Authored test data only; it does not describe a real event, person, or source record.',
  };
}

export function createOfflineObservations(): readonly ExternalObservation[] {
  return [
    createObservation({
      id: 'obs:synthetic:quake-sensor-a',
      observedAt: '2026-01-15T10:00:00.000Z',
      ingestedAt: FIXTURE_TIME,
      domain: 'disaster',
      eventType: 'earthquake',
      geography: { kind: 'point', latitude: 12.34, longitude: -45.67 },
      metrics: { magnitude: 5.4, depthKm: 18, tsunami: false },
      evidence: { directness: 0.95, timeliness: 0.95, officialSource: 0.9 },
      source: {
        adapter: 'synthetic-seismic-a',
        provider: 'The Current synthetic fixture',
        upstreamId: 'quake-sensor-a',
        upstreamUrl: `${PROJECT_URL}#synthetic-quake-a`,
        lineage: ['origin:synthetic-seismic-a', 'event:synthetic:quake-a'],
        attribution: attribution('seismic-a'),
      },
      tags: ['earthquake', 'synthetic'],
    }),
    createObservation({
      id: 'obs:synthetic:quake-sensor-b',
      observedAt: '2026-01-15T10:04:00.000Z',
      ingestedAt: FIXTURE_TIME,
      domain: 'disaster',
      eventType: 'earthquake',
      geography: { kind: 'point', latitude: 12.341, longitude: -45.669 },
      metrics: { magnitude: 5.3, depthKm: 17.5, tsunami: false },
      evidence: { directness: 0.85, timeliness: 0.95, officialSource: 0.8 },
      source: {
        adapter: 'synthetic-seismic-b',
        provider: 'The Current synthetic fixture',
        upstreamId: 'quake-sensor-b',
        upstreamUrl: `${PROJECT_URL}#synthetic-quake-b`,
        lineage: ['origin:synthetic-seismic-b', 'event:synthetic:quake-b'],
        attribution: attribution('seismic-b'),
      },
      tags: ['earthquake', 'synthetic'],
    }),
    createObservation({
      id: 'obs:synthetic:space-weather',
      observedAt: '2026-01-15T11:00:00.000Z',
      ingestedAt: FIXTURE_TIME,
      domain: 'space',
      eventType: 'geomagnetic-activity',
      geography: { kind: 'global' },
      metrics: { kpIndex: 6.1, stationCount: 8 },
      evidence: { directness: 0.95, timeliness: 0.9, officialSource: 0.9 },
      source: {
        adapter: 'synthetic-space-weather',
        provider: 'The Current synthetic fixture',
        upstreamId: 'space-weather-test-1',
        upstreamUrl: `${PROJECT_URL}#synthetic-space-weather`,
        lineage: ['origin:synthetic-space-weather', 'measurement:synthetic:kp-1'],
        attribution: attribution('space-weather'),
      },
      tags: ['space-weather', 'synthetic'],
    }),
    createObservation({
      id: 'obs:synthetic:technology-attention',
      observedAt: '2026-01-15T09:30:00.000Z',
      publishedAt: '2026-01-15T09:30:00.000Z',
      ingestedAt: FIXTURE_TIME,
      domain: 'technology',
      eventType: 'community-technology-attention',
      geography: { kind: 'global' },
      metrics: { itemId: 1, rank: 3, score: 180, commentCount: 64, itemType: 'story' },
      evidence: { directness: 0.75, timeliness: 0.9, officialSource: 0.7 },
      source: {
        adapter: 'synthetic-attention',
        provider: 'The Current synthetic fixture',
        upstreamId: 'attention-test-1',
        upstreamUrl: `${PROJECT_URL}#synthetic-attention`,
        lineage: ['origin:synthetic-attention', 'item:synthetic:attention-1'],
        attribution: attribution('attention'),
      },
      tags: ['community-attention', 'technology', 'synthetic'],
    }),
    createObservation({
      id: 'obs:synthetic:weather',
      observedAt: '2026-01-15T11:45:00.000Z',
      ingestedAt: FIXTURE_TIME,
      domain: 'climate',
      eventType: 'weather-conditions',
      geography: { kind: 'point', latitude: 39.77, longitude: -86.16, radiusKm: 25 },
      metrics: {
        temperatureC: 36,
        relativeHumidityPercent: 61,
        precipitationMm: 2.5,
        weatherCode: 61,
        windSpeedKmh: 28,
      },
      evidence: { directness: 0.9, timeliness: 0.95, officialSource: 0.75 },
      source: {
        adapter: 'synthetic-weather',
        provider: 'The Current synthetic fixture',
        upstreamId: 'weather-test-1',
        upstreamUrl: `${PROJECT_URL}#synthetic-weather`,
        lineage: ['origin:synthetic-weather', 'forecast-cell:synthetic:weather-1'],
        attribution: attribution('weather'),
      },
      tags: ['weather', 'synthetic'],
    }),
  ];
}

export function createOfflineSnapshot(): SignalSnapshot {
  const observations = createOfflineObservations();
  return parseSnapshot({
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    normalizerVersion: NORMALIZER_VERSION,
    generatedAt: FIXTURE_TIME,
    mode: 'offline',
    fixture: true,
    fixtureVersion: OFFLINE_FIXTURE_VERSION,
    sources: [
      {
        adapter: 'synthetic-fixture',
        provider: 'The Current contributors',
        status: 'synthetic',
        observationCount: observations.length,
        startedAt: FIXTURE_TIME,
        finishedAt: FIXTURE_TIME,
      },
    ],
    observations,
    signals: normalizeObservations(observations),
  });
}
