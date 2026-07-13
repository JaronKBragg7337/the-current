import { describe, expect, it } from 'vitest';

import { createEonetAdapter } from './eonet';
import { createHackerNewsAdapter } from './hacker-news';
import { createOpenMeteoAdapter } from './open-meteo';
import { createSwpcAdapter } from './swpc';
import { createUsgsAdapter } from './usgs';

const NOW = new Date('2026-01-15T12:00:00.000Z');

describe('credential-free source adapters', () => {
  it('parses a bounded USGS GeoJSON feature', async () => {
    const adapter = createUsgsAdapter();
    const observations = await adapter.fetch({
      now: NOW,
      request: async () => ({
        features: [
          {
            id: 'test-event',
            geometry: { coordinates: [-86.1, 39.7, 12] },
            properties: {
              time: Date.parse('2026-01-15T11:55:00.000Z'),
              mag: 4.2,
              sig: 250,
              tsunami: 0,
              url: 'https://earthquake.usgs.gov/earthquakes/eventpage/test-event',
            },
          },
        ],
      }),
    });

    expect(observations).toHaveLength(1);
    expect(observations[0]?.metrics.magnitude).toBe(4.2);
    expect(observations[0]?.source.lineage).toContain('event:usgs:test-event');
  });

  it('parses EONET metadata without retaining title or description', async () => {
    const adapter = createEonetAdapter();
    const observations = await adapter.fetch({
      now: NOW,
      request: async () => ({
        events: [
          {
            id: 'EONET-test',
            title: 'intentionally ignored',
            description: 'intentionally ignored',
            link: 'https://eonet.gsfc.nasa.gov/api/v3/events/EONET-test',
            categories: [{ id: 'wildfires', title: 'Wildfires' }],
            sources: [{ id: 'TEST', url: 'https://example.invalid/test-source' }],
            geometry: [
              {
                date: '2026-01-15T10:00:00.000Z',
                type: 'Point',
                coordinates: [-120, 45],
              },
            ],
          },
        ],
      }),
    });

    expect(observations[0]?.eventType).toBe('eonet-wildfires');
    expect(JSON.stringify(observations[0])).not.toContain('intentionally ignored');
    expect(observations[0]?.source.lineage).toContain('origin:eonet-source:TEST');
  });

  it('accepts the NOAA tabular K-index product', async () => {
    const adapter = createSwpcAdapter();
    const observations = await adapter.fetch({
      now: NOW,
      request: async () => [
        ['time_tag', 'Kp', 'a_running', 'station_count'],
        ['2026-01-15T11:00:00Z', '5.67', '30', '8'],
      ],
    });

    expect(observations[0]?.metrics.kpIndex).toBe(5.67);
    expect(observations[0]?.domain).toBe('space');
  });

  it('retains only privacy-minimized Hacker News metadata', async () => {
    const adapter = createHackerNewsAdapter({ maxItems: 1 });
    const observations = await adapter.fetch({
      now: NOW,
      request: async (input) => {
        const url = input.toString();
        if (url.endsWith('topstories.json')) return [42];
        return {
          id: 42,
          type: 'story',
          by: 'ignored-user',
          title: 'ignored-title',
          text: 'ignored-text',
          time: Date.parse('2026-01-15T11:00:00Z') / 1_000,
          score: 100,
          descendants: 30,
          url: 'https://example.invalid/article',
        };
      },
    });

    const serialized = JSON.stringify(observations);
    expect(serialized).not.toContain('ignored-user');
    expect(serialized).not.toContain('ignored-title');
    expect(serialized).not.toContain('ignored-text');
    expect(observations[0]?.metrics.linkDomain).toBe('example.invalid');
  });

  it('parses configured Open-Meteo current conditions', async () => {
    const adapter = createOpenMeteoAdapter({ latitude: 39.77, longitude: -86.16 });
    const observations = await adapter.fetch({
      now: NOW,
      request: async () => ({
        current: {
          time: '2026-01-15T11:45',
          temperature_2m: 7,
          relative_humidity_2m: 65,
          precipitation: 0.2,
          weather_code: 61,
          wind_speed_10m: 18,
          wind_gusts_10m: 25,
        },
      }),
    });

    expect(observations[0]?.observedAt).toBe('2026-01-15T11:45:00.000Z');
    expect(observations[0]?.metrics.temperatureC).toBe(7);
  });
});
