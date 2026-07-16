import type { PersonProjection } from '../simulation';
import { deterministicUnit } from './terrain';

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/**
 * Present the authoritative start/end locations as a staggered daily journey.
 * Decisions and task effects remain simulation-owned; this only exposes the
 * travel that previously happened invisibly between daily snapshots.
 */
export function presentDailyTravel(
  person: PersonProjection,
  day: number,
  dayStartedAtUtc: string | null,
  worldDayDurationMs: number | null,
  nowMs: number,
): PersonProjection {
  if (dayStartedAtUtc === null || worldDayDurationMs === null || worldDayDurationMs <= 0) return person;
  const startMs = new Date(dayStartedAtUtc).getTime();
  if (!Number.isFinite(startMs)) return person;
  const dx = person.position.x - person.previousPosition.x;
  const dz = person.position.z - person.previousPosition.z;
  const distance = Math.hypot(dx, dz);
  if (distance < 0.001) return person;
  const worldFraction = clamp01((nowMs - startMs) / worldDayDurationMs);
  const departure = 0.05 + deterministicUnit(`${person.id}:${day}:departure`) * 0.78;
  const journeyDuration = Math.max(0.025, Math.min(0.09, 0.025 + distance / 180 * 0.065));
  const rawProgress = clamp01((worldFraction - departure) / journeyDuration);
  const progress = rawProgress * rawProgress * (3 - 2 * rawProgress);
  return {
    ...person,
    position: {
      x: person.previousPosition.x + dx * progress,
      y: person.previousPosition.y + (person.position.y - person.previousPosition.y) * progress,
      z: person.previousPosition.z + dz * progress,
    },
    yaw: Math.atan2(dx, dz),
  };
}
