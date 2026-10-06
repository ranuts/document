export interface NativePasteApi {
  pre_Paste(fonts: unknown, images: unknown, insert: () => void): void;
  asc_PasteData(
    format: number,
    text: string,
    a: undefined,
    b: undefined,
    c: undefined,
    complete: (ok?: boolean) => void,
  ): void;
}

/** Native slide plain-text paste. Run inside an owned blocking action/history scope.
 * The SDK enters pre_Paste synchronously; its insertion may await fonts/images.
 * isCurrent must prove document AND paste-state ownership; endPaste must be bound
 * to that same SDK helper. This function never changes document history itself.
 */
export function pasteSlideText(
  api: NativePasteApi,
  format: number,
  text: string,
  options: { isCurrent(): boolean; endPaste(): void; timeoutMs?: number; signal?: AbortSignal },
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
    const original = api.pre_Paste;
    let active = true,
      prepared = false,
      inserted = false;
    const fail = (error: unknown) => {
      if (!active) return;
      active = false;
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', abort);
      try {
        if (prepared && !inserted && current()) options.endPaste();
      } catch (cleanupError) {
        reject(cleanupError);
        return;
      }
      reject(error);
    };
    const abort = () => fail(options.signal!.reason);
    const timer = setTimeout(() => fail(new Error('Native paste timed out')), timeout);
    options.signal?.addEventListener('abort', abort, { once: true });
    const prepare: NativePasteApi['pre_Paste'] = function (fonts, images, insert) {
      prepared = true;
      original.call(api, fonts, images, () => {
        if (!active) return;
        if (!current()) {
          fail(new Error('Paste target has expired'));
          return;
        }
        inserted = true;
        try {
          insert();
        } catch (error) {
          fail(error);
        }
      });
    };
    api.pre_Paste = prepare;
    try {
      api.asc_PasteData(format, text, undefined, undefined, undefined, (ok) => {
        if (!active) return;
        if (ok === false) {
          fail(new Error('Native paste was rejected'));
          return;
        }
        if (!current()) {
          fail(new Error('Paste target has expired'));
          return;
        }
        active = false;
        clearTimeout(timer);
        options.signal?.removeEventListener('abort', abort);
        resolve();
      });
      if (active && !prepared) fail(new Error('Native paste was rejected'));
    } catch (error) {
      fail(error);
    } finally {
      if (api.pre_Paste === prepare) api.pre_Paste = original;
    }
  });
}
