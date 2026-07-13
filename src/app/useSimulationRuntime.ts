import { useCallback, useEffect, useRef, useState } from 'react';

import { CurrentPersistence, requestPersistentStorage } from '../persistence';
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
  createWorkerRequestId,
} from '../worker';
import type {
  HostPerformanceMetrics,
  ReadyResponse,
  SimulationHost,
  SimulationWorkerCommand,
  SimulationWorkerResponse,
} from '../worker';
import {
  AutosaveScheduler,
  TimedWaiterRegistry,
  calculateRecoveryDay,
  createTimedDeferred,
  drainPendingOperations,
  queuedWorldDay,
  type TimedDeferred,
} from './runtimePersistence';

const DEFAULT_WORLD_ID = 'the-current-public-current-001';
const DEFAULT_SEED = 'current-public-001';
const AUTOSAVE_INTERVAL_DAYS = 1;

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

export function useSimulationRuntime(enabled = true): SimulationRuntimeView {
  const hostRef = useRef<SimulationHost | null>(null);
  const persistenceRef = useRef<CurrentPersistence | null>(null);
  const persistenceReadyRef = useRef<Promise<void>>(Promise.resolve());
  const worldIdRef = useRef(DEFAULT_WORLD_ID);
  const lastSaveRequestedDayRef = useRef(-1);
  const lastPersistedDayRef = useRef(-1);
  const currentDayRef = useRef(0);
  const downloadRequestsRef = useRef(new Set<string>());
  const snapshotWaitersRef = useRef(new TimedWaiterRegistry<void>());
  const hostResponseWaitersRef = useRef(new TimedWaiterRegistry<SimulationWorkerResponse>());
  const pendingPersistenceWritesRef = useRef(new Set<Promise<void>>());
  const autosaveSchedulerRef = useRef<AutosaveScheduler | null>(null);
  const hostTransitionRef = useRef(false);
  const fatalHostErrorRef = useRef<Error | null>(null);
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
    // When the app is spectating the shared authoritative world, no local
    // simulation host or persistence should ever be created.
    if (!enabled) return undefined;
    let active = true;
    const pendingSnapshotWaiters = snapshotWaitersRef.current;
    const pendingHostResponseWaiters = hostResponseWaitersRef.current;
    const persistence = new CurrentPersistence();
    const created = createHost();
    let initialPersistence: TimedDeferred<void> | null = null;
    let initialSnapshotRequestId: string | null = null;
    let needsInitialSnapshot = false;
    persistenceRef.current = persistence;
    hostRef.current = created.host;
    fatalHostErrorRef.current = null;
    setUsingWorker(created.usingWorker);

    const reportPersistenceError = (caught: unknown): void => {
      if (!active) return;
      setSaveStatus('error');
      setError(caught instanceof Error ? caught.message : String(caught));
    };

    const trackPersistenceOperation = (operation: Promise<void>): void => {
      pendingPersistenceWritesRef.current.add(operation);
      void operation.finally(() => pendingPersistenceWritesRef.current.delete(operation));
    };

    const postSnapshotRequest = (
      day: number,
      requestId = createWorkerRequestId('snapshot'),
      download = false,
    ): string => {
      const command = createWorkerCommand({ type: 'EXPORT' }, requestId);
      lastSaveRequestedDayRef.current = day;
      if (download) downloadRequestsRef.current.add(command.requestId);
      setSaveStatus('saving');
      created.host.post(command);
      return command.requestId;
    };

    const autosaveScheduler = new AutosaveScheduler({
      idFactory: () => createWorkerRequestId('autosave'),
      onError: reportPersistenceError,
      request: (day, requestId) => postSnapshotRequest(day, requestId),
    });
    autosaveSchedulerRef.current = autosaveScheduler;

    const handleResponse = (response: SimulationWorkerResponse): void => {
      if (!active) return;
      if (response.type === 'READY' && response.inReplyTo !== null) {
        pendingHostResponseWaiters.resolve(response.inReplyTo, response);
      }
      switch (response.type) {
        case 'READY':
          setReady(true);
          pausedRef.current = response.state !== 'running';
          speedRef.current = response.speed.daysPerSecond;
          setPaused(pausedRef.current);
          setSpeedState(speedRef.current);
          if (needsInitialSnapshot) {
            needsInitialSnapshot = false;
            initialSnapshotRequestId = postSnapshotRequest(response.day);
          }
          return;
        case 'PROJECTION':
          currentDayRef.current = response.projection.day;
          setProjection(response.projection);
          if (
            response.projection.day > 0 &&
            response.projection.day % AUTOSAVE_INTERVAL_DAYS === 0 &&
            response.projection.day > lastPersistedDayRef.current &&
            !hostTransitionRef.current
          ) {
            autosaveScheduler.queue(response.projection.day);
          }
          return;
        case 'EVENT_BATCH':
          if (response.events.length > 0) {
            const eventWorldId = worldIdRef.current;
            const operation = persistence.appendEventChunk(eventWorldId, response.events).then(
              () => undefined,
              () => {
              // The authoritative snapshot still contains the event history.
              },
            );
            trackPersistenceOperation(operation);
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
          const requestId = response.inReplyTo;
          const snapshotWorldId = worldIdRef.current;
          const shouldDownload = requestId !== null && downloadRequestsRef.current.delete(requestId);
          const operation = persistence
            .saveWorldSnapshot({
              worldId: snapshotWorldId,
              snapshot: response.snapshot,
              name: 'The Current — Confluence',
            })
            .then(async () => {
              lastPersistedDayRef.current = Math.max(
                lastPersistedDayRef.current,
                response.snapshot.day,
              );
              if (requestId === initialSnapshotRequestId) {
                initialPersistence?.resolve(undefined);
                initialPersistence = null;
                initialSnapshotRequestId = null;
              }
              if (requestId !== null) {
                pendingSnapshotWaiters.resolve(requestId, undefined);
                autosaveScheduler.complete(requestId);
              }
              if (!active) return;
              setSaveStatus('saved');
              if (shouldDownload) {
                const json = await persistence.exportWorldJson(snapshotWorldId, {
                  includeExternalInputs: true,
                  includeHistory: true,
                });
                if (active) triggerDownload(json, response.snapshot.day);
              }
            })
            .catch((caught: unknown) => {
              if (requestId === initialSnapshotRequestId) {
                initialPersistence?.reject(caught);
                initialPersistence = null;
                initialSnapshotRequestId = null;
              }
              if (requestId !== null) {
                pendingSnapshotWaiters.reject(requestId, caught);
                autosaveScheduler.fail(requestId, caught);
              }
              reportPersistenceError(caught);
            });
          trackPersistenceOperation(operation);
          return;
        }
        case 'ERROR': {
          const failure = new Error(response.message);
          if (response.inReplyTo !== null) {
            pendingSnapshotWaiters.reject(response.inReplyTo, failure);
            pendingHostResponseWaiters.reject(response.inReplyTo, failure);
            autosaveScheduler.fail(response.inReplyTo, failure);
            if (response.inReplyTo === initialSnapshotRequestId) {
              initialPersistence?.reject(failure);
              initialPersistence = null;
              initialSnapshotRequestId = null;
            }
          }
          if (!response.recoverable) {
            fatalHostErrorRef.current = failure;
            pendingSnapshotWaiters.rejectAll(failure);
            pendingHostResponseWaiters.rejectAll(failure);
            initialPersistence?.reject(failure);
            initialPersistence = null;
            initialSnapshotRequestId = null;
            autosaveScheduler.abort();
            setSaveStatus('error');
          }
          setError(response.message);
          return;
        }
      }
    };

    const unsubscribe = created.host.subscribe(handleResponse);
    void requestPersistentStorage();
    void persistence
      .loadLatestWorld()
      .then(async (loaded) => {
        if (!active) return;
        if (loaded === null) {
          initialPersistence = createTimedDeferred<void>('Initial world persistence');
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
          lastPersistedDayRef.current = loaded.snapshot.day;
          currentDayRef.current = loaded.snapshot.day;
          created.host.post(createWorkerCommand({
            type: 'LOAD',
            snapshot: loaded.snapshot,
            speed: { daysPerSecond: 1, maxDaysPerSlice: 4, projectionEveryDays: 1, metricsEveryDays: 5 },
            startPaused: true,
          }));
          const recoveryDay = calculateRecoveryDay(
            loaded.snapshot.day,
            laterEventChunks,
            externalInputs,
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
        if (fatalHostErrorRef.current !== null) return;
        initialPersistence = createTimedDeferred<void>('Fallback world persistence');
        persistenceReadyRef.current = initialPersistence.promise;
        needsInitialSnapshot = true;
        created.host.post(createWorkerCommand({
          type: 'INIT',
          options: { seed: DEFAULT_SEED },
          startPaused: true,
        }));
      });

    const handleVisibilityChange = (): void => {
      if (
        document.visibilityState === 'hidden'
        && fatalHostErrorRef.current === null
        && !hostTransitionRef.current
      ) {
        try {
          postSnapshotRequest(currentDayRef.current);
        } catch (caught: unknown) {
          reportPersistenceError(caught);
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      active = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      const closed = new Error('Simulation host closed before persistence completed');
      pendingSnapshotWaiters.rejectAll(closed);
      pendingHostResponseWaiters.rejectAll(closed);
      initialPersistence?.reject(closed);
      autosaveScheduler.dispose();
      autosaveSchedulerRef.current = null;
      hostTransitionRef.current = false;
      unsubscribe();
      created.host.terminate();
      void persistence.close();
      hostRef.current = null;
      persistenceRef.current = null;
    };
  }, [enabled]);

  const postAndWaitForReady = useCallback(async (
    command: SimulationWorkerCommand,
    label: string,
  ): Promise<ReadyResponse> => {
    const fatalFailure = fatalHostErrorRef.current;
    if (fatalFailure !== null) throw fatalFailure;
    const host = hostRef.current;
    if (host === null) throw new Error('Simulation host is not ready');
    const responsePromise = hostResponseWaitersRef.current.wait(command.requestId, label);
    try {
      host.post(command);
    } catch (caught: unknown) {
      hostResponseWaitersRef.current.reject(command.requestId, caught);
    }
    const response = await responsePromise;
    if (response.type !== 'READY') {
      throw new Error(`${label} received ${response.type} instead of READY`);
    }
    return response;
  }, []);

  const persistHostState = useCallback(async (): Promise<void> => {
    const fatalFailure = fatalHostErrorRef.current;
    if (fatalFailure !== null) throw fatalFailure;
    if (hostTransitionRef.current) throw new Error('World replacement is in progress');
    const host = hostRef.current;
    if (host === null) throw new Error('Simulation host is not ready');
    const command = createWorkerCommand({ type: 'EXPORT' });
    const persisted = snapshotWaitersRef.current.wait(
      command.requestId,
      `Snapshot persistence for day ${currentDayRef.current.toString()}`,
    );
    lastSaveRequestedDayRef.current = currentDayRef.current;
    setSaveStatus('saving');
    try {
      host.post(command);
    } catch (caught: unknown) {
      snapshotWaitersRef.current.reject(command.requestId, caught);
    }
    try {
      await persisted;
    } catch (caught: unknown) {
      setSaveStatus('error');
      setError(caught instanceof Error ? caught.message : String(caught));
      throw caught;
    }
  }, []);

  const awaitTrackedPersistence = useCallback(async <T,>(operation: Promise<T>): Promise<T> => {
    const completion = operation.then(
      () => undefined,
      () => undefined,
    );
    pendingPersistenceWritesRef.current.add(completion);
    try {
      return await operation;
    } finally {
      pendingPersistenceWritesRef.current.delete(completion);
    }
  }, []);

  const setSpeed = useCallback((daysPerSecond: number): void => {
    if (hostTransitionRef.current) return;
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
    if (hostTransitionRef.current) return;
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
    if (hostTransitionRef.current) return;
    hostRef.current?.post(createWorkerCommand({ type: 'ADVANCE', days, projectionEveryDays: 1 }));
  }, []);

  const inspectPerson = useCallback((personId: string): void => {
    if (hostTransitionRef.current) return;
    setInspectedPersonId(personId);
    hostRef.current?.post(createWorkerCommand({
      type: 'INSPECT',
      entityType: 'person',
      entityId: personId,
    }));
  }, []);

  const submitIntervention = useCallback(async (intervention: ObserverIntervention): Promise<void> => {
    await persistenceReadyRef.current;
    if (hostTransitionRef.current) throw new Error('World replacement is in progress');
    const fatalFailure = fatalHostErrorRef.current;
    if (fatalFailure !== null) throw fatalFailure;
    const persistence = persistenceRef.current;
    if (persistence !== null) {
      await awaitTrackedPersistence(
        persistence.saveIntervention(worldIdRef.current, intervention, currentDayRef.current),
      );
    }
    if (hostTransitionRef.current) throw new Error('World replacement is in progress');
    const host = hostRef.current;
    if (host === null) throw new Error('Simulation host is not ready');
    host.post(createWorkerCommand({ type: 'INTERVENTION', intervention }));
    await persistHostState();
  }, [awaitTrackedPersistence, persistHostState]);

  const submitSignal = useCallback(async (signal: NormalizedSignal): Promise<void> => {
    await persistenceReadyRef.current;
    if (hostTransitionRef.current) throw new Error('World replacement is in progress');
    const fatalFailure = fatalHostErrorRef.current;
    if (fatalFailure !== null) throw fatalFailure;
    const persistence = persistenceRef.current;
    if (persistence !== null) {
      await awaitTrackedPersistence(persistence.saveSignal(worldIdRef.current, signal));
    }
    if (hostTransitionRef.current) throw new Error('World replacement is in progress');
    const host = hostRef.current;
    if (host === null) throw new Error('Simulation host is not ready');
    host.post(createWorkerCommand({ type: 'SIGNAL', signal }));
    await persistHostState();
  }, [awaitTrackedPersistence, persistHostState]);

  const saveNow = useCallback((): void => {
    if (hostTransitionRef.current) return;
    const day = projection?.day ?? 0;
    lastSaveRequestedDayRef.current = day;
    setSaveStatus('saving');
    hostRef.current?.post(createWorkerCommand({ type: 'EXPORT' }));
  }, [projection?.day]);

  const exportWorld = useCallback((): void => {
    if (hostTransitionRef.current) return;
    const command = createWorkerCommand({ type: 'EXPORT' });
    downloadRequestsRef.current.add(command.requestId);
    setSaveStatus('saving');
    hostRef.current?.post(command);
  }, []);

  const importWorld = useCallback(async (json: string): Promise<void> => {
    await persistenceReadyRef.current;
    const fatalFailure = fatalHostErrorRef.current;
    if (fatalFailure !== null) throw fatalFailure;
    const persistence = persistenceRef.current;
    const host = hostRef.current;
    if (persistence === null || host === null) throw new Error('Simulation persistence is not ready');
    if (hostTransitionRef.current) throw new Error('World replacement is already in progress');
    hostTransitionRef.current = true;
    // Stop both the pending timer and any coalesced old-world day before the
    // PAUSE command is posted. The transition gate prevents projections that
    // arrive while waiting for the barrier from scheduling another export.
    autosaveSchedulerRef.current?.abort();

    try {
      // PAUSE is a worker command-queue barrier: every earlier response is
      // delivered before its correlated READY. Waiting for local IndexedDB
      // writes after that barrier prevents old-world saves from racing import.
      await postAndWaitForReady(
        createWorkerCommand({ type: 'PAUSE' }),
        'Pause before world import',
      );
      await drainPendingOperations(pendingPersistenceWritesRef.current);

      const loaded = await persistence.importWorldJson(json, { replaceExisting: true });
      worldIdRef.current = loaded.world.id;
      lastSaveRequestedDayRef.current = loaded.snapshot.day;
      lastPersistedDayRef.current = loaded.snapshot.day;
      currentDayRef.current = loaded.snapshot.day;
      setReady(false);
      setProjection(null);
      setInspectedPerson(null);
      setInspectedPersonId(null);

      try {
        await postAndWaitForReady(
          createWorkerCommand({
            type: 'LOAD',
            snapshot: loaded.snapshot,
            speed: { daysPerSecond: speedRef.current || 1 },
            startPaused: true,
          }),
          'Load imported world',
        );
      } catch (caught: unknown) {
        const failure = caught instanceof Error ? caught : new Error(String(caught));
        // Persistence now names the imported world. Stopping the old host is
        // safer than allowing old authoritative state to save under that identity.
        fatalHostErrorRef.current = failure;
        snapshotWaitersRef.current.rejectAll(failure);
        hostResponseWaitersRef.current.rejectAll(failure);
        host.terminate();
        hostRef.current = null;
        setReady(false);
        setSaveStatus('error');
        setError(failure.message);
        throw failure;
      }
      setSaveStatus('saved');
    } finally {
      hostTransitionRef.current = false;
    }
  }, [postAndWaitForReady]);

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
