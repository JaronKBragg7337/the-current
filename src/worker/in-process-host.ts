import type { SimulationHost, SimulationResponseListener } from './host';
import type { SimulationWorkerCommand, SimulationWorkerResponse } from './protocol';
import { SimulationWorkerRuntime } from './runtime';

/**
 * Main-thread fallback and deterministic test host. The runtime still advances in
 * bounded slices and yields between manual slices, but production browsers should
 * prefer BrowserSimulationHost so simulation CPU work is isolated from rendering.
 */
export class InProcessSimulationHost implements SimulationHost {
  private readonly listeners = new Set<SimulationResponseListener>();
  private readonly runtime = new SimulationWorkerRuntime((response) => this.publish(response));
  private terminated = false;

  post(command: SimulationWorkerCommand): void {
    void this.dispatch(command);
  }

  dispatch(command: SimulationWorkerCommand): Promise<void> {
    if (this.terminated) return Promise.reject(new Error('In-process simulation host has been terminated'));
    return this.runtime.handle(command);
  }

  dispatchUnknown(message: unknown): Promise<void> {
    if (this.terminated) return Promise.reject(new Error('In-process simulation host has been terminated'));
    return this.runtime.handleMessage(message);
  }

  subscribe(listener: SimulationResponseListener): () => void {
    if (this.terminated) throw new Error('In-process simulation host has been terminated');
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  terminate(): void {
    if (this.terminated) return;
    this.terminated = true;
    this.runtime.dispose();
    this.listeners.clear();
  }

  private publish(response: SimulationWorkerResponse): void {
    for (const listener of this.listeners) listener(response);
  }
}

export function createInProcessSimulationHost(): InProcessSimulationHost {
  return new InProcessSimulationHost();
}
