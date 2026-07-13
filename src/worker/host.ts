import {
  isSimulationWorkerResponse,
  type SimulationWorkerCommand,
  type SimulationWorkerResponse,
} from './protocol';

export type SimulationResponseListener = (response: SimulationWorkerResponse) => void;

export interface SimulationHost {
  post(command: SimulationWorkerCommand): void;
  subscribe(listener: SimulationResponseListener): () => void;
  terminate(): void;
}

export type SimulationWorkerFactory = () => Worker;

function defaultWorkerFactory(): Worker {
  return new Worker(new URL('./simulation.worker.ts', import.meta.url), {
    name: 'the-current-simulation',
    type: 'module',
  });
}

export class BrowserSimulationHost implements SimulationHost {
  private readonly worker: Worker;
  private readonly listeners = new Set<SimulationResponseListener>();
  private terminated = false;

  constructor(workerFactory: SimulationWorkerFactory = defaultWorkerFactory) {
    this.worker = workerFactory();
    this.worker.addEventListener('message', this.handleMessage);
  }

  post(command: SimulationWorkerCommand): void {
    if (this.terminated) throw new Error('Simulation worker host has been terminated');
    this.worker.postMessage(command);
  }

  subscribe(listener: SimulationResponseListener): () => void {
    if (this.terminated) throw new Error('Simulation worker host has been terminated');
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  terminate(): void {
    if (this.terminated) return;
    this.terminated = true;
    this.worker.removeEventListener('message', this.handleMessage);
    this.worker.terminate();
    this.listeners.clear();
  }

  private readonly handleMessage = (event: MessageEvent<unknown>): void => {
    if (!isSimulationWorkerResponse(event.data)) return;
    for (const listener of this.listeners) listener(event.data);
  };
}

export function createBrowserSimulationHost(
  workerFactory?: SimulationWorkerFactory,
): BrowserSimulationHost {
  return workerFactory === undefined
    ? new BrowserSimulationHost()
    : new BrowserSimulationHost(workerFactory);
}
