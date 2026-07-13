import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchJson } from './http';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('bounded JSON transport', () => {
  it('parses JSON without relying on a JSON content type', async () => {
    const value = await fetchJson('data:text/plain,%7B%22ok%22%3Atrue%7D', { retries: 0 });
    expect(value).toEqual({ ok: true });
  });

  it('rejects a streamed body above the configured byte limit', async () => {
    await expect(
      fetchJson('data:text/plain,%7B%22message%22%3A%22too-large%22%7D', {
        retries: 0,
        maxBytes: 8,
      }),
    ).rejects.toThrow('exceeds the 8-byte limit');
  });

  it('retries transient HTTP status codes and then succeeds', async () => {
    let attempts = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(() => {
        attempts += 1;
        return Promise.resolve(
          attempts < 3
            ? new Response('{}', { status: 503 })
            : new Response('{"recovered":true}', { status: 200 }),
        );
      }),
    );

    await expect(fetchJson('https://example.invalid/retry-test', { retries: 2 })).resolves.toEqual({
      recovered: true,
    });
    expect(attempts).toBe(3);
  });
});
