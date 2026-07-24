import { afterEach, describe, expect, it, vi } from 'vitest';

import { resolveWorld, resolveWorldMode, SHARED_WORLD_UNAVAILABLE_MESSAGE } from './sharedWorldRuntime';
import {
  WORLD_DAY_DURATION_MS,
  formatWorldTimeOfDay,
  worldDayAt,
  worldDayStartedAtUtc,
} from './worldClock';

const SHARED_CONFIG = {
  enabled: true,
  url: 'https://example.supabase.co/',
  anonKey: 'anon-key',
  pollSeconds: 20,
};

function mockSharedWorldResponse(body: unknown, ok = true): void {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok,
    json: async () => body,
  })));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('world mode resolution', () => {
  it('defaults to the shared world when no mode is requested', () => {
    expect(resolveWorldMode('')).toBe('shared');
    expect(resolveWorldMode('?')).toBe('shared');
    expect(resolveWorldMode('?foo=bar')).toBe('shared');
  });

  it('still resolves to the shared world for an explicit ?world=shared', () => {
    expect(resolveWorldMode('?world=shared')).toBe('shared');
  });

  it('forks a private world only for an explicit outsider opt-in', () => {
    expect(resolveWorldMode('?world=local')).toBe('local');
    expect(resolveWorldMode('?world=new')).toBe('local');
  });

  it('does not treat an unrecognised mode as permission to fork', () => {
    expect(resolveWorldMode('?world=')).toBe('shared');
    expect(resolveWorldMode('?world=dev')).toBe('shared');
    expect(resolveWorldMode('?world=LOCAL')).toBe('shared');
  });

  it('resolves the live shared world when its configuration is reachable', async () => {
    mockSharedWorldResponse(SHARED_CONFIG);
    const resolution = await resolveWorld('');
    expect(resolution.mode).toBe('shared');
    if (resolution.mode !== 'shared') return;
    expect(resolution.config.url).toBe('https://example.supabase.co');
    expect(resolution.config.pollSeconds).toBe(20);
  });

  it('reports a failure instead of silently substituting a fresh local world', async () => {
    mockSharedWorldResponse(null, false);
    const resolution = await resolveWorld('');
    expect(resolution.mode).toBe('unavailable');
    if (resolution.mode !== 'unavailable') return;
    expect(resolution.reason).toContain(SHARED_WORLD_UNAVAILABLE_MESSAGE);
  });

  it('reports a failure when the shared world cannot be fetched at all', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    const resolution = await resolveWorld('');
    expect(resolution.mode).toBe('unavailable');
    if (resolution.mode !== 'unavailable') return;
    expect(resolution.reason).toContain('offline');
  });

  it('never reaches for the shared configuration when a private fork was requested', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    await expect(resolveWorld('?world=local')).resolves.toEqual({ mode: 'local' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('real-clock world time', () => {
  const genesisMs = Date.UTC(2026, 6, 16, 7, 53, 7);

  it('derives the world day from elapsed real time', () => {
    expect(worldDayAt(genesisMs, genesisMs)).toBe(0);
    expect(worldDayAt(genesisMs, genesisMs + WORLD_DAY_DURATION_MS - 1)).toBe(0);
    expect(worldDayAt(genesisMs, genesisMs + WORLD_DAY_DURATION_MS)).toBe(1);
    expect(worldDayAt(genesisMs, genesisMs + 7 * WORLD_DAY_DURATION_MS)).toBe(7);
  });

  it('never reports a day before genesis', () => {
    expect(worldDayAt(genesisMs, genesisMs - WORLD_DAY_DURATION_MS)).toBe(0);
  });

  it('anchors each day to its own start instant', () => {
    expect(worldDayStartedAtUtc(genesisMs, 0)).toBe(new Date(genesisMs).toISOString());
    expect(worldDayStartedAtUtc(genesisMs, 7))
      .toBe(new Date(genesisMs + 7 * WORLD_DAY_DURATION_MS).toISOString());
  });

  it('formats a 24-hour time of day from the progress of the current day', () => {
    const dayStart = worldDayStartedAtUtc(genesisMs, 7);
    const at = (ms: number) => formatWorldTimeOfDay(dayStart, WORLD_DAY_DURATION_MS, genesisMs + 7 * WORLD_DAY_DURATION_MS + ms);
    expect(at(0)).toBe('00:00');
    expect(at(60_000)).toBe('00:01');
    expect(at(9 * 3_600_000 + 30 * 60_000)).toBe('09:30');
    expect(at(13 * 3_600_000 + 5 * 60_000)).toBe('13:05');
    expect(at(WORLD_DAY_DURATION_MS - 1)).toBe('23:59');
  });

  it('stays inside the day when the clock drifts past its boundary', () => {
    const dayStart = worldDayStartedAtUtc(genesisMs, 0);
    expect(formatWorldTimeOfDay(dayStart, WORLD_DAY_DURATION_MS, genesisMs - 5_000)).toBe('00:00');
    expect(formatWorldTimeOfDay(dayStart, WORLD_DAY_DURATION_MS, genesisMs + WORLD_DAY_DURATION_MS * 2)).toBe('23:59');
  });

  it('reports no time for a world that has not published its day boundary', () => {
    expect(formatWorldTimeOfDay(null, WORLD_DAY_DURATION_MS, Date.now())).toBeNull();
    expect(formatWorldTimeOfDay('2026-07-16T07:53:07.000Z', null, Date.now())).toBeNull();
    expect(formatWorldTimeOfDay('not-a-date', WORLD_DAY_DURATION_MS, Date.now())).toBeNull();
  });
});
