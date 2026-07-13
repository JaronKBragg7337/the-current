import type { ExternalObservation } from '../schema';
import type { JsonRequestOptions } from '../http';

export interface AdapterContext {
  readonly now: Date;
  readonly request?: (
    input: string | URL,
    options?: JsonRequestOptions,
  ) => Promise<unknown>;
  readonly signal?: AbortSignal;
}

export interface InformationAdapter {
  readonly id: string;
  readonly provider: string;
  readonly fetch: (context: AdapterContext) => Promise<readonly ExternalObservation[]>;
}
