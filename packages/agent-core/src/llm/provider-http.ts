export interface ProviderHttpOptions {
  /** Total request deadline, including response reads. Defaults to five minutes. */
  timeoutMs?: number;
  /** Maximum decoded response bytes, including streaming protocol frames. Defaults to 8 MiB. */
  maxResponseBytes?: number;
  /** Inject a fetch implementation (tests or host transport). */
  fetchImpl?: (url: string, init: RequestInit) => Promise<Response>;
}

/** One lifetime and byte budget for headers, JSON and incremental protocols. */
export async function fetchProviderResponse<T>(
  provider: string,
  url: string,
  init: RequestInit,
  options: ProviderHttpOptions,
  consume: (response: Response, chunks: AsyncIterable<string>, signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const owner = init.signal;
  owner?.throwIfAborted();
  const timeoutMs = options.timeoutMs ?? 300_000;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 2_147_483_647)
    throw new RangeError('Provider timeout must be a positive timer duration');
  const maxResponseBytes = options.maxResponseBytes ?? 8 * 1024 * 1024;
  if (!Number.isSafeInteger(maxResponseBytes) || maxResponseBytes <= 0)
    throw new RangeError('Provider response budget must be a positive safe integer');
  const controller = new AbortController();
  const forwardAbort = () => controller.abort(owner?.reason);
  owner?.addEventListener('abort', forwardAbort, { once: true });
  let response: Response | undefined;
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  const cancelBody = () => {
    if (reader) void reader.cancel().catch(() => {});
    else if (response?.body && !response.body.locked) void response.body.cancel().catch(() => {});
  };
  const rejectOversized = () => {
    const error = new RangeError('AI response exceeds size limit');
    controller.abort(error);
    throw error;
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
  async function* readChunks(): AsyncGenerator<string> {
    let bytes = 0;
    // A host-only json() response remains supported; native Responses use the
    // bounded reader, without allocating the full body before checking its size.
    if (!response!.body) {
      const text = JSON.stringify(await response!.json());
      controller.signal.throwIfAborted();
      if (new TextEncoder().encode(text).byteLength > maxResponseBytes) rejectOversized();
      yield text;
      return;
    }
    reader = response!.body.getReader();
    const activeReader = reader;
    const decoder = new TextDecoder();
    let complete = false;
    try {
      while (true) {
        const chunk = await activeReader.read();
        controller.signal.throwIfAborted();
        if (chunk.done) {
          complete = true;
          break;
        }
        bytes += chunk.value.byteLength;
        if (bytes > maxResponseBytes) rejectOversized();
        yield decoder.decode(chunk.value, { stream: true });
      }
      yield decoder.decode();
    } finally {
      // Protocol completion and parser/callback failure can stop before EOF.
      if (!complete) void activeReader.cancel().catch(() => {});
      activeReader.releaseLock();
      reader = undefined;
    }
  }
  try {
    const request = (async () => {
      const fetcher = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
      response = await fetcher(url, { ...init, signal: controller.signal });
      if (controller.signal.aborted) cancelBody();
      controller.signal.throwIfAborted();
      if (!response.ok) {
        cancelBody();
        throw Object.assign(new Error(`${provider} request failed: ${response.status}`), { status: response.status });
      }
      if (Number(response.headers?.get('Content-Length')) > maxResponseBytes) rejectOversized();
      const value = await consume(response, readChunks(), controller.signal);
      controller.signal.throwIfAborted();
      return value;
    })();
    return await Promise.race([request, aborted]);
  } catch (error) {
    cancelBody();
    throw error;
  } finally {
    clearTimeout(timer);
    owner?.removeEventListener('abort', forwardAbort);
    controller.signal.removeEventListener('abort', onAbort);
  }
}

export async function readProviderJson<T>(chunks: AsyncIterable<string>): Promise<T> {
  let text = '';
  for await (const chunk of chunks) text += chunk;
  return JSON.parse(text) as T;
}

/** Fetch-based providers share cancellation, deadlines and safe HTTP failures. */
export function fetchProviderJson<T>(
  provider: string,
  url: string,
  init: RequestInit,
  options: ProviderHttpOptions,
): Promise<T> {
  return fetchProviderResponse(provider, url, init, options, (_response, chunks) => readProviderJson<T>(chunks));
}
