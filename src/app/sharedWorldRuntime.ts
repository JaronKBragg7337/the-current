import { useCallback, useEffect, useRef, useState } from 'react';

import {
  restoreSimulation,
  type CurrentSimulation,
  type NormalizedSignal,
  type ObserverIntervention,
  type Person,
  type WorldProjection,
  type WorldSnapshot,
} from '../simulation';
import { useSimulationRuntime, type SimulationRuntimeView } from './useSimulationRuntime';

/**
 * Shared authoritative world spectating.
 *
 * One simulation exists, hosted server-side, advancing at a fixed real-time
 * pace with hidden entropy. Every browser in shared mode is a read-only
 * witness of the same world state: nobody can pause it, speed it up, add a
 * day, or import a different history. The client merely polls the published
 * snapshot and projects it into the 3D scene.
 */

export interface SharedWorldConfig {
  url: string;
  anonKey: string;
  pollSeconds: number;
}

interface SharedWorldHead {
  day: number;
  digest: string;
}

interface SharedWorldSnapshotRow {
  snapshot: WorldSnapshot;
  digest: string;
  genesis_at: string;
  world_day_ms: number;
}

export type WorldMode = 'local' | 'shared';

export type WorldResolution =
  | { mode: 'local' }
  | { mode: 'shared'; config: SharedWorldConfig }
  | { mode: 'unavailable'; reason: string };

export const SHARED_WORLD_UNAVAILABLE_MESSAGE =
  'The live shared world could not be reached, so this client is not showing it. '
  + 'Fix public/shared-world.json or the network, then reload. '
  + 'Add ?world=local only if you intend to fork a private world of your own.';

/**
 * Which world this client watches.
 *
 * Development and production both default to the single shared authoritative
 * world — the owner's live world, and the only world a collaborator should
 * ever observe. `?world=local` (alias `?world=new`) is an explicit opt-in for
 * an outsider who wants to fork a private world of their own. There is no
 * condition under which a fresh local world becomes the default.
 */
export function resolveWorldMode(search: string): WorldMode {
  const mode = new URLSearchParams(search).get('world');
  return mode === 'local' || mode === 'new' ? 'local' : 'shared';
}

export async function loadSharedWorldConfig(): Promise<SharedWorldConfig | null> {
  const response = await fetch(`${import.meta.env.BASE_URL}shared-world.json`, { cache: 'no-store' });
  if (!response.ok) return null;
  const config: unknown = await response.json();
  if (typeof config !== 'object' || config === null) return null;
  const candidate = config as { enabled?: unknown; url?: unknown; anonKey?: unknown; pollSeconds?: unknown };
  if (candidate.enabled !== true || typeof candidate.url !== 'string' || typeof candidate.anonKey !== 'string') {
    return null;
  }
  return {
    url: candidate.url.replace(/\/$/, ''),
    anonKey: candidate.anonKey,
    pollSeconds: typeof candidate.pollSeconds === 'number' && candidate.pollSeconds >= 5 ? candidate.pollSeconds : 20,
  };
}

/**
 * Resolve the world without ever silently substituting one for another. A
 * client that asked for the shared world and cannot reach it reports that
 * failure; it does not quietly create a brand-new private world and present it
 * as the real one.
 */
export async function resolveWorld(search: string): Promise<WorldResolution> {
  if (resolveWorldMode(search) === 'local') return { mode: 'local' };
  try {
    const config = await loadSharedWorldConfig();
    return config === null
      ? { mode: 'unavailable', reason: SHARED_WORLD_UNAVAILABLE_MESSAGE }
      : { mode: 'shared', config };
  } catch (caught) {
    const detail = caught instanceof Error ? caught.message : String(caught);
    return { mode: 'unavailable', reason: `${SHARED_WORLD_UNAVAILABLE_MESSAGE} (${detail})` };
  }
}

async function fetchRow<T>(config: SharedWorldConfig, select: string): Promise<T | null> {
  const response = await fetch(
    `${config.url}/rest/v1/the_current_world?id=eq.main&select=${encodeURIComponent(select)}`,
    {
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${config.anonKey}`,
        Accept: 'application/json',
      },
    },
  );
  if (!response.ok) throw new Error(`Shared world request failed with HTTP ${response.status}`);
  const rows = (await response.json()) as T[];
  return rows[0] ?? null;
}

const SHARED_MODE_MESSAGE = 'This is the one shared world; it cannot be changed from a spectator client.';

export function useSharedWorldRuntime(config: SharedWorldConfig | null): SimulationRuntimeView {
  const simulationRef = useRef<CurrentSimulation | null>(null);
  const digestRef = useRef<string | null>(null);
  const [projection, setProjection] = useState<WorldProjection | null>(null);
  const [inspectedPerson, setInspectedPerson] = useState<Person | null>(null);
  const [inspectedPersonId, setInspectedPersonId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (config === null) return undefined;
    let active = true;
    let timer: number | null = null;

    const poll = async (): Promise<void> => {
      try {
        const head = await fetchRow<SharedWorldHead>(config, 'day,digest');
        if (!active) return;
        if (head === null) {
          setError('The shared world has not been created yet. Check back shortly.');
          return;
        }
        if (head.digest !== digestRef.current) {
          const full = await fetchRow<SharedWorldSnapshotRow>(
            config,
            'snapshot,digest,genesis_at,world_day_ms',
          );
          if (!active || full === null) return;
          const simulation = restoreSimulation(full.snapshot);
          simulationRef.current = simulation;
          digestRef.current = full.digest;
          const worldDayDurationMs = Number(full.world_day_ms);
          const genesisMs = new Date(full.genesis_at).getTime();
          const dayStartedAtUtc = Number.isFinite(genesisMs) && Number.isFinite(worldDayDurationMs)
            ? new Date(genesisMs + full.snapshot.day * worldDayDurationMs).toISOString()
            : null;
          setProjection({
            ...simulation.projection(),
            dayStartedAtUtc,
            worldDayDurationMs: Number.isFinite(worldDayDurationMs) ? worldDayDurationMs : null,
          });
          setReady(true);
          setError(null);
        }
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : String(caught));
      }
    };

    void poll();
    timer = window.setInterval(() => { void poll(); }, config.pollSeconds * 1000);
    return () => {
      active = false;
      if (timer !== null) window.clearInterval(timer);
      simulationRef.current = null;
      digestRef.current = null;
    };
  }, [config]);

  const inspectPerson = useCallback((personId: string): void => {
    const simulation = simulationRef.current;
    if (simulation === null) return;
    setInspectedPersonId(personId);
    setInspectedPerson(simulation.inspectPerson(personId));
  }, []);

  const rejectMutation = useCallback(async (): Promise<void> => {
    throw new Error(SHARED_MODE_MESSAGE);
  }, []);

  const exportWorld = useCallback((): void => {
    const simulation = simulationRef.current;
    if (simulation === null) return;
    const snapshot = simulation.snapshot();
    const blob = new Blob([JSON.stringify(snapshot)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `the-current-shared-day-${snapshot.day}.snapshot.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, []);

  const noop = useCallback((): void => {
    // The shared world's day comes from the server's real clock. Nothing a
    // client does — including the browser test shim — can move it.
  }, []);

  return {
    projection,
    inspectedPerson,
    inspectedPersonId,
    hostMetrics: null,
    ready,
    saveStatus: 'idle',
    error,
    usingWorker: false,
    skipAheadOneDayForTests: noop,
    inspectPerson,
    submitIntervention: rejectMutation as (intervention: ObserverIntervention) => Promise<void>,
    submitSignal: rejectMutation as (signal: NormalizedSignal) => Promise<void>,
    saveNow: noop,
    exportWorld,
    importWorld: rejectMutation as (json: string) => Promise<void>,
  };
}

export interface WorldRuntime extends SimulationRuntimeView {
  liveWorld: boolean;
}

/**
 * Resolve which world this client watches. The shared authoritative world is
 * the default in development and production alike; a private local world is
 * only ever the result of an explicit `?world=local` opt-in. Exactly one
 * runtime is active, and a failure to reach the shared world surfaces as an
 * error rather than as a different world.
 */
export function useWorldRuntime(): WorldRuntime | null {
  const [resolution, setResolution] = useState<WorldResolution | null>(null);

  useEffect(() => {
    let active = true;
    void resolveWorld(window.location.search).then((resolved) => {
      if (active) setResolution(resolved);
    });
    return () => {
      active = false;
    };
  }, []);

  const local = useSimulationRuntime(resolution?.mode === 'local');
  const shared = useSharedWorldRuntime(resolution?.mode === 'shared' ? resolution.config : null);

  if (resolution === null) return null;
  if (resolution.mode === 'local') return { ...local, liveWorld: false };
  if (resolution.mode === 'shared') return { ...shared, liveWorld: true };
  return { ...shared, liveWorld: true, error: resolution.reason };
}
