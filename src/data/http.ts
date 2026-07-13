export interface JsonRequestOptions {
  readonly timeoutMs?: number;
  readonly retries?: number;
  readonly headers?: Readonly<Record<string, string>>;
  readonly maxBytes?: number;
  readonly signal?: AbortSignal;
}

export class HttpRequestError extends Error {
  public readonly status: number | undefined;
  public readonly retryable: boolean;

  public constructor(message: string, status?: number, retryable = false) {
    super(message);
    this.name = 'HttpRequestError';
    this.status = status;
    this.retryable = retryable;
  }
}

const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_RETRIES = 2;
const DEFAULT_MAX_BYTES = 8 * 1024 * 1024;
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

function delay(milliseconds: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted === true) {
      reject(signal.reason instanceof Error ? signal.reason : new Error('Request aborted'));
      return;
    }

    const timer = setTimeout(resolve, milliseconds);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(signal.reason instanceof Error ? signal.reason : new Error('Request aborted'));
      },
      { once: true },
    );
  });
}

function sanitizedUrl(value: URL): string {
  const safe = new URL(value);
  for (const key of safe.searchParams.keys()) {
    if (/key|token|secret|password|credential/i.test(key)) {
      safe.searchParams.set(key, '[redacted]');
    }
  }
  return safe.toString();
}

function isRetryableError(error: unknown): boolean {
  if (error instanceof HttpRequestError) {
    return error.retryable;
  }

  return error instanceof TypeError || (error instanceof DOMException && error.name === 'AbortError');
}

async function readBoundedText(response: Response, maxBytes: number, url: URL): Promise<string> {
  if (response.body === null) return '';
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let receivedBytes = 0;
  let text = '';

  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    receivedBytes += chunk.value.byteLength;
    if (receivedBytes > maxBytes) {
      await reader.cancel();
      throw new HttpRequestError(
        `Response from ${sanitizedUrl(url)} exceeds the ${maxBytes}-byte limit`,
      );
    }
    text += decoder.decode(chunk.value, { stream: true });
  }

  return text + decoder.decode();
}

/**
 * Fetches bounded JSON with deterministic exponential backoff. This utility is
 * intended for CLI/server ingestion and is never called by the simulation loop.
 */
export async function fetchJson(
  input: string | URL,
  options: JsonRequestOptions = {},
): Promise<unknown> {
  const url = input instanceof URL ? input : new URL(input);
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retries = options.retries ?? DEFAULT_RETRIES;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const timeoutController = new AbortController();
    const timeout = setTimeout(
      () => timeoutController.abort(new Error(`Request timed out after ${timeoutMs}ms`)),
      timeoutMs,
    );
    const onOuterAbort = (): void => {
      timeoutController.abort(options.signal?.reason);
    };
    options.signal?.addEventListener('abort', onOuterAbort, { once: true });

    try {
      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
          ...options.headers,
        },
        signal: timeoutController.signal,
      });

      if (!response.ok) {
        throw new HttpRequestError(
          `HTTP ${response.status} from ${sanitizedUrl(url)}`,
          response.status,
          RETRYABLE_STATUS.has(response.status),
        );
      }

      const declaredLength = Number(response.headers.get('content-length'));
      if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
        throw new HttpRequestError(
          `Response from ${sanitizedUrl(url)} exceeds the ${maxBytes}-byte limit`,
        );
      }

      // Reading text first is intentional: EONET has occasionally returned JSON
      // with a non-JSON Content-Type, so response.json() is unnecessarily brittle.
      const body = await readBoundedText(response, maxBytes, url);

      try {
        return JSON.parse(body) as unknown;
      } catch {
        throw new HttpRequestError(`Invalid JSON from ${sanitizedUrl(url)}`);
      }
    } catch (error: unknown) {
      lastError = error;
      const timedOut = timeoutController.signal.aborted && options.signal?.aborted !== true;
      if (
        attempt >= retries ||
        (!isRetryableError(error) && !timedOut) ||
        options.signal?.aborted === true
      ) {
        throw error;
      }
    } finally {
      clearTimeout(timeout);
      options.signal?.removeEventListener('abort', onOuterAbort);
    }

    await delay(Math.min(250 * 2 ** attempt, 2_000), options.signal);
  }

  throw lastError instanceof Error ? lastError : new Error('Request failed');
}
