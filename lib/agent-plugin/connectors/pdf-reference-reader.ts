import { withReferenceAbort } from './reference-lifetime';
/** PDF.js runs parsing in its bundled worker; no editor, rendering, fonts or remote URLs. */
export async function readPdfReference(bytes: Uint8Array, signal?: AbortSignal): Promise<string> {
  signal?.throwIfAborted();
  const pdfjs = await (signal ? withReferenceAbort(import('pdfjs-dist'), signal) : import('pdfjs-dist'));
  const { default: workerUrl } = await (signal
    ? withReferenceAbort(import('pdfjs-dist/build/pdf.worker.min.mjs?url'), signal)
    : import('pdfjs-dist/build/pdf.worker.min.mjs?url'));
  signal?.throwIfAborted();
  const port = new Worker(workerUrl, { type: 'module' });
  // PDF.js v5's generated declaration infers null for the documented Worker port.
  const worker = new pdfjs.PDFWorker({ port: port as never });
  const task = pdfjs.getDocument({
    data: bytes,
    worker,
    isEvalSupported: false,
    useSystemFonts: false,
    disableFontFace: true,
    useWorkerFetch: false,
  });
  let rejectAbort!: (reason: unknown) => void;
  const aborted = new Promise<never>((_resolve, reject) => {
    rejectAbort = reject;
  });
  const abort = () => {
    rejectAbort(signal?.reason);
    void task.destroy().catch(() => undefined);
    port.terminate();
  };
  signal?.addEventListener('abort', abort, { once: true });
  let reader: ReadableStreamDefaultReader | undefined;
  try {
    const pdf = await Promise.race([task.promise, aborted]);
    signal?.throwIfAborted();
    if (pdf.numPages > 100) throw new Error('source-too-large');
    let length = 0;
    const output: string[] = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      signal?.throwIfAborted();
      const page = await Promise.race([pdf.getPage(n), aborted]);
      reader = page.streamTextContent({ includeMarkedContent: false }).getReader();
      while (true) {
        const chunk = await Promise.race([reader.read(), aborted]);
        signal?.throwIfAborted();
        if (chunk.done) break;
        for (const item of chunk.value.items) {
          if (!('str' in item)) continue;
          const text = item.str + (item.hasEOL ? '\n' : ' ');
          length += new TextEncoder().encode(text).length;
          if (length > 262144) throw new Error('source-too-large');
          output.push(text);
        }
      }
      reader.releaseLock();
      reader = undefined;
      page.cleanup();
    }
    const result = output.join('').trim();
    if (!result) throw new Error('source-empty');
    return result;
  } catch (error) {
    signal?.throwIfAborted();
    if (error instanceof Error && error.name === 'PasswordException') throw new Error('source-encrypted');
    if (error instanceof Error && error.message.startsWith('source-')) throw error;
    throw new Error('source-corrupt');
  } finally {
    signal?.removeEventListener('abort', abort);
    if (signal?.aborted) {
      void reader?.cancel().catch(() => undefined);
      void task.destroy().catch(() => undefined);
    } else {
      await reader?.cancel().catch(() => undefined);
      await task.destroy().catch(() => undefined);
    }
    worker.destroy();
    port.terminate();
  }
}
