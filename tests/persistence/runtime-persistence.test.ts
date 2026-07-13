import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ExternalInputRecord } from '../../src/persistence';
import {
  createSimulation,
  type NormalizedSignal,
  type ObserverIntervention,
} from '../../src/simulation';
import {
  createInProcessSimulationHost,
  createWorkerCommand,
  type SimulationWorkerResponse,
} from '../../src/worker';
import {
  AutosaveScheduler,
  TimedWaiterRegistry,
  calculateRecoveryDay,
} from '../../src/app/runtimePersistence';

const signal: NormalizedSignal = {
  id: 'signal:recovery',
  sourceIds: ['fixture:recovery'],
  domain: 'energy',
  geography: 'Confluence',
  intensity: 0.5,
  confidence: 0.8,
  sourceAgreement: 0.7,
  novelty: 0.6,
  durationDays: 2,
  halfLifeDays: 1,
  timestampDay: 14,
  effectiveDay: 15,
  objectivePressure: { energy: 0.4 },
  beliefPressure: { sentiment: -0.1 },
};

const intervention: ObserverIntervention = {
  id: 'intervention:recovery',
  kind: 'help',
  payloadType: 'water',
  effectiveDay: 19,
  amount: 12,
  intensity: 0.4,
  targetSettlementId: 'settlement:current',
  note: 'Queued after the latest durable event chunk',
};

function externalInputs(): ExternalInputRecord[] {
  return [
    {
      recordVersion: 1,
      key: 'world:test:input:signal:signal%3Arecovery',
      worldId: 'world:test',
      inputId: signal.id,
      kind: 'signal',
      queuedDay: signal.timestampDay,
      effectiveDay: signal.effectiveDay,
      recordedAt: '2026-07-13T00:00:00.000Z',
      digest: 'fixture-signal-digest',
      input: signal,
    },
    {
      recordVersion: 1,
      key: 'world:test:input:intervention:intervention%3Arecovery',
      worldId: 'world:test',
      inputId: intervention.id,
      kind: 'intervention',
      queuedDay: 18,
      effectiveDay: intervention.effectiveDay,
      recordedAt: '2026-07-13T00:00:01.000Z',
      digest: 'fixture-intervention-digest',
      input: intervention,
    },
  ];
}

afterEach(() => {
  vi.useRealTimers();
});

describe('runtime persistence coordination', () => {
  it('times out unresolved persistence waiters and rejects every waiter on fatal host failure', async () => {
    vi.useFakeTimers();
    const waiters = new TimedWaiterRegistry<void>();
    const timedOut = waiters.wait('request:timeout', 'Snapshot persistence', 50);
    await vi.advanceTimersByTimeAsync(50);
    await expect(timedOut).rejects.toThrow('Snapshot persistence timed out after 50ms');
    expect(waiters.size).toBe(0);

    const first = waiters.wait('request:first', 'First snapshot', 1_000);
    const second = waiters.wait('request:second', 'Second snapshot', 1_000);
    const failure = new Error('Simulation worker crashed');
    waiters.rejectAll(failure);
    await expect(first).rejects.toThrow('Simulation worker crashed');
    await expect(second).rejects.toThrow('Simulation worker crashed');
    expect(waiters.size).toBe(0);
  });

  it('allows one autosave at a time, coalesces busy projections, and throttles the next export', async () => {
    vi.useFakeTimers();
    let now = 10_000;
    let requestSequence = 0;
    const requests: Array<{ day: number; requestId: string }> = [];
    const errors: unknown[] = [];
    const scheduler = new AutosaveScheduler({
      idFactory: () => {
        requestSequence += 1;
        return `autosave:${requestSequence.toString()}`;
      },
      minimumIntervalMilliseconds: 1_000,
      now: () => now,
      onError: (error) => errors.push(error),
      request: (day, requestId) => requests.push({ day, requestId }),
    });

    scheduler.queue(1);
    scheduler.queue(2);
    scheduler.queue(7);
    expect(requests).toEqual([{ day: 1, requestId: 'autosave:1' }]);
    expect(scheduler.state.pendingDay).toBe(7);

    expect(scheduler.complete('autosave:1')).toBe(true);
    expect(requests).toHaveLength(1);
    now += 999;
    await vi.advanceTimersByTimeAsync(999);
    expect(requests).toHaveLength(1);
    now += 1;
    await vi.advanceTimersByTimeAsync(1);
    expect(requests).toEqual([
      { day: 1, requestId: 'autosave:1' },
      { day: 7, requestId: 'autosave:2' },
    ]);
    expect(errors).toEqual([]);
    scheduler.dispose();
  });

  it('aborts a pending old-world autosave before an import barrier without resuming it later', async () => {
    vi.useFakeTimers();
    let now = 20_000;
    let requestSequence = 0;
    const requests: Array<{ day: number; requestId: string }> = [];
    const scheduler = new AutosaveScheduler({
      idFactory: () => `autosave:${(++requestSequence).toString()}`,
      minimumIntervalMilliseconds: 1_000,
      now: () => now,
      onError: () => undefined,
      request: (day, requestId) => requests.push({ day, requestId }),
    });

    scheduler.queue(3);
    scheduler.queue(11);
    scheduler.complete('autosave:1');
    expect(scheduler.state.pendingDay).toBe(11);
    scheduler.abort();
    expect(scheduler.state).toEqual({
      inFlightDay: null,
      inFlightRequestId: null,
      pendingDay: null,
    });
    scheduler.queue(2);
    expect(requests.at(-1)).toEqual({ day: 2, requestId: 'autosave:2' });

    now += 2_000;
    await vi.advanceTimersByTimeAsync(2_000);
    expect(requests).toEqual([
      { day: 3, requestId: 'autosave:1' },
      { day: 2, requestId: 'autosave:2' },
    ]);
    scheduler.dispose();
  });

  it('recovers through the latest durable external-input queue day, not only event chunks', () => {
    const inputs = externalInputs();
    expect(calculateRecoveryDay(10, [{ lastDay: 12 }], inputs)).toBe(18);
    expect(calculateRecoveryDay(20, [], inputs)).toBe(20);
  });

  it('uses a correlated PAUSE response as a queue barrier before replacing a world', async () => {
    const host = createInProcessSimulationHost();
    const responses: SimulationWorkerResponse[] = [];
    host.subscribe((response) => responses.push(response));
    await host.dispatch(createWorkerCommand({
      type: 'INIT',
      options: { seed: 'old-world' },
      startPaused: true,
    }, 'request:init-old'));

    const advancing = host.dispatch(createWorkerCommand({
      type: 'ADVANCE',
      days: 8,
      projectionEveryDays: 1,
    }, 'request:advance-old'));
    const paused = host.dispatch(createWorkerCommand({ type: 'PAUSE' }, 'request:pause-barrier'));
    await paused;
    await advancing;

    const pauseIndex = responses.findIndex(
      (response) => response.type === 'READY' && response.inReplyTo === 'request:pause-barrier',
    );
    expect(pauseIndex).toBeGreaterThan(-1);
    expect(
      responses.slice(pauseIndex + 1).some((response) => response.inReplyTo === 'request:advance-old'),
    ).toBe(false);

    const replacement = createSimulation({ seed: 'replacement-world' }).snapshot();
    await host.dispatch(createWorkerCommand({
      type: 'LOAD',
      snapshot: replacement,
      startPaused: true,
    }, 'request:load-replacement'));
    expect(responses.at(-3)).toMatchObject({
      type: 'READY',
      inReplyTo: 'request:load-replacement',
      digest: replacement.digest,
    });
    expect(
      responses.slice(pauseIndex + 1).some((response) => response.inReplyTo === 'request:advance-old'),
    ).toBe(false);
    host.terminate();
  });
});
