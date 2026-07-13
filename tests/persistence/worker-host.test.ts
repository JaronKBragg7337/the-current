import { describe, expect, it } from 'vitest';
import {
  SIMULATION_WORKER_PROTOCOL_VERSION,
  createInProcessSimulationHost,
  createWorkerCommand,
  type SimulationWorkerResponse,
} from '../../src/worker';

describe('in-process simulation host', () => {
  it('mirrors the versioned worker protocol for initialization, advancement, inspection, export, load, and stop', async () => {
    const host = createInProcessSimulationHost();
    const responses: SimulationWorkerResponse[] = [];
    host.subscribe((response) => responses.push(response));

    await host.dispatch(
      createWorkerCommand(
        {
          type: 'INIT',
          options: { seed: 'worker-host-seed' },
          startPaused: true,
        },
        'request:init',
      ),
    );
    expect(responses.map((response) => response.type)).toEqual(
      expect.arrayContaining(['READY', 'PROJECTION', 'METRICS']),
    );
    expect(
      responses.find((response) => response.type === 'READY' && response.inReplyTo === 'request:init'),
    ).toMatchObject({ state: 'paused', day: 0, seed: 'worker-host-seed' });

    await host.dispatch(
      createWorkerCommand(
        { type: 'ADVANCE', days: 6, projectionEveryDays: 2 },
        'request:advance',
      ),
    );
    const advanceProjections = responses.filter(
      (response) => response.type === 'PROJECTION' && response.inReplyTo === 'request:advance',
    );
    expect(advanceProjections.length).toBeGreaterThanOrEqual(3);
    const finalProjection = advanceProjections.at(-1);
    expect(finalProjection?.type === 'PROJECTION' ? finalProjection.projection.day : -1).toBe(6);
    expect(
      responses.some(
        (response) =>
          response.type === 'EVENT_BATCH' &&
          response.inReplyTo === 'request:advance' &&
          response.events.length > 0,
      ),
    ).toBe(true);

    const projectedPerson = finalProjection?.type === 'PROJECTION'
      ? finalProjection.projection.people[0]
      : undefined;
    expect(projectedPerson).toBeDefined();
    await host.dispatch(
      createWorkerCommand(
        { type: 'INSPECT', entityType: 'person', entityId: projectedPerson?.id ?? 'missing' },
        'request:inspect',
      ),
    );
    expect(
      responses.find(
        (response) => response.type === 'INSPECTION' && response.inReplyTo === 'request:inspect',
      ),
    ).toMatchObject({ entityId: projectedPerson?.id });

    await host.dispatch(createWorkerCommand({ type: 'EXPORT' }, 'request:export'));
    const exported = responses.find(
      (response) => response.type === 'SNAPSHOT' && response.inReplyTo === 'request:export',
    );
    if (exported?.type !== 'SNAPSHOT') throw new Error('Expected a snapshot response');
    expect(exported.snapshot.day).toBe(6);

    await host.dispatch(
      createWorkerCommand(
        { type: 'LOAD', snapshot: exported.snapshot, startPaused: true },
        'request:load',
      ),
    );
    expect(
      responses.find((response) => response.type === 'READY' && response.inReplyTo === 'request:load'),
    ).toMatchObject({ day: 6, state: 'paused', digest: exported.snapshot.digest });

    await host.dispatch(createWorkerCommand({ type: 'SET_SPEED', speed: { daysPerSecond: 0 } }, 'request:speed'));
    await host.dispatch(createWorkerCommand({ type: 'PAUSE' }, 'request:pause'));
    await host.dispatch(createWorkerCommand({ type: 'STOP' }, 'request:stop'));
    expect(
      responses.find((response) => response.type === 'READY' && response.inReplyTo === 'request:stop'),
    ).toMatchObject({ state: 'stopped', day: 6 });
    host.terminate();
  });

  it('returns a correlated protocol error for malformed and mismatched messages', async () => {
    const host = createInProcessSimulationHost();
    const responses: SimulationWorkerResponse[] = [];
    host.subscribe((response) => responses.push(response));

    await host.dispatchUnknown({
      type: 'INIT',
      protocolVersion: SIMULATION_WORKER_PROTOCOL_VERSION + 1,
      requestId: 'request:wrong-version',
    });
    expect(responses.at(-1)).toMatchObject({
      type: 'ERROR',
      code: 'PROTOCOL_MISMATCH',
      inReplyTo: 'request:wrong-version',
    });
    host.terminate();
  });

  it('runs accelerated continuous time in bounded scheduled pulses and can be paused', async () => {
    const host = createInProcessSimulationHost();
    const responses: SimulationWorkerResponse[] = [];
    host.subscribe((response) => responses.push(response));

    await host.dispatch(
      createWorkerCommand(
        {
          type: 'INIT',
          options: { seed: 'worker-accelerated-seed' },
          speed: {
            daysPerSecond: 200,
            maxDaysPerSlice: 2,
            projectionEveryDays: 1,
            metricsEveryDays: 2,
          },
          startPaused: false,
        },
        'request:accelerated-init',
      ),
    );

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Accelerated host did not reach day 3')), 2_000);
      const unsubscribe = host.subscribe((response) => {
        if (response.type === 'PROJECTION' && response.projection.day >= 3) {
          clearTimeout(timeout);
          unsubscribe();
          resolve();
        }
      });
    });

    await host.dispatch(createWorkerCommand({ type: 'PAUSE' }, 'request:accelerated-pause'));
    const paused = responses.find(
      (response) => response.type === 'READY' && response.inReplyTo === 'request:accelerated-pause',
    );
    expect(paused?.type === 'READY' ? paused.day : -1).toBeGreaterThanOrEqual(3);
    expect(paused).toMatchObject({ state: 'paused' });
    host.terminate();
  });
});
