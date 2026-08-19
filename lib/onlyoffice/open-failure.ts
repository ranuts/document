import { t } from '@ranuts/shared/i18n';
import { getDocumentOpenError, isDocumentContentReady, markDocumentOpenFailed, noteFrameError } from './open-state';
import { failPendingSaveConversion } from './save-stream';

/**
 * Everything about an open that did not survive: which document was being
 * opened (so an environment-class failure can be retried with the same
 * bytes), how a failure message is classified, and the frame-level guard that
 * turns the vendor's unhandled rejection into a real error.
 */

// Rebuilds the editor for a retry. Injected by lib/onlyoffice-editor to keep
// the module graph acyclic, the same way the converter callbacks are.
type OpenRunner = (config: {
  fileName: string;
  fileType: string;
  binData?: ArrayBuffer;
  readonly?: boolean;
  isRetry?: boolean;
}) => Promise<void>;
let runOpen: OpenRunner | null = null;

export function setOpenRunner(runner: OpenRunner): void {
  runOpen = runner;
}

// The document currently being opened, kept so an open that fails for an
// environment reason can be retried with the same bytes (see
// retryCurrentOpen). Cleared on the next user-initiated open.
type OpenAttempt = {
  fileName: string;
  fileType: string;
  binData?: ArrayBuffer;
  readonly: boolean;
  retried: boolean;
};
let currentOpenAttempt: OpenAttempt | null = null;
// Bumped for every editor build (a user-initiated open and its retry alike).
// Each frame's failure guard captures the generation it was installed for, so
// the duplicate rejections a torn-down frame keeps emitting cannot report an
// error against the document that replaced it.
let openGeneration = 0;
// Generation whose open failure has already been acted on (reported, or
// answered with a retry). The vendor leaves both the inner conversion promise
// and loadDocument's own promise unhandled, so every failure arrives twice.
let handledFailureGeneration = -1;

/**
 * Drop the bytes held for a possible retry, keeping the attempt itself so the
 * one-retry budget is still tracked. Called once the open has succeeded: from
 * that point installOpenFailureGuard takes its `documentContentReady` branch
 * and treats every further conversion failure as a failed export, so no retry
 * can ask for these bytes again.
 */
export function releaseOpenAttemptBytes(): void {
  if (currentOpenAttempt) currentOpenAttempt.binData = undefined;
}

/** Whether a retry could still be served from bytes we are holding. */
export function openAttemptHoldsBytes(): boolean {
  return Boolean(currentOpenAttempt?.binData);
}

/**
 * Rebuild the editor once for the document that just failed to open.
 * Returns whether a retry was started; `false` means the caller should report
 * the failure to the user.
 */
function retryCurrentOpen(reason: string): boolean {
  const attempt = currentOpenAttempt;
  if (!attempt || attempt.retried) return false;
  if (classifyOpenFailure(reason) !== 'environment') return false;
  attempt.retried = true;
  console.warn('[OO] retrying the open once after an environment failure:', reason);
  (window as unknown as { message?: { info?: (msg: string) => void } }).message?.info?.(t('editorOpenRetrying'));
  // Deferred: this runs from the failing frame's rejection handler, and the
  // rebuild tears that frame down.
  setTimeout(() => {
    if (!runOpen) return;
    void runOpen({
      fileName: attempt.fileName,
      fileType: attempt.fileType,
      binData: attempt.binData,
      readonly: attempt.readonly,
      isRetry: true,
    }).catch((error) => {
      console.error('[OO] open retry failed to start:', error);
      markDocumentOpenFailed(String(error));
    });
  }, 0);
  return true;
}

/**
 * Open-conversion failures split into two very different kinds:
 *
 * - `document`: x2t ran and rejected these bytes ("Conversion failed with
 *   code: 88", an emscripten `Aborted(...)` on an importer this wasm build
 *   stubs out). Retrying is pointless -- the same bytes fail the same way --
 *   so the user gets the error immediately.
 * - `environment`: the editor tripped over its own boot state or over a
 *   resource that did not arrive (a TypeError from a half-initialised SDK,
 *   the x2t module missing or timing out, a failed fetch). Nothing is wrong
 *   with the document, and a rebuilt editor usually opens it -- which is why
 *   the same file opens in a freshly-started browser and fails in the one
 *   that has been running all day (GitHub #144).
 */
export function classifyOpenFailure(message: string): 'document' | 'environment' {
  if (/Conversion failed with code|Aborted\(|missing function|RuntimeError/i.test(message)) return 'document';
  // The TypeError wordings of a half-initialised SDK, across engines.
  if (/Cannot read propert|undefined is not an object|null is not an object/i.test(message)) return 'environment';
  if (/is not a function|has no properties|can't access property/i.test(message)) return 'environment';
  if (/X2T module|initialization timeout|Failed to fetch|NetworkError|load failed/i.test(message)) return 'environment';
  return 'document';
}

// Open-conversion failure surfacing. The vendor's offline controller awaits
// AscCommon.x2t.convertToBin inside loadDocument with no catch, so a failed
// import (garbage or truncated bytes, HTML disguised as .xls/.xlsx, an x2t
// abort on a format its wasm build stubs out) is nothing but an unhandled
// rejection inside the editor frame: no asc_onError, the "Loading ..." mask
// stays up forever and every save waits out its timeout. Route the rejection
// into the SDK's own error path -- the vendor shows its open-error dialog,
// Common.Gateway reports it to our onError toast, the load mask ends -- and
// flag the document so requestSaveDocument rejects immediately.
const OPEN_FAILURE_PATTERN = /Document conversion failed|Conversion failed with code|X2T module/i;
export function installOpenFailureGuard(win: Window): void {
  const w = win as unknown as {
    __ooOpenFailureGuarded?: boolean;
    Asc?: {
      editor?: { sendEvent?: (name: string, ...args: unknown[]) => void };
      c_oAscError?: { ID?: { ConvertationOpenError?: number }; Level?: { Critical?: number } };
      c_oAscAsyncActionType?: { BlockInteraction?: number };
      c_oAscAsyncAction?: { Open?: number };
    };
  };
  if (w.__ooOpenFailureGuarded) return;
  w.__ooOpenFailureGuarded = true;
  // The editor build this frame belongs to. A frame the retry replaced keeps
  // emitting the rejections of its own failed open for a while; those must not
  // be charged to the document that took its place.
  const generation = openGeneration;
  // Everything that throws in this frame before the document is ready ends up
  // as the vendor's own -82, so keep the first message whether or not it looks
  // like a conversion failure (see noteFrameError).
  win.addEventListener('error', (event) => {
    const error = event as ErrorEvent;
    if (generation !== openGeneration) return;
    noteFrameError(String(error.message ?? ''), error.filename);
  });
  win.addEventListener('unhandledrejection', (event) => {
    const reason = (event as PromiseRejectionEvent).reason as { message?: unknown } | undefined;
    const message = String(reason && typeof reason === 'object' ? (reason.message ?? reason) : reason);
    if (generation === openGeneration) noteFrameError(message);
    if (!OPEN_FAILURE_PATTERN.test(message)) return;
    if (isDocumentContentReady()) {
      // The document is loaded, so this is a failed export (convertFromBin);
      // the SDK already reports those through asc_onError itself. Just stop
      // the pending save request from waiting out its timeout.
      console.error('[OO] save conversion failed:', message);
      failPendingSaveConversion(message);
      return;
    }
    // The vendor's async loadDocument leaves both the inner conversion
    // promise and its own promise unhandled, so this fires twice per failure;
    // act once per editor build, and never for a superseded one.
    if (generation !== openGeneration || getDocumentOpenError()) return;
    if (handledFailureGeneration === generation) return;
    handledFailureGeneration = generation;
    console.error('[OO] open conversion failed:', message);
    // An environment-class failure (see classifyOpenFailure) says nothing
    // about the document, so rebuild the editor once with the same bytes
    // before telling the user the file cannot be opened. The rebuild starts
    // the editor -- and its font system, x2t module and image pipeline --
    // from scratch, which is what turned the failure into a success on a
    // second, colder browser in GitHub #144.
    if (retryCurrentOpen(message)) return;
    markDocumentOpenFailed(message);
    const api = w.Asc?.editor;
    if (!api || typeof api.sendEvent !== 'function') return;
    const errorId = w.Asc?.c_oAscError?.ID?.ConvertationOpenError ?? -82;
    const critical = w.Asc?.c_oAscError?.Level?.Critical ?? -1;
    api.sendEvent('asc_onError', errorId, critical);
    const blockInteraction = w.Asc?.c_oAscAsyncActionType?.BlockInteraction;
    const openAction = w.Asc?.c_oAscAsyncAction?.Open;
    if (blockInteraction !== undefined && openAction !== undefined) {
      api.sendEvent('asc_onEndAction', blockInteraction, openAction);
    }
  });
}

/**
 * Start tracking a new open. A user-initiated open resets the one-retry
 * budget; a retry keeps the budget of the attempt it belongs to.
 */
export function registerOpenAttempt(config: {
  fileName: string;
  fileType: string;
  binData?: ArrayBuffer;
  readonly?: boolean;
  isRetry?: boolean;
}): void {
  openGeneration += 1;
  if (config.isRetry) return;
  currentOpenAttempt = {
    fileName: config.fileName,
    fileType: config.fileType,
    binData: config.binData,
    readonly: config.readonly ?? false,
    retried: false,
  };
}
