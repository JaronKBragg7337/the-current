import {
  SIMULATION_WORKER_PROTOCOL_VERSION,
  isSimulationWorkerResponse,
  type ErrorResponse,
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
  private failureResponse: ErrorResponse | null = null;
  private responseSequence = 0;
  private terminated = false;

  constructor(workerFactory: SimulationWorkerFactory = defaultWorkerFactory) {
    this.worker = workerFactory();
    this.worker.addEventListener('message', this.handleMessage);
    this.worker.addEventListener('error', this.handleWorkerFailure);
    this.worker.addEventListener('messageerror', this.handleWorkerFailure);
  }

  post(command: SimulationWorkerCommand): void {
    if (this.terminated) throw new Error('Simulation worker host has been terminated');
    this.worker.postMessage(command);
  }

  subscribe(listener: SimulationResponseListener): () => void {
    if (this.terminated) throw new Error('Simulation worker host has been terminated');
    this.listeners.add(listener);
    if (this.failureResponse !== null) listener(this.failureResponse);
    return () => {
      this.listeners.delete(listener);
    };
  }

  terminate(): void {
    if (this.terminated) return;
    this.terminated = true;
    this.worker.removeEventListener('message', this.handleMessage);
    this.worker.removeEventListener('error', this.handleWorkerFailure);
    this.worker.removeEventListener('messageerror', this.handleWorkerFailure);
    this.worker.terminate();
    this.listeners.clear();
  }

  private readonly handleMessage = (event: MessageEvent<unknown>): void => {
    if (!isSimulationWorkerResponse(event.data)) return;
    for (const listener of this.listeners) listener(event.data);
  };

  private readonly handleWorkerFailure = (event: Event): void => {
    if (this.terminated || this.failureResponse !== null) return;
    const detail = event instanceof ErrorEvent && event.message.trim() !== ''
      ? event.message
      : event.type === 'messageerror'
        ? 'The simulation worker returned an unreadable message'
        : 'The simulation worker failed to start or crashed';
    this.responseSequence += 1;
    this.failureResponse = {
      protocolVersion: SIMULATION_WORKER_PROTOCOL_VERSION,
      responseId: this.responseSequence,
      inReplyTo: null,
      emittedAt: Date.now(),
      type: 'ERROR',
      code: 'COMMAND_FAILED',
      message: detail,
      recoverable: false,
      commandType: null,
    };
    for (const listener of this.listeners) listener(this.failureResponse);
  };
}

export function createBrowserSimulationHost(
  workerFactory?: SimulationWorkerFactory,
): BrowserSimulationHost {
  return workerFactory === undefined
    ? new BrowserSimulationHost()
    : new BrowserSimulationHost(workerFactory);
}
