/// <reference lib="webworker" />

import { SimulationWorkerRuntime } from './runtime';

const workerScope = globalThis as unknown as DedicatedWorkerGlobalScope;
const runtime = new SimulationWorkerRuntime((response) => {
  workerScope.postMessage(response);
});

workerScope.addEventListener('message', (event: MessageEvent<unknown>) => {
  void runtime.handleMessage(event.data);
});

export {};
