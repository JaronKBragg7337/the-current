import { normalizeObservations } from './normalize';
import {
  NORMALIZER_VERSION,
  SNAPSHOT_SCHEMA_VERSION,
  parseSnapshot,
} from './schema';
import type { CausalSignal, ExternalObservation, SignalSnapshot } from './schema';
import type { InformationAdapter } from './adapters/types';

export interface CollectionOptions {
  readonly now?: Date;
  readonly mode?: 'live' | 'mixed';
  readonly previousSignals?: readonly CausalSignal[];
  readonly signal?: AbortSignal;
}

function safeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/([?&](?:api_?key|token|secret|password|credential)=)[^&\s]+/gi, '$1[redacted]')
    .slice(0, 500);
}

/** Collects adapters independently so a degraded source cannot stop a snapshot. */
export async function collectSignalSnapshot(
  adapters: readonly InformationAdapter[],
  options: CollectionOptions = {},
): Promise<SignalSnapshot> {
  const now = options.now ?? new Date();
  const runs = await Promise.all(
    adapters.map(async (adapter) => {
      const startedAt = new Date().toISOString();
      try {
        const observations = await adapter.fetch({
          now,
          ...(options.signal === undefined ? {} : { signal: options.signal }),
        });
        return {
          observations,
          source: {
            adapter: adapter.id,
            provider: adapter.provider,
            status: 'success' as const,
            observationCount: observations.length,
            startedAt,
            finishedAt: new Date().toISOString(),
          },
        };
      } catch (error: unknown) {
        return {
          observations: [] as readonly ExternalObservation[],
          source: {
            adapter: adapter.id,
            provider: adapter.provider,
            status: 'failed' as const,
            observationCount: 0,
            startedAt,
            finishedAt: new Date().toISOString(),
            error: safeErrorMessage(error),
          },
        };
      }
    }),
  );

  const observations = runs
    .flatMap((run) => run.observations)
    .sort((left, right) => left.id.localeCompare(right.id));
  const signals = normalizeObservations(
    observations,
    options.previousSignals === undefined
      ? {}
      : { previousSignals: options.previousSignals },
  );

  return parseSnapshot({
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    normalizerVersion: NORMALIZER_VERSION,
    generatedAt: now.toISOString(),
    mode: options.mode ?? 'live',
    fixture: false,
    sources: runs.map((run) => run.source),
    observations,
    signals,
  });
}
