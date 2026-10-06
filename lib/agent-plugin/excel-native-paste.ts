import { guardExcelPasteCallbacks } from './excel-paste-guard';
import type { ExcelPasteOwnership } from './excel-paste-guard';
import type { NativePasteApi } from './native-paste';

/** Caller owns the blocking action, original cell/history and paste-state identity.
 * endPaste must be bound to that original paste helper and safe on failure.
 * This adapter does not roll back an insertion that has already completed.
 */
export function pasteExcelText(
  api: Pick<NativePasteApi, 'asc_PasteData'>,
  view: object,
  format: number,
  text: string,
  options: ExcelPasteOwnership & {
    isCurrent(): boolean;
    endPaste(): void;
    /** Capture completed mutation ownership before any promise continuation runs. */
    onNativeCompletion?(): void;
    signal?: AbortSignal;
    timeoutMs?: number;
  },
): Promise<void> {
  if (options.signal?.aborted) return Promise.reject(options.signal.reason);
  const timeout = options.timeoutMs ?? 10000;
  const current = () => {
    try {
      return options.isCurrent();
    } catch {
      return false;
    }
  };
  if (!Number.isInteger(format) || format < 0 || !Number.isFinite(timeout) || timeout <= 0 || !current())
    return Promise.reject(new Error('Paste target has expired or parameters are invalid'));
  return new Promise((resolve, reject) => {
    let active = true,
      started = false;
    const guard = guardExcelPasteCallbacks(view, () => active && current(), {
      captureOwnership: options.captureOwnership,
      onOwnershipLost: () => {
        try {
          options.onOwnershipLost?.();
        } finally {
          finish(new Error('Paste ownership has expired'));
        }
      },
    });
    const finish = (error?: unknown) => {
      if (!active) return;
      active = false;
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', abort);
      try {
        guard.close();
        if (error !== undefined && started) options.endPaste();
      } catch (cleanupError) {
        reject(cleanupError);
        return;
      }
      if (error !== undefined) reject(error);
      else resolve();
    };
    const abort = () => finish(options.signal!.reason);
    const timer = setTimeout(() => finish(new Error('Native paste timed out')), timeout);
    options.signal?.addEventListener('abort', abort, { once: true });
    if (options.signal?.aborted) {
      abort();
      return;
    }
    try {
      started = true;
      api.asc_PasteData(format, text, undefined, undefined, undefined, (ok) => {
        if (!active) return;
        try {
          options.onNativeCompletion?.();
        } catch (error) {
          finish(error);
          return;
        }
        if (ok === false) finish(new Error('Native paste was rejected'));
        else if (!current()) finish(new Error('Paste target has expired'));
        else finish();
      });
    } catch (error) {
      finish(error);
    }
  });
}
