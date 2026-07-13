import { fetchJson } from '../http';
import type { ExternalObservation } from '../schema';
import {
  DEFAULT_USER_AGENT,
  asRecord,
  createObservation,
  finiteNumber,
  safeIdentifier,
  timeliness,
  toUtcIsoTimestamp,
} from './common';
import type { InformationAdapter } from './types';

const DEFAULT_ENDPOINT = 'https://api.open-meteo.com/v1/forecast';

export interface OpenMeteoAdapterOptions {
  readonly latitude: number;
  readonly longitude: number;
  readonly locationId?: string;
  readonly endpoint?: string;
}

export function createOpenMeteoAdapter(options: OpenMeteoAdapterOptions): InformationAdapter {
  if (options.latitude < -90 || options.latitude > 90) {
    throw new RangeError('Open-Meteo latitude must be between -90 and 90');
  }
  if (options.longitude < -180 || options.longitude > 180) {
    throw new RangeError('Open-Meteo longitude must be between -180 and 180');
  }
  const endpoint = options.endpoint ?? DEFAULT_ENDPOINT;
  const locationId = safeIdentifier(
    options.locationId ?? `${options.latitude.toFixed(4)},${options.longitude.toFixed(4)}`,
  );

  return {
    id: `open-meteo-${locationId}`,
    provider: 'Open-Meteo',
    async fetch(context): Promise<readonly ExternalObservation[]> {
      const url = new URL(endpoint);
      url.searchParams.set('latitude', String(options.latitude));
      url.searchParams.set('longitude', String(options.longitude));
      url.searchParams.set(
        'current',
        'temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_gusts_10m',
      );
      url.searchParams.set('timezone', 'UTC');
      const request = context.request ?? fetchJson;
      const payload = asRecord(
        await request(url, {
          headers: { 'User-Agent': DEFAULT_USER_AGENT },
          ...(context.signal === undefined ? {} : { signal: context.signal }),
        }),
      );
      const current = asRecord(payload?.current) ?? asRecord(payload?.current_weather);
      const rawTime = typeof current?.time === 'string' ? current.time : '';
      const observedAt = toUtcIsoTimestamp(rawTime);
      if (current === undefined || observedAt === undefined) {
        return [];
      }

      const metrics: Record<string, number | string | boolean> = {};
      const mappings = {
        temperatureC: current.temperature_2m ?? current.temperature,
        relativeHumidityPercent: current.relative_humidity_2m,
        precipitationMm: current.precipitation,
        weatherCode: current.weather_code ?? current.weathercode,
        windSpeedKmh: current.wind_speed_10m ?? current.windspeed,
        windGustKmh: current.wind_gusts_10m,
      };
      for (const [key, value] of Object.entries(mappings)) {
        const number = finiteNumber(value);
        if (number !== undefined) metrics[key] = number;
      }

      const ingestedAt = context.now.toISOString();
      return [
        createObservation({
          id: `obs:open-meteo:${locationId}:${safeIdentifier(observedAt)}`,
          observedAt,
          ingestedAt,
          domain: 'climate',
          eventType: 'weather-conditions',
          geography: {
            kind: 'point',
            latitude: options.latitude,
            longitude: options.longitude,
            radiusKm: 25,
          },
          metrics,
          evidence: {
            directness: 0.9,
            timeliness: timeliness(observedAt, ingestedAt, 6),
            officialSource: 0.75,
          },
          source: {
            adapter: `open-meteo-${locationId}`,
            provider: 'Open-Meteo',
            upstreamId: `${locationId}:${observedAt}`,
            upstreamUrl: url.toString(),
            lineage: ['origin:open-meteo', `forecast-cell:${locationId}:${observedAt}`],
            attribution: {
              title: 'Open-Meteo Forecast API',
              creator: 'Open-Meteo',
              sourceUrl: url.toString(),
              license: 'CC BY 4.0 data; hosted free API limited to non-commercial use',
              licenseUrl: 'https://open-meteo.com/en/terms',
              retrievedAt: ingestedAt,
              redistribution: 'conditional',
              notes: 'Attribution is required. Confirm commercial API terms or self-host before commercial production use.',
            },
          },
          tags: ['weather', 'current-conditions'],
        }),
      ];
    },
  };
}
