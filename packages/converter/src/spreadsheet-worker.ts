import { BASE_PATH } from '@ranuts/shared/document-utils';

export type SpreadsheetOperation = 'csv-to-xlsx' | 'html-to-xlsx' | 'xlsx-to-csv';
const CONVERSION_TIMEOUT_MS = 120_000;

/** Own one worker per conversion so cancellation never interrupts another document. */
export function runSpreadsheetWorker(
  operation: SpreadsheetOperation,
  input: string | Uint8Array,
  signal?: AbortSignal,
): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new DOMException('Conversion canceled', 'AbortError'));
      return;
    }
    let worker: Worker | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let settled = false;
    const finish = (error?: unknown, data?: ArrayBuffer) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      if (worker) {
        worker.onmessage = null;
        worker.onerror = null;
        worker.onmessageerror = null;
        worker.terminate();
      }
      if (error !== undefined) reject(error);
      else resolve(data!);
    };
    const abort = () => finish(signal?.reason ?? new DOMException('Conversion canceled', 'AbortError'));
    try {
      worker = new Worker(`${BASE_PATH}libs/sheetjs/convert.worker.js`);
      worker.onmessage = (event: MessageEvent) => {
        const message = event.data;
        if (message?.ok === true && message.data instanceof ArrayBuffer) finish(undefined, message.data);
        else
          finish(new Error(typeof message?.error === 'string' ? message.error : 'Invalid spreadsheet worker result'));
      };
      worker.onerror = (event) => {
        event.preventDefault();
        finish(new Error(event.message || 'Spreadsheet worker failed'));
      };
      worker.onmessageerror = () => finish(new Error('Unreadable spreadsheet worker result'));
      signal?.addEventListener('abort', abort, { once: true });
      timer = setTimeout(() => finish(new Error('Spreadsheet conversion timed out')), CONVERSION_TIMEOUT_MS);
      // Never detach a caller's buffer, including subarray views shared with other work.
      const data = typeof input === 'string' ? input : new Uint8Array(input).buffer;
      worker.postMessage({ operation, data }, typeof data === 'string' ? [] : [data]);
    } catch (error) {
      finish(error);
    }
  });
}
