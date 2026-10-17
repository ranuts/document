export interface ProviderHttpOptions {
  /** Total request deadline, including response reads. Defaults to five minutes. */
  timeoutMs?: number;
  /** Inject a fetch implementation (tests or host transport). */
  fetchImpl?: (url: string, init: RequestInit) => Promise<Response>;
}

/** Fetch-based providers share cancellation, deadlines and safe HTTP failures. */
export async function fetchProviderJson<T>(
  provider: string,
  url: string,
  init: RequestInit,
  options: ProviderHttpOptions,
): Promise<T> {
  const owner = init.signal;
  owner?.throwIfAborted();
  const timeoutMs = options.timeoutMs ?? 300_000;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 2_147_483_647)
    throw new RangeError('Provider timeout must be a positive timer duration');

  const controller = new AbortController();
  const forwardAbort = () => controller.abort(owner?.reason);
  owner?.addEventListener('abort', forwardAbort, { once: true });
  let response: Response | undefined;
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  const cancelBody = () => {
    if (reader) void reader.cancel().catch(() => {});
    else if (response?.body && !response.body.locked) void response.body.cancel().catch(() => {});
  };
  let onAbort: () => void = () => {};
  const aborted = new Promise<never>((_resolve, reject) => {
    onAbort = () => {
      cancelBody();
      reject(controller.signal.reason);
    };
    controller.signal.addEventListener('abort', onAbort, { once: true });
  });
  const timer = setTimeout(() => controller.abort(new DOMException('AI request timed out', 'TimeoutError')), timeoutMs);
  try {
    const request = (async () => {
      const fetcher = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
      response = await fetcher(url, { ...init, signal: controller.signal });
      if (controller.signal.aborted) cancelBody();
      controller.signal.throwIfAborted();
      if (!response.ok) {
        // Never wait for or retain an upstream error body: it may stall or
        // contain credentials and private request content.
        cancelBody();
        throw Object.assign(new Error(`${provider} request failed: ${response.status}`), { status: response.status });
      }
      let value: T;
      if (response.body) {
        // Own the reader so even a host-created Response whose transport ignores
        // AbortSignal stops consuming bytes when the request is cancelled.
        reader = response.body.getReader();
        const activeReader = reader;
        const decoder = new TextDecoder();
        let text = '';
        try {
          while (true) {
            const chunk = await activeReader.read();
            controller.signal.throwIfAborted();
            if (chunk.done) break;
            text += decoder.decode(chunk.value, { stream: true });
          }
          text += decoder.decode();
          value = JSON.parse(text) as T;
        } finally {
          activeReader.releaseLock();
          reader = undefined;
        }
      } else value = (await response.json()) as T;
      controller.signal.throwIfAborted();
      return value;
    })();
    // The boundary also settles when a host transport/body ignores AbortSignal.
    return await Promise.race([request, aborted]);
  } finally {
    clearTimeout(timer);
    owner?.removeEventListener('abort', forwardAbort);
    controller.signal.removeEventListener('abort', onAbort);
  }
}
