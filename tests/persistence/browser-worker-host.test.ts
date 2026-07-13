import { describe, expect, it } from 'vitest';

import {
  createBrowserSimulationHost,
  type SimulationWorkerResponse,
} from '../../src/worker';

class FakeWorker extends EventTarget {
  terminated = false;

  postMessage(): void {}

  terminate(): void {
    this.terminated = true;
  }
}

describe('browser simulation host failures', () => {
  it('surfaces asynchronous module-worker failures instead of hanging silently', () => {
    const worker = new FakeWorker();
    const host = createBrowserSimulationHost(() => worker as unknown as Worker);
    const responses: SimulationWorkerResponse[] = [];
    host.subscribe((response) => responses.push(response));

    worker.dispatchEvent(new ErrorEvent('error', { message: 'Unable to load simulation.worker.js' }));

    expect(responses).toContainEqual(expect.objectContaining({
      type: 'ERROR',
      code: 'COMMAND_FAILED',
      recoverable: false,
      message: 'Unable to load simulation.worker.js',
    }));
    host.terminate();
    expect(worker.terminated).toBe(true);
  });

  it('replays a recorded failure to listeners that subscribe after the crash', () => {
    const worker = new FakeWorker();
    const host = createBrowserSimulationHost(() => worker as unknown as Worker);
    worker.dispatchEvent(new Event('messageerror'));

    const responses: SimulationWorkerResponse[] = [];
    host.subscribe((response) => responses.push(response));
    expect(responses.at(-1)).toMatchObject({
      type: 'ERROR',
      message: 'The simulation worker returned an unreadable message',
    });
    host.terminate();
  });
});
