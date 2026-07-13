import { describe, expect, it } from 'vitest';

import type { InformationAdapter } from './adapters';
import { createOfflineObservations } from './fixtures/offline';
import { collectSignalSnapshot } from './pipeline';

describe('signal collection pipeline', () => {
  it('isolates adapter failures and keeps successful observations', async () => {
    const observations = createOfflineObservations();
    const working: InformationAdapter = {
      id: 'working',
      provider: 'Fixture provider',
      fetch: async () => observations,
    };
    const failing: InformationAdapter = {
      id: 'failing',
      provider: 'Unavailable provider',
      fetch: async () => {
        throw new Error('temporary outage?token=must-not-leak');
      },
    };

    const snapshot = await collectSignalSnapshot([working, failing], {
      now: new Date('2026-01-15T12:00:00.000Z'),
    });

    expect(snapshot.observations).toHaveLength(5);
    expect(snapshot.signals).toHaveLength(4);
    expect(snapshot.sources.find((source) => source.adapter === 'failing')?.status).toBe(
      'failed',
    );
    expect(snapshot.sources.find((source) => source.adapter === 'failing')?.error).toContain(
      '[redacted]',
    );
  });
});
