/**
 * Time is a property of a world, never a control.
 *
 * Every world in The Current runs on the real clock: one world day per real
 * day, measured from that world's genesis. The shared authoritative world
 * takes its genesis and day length from the server; a private local fork takes
 * its genesis from the moment it was created. Neither can be paused,
 * accelerated, rewound, or hand-advanced, so no viewer — owner, collaborator,
 * or outsider — can see a world state that real time has not produced yet.
 */

export const WORLD_DAY_DURATION_MS = 86_400_000;

const MINUTES_PER_DAY = 1_440;

let testClockOffsetMs = 0;

/**
 * The wall clock a local world reads. Identical to `Date.now()` except in the
 * browser smoke test, which moves the clock rather than the world because
 * moving the world directly would be a time control.
 */
export function worldNowMs(): number {
  return Date.now() + testClockOffsetMs;
}

/**
 * Browser-test only. Shifts the clock every local world reads so a test can
 * observe a real day boundary without waiting a real day for it.
 */
export function shiftWorldClock(milliseconds: number): void {
  testClockOffsetMs += milliseconds;
}

/** The world day a genesis timestamp has reached by `nowMs`. */
export function worldDayAt(genesisMs: number, nowMs: number = worldNowMs()): number {
  if (!Number.isFinite(genesisMs) || !Number.isFinite(nowMs)) return 0;
  return Math.max(0, Math.floor((nowMs - genesisMs) / WORLD_DAY_DURATION_MS));
}

/** When a given world day began, as an ISO timestamp. */
export function worldDayStartedAtUtc(genesisMs: number, day: number): string | null {
  if (!Number.isFinite(genesisMs) || !Number.isFinite(day)) return null;
  return new Date(genesisMs + day * WORLD_DAY_DURATION_MS).toISOString();
}

/**
 * The world's 24-hour time of day as `HH:MM`, derived from how far the current
 * world day has progressed. Returns null when a world has not published its
 * day boundary yet.
 */
export function formatWorldTimeOfDay(
  dayStartedAtUtc: string | null,
  worldDayDurationMs: number | null,
  nowMs: number,
): string | null {
  if (dayStartedAtUtc === null || worldDayDurationMs === null || worldDayDurationMs <= 0) return null;
  const startedMs = new Date(dayStartedAtUtc).getTime();
  if (!Number.isFinite(startedMs) || !Number.isFinite(nowMs)) return null;
  // Scale before dividing. Going through a 0..1 fraction loses just enough
  // precision to render a whole minute early on exact boundaries.
  const elapsedMs = Math.max(0, Math.min(worldDayDurationMs - 1, nowMs - startedMs));
  const totalMinutes = Math.floor((elapsedMs * MINUTES_PER_DAY) / worldDayDurationMs);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}
