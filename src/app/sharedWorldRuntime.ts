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

export async function loadSharedWorldConfig(): Promise<SharedWorldConfig | null> {
  const params = new URLSearchParams(window.location.search);
  const mode = params.get('world');
  // ?world=local always opts out; development builds default to local
  // worlds (tests, offline work) unless ?world=shared explicitly opts in.
  if (mode === 'local') return null;
  if (import.meta.env.DEV && mode !== 'shared') return null;
  try {
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
  } catch {
    return null;
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
          const full = await fetchRow<{ snapshot: WorldSnapshot; digest: string }>(config, 'snapshot,digest');
          if (!active || full === null) return;
          const simulation = restoreSimulation(full.snapshot);
          simulationRef.current = simulation;
          digestRef.current = full.digest;
          setProjection(simulation.projection());
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
    // Spectators cannot alter the shared world's time.
  }, []);

  return {
    projection,
    inspectedPerson,
    inspectedPersonId,
    hostMetrics: null,
    ready,
    // The shared world is always running at its own fixed pace.
    paused: false,
    speed: 1,
    saveStatus: 'idle',
    error,
    usingWorker: false,
    setSpeed: noop,
    togglePause: noop,
    advanceDays: noop,
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
 * Resolve which world this client watches: the single shared authoritative
 * world (default in production when configured) or a private local world
 * (development, tests, or ?world=local). Exactly one runtime is active.
 */
export function useWorldRuntime(): WorldRuntime | null {
  const [config, setConfig] = useState<SharedWorldConfig | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    void loadSharedWorldConfig().then((resolved) => {
      if (active) setConfig(resolved);
    });
    return () => {
      active = false;
    };
  }, []);

  const local = useSimulationRuntime(config === null);
  const shared = useSharedWorldRuntime(config ?? null);

  if (config === undefined) return null;
  return config === null
    ? { ...local, liveWorld: false }
    : { ...shared, liveWorld: true };
}
