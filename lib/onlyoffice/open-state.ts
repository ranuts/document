/**
 * Open-state of the document currently in the editor: whether its content is
 * ready, why it failed to open, and what the editor frame threw on the way.
 * One owner for all of it -- the failure guard, the save path and the error
 * toast all read the same flags, and a second copy of any of them would
 * desynchronise the three.
 */

// v9 only: an export fired before the document finished loading is silently
// dropped by the SDK, and the embed API makes that easy to hit (a scripted
// parent can call document:save right after document:opened, which resolves
// when the editor is constructed, not when the document is loaded). Gate
// exports on the DocEditor onDocumentReady event (marked in
// createPersonalEditorInstance) instead of assuming readiness. v7 never
// marks this, so it must default true there or every v7 save would eat a
// pointless wait.
let documentContentReady = false;
let contentReadyWaiters: Array<() => void> = [];
// Set when the editor's own open conversion failed for the current document
// (see installOpenFailureGuard); pending and future saves reject with it
// instead of waiting out the readiness timeout.
let documentOpenError: string | null = null;
// First error seen inside the editor frame before the document finished
// loading. The vendor installs its own window.onerror/onunhandledrejection
// (sdk-all-min, asc_docs_api._init) and turns ANY error that lands before
// isDocumentLoadComplete into asc_onError(ConvertationOpenError = -82,
// Critical) -- the same code our own conversion guard raises, and the same
// dialog, with nothing about what actually threw. That is why every #144
// report so far is a screenshot of an identical toast: the failures that do
// not go through installOpenFailureGuard carry no cause at all. Keeping the
// raw message here lets the toast name it.
let lastFrameError: string | null = null;

// Errors thrown by browser extensions and by cross-origin scripts are not
// ours to report (the vendor's own handler skips them for the same reason).
const FOREIGN_SCRIPT = /^(?:chrome|moz|safari|ms-browser)-extension:\/\//;

/**
 * Record an error seen inside the editor frame while a document is opening.
 * First one wins: later errors are usually fallout from the first. Returns
 * whether this call is the one that stuck.
 */
export function noteFrameError(message: string, source?: string): boolean {
  if (documentContentReady || documentOpenError || lastFrameError) return false;
  if (!message || message === 'Script error.') return false;
  if (source && FOREIGN_SCRIPT.test(source)) return false;
  lastFrameError = message;
  return true;
}

/**
 * The bracketed cause appended to the -82 toast. `documentOpenError` is the
 * conversion rejection our own guard caught; `lastFrameError` covers the
 * failures the vendor reported itself, which otherwise arrive as a bare code.
 */
export function describeOpenFailure(
  code: number | undefined,
  openError: string | null,
  frameError: string | null,
): string {
  if (code !== -82) return '';
  const reason = openError ?? frameError;
  return reason ? ` [${reason.slice(0, 160)}]` : '';
}

export function markDocumentContentReady(): void {
  if (documentContentReady) return;
  documentContentReady = true;
  const waiters = contentReadyWaiters;
  contentReadyWaiters = [];
  waiters.forEach((waiter) => waiter());
}

// Called once per document open (v9 only) to drop any stale ready-state from
// a previously open document before the new one's own readiness is known.
export function resetOpenState(): void {
  documentContentReady = false;
  documentOpenError = null;
  lastFrameError = null;
  contentReadyWaiters = [];
}

export function markDocumentOpenFailed(reason: string): void {
  if (documentOpenError) return;
  documentOpenError = reason;
  // Release anyone waiting for readiness; they check documentOpenError.
  const waiters = contentReadyWaiters;
  contentReadyWaiters = [];
  waiters.forEach((waiter) => waiter());
}

// Resolves immediately if already ready; otherwise waits for
// markDocumentContentReady() (or the safety-net timeout) so callers never
// hang forever.
export function waitForDocumentContentReady(timeoutMs = 15000): Promise<void> {
  if (documentContentReady) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, timeoutMs);
    contentReadyWaiters.push(() => {
      clearTimeout(timer);
      resolve();
    });
  });
}

/** Whether the current document reported onDocumentReady. */
export function isDocumentContentReady(): boolean {
  return documentContentReady;
}

/** The conversion failure that killed the current open, if any. */
export function getDocumentOpenError(): string | null {
  return documentOpenError;
}

/** The first error the editor frame threw before the document was ready. */
export function getLastFrameError(): string | null {
  return lastFrameError;
}
