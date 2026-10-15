import { t } from '@ranuts/shared/i18n';

export const MAX_REMOTE_DOCUMENT_BYTES = 100 * 1024 * 1024;
export const REMOTE_DOCUMENT_TIMEOUT_MS = 60_000;

/** Bound decoded response bytes and the entire transfer, including body reads. */
export async function fetchRemoteDocument(url: string, options: RequestInit = {}, owner?: AbortSignal) {
  const controller = new AbortController();
  const signals = [owner, options.signal].filter((signal): signal is AbortSignal => !!signal);
  const forwardAbort = (event: Event) => controller.abort((event.target as AbortSignal).reason);
  for (const signal of signals) {
    if (signal.aborted) controller.abort(signal.reason);
    else signal.addEventListener('abort', forwardAbort, { once: true });
  }
  const timeout = setTimeout(
    () => controller.abort(new DOMException(t('openUrlTimeout'), 'TimeoutError')),
    REMOTE_DOCUMENT_TIMEOUT_MS,
  );
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let response: Response | undefined;
  let onAbort: () => void = () => {};
  const aborted = new Promise<never>((_, reject) => {
    onAbort = () => reject(controller.signal.reason);
    controller.signal.addEventListener('abort', onAbort, { once: true });
  });
  try {
    controller.signal.throwIfAborted();
    response = await Promise.race([fetch(url, { ...options, signal: controller.signal }), aborted]);
    controller.signal.throwIfAborted();
    if (!response.ok) throw new Error(`Failed to fetch document: ${response.status} ${response.statusText}`);
    const sizeError = () => new Error(t('openUrlTooLarge', { mb: MAX_REMOTE_DOCUMENT_BYTES / 1024 / 1024 }));
    if (Number(response.headers.get('Content-Length')) > MAX_REMOTE_DOCUMENT_BYTES) throw sizeError();
    const chunks: Uint8Array<ArrayBuffer>[] = [];
    let size = 0;
    reader = response.body?.getReader();
    if (reader) {
      while (true) {
        const { value, done } = await Promise.race([reader.read(), aborted]);
        controller.signal.throwIfAborted();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_REMOTE_DOCUMENT_BYTES) throw sizeError();
        chunks.push(new Uint8Array(value));
      }
    }
    return { headers: response.headers, blob: new Blob(chunks, { type: response.headers.get('Content-Type') || '' }) };
  } catch (error) {
    // Cancellation can itself remain pending on a broken remote stream. It
    // must never hold the caller past the deadline or hide the original error.
    if (reader) void reader.cancel().catch(() => {});
    else if (response?.body) void response.body.cancel().catch(() => {});
    throw error;
  } finally {
    clearTimeout(timeout);
    controller.signal.removeEventListener('abort', onAbort);
    for (const signal of signals) signal.removeEventListener('abort', forwardAbort);
  }
}
