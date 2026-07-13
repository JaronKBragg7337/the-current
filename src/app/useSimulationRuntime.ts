import { useCallback, useEffect, useRef, useState } from 'react';

import { CurrentPersistence, requestPersistentStorage } from '../persistence';
import type { ExternalInputRecord } from '../persistence';
import type {
  NormalizedSignal,
  ObserverIntervention,
  Person,
  WorldProjection,
} from '../simulation';
import {
  createBrowserSimulationHost,
  createInProcessSimulationHost,
  createWorkerCommand,
} from '../worker';
import type {
  HostPerformanceMetrics,
  SimulationHost,
  SimulationWorkerResponse,
} from '../worker';

const DEFAULT_WORLD_ID = 'the-current-public-current-001';
const DEFAULT_SEED = 'current-public-001';
const AUTOSAVE_INTERVAL_DAYS = 1;

interface DeferredPersistence {
  promise: Promise<void>;
  reject: (reason: unknown) => void;
  resolve: () => void;
}

function createDeferredPersistence(): DeferredPersistence {
  let resolvePromise: (() => void) | undefined;
  let rejectPromise: ((reason: unknown) => void) | undefined;
  const promise = new Promise<void>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });
  void promise.catch(() => undefined);
  return {
    promise,
    reject: (reason) => rejectPromise?.(reason),
    resolve: () => resolvePromise?.(),
  };
}

function queuedWorldDay(record: ExternalInputRecord): number {
  if (record.queuedDay !== undefined) return record.queuedDay;
  if (record.kind === 'signal') return record.input.timestampDay;
  return Math.max(0, record.effectiveDay - 1);
}

function projectionIntervalForSpeed(daysPerSecond: number): number {
  return Math.max(1, Math.ceil(daysPerSecond / 16));
}

export interface SimulationRuntimeView {
  projection: WorldProjection | null;
  inspectedPerson: Person | null;
  inspectedPersonId: string | null;
  hostMetrics: HostPerformanceMetrics | null;
  ready: boolean;
  paused: boolean;
  speed: number;
  saveStatus: 'error' | 'idle' | 'saving' | 'saved';
  error: string | null;
  usingWorker: boolean;
  setSpeed: (daysPerSecond: number) => void;
  togglePause: () => void;
  advanceDays: (days: number) => void;
  inspectPerson: (personId: string) => void;
  submitIntervention: (intervention: ObserverIntervention) => Promise<void>;
  submitSignal: (signal: NormalizedSignal) => Promise<void>;
  saveNow: () => void;
  exportWorld: () => void;
  importWorld: (json: string) => Promise<void>;
}

function triggerDownload(json: string, day: number): void {
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `the-current-day-${day}.current.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function createHost(): { host: SimulationHost; usingWorker: boolean } {
  if (typeof Worker !== 'undefined') {
    try {
      return { host: createBrowserSimulationHost(), usingWorker: true };
    } catch {
      // A deterministic in-process host keeps unsupported browsers usable.
    }
  }
  return { host: createInProcessSimulationHost(), usingWorker: false };
}

export function useSimulationRuntime(): SimulationRuntimeView {
  const hostRef = useRef<SimulationHost | null>(null);
  const persistenceRef = useRef<CurrentPersistence | null>(null);
  const persistenceReadyRef = useRef<Promise<void>>(Promise.resolve());
  const worldIdRef = useRef(DEFAULT_WORLD_ID);
  const lastSaveRequestedDayRef = useRef(-1);
  const currentDayRef = useRef(0);
  const downloadRequestsRef = useRef(new Set<string>());
  const snapshotWaitersRef = useRef(new Map<string, DeferredPersistence>());
  const speedRef = useRef(1);
  const pausedRef = useRef(true);
  const [projection, setProjection] = useState<WorldProjection | null>(null);
  const [inspectedPerson, setInspectedPerson] = useState<Person | null>(null);
  const [inspectedPersonId, setInspectedPersonId] = useState<string | null>(null);
  const [hostMetrics, setHostMetrics] = useState<HostPerformanceMetrics | null>(null);
  const [ready, setReady] = useState(false);
  const [paused, setPaused] = useState(true);
  const [speed, setSpeedState] = useState(1);
  const [saveStatus, setSaveStatus] = useState<'error' | 'idle' | 'saving' | 'saved'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [usingWorker, setUsingWorker] = useState(true);

  useEffect(() => {
    let active = true;
    const pendingSnapshotWaiters = snapshotWaitersRef.current;
    const persistence = new CurrentPersistence();
    const created = createHost();
    let initialPersistence: DeferredPersistence | null = null;
    let needsInitialSnapshot = false;
    persistenceRef.current = persistence;
    hostRef.current = created.host;
    setUsingWorker(created.usingWorker);

    const requestSnapshot = (day: number, download: boolean): void => {
      if (day === lastSaveRequestedDayRef.current && !download) return;
      const command = createWorkerCommand({ type: 'EXPORT' });
      lastSaveRequestedDayRef.current = day;
      if (download) downloadRequestsRef.current.add(command.requestId);
      setSaveStatus('saving');
      created.host.post(command);
    };

    const handleResponse = (response: SimulationWorkerResponse): void => {
      if (!active) return;
      switch (response.type) {
        case 'READY':
          setReady(true);
          pausedRef.current = response.state !== 'running';
          speedRef.current = response.speed.daysPerSecond;
          setPaused(pausedRef.current);
          setSpeedState(speedRef.current);
          if (needsInitialSnapshot) {
            needsInitialSnapshot = false;
            requestSnapshot(response.day, false);
          }
          return;
        case 'PROJECTION':
          currentDayRef.current = response.projection.day;
          setProjection(response.projection);
          if (
            response.projection.day > 0 &&
            response.projection.day % AUTOSAVE_INTERVAL_DAYS === 0 &&
            response.projection.day !== lastSaveRequestedDayRef.current
          ) {
            requestSnapshot(response.projection.day, false);
          }
          return;
        case 'EVENT_BATCH':
          if (response.events.length > 0) {
            void persistence.appendEventChunk(worldIdRef.current, response.events).catch(() => {
              // The authoritative snapshot still contains the event history.
            });
          }
          return;
        case 'METRICS':
          setHostMetrics(response.host);
          return;
        case 'INSPECTION':
          setInspectedPersonId(response.entityId);
          setInspectedPerson(response.value);
          return;
        case 'SNAPSHOT': {
          const shouldDownload = response.inReplyTo !== null && downloadRequestsRef.current.delete(response.inReplyTo);
          const waiter = response.inReplyTo === null
            ? undefined
            : snapshotWaitersRef.current.get(response.inReplyTo);
          void persistence
            .saveWorldSnapshot({
              worldId: worldIdRef.current,
              snapshot: response.snapshot,
              name: 'The Current — Confluence',
            })
            .then(async () => {
              initialPersistence?.resolve();
              initialPersistence = null;
              waiter?.resolve();
              if (response.inReplyTo !== null) snapshotWaitersRef.current.delete(response.inReplyTo);
              if (!active) return;
              setSaveStatus('saved');
              if (shouldDownload) {
                const json = await persistence.exportWorldJson(worldIdRef.current, {
                  includeExternalInputs: true,
                  includeHistory: true,
                });
                if (active) triggerDownload(json, response.snapshot.day);
              }
            })
            .catch((caught: unknown) => {
              initialPersistence?.reject(caught);
              initialPersistence = null;
              waiter?.reject(caught);
              if (response.inReplyTo !== null) snapshotWaitersRef.current.delete(response.inReplyTo);
              if (!active) return;
              setSaveStatus('error');
              setError(caught instanceof Error ? caught.message : String(caught));
            });
          return;
        }
        case 'ERROR':
          setError(response.message);
          return;
      }
    };

    const unsubscribe = created.host.subscribe(handleResponse);
    void requestPersistentStorage();
    void persistence
      .loadLatestWorld()
      .then(async (loaded) => {
        if (!active) return;
        if (loaded === null) {
          initialPersistence = createDeferredPersistence();
          persistenceReadyRef.current = initialPersistence.promise;
          needsInitialSnapshot = true;
          created.host.post(createWorkerCommand({
            type: 'INIT',
            options: { seed: DEFAULT_SEED },
            speed: { daysPerSecond: 1, maxDaysPerSlice: 4, projectionEveryDays: 1, metricsEveryDays: 5 },
            startPaused: true,
          }));
        } else {
          const [externalInputs, laterEventChunks] = await Promise.all([
            persistence.listExternalInputs(loaded.world.id),
            persistence.listEventChunks(loaded.world.id, loaded.snapshot.state.eventSequence),
          ]);
          if (!active) return;
          persistenceReadyRef.current = Promise.resolve();
          worldIdRef.current = loaded.world.id;
          lastSaveRequestedDayRef.current = loaded.snapshot.day;
          created.host.post(createWorkerCommand({
            type: 'LOAD',
            snapshot: loaded.snapshot,
            speed: { daysPerSecond: 1, maxDaysPerSlice: 4, projectionEveryDays: 1, metricsEveryDays: 5 },
            startPaused: true,
          }));
          const recoveryDay = laterEventChunks.reduce(
            (latest, chunk) => Math.max(latest, chunk.lastDay),
            loaded.snapshot.day,
          );
          const replayInputs = externalInputs
            .filter((record) => queuedWorldDay(record) >= loaded.snapshot.day)
            .sort((left, right) =>
              queuedWorldDay(left) - queuedWorldDay(right)
              || left.kind.localeCompare(right.kind)
              || left.inputId.localeCompare(right.inputId),
            );
          const postInputsForDay = (day: number): void => {
            replayInputs
              .filter((record) => queuedWorldDay(record) === day)
              .forEach((record) => {
                created.host.post(createWorkerCommand(
                  record.kind === 'signal'
                    ? { type: 'SIGNAL', signal: record.input }
                    : { type: 'INTERVENTION', intervention: record.input },
                ));
              });
          };
          postInputsForDay(loaded.snapshot.day);
          for (let day = loaded.snapshot.day + 1; day <= recoveryDay; day += 1) {
            created.host.post(createWorkerCommand({ type: 'ADVANCE', days: 1, projectionEveryDays: 1 }));
            postInputsForDay(day);
          }
        }
      })
      .catch((caught: unknown) => {
        if (!active) return;
        setError(caught instanceof Error ? caught.message : String(caught));
        initialPersistence = createDeferredPersistence();
        persistenceReadyRef.current = initialPersistence.promise;
        needsInitialSnapshot = true;
        created.host.post(createWorkerCommand({
          type: 'INIT',
          options: { seed: DEFAULT_SEED },
          startPaused: true,
        }));
      });

    const handleVisibilityChange = (): void => {
      if (document.visibilityState === 'hidden') requestSnapshot(currentDayRef.current, false);
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      active = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      pendingSnapshotWaiters.forEach((waiter) => waiter.reject(new Error('Simulation host closed before persistence completed')));
      pendingSnapshotWaiters.clear();
      unsubscribe();
      created.host.terminate();
      void persistence.close();
      hostRef.current = null;
      persistenceRef.current = null;
    };
  }, []);

  const persistHostState = useCallback(async (): Promise<void> => {
    const host = hostRef.current;
    if (host === null) throw new Error('Simulation host is not ready');
    const command = createWorkerCommand({ type: 'EXPORT' });
    const waiter = createDeferredPersistence();
    snapshotWaitersRef.current.set(command.requestId, waiter);
    lastSaveRequestedDayRef.current = currentDayRef.current;
    setSaveStatus('saving');
    host.post(command);
    await waiter.promise;
  }, []);

  const setSpeed = useCallback((daysPerSecond: number): void => {
    const host = hostRef.current;
    if (host === null) return;
    speedRef.current = daysPerSecond;
    pausedRef.current = daysPerSecond === 0;
    setSpeedState(daysPerSecond);
    setPaused(pausedRef.current);
    host.post(createWorkerCommand({
      type: 'SET_SPEED',
      speed: {
        daysPerSecond,
        maxDaysPerSlice: daysPerSecond >= 32 ? 16 : 4,
        projectionEveryDays: projectionIntervalForSpeed(daysPerSecond),
        metricsEveryDays: Math.max(5, projectionIntervalForSpeed(daysPerSecond)),
      },
    }));
  }, []);

  const togglePause = useCallback((): void => {
    const host = hostRef.current;
    if (host === null) return;
    if (pausedRef.current) {
      const resumedSpeed = speedRef.current > 0 ? speedRef.current : 1;
      setSpeed(resumedSpeed);
    } else {
      pausedRef.current = true;
      setPaused(true);
      host.post(createWorkerCommand({ type: 'PAUSE' }));
      void persistHostState().catch(() => undefined);
    }
  }, [persistHostState, setSpeed]);

  const advanceDays = useCallback((days: number): void => {
    hostRef.current?.post(createWorkerCommand({ type: 'ADVANCE', days, projectionEveryDays: 1 }));
  }, []);

  const inspectPerson = useCallback((personId: string): void => {
    setInspectedPersonId(personId);
    hostRef.current?.post(createWorkerCommand({
      type: 'INSPECT',
      entityType: 'person',
      entityId: personId,
    }));
  }, []);

  const submitIntervention = useCallback(async (intervention: ObserverIntervention): Promise<void> => {
    await persistenceReadyRef.current;
    const persistence = persistenceRef.current;
    if (persistence !== null) {
      await persistence.saveIntervention(worldIdRef.current, intervention, currentDayRef.current);
    }
    const host = hostRef.current;
    if (host === null) throw new Error('Simulation host is not ready');
    host.post(createWorkerCommand({ type: 'INTERVENTION', intervention }));
    await persistHostState();
  }, [persistHostState]);

  const submitSignal = useCallback(async (signal: NormalizedSignal): Promise<void> => {
    await persistenceReadyRef.current;
    const persistence = persistenceRef.current;
    if (persistence !== null) await persistence.saveSignal(worldIdRef.current, signal);
    const host = hostRef.current;
    if (host === null) throw new Error('Simulation host is not ready');
    host.post(createWorkerCommand({ type: 'SIGNAL', signal }));
    await persistHostState();
  }, [persistHostState]);

  const saveNow = useCallback((): void => {
    const day = projection?.day ?? 0;
    lastSaveRequestedDayRef.current = day;
    setSaveStatus('saving');
    hostRef.current?.post(createWorkerCommand({ type: 'EXPORT' }));
  }, [projection?.day]);

  const exportWorld = useCallback((): void => {
    const command = createWorkerCommand({ type: 'EXPORT' });
    downloadRequestsRef.current.add(command.requestId);
    setSaveStatus('saving');
    hostRef.current?.post(command);
  }, []);

  const importWorld = useCallback(async (json: string): Promise<void> => {
    const persistence = persistenceRef.current;
    const host = hostRef.current;
    if (persistence === null || host === null) throw new Error('Simulation persistence is not ready');
    const loaded = await persistence.importWorldJson(json, { replaceExisting: true });
    worldIdRef.current = loaded.world.id;
    lastSaveRequestedDayRef.current = loaded.snapshot.day;
    host.post(createWorkerCommand({
      type: 'LOAD',
      snapshot: loaded.snapshot,
      speed: { daysPerSecond: speedRef.current || 1 },
      startPaused: true,
    }));
    setSaveStatus('saved');
  }, []);

  return {
    projection,
    inspectedPerson,
    inspectedPersonId,
    hostMetrics,
    ready,
    paused,
    speed,
    saveStatus,
    error,
    usingWorker,
    setSpeed,
    togglePause,
    advanceDays,
    inspectPerson,
    submitIntervention,
    submitSignal,
    saveNow,
    exportWorld,
    importWorld,
  };
}
