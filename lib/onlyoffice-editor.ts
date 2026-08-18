import 'ranui/message';
import { getDocmentObj } from '@ranuts/shared/store';
import { getOnlyOfficeLang, t } from '@ranuts/shared/i18n';
import { oAscFileType } from './file-types';
import { installEditorThemeFollow, resolveEditorUiTheme } from './editor-theme';
import { DOCUMENT_TYPE_MAP, getDocumentMimeType } from '@ranuts/shared/document-utils';
import { X2TConverter, saveFileToDisk } from '@ranuts/converter';

// v9.3.0 renamed sendCommand -> serviceCommand; keep the fallback for safety.
function editorSendCommand(params: { command: string; data: Record<string, any> }): void {
  const editor = window.editor as any;
  if (!editor) return;
  if (typeof editor.serviceCommand === 'function') {
    editor.serviceCommand(params);
  } else if (typeof editor.sendCommand === 'function') {
    editor.sendCommand(params);
  }
}

// Editor operation queue to prevent concurrent operations
let editorOperationQueue: Promise<void> = Promise.resolve();
let isReadonlyMode = false;

type EmbeddedSaveRequest = {
  targetExt?: string;
  resolve: (file: File) => void;
  reject: (error: Error) => void;
  timeoutId: number;
  fallbackId: number;
  settled: boolean;
};

let embeddedSaveRequest: EmbeddedSaveRequest | null = null;

// requestSaveDocument budget. Readiness (onDocumentReady) may take long on a
// cold, slow link: the editor first downloads and inflates x2t.wasm.gz
// (~10 MB) before it can import the document. The hard timeout stays above
// the readiness wait plus the export retry window so a slow-but-alive save
// still gets through; dead saves fail fast through documentOpenError.
export const SAVE_READY_WAIT_MS = 150_000;
export const SAVE_RETRY_WINDOW_MS = 25_000;
export const SAVE_REQUEST_TIMEOUT_MS = 180_000;

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

function markDocumentContentReady(): void {
  if (documentContentReady) return;
  documentContentReady = true;
  const waiters = contentReadyWaiters;
  contentReadyWaiters = [];
  waiters.forEach((waiter) => waiter());
}

// Called once per document open (v9 only) to drop any stale ready-state from
// a previously open document before the new one's own readiness is known.
function resetDocumentContentReady(): void {
  documentContentReady = false;
  documentOpenError = null;
  contentReadyWaiters = [];
}

function markDocumentOpenFailed(reason: string): void {
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
function waitForDocumentContentReady(timeoutMs = 15000): Promise<void> {
  if (documentContentReady) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, timeoutMs);
    contentReadyWaiters.push(() => {
      clearTimeout(timer);
      resolve();
    });
  });
}

export function getSavedFileMimeType(fileName: string): string {
  return getDocumentMimeType(fileName);
}

export function getNormalizedFile(file: File): File {
  const mimeType = !file.type || file.type === 'application/octet-stream' ? getSavedFileMimeType(file.name) : file.type;
  return new File([file], file.name, { type: mimeType });
}

export function toUint8Array(data: BlobPart): Uint8Array {
  if (data instanceof Uint8Array) {
    return data;
  }
  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data);
  }
  if (ArrayBuffer.isView(data)) {
    const arrayBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
    return new Uint8Array(arrayBuffer);
  }
  throw new Error('Unsupported saved data type');
}

function getFileExtension(fileName: string): string {
  return fileName.split('.').pop()?.toUpperCase() || '';
}

function isEmbedMode(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const params = new URLSearchParams(window.location.search);
  const embed = params.get('embed') || params.get('embedded');
  return window.parent !== window || embed === '' || embed === '1' || embed === 'true';
}

function resolveEmbeddedSaveRequest(request: EmbeddedSaveRequest, file: File): void {
  if (request.settled) {
    return;
  }
  request.settled = true;
  request.resolve(file);
}

function rejectEmbeddedSaveRequest(request: EmbeddedSaveRequest, error: Error): void {
  if (request.settled) {
    return;
  }
  request.settled = true;
  request.reject(error);
}

function cleanupEmbeddedSaveRequest(request: EmbeddedSaveRequest): void {
  window.clearTimeout(request.timeoutId);
  window.clearTimeout(request.fallbackId);
  if (embeddedSaveRequest === request) {
    embeddedSaveRequest = null;
  }
}

// ranui/message registers a global `window.message` toast API (untyped).
function notifyOperationFailed(error: unknown): void {
  (window as unknown as { message?: { error?: (msg: string) => void } }).message?.error?.(
    `${t('documentOperationFailed')}${error instanceof Error ? error.message : String(error)}`,
  );
}

// ---- v9 file-stream save channel (OnlyOffice Personal vendor build) ----
//
// The vendored sdkjs/web-apps build performs every export inside the editor
// iframe (its own x2t_helper converts the editor's canvas render stream /
// document), then posts the finished bytes to the parent window as an
// 'onlyoffice-file-stream' message. Setting OO_FILE_STREAM_ONLY on this
// window tells the helper (which walks up the parent chain looking for it)
// to suppress its own <a download> fallback and let us own the save UX.

interface FileStreamMessage {
  type: 'onlyoffice-file-stream';
  fileName?: string;
  fileType?: string;
  buffer?: ArrayBuffer;
}

// SheetJS-only converter for the CSV save-back path below; never touches the
// x2t WASM, so instantiating it here is cheap and avoids a circular import of
// lib/converter's singleton.
let sheetJsConverter: X2TConverter | null = null;

function routeSavedFile(file: File): void {
  if (embeddedSaveRequest) {
    const request = embeddedSaveRequest;
    cleanupEmbeddedSaveRequest(request);
    resolveEmbeddedSaveRequest(request, file);
    return;
  }

  if (isEmbedMode()) {
    console.warn('Local save is disabled in iframe embed mode. Use document:save from the parent page.');
    return;
  }

  saveFileToDisk(file, file.name).catch(notifyOperationFailed);
}

function handleFileStreamMessage(event: MessageEvent): void {
  const data = event.data as FileStreamMessage | undefined;
  if (!data || data.type !== 'onlyoffice-file-stream' || !(data.buffer instanceof ArrayBuffer)) {
    return;
  }

  const buffer = data.buffer;
  const { fileName: docName } = getDocmentObj() || {};
  const ext = (data.fileType || data.fileName?.split('.').pop() || 'bin').toLowerCase();
  const baseName = (docName || data.fileName || 'document').replace(/\.[^/.]+$/, '');
  console.log(`[OO] file stream received: ${baseName}.${ext} (${buffer.byteLength} bytes)`);

  // A CSV original is opened as XLSX (the vendor editor can't ingest raw CSV,
  // see handleDocumentOperation), so its saves come back as XLSX -- convert
  // them back so a CSV in still means a CSV out (GitHub #13/#33), and honor
  // an explicit embed-API "save as CSV" the same way (the editor's own CSV
  // export stalls on a delimiter dialog, see triggerPersonalDownloadAs).
  // Explicit non-CSV requests (e.g. the embed default XLSX) keep the stream.
  const requestedExt = embeddedSaveRequest?.targetExt;
  const wantsCsvBack =
    ext === 'xlsx' &&
    (requestedExt === 'CSV' || (requestedExt === undefined && !!docName?.toLowerCase().endsWith('.csv')));
  if (wantsCsvBack) {
    void (async () => {
      try {
        sheetJsConverter ??= new X2TConverter();
        const csvBytes = await sheetJsConverter.xlsxToCsvBytes(new Uint8Array(buffer));
        routeSavedFile(new File([csvBytes], `${baseName}.csv`, { type: 'text/csv' }));
      } catch (error) {
        console.error('Failed to convert saved XLSX back to CSV, keeping XLSX:', error);
        routeSavedFile(new File([buffer], `${baseName}.xlsx`, { type: getSavedFileMimeType('a.xlsx') }));
      }
    })();
    return;
  }

  const savedName = `${baseName}.${ext}`;
  routeSavedFile(new File([buffer], savedName, { type: getSavedFileMimeType(savedName) }));
}

if (typeof window !== 'undefined') {
  (window as unknown as { OO_FILE_STREAM_ONLY?: boolean }).OO_FILE_STREAM_ONLY = true;
  window.addEventListener('message', handleFileStreamMessage);
}

/**
 * v9: the api layer's `downloadAs(format)` silently drops the request in the
 * Personal vendor build (observed live -- its own demo has the same gap), so
 * trigger the export directly on the same-origin editor iframe's API with the
 * numeric file-type constant. Returns false when no editor frame is ready.
 */
function triggerPersonalDownloadAs(targetExt: string): boolean {
  // A CSV export request pops the editor's delimiter-options dialog and stalls
  // a headless save forever; ask the editor for XLSX instead and convert the
  // returned stream to CSV in handleFileStreamMessage.
  const effectiveExt = targetExt.toUpperCase() === 'CSV' ? 'XLSX' : targetExt.toUpperCase();
  const code = (oAscFileType as Record<string, number>)[effectiveExt];
  if (!code) return false;
  for (let i = 0; i < window.frames.length; i++) {
    try {
      const win = window.frames[i] as unknown as {
        Asc?: {
          editor?: { asc_DownloadAs?: (options: unknown) => void };
          asc_CDownloadOptions?: new (fileType: number) => unknown;
        };
      };
      const AscNs = win.Asc;
      const api = AscNs?.editor as
        | {
            asc_DownloadAs?: (options: unknown) => void;
            isLoadFullApi?: boolean;
            isDocumentLoadComplete?: boolean;
          }
        | undefined;
      if (api && typeof api.asc_DownloadAs === 'function' && AscNs?.asc_CDownloadOptions) {
        // onDocumentReady fires while the full API bundle (sdk-all.js) may
        // still be loading on a cold cache; an export fired in that window
        // crashes inside the SDK's font collector ("Cannot read properties
        // of undefined (reading 'forEach')") or is silently dropped. Only
        // fire once the SDK itself reports full readiness -- the caller's
        // retry loop keeps polling until then.
        if (!api.isLoadFullApi || !api.isDocumentLoadComplete) return false;
        api.asc_DownloadAs(new AscNs.asc_CDownloadOptions(code));
        return true;
      }
    } catch {
      // cross-origin frame or editor not booted yet -- keep looking
    }
  }
  return false;
}

/**
 * Queue editor operations to prevent concurrent editor creation/destruction
 */
async function queueEditorOperation<T>(operation: () => Promise<T>): Promise<T> {
  // Wait for previous operations to complete
  // Add a timeout to prevent infinite waiting
  try {
    await Promise.race([
      editorOperationQueue,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Editor operation queue timeout')), 30000)),
    ]);
  } catch (error) {
    // If timeout, log warning but continue (previous operation may have failed)
    if (error instanceof Error && error.message === 'Editor operation queue timeout') {
      console.warn('Editor operation queue timeout, proceeding anyway');
    } else {
      // Re-throw other errors
      throw error;
    }
  }

  // Create a new promise for this operation
  let resolveOperation: () => void;
  let rejectOperation: (error: any) => void;
  const operationPromise = new Promise<void>((resolve, reject) => {
    resolveOperation = resolve;
    rejectOperation = reject;
  });

  // Update the queue
  editorOperationQueue = operationPromise;

  try {
    const result = await operation();
    resolveOperation!();
    return result;
  } catch (error) {
    rejectOperation!(error);
    throw error;
  }
}

// Blob URL handed to the current v9 editor via document.url; revoked when the
// next document replaces it.
let currentDocumentBlobUrl: string | null = null;

/**
 * Same-origin preparation of the editor iframe, applied from onAppReady /
 * onDocumentReady (idempotent):
 *
 * 1. Strip OnlyOffice chrome that has no place in a pure single-user local
 *    editor -- the header logo and the current-user / co-users widgets.
 *    There is no DocEditor config switch for these in this build.
 * 2. Shadow SharedWorker inside the editor iframe. The SDK's local
 *    spellchecker prefers `new SharedWorker(spell.js, ...)`, and loading
 *    that script on a cold profile of a service-worker-controlled origin
 *    hangs forever in Chromium (request never settles; warm profiles are
 *    immune only because the previous page's named SharedWorker is still
 *    alive and gets reused without a fetch). The stuck load keeps the
 *    editor's isDocumentLoadComplete flag false, which silently breaks
 *    every save/export. With SharedWorker absent, CSpellchecker falls back
 *    to a plain dedicated Worker, which loads fine.
 *
 * Returns true once every treatment is in place on some frame, so the caller
 * can stop re-applying.
 */
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
    createEditorInstance({
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
 * The parts of an editor frame the vendor's `AscCommon.fetchFonts` walks
 * before the open conversion can proceed.
 */
export type FontSystemWindow = {
  AscCommon?: {
    fetchFonts?: (cb: (fonts: unknown[]) => void) => unknown;
    g_font_loader?: { fontFiles?: unknown };
  };
  AscFonts?: { g_font_infos?: unknown };
};

/**
 * Both halves of the font system have to be up before the vendor's
 * `fetchFonts` is safe to run: it iterates `AscFonts.g_font_infos` and, for
 * every face that needs styles, dereferences
 * `AscCommon.g_font_loader.fontFiles[index].Id`. They are populated by
 * different steps of the editor boot, so "g_font_infos exists" is not enough
 * -- an entry read out of an empty `fontFiles` is `undefined` and `.Id`
 * throws, which surfaces to the user as a -82 open error.
 */
export function isFontSystemReady(win: FontSystemWindow): boolean {
  const infos = win.AscFonts?.g_font_infos;
  if (!Array.isArray(infos)) return false;
  // Nothing to look up: the loop body never runs, so an empty catalog is safe.
  if (infos.length === 0) return true;
  const files = win.AscCommon?.g_font_loader?.fontFiles;
  return Array.isArray(files) && files.length > 0;
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
function installOpenFailureGuard(win: Window): void {
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
  win.addEventListener('unhandledrejection', (event) => {
    const reason = (event as PromiseRejectionEvent).reason as { message?: unknown } | undefined;
    const message = String(reason && typeof reason === 'object' ? (reason.message ?? reason) : reason);
    if (!OPEN_FAILURE_PATTERN.test(message)) return;
    if (documentContentReady) {
      // The document is loaded, so this is a failed export (convertFromBin);
      // the SDK already reports those through asc_onError itself. Just stop
      // the pending save request from waiting out its timeout.
      console.error('[OO] save conversion failed:', message);
      const request = embeddedSaveRequest;
      if (request && !request.settled) {
        cleanupEmbeddedSaveRequest(request);
        rejectEmbeddedSaveRequest(request, new Error(`Save conversion failed: ${message}`));
      }
      return;
    }
    // The vendor's async loadDocument leaves both the inner conversion
    // promise and its own promise unhandled, so this fires twice per failure;
    // act once per editor build, and never for a superseded one.
    if (generation !== openGeneration || documentOpenError) return;
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

function prepareEditorIframe(): boolean {
  let fullyApplied = false;
  for (let i = 0; i < window.frames.length; i++) {
    try {
      const win = window.frames[i] as Window & { __ooSharedWorkerShadowed?: boolean };
      const doc = win.document;
      if (!doc) continue;
      installOpenFailureGuard(win);

      if (!doc.getElementById('oo-local-chrome-css')) {
        const style = doc.createElement('style');
        style.id = 'oo-local-chrome-css';
        // The compact rule is a media query on purpose: it re-evaluates itself
        // on rotation and on every window resize, so the panel a phone cannot
        // afford stays gone no matter which orientation the document was
        // opened in. The JS side (syncCompactLayout) only handles what CSS
        // cannot: the thumbnails panel and the SDK's own canvas geometry.
        style.textContent = [
          '#header-logo, .btn-current-user, #tlb-box-users { display: none !important; }',
          `@media (max-width: ${COMPACT_VIEWPORT_MAX_WIDTH}px), (pointer: coarse) and (max-height: ${COMPACT_VIEWPORT_MAX_WIDTH}px) {`,
          '  [data-layout-name="rightMenu"] { display: none !important; }',
          '}',
        ].join('\n');
        (doc.head || doc.documentElement).appendChild(style);
      }

      if (!win.__ooSharedWorkerShadowed) {
        Object.defineProperty(win, 'SharedWorker', { value: undefined, configurable: true });
        win.__ooSharedWorkerShadowed = true;
        console.log('[OO] SharedWorker shadowed in editor iframe (spellchecker uses a dedicated worker)');
      }

      // 3. Guard the vendor build's AscCommon.fetchFonts: the open-document
      //    conversion awaits it (x2t_helper _convertDocument), and it walks
      //    the font system with no readiness check of its own --
      //    `AscFonts.g_font_infos.forEach(...)` and, per entry,
      //    `AscCommon.g_font_loader.fontFiles[index].Id`. Whichever of the
      //    two is not populated yet throws a TypeError that x2t_helper
      //    rewraps as "Document conversion failed: ...", i.e. a -82 open
      //    error on a perfectly good file. Import conversions don't need
      //    fonts, so report "no fonts" until the whole font system is up;
      //    exports (PDF) happen much later, when it always is.
      const ooWin = win as unknown as FontSystemWindow & { __ooFetchFontsGuarded?: boolean };
      if (ooWin.AscCommon && typeof ooWin.AscCommon.fetchFonts === 'function' && !ooWin.__ooFetchFontsGuarded) {
        const origFetchFonts = ooWin.AscCommon.fetchFonts;
        ooWin.AscCommon.fetchFonts = function (cb: (fonts: unknown[]) => void) {
          if (!isFontSystemReady(ooWin)) {
            console.warn('[OO] fetchFonts called before the font system was ready; importing without fonts');
            cb([]);
            return;
          }
          return origFetchFonts.call(this, cb);
        };
        ooWin.__ooFetchFontsGuarded = true;
        console.log('[OO] AscCommon.fetchFonts guarded against uninitialized font system');
      }

      // 4. Serverless image pipeline. The SDK expects a Document Server to
      //    turn pasted/URL-inserted images into registered local media names
      //    (sendImgUrls posts an "imgurls" command and waits for the server
      //    to answer). Without a server nothing registers, the document
      //    model keeps a raw data:/blob:/https: src, the DOCY writer embeds
      //    that raw string as the image path (getImageLocal hard-rejects
      //    data: URLs), and x2t.wasm blocks the main thread forever trying
      //    to resolve it. Three coordinated patches:
      //    4a. a self-healing getImageLocal that registers external ids on
      //        lookup miss, so the writers always serialize a local name;
      //    4b. a serverless sendImgUrls that registers the source directly;
      //    4c. a medias fallback on convertFromBin, since the vendor's save
      //        glue passes an empty media map.
      const imgWin = win as unknown as {
        AscCommon?: {
          x2t?: { convertFromBin?: unknown };
          sendImgUrls?: unknown;
          g_oDocumentUrls?: {
            mediaPrefix?: string;
            addImageUrl: (name: string, url: string) => void;
            getLocal: (url: string) => string | null;
            getUrl: (path: string) => string | null;
            getUrls: () => Record<string, string>;
            getImageLocal: (url: string) => string | null;
          };
        };
        Asc?: {
          editor?: { ImageLoader?: { map_image_index?: Record<string, unknown> }; _downloadAsFromLocal?: unknown };
        };
        editor?: { ImageLoader?: { map_image_index?: Record<string, unknown> }; _downloadAsFromLocal?: unknown };
        __ooImagePipelinePatched?: boolean;
      };
      const ac = imgWin.AscCommon;
      const editorApi = imgWin.Asc?.editor || imgWin.editor;
      if (ac?.g_oDocumentUrls && ac.x2t && editorApi && !imgWin.__ooImagePipelinePatched) {
        const docUrls = ac.g_oDocumentUrls;
        const MEDIA = docUrls.mediaPrefix || 'media/';
        let imgSeq = 0;

        const extFromSrc = (src: string): string => {
          const dataMime = /^data:image\/([a-z0-9+.-]+)/i.exec(src);
          if (dataMime) {
            const sub = dataMime[1].toLowerCase();
            return sub === 'svg+xml' ? 'svg' : sub === 'jpeg' ? 'jpg' : sub;
          }
          const fromPath = /\.([a-z0-9]{2,5})(?:[?#]|$)/i.exec(src);
          return fromPath ? fromPath[1].toLowerCase() : 'png';
        };

        const registerSrc = (src: unknown): string | null => {
          if (typeof src !== 'string' || !/^(data:image|blob:|https?:)/i.test(src)) return null;
          const existing = docUrls.getLocal(src);
          if (existing) return existing;
          let name: string;
          do {
            name = `image_oo${imgSeq++}.${extFromSrc(src)}`;
          } while (docUrls.getUrl(MEDIA + name));
          docUrls.addImageUrl(name, src);
          return MEDIA + name;
        };

        // 4a. Self-healing resolver. The DOCY writers call getImageLocal
        //     with the model's RasterImageId right before serializing it; a
        //     miss makes them embed the raw external URL into the DOCY,
        //     which is exactly what x2t.wasm loops forever on (verified
        //     offline: the same DOCY converts in ~100ms once the path is a
        //     local media name). So on a miss for an external id, register
        //     it on the spot and return the fresh local name.
        docUrls.getImageLocal = function (url: string) {
          let local = this.getLocal(url) || registerSrc(url);
          if (local && local.indexOf(MEDIA) === 0) local = local.substring(MEDIA.length);
          return local || null;
        };

        // 4b. The callback contract mirrors the server response: url is what
        //     the editor displays, path is the document-relative media name.
        ac.sendImgUrls = function (
          _api: unknown,
          images: string[],
          callback: (r: Array<{ url: string; path: string }>) => void,
        ) {
          const out = (images || []).map((src) => {
            const path = registerSrc(src);
            return path ? { url: src, path } : { url: 'error', path: 'error' };
          });
          setTimeout(() => callback(out), 0);
        };

        // 4c. The vendor's save glue passes medias: [] even when the
        //     document references media -- refill it from the registry so
        //     x2t_helper's writeMediaFiles materializes the bytes (it
        //     decodes data: URLs and fetches blob:/http(s): sources). A
        //     fetch failure degrades to a missing image in the output,
        //     never a hang (verified offline).
        const x2tProto = Object.getPrototypeOf(ac.x2t) as {
          convertFromBin: (obj: { medias?: Record<string, string> }) => unknown;
        };
        const origConvertFromBin = x2tProto.convertFromBin;
        x2tProto.convertFromBin = function (obj: { medias?: Record<string, string> }) {
          if (obj && (!obj.medias || Object.keys(obj.medias).length === 0)) {
            const urls = docUrls.getUrls() || {};
            const medias: Record<string, string> = {};
            for (const key of Object.keys(urls)) {
              if (key.indexOf(MEDIA) === 0) medias[key] = urls[key];
            }
            if (Object.keys(medias).length > 0) obj.medias = medias;
          }
          return origConvertFromBin.call(this, obj);
        };

        imgWin.__ooImagePipelinePatched = true;
        console.log('[OO] serverless image pipeline installed (sendImgUrls, media registry, convertFromBin medias)');
      }

      // 5. Serverless save semantics. The SDK's coauthoring autosave loop
      //    (autoSaveGap, ticking every 40ms) pushes each edit to a Document
      //    Server and, on the fake success our serverless build produces,
      //    marks the history as saved: isDocumentCanSave flips back to false
      //    within 1-2s of every keystroke, so the toolbar Save button and
      //    Ctrl+S stay permanently disabled and the user cannot save at all
      //    (verified live: canSave true -> false exactly autoSaveGapFast
      //    later; with the gap at 0 the button stays lit). Two coordinated
      //    patches, mirroring what the SDK itself does for the desktop
      //    offline mode:
      //    5a. kill the autosave loop (gap 0 makes _autoSave a no-op);
      //    5b. route user-initiated asc_Save (Save button / Ctrl+S) to
      //        asc_DownloadAs in the document's own format, which produces
      //        the onlyoffice-file-stream our save UX consumes. Autosave-
      //        flagged calls keep the original path so nothing else changes.
      const saveWin = win as unknown as {
        Asc?: {
          editor?: {
            autoSaveGap?: number;
            autoSaveGapFast?: number;
            autoSaveGapRealTime?: number;
            asc_setAutoSaveGap?: (gap: number) => void;
            asc_Save?: (isAutoSave?: boolean, isUndoRequest?: boolean) => boolean;
            asc_DownloadAs?: (options: unknown) => void;
            documentFormatSave?: number;
          };
          asc_CDownloadOptions?: new (fileType: number) => unknown;
        };
        __ooServerlessSavePatched?: boolean;
      };
      const saveApi = saveWin.Asc?.editor;
      if (
        saveApi &&
        typeof saveApi.asc_Save === 'function' &&
        saveWin.Asc?.asc_CDownloadOptions &&
        !saveWin.__ooServerlessSavePatched
      ) {
        saveApi.autoSaveGap = 0;
        saveApi.autoSaveGapFast = 0;
        saveApi.autoSaveGapRealTime = 0;
        // The app layer re-applies the user's autosave preference from
        // localStorage on ready and on settings changes; pin the setter so
        // those calls cannot resurrect the loop.
        saveApi.asc_setAutoSaveGap = function () {
          this.autoSaveGap = 0;
        };
        const origSave = saveApi.asc_Save;
        const DownloadOptions = saveWin.Asc.asc_CDownloadOptions;
        saveApi.asc_Save = function (isAutoSave?: boolean, isUndoRequest?: boolean) {
          if (isAutoSave) return origSave.call(this, isAutoSave, isUndoRequest);
          const format = typeof this.documentFormatSave === 'number' ? this.documentFormatSave : undefined;
          if (format === undefined || typeof this.asc_DownloadAs !== 'function') {
            return origSave.call(this, isAutoSave, isUndoRequest);
          }
          this.asc_DownloadAs(new DownloadOptions(format));
          return true;
        };
        saveWin.__ooServerlessSavePatched = true;
        console.log('[OO] serverless save semantics installed (autosave loop off, Save/Ctrl+S -> download stream)');
      }

      // 6. Long-action counter leak guard. Frame-editor entry points
      //    (edit chart / edit OLE table) do sync_StartAction(BlockInteraction)
      //    -- which increments IsLongActionCurrent -- and then, when the
      //    frame editor cannot open (no chart under the selection, no
      //    Document Server frame editor in a serverless build), throw
      //    before the matching sync_EndAction. isLongAction() is then stuck
      //    true for the rest of the session and every asc_DownloadAs is
      //    silently dropped: the document can never be saved again, with no
      //    error shown. Found by the api-surface sweep, confirmed by
      //    single-method bisection on pptx. Reachable from the UI (chart
      //    context menu / double-click), so wrap those entry points and
      //    release the counter on the exception path.
      const laWin = win as unknown as {
        Asc?: {
          editor?: {
            IsLongActionCurrent?: number;
            isLongAction?: () => boolean;
            sync_EndAction?: (type: number, id: number) => void;
            asc_editChartInFrameEditor?: (...args: unknown[]) => unknown;
            asc_editOleTableInFrameEditor?: (...args: unknown[]) => unknown;
            asc_runAutostartMacroses?: (...args: unknown[]) => unknown;
          };
          c_oAscAsyncActionType?: { BlockInteraction?: number };
        };
        __ooLongActionLeakGuarded?: boolean;
      };
      const laApi = laWin.Asc?.editor;
      if (laApi && !laWin.__ooLongActionLeakGuarded) {
        // Restore the counter to what it was before the entry and let the
        // app layer end its BlockInteraction overlay.
        const releaseTo = (api: NonNullable<typeof laApi>, before: number) => {
          if (typeof api.IsLongActionCurrent !== 'number' || api.IsLongActionCurrent <= before) return false;
          const block = laWin.Asc?.c_oAscAsyncActionType?.BlockInteraction;
          while (api.IsLongActionCurrent > before) {
            if (typeof block === 'number' && typeof api.sync_EndAction === 'function') {
              api.sync_EndAction(block, 0);
            } else {
              api.IsLongActionCurrent -= 1;
            }
          }
          return true;
        };
        const wrapEntry = (
          name: 'asc_editChartInFrameEditor' | 'asc_editOleTableInFrameEditor' | 'asc_runAutostartMacroses',
          // Entries that legitimately stay "long" until an async callback
          // must only be released on the exception path; synchronous ones
          // (autostart macros: no macros / no builder in this build) are
          // released whenever they return with the counter still raised.
          releaseOnReturn: boolean,
        ) => {
          const orig = laApi[name];
          if (typeof orig !== 'function') return;
          laApi[name] = function (this: NonNullable<typeof laApi>, ...args: unknown[]) {
            const before = typeof this.IsLongActionCurrent === 'number' ? this.IsLongActionCurrent : 0;
            try {
              const out = orig.apply(this, args);
              if (releaseOnReturn && releaseTo(this, before)) {
                console.warn(`[OO] ${name} returned with the long-action counter raised; restored`);
              }
              return out;
            } catch (error) {
              releaseTo(this, before);
              console.warn(`[OO] ${name} failed; long-action counter restored`, error);
              return undefined;
            }
          };
        };
        wrapEntry('asc_editChartInFrameEditor', false);
        wrapEntry('asc_editOleTableInFrameEditor', false);
        wrapEntry('asc_runAutostartMacroses', true);
        laWin.__ooLongActionLeakGuarded = true;
        console.log('[OO] long-action counter leak guard installed (frame-editor entry points)');
      }

      // 7. Whole-sheet series-settings guard (cell editor). After Ctrl+A the
      //    selection is the full 1048576 x 16384 grid; asc_GetSeriesSettings
      //    (the chart-insert dialog's data source) then builds series over
      //    every cell of that selection, which pins the main thread and
      //    exhausts memory until "Array buffer allocation failed" -- the
      //    renderer dies or, at best, the document can no longer be saved.
      //    Found by the api-surface sweep (minimal repro: asc_EditSelectAll
      //    then asc_GetSeriesSettings), reachable from the UI as
      //    select-all -> insert chart. Clamp oversized selections to the
      //    used area for the duration of the call, restoring afterwards, so
      //    the vendor logic sees at most the cells that actually hold data.
      const seriesWin = win as unknown as {
        Asc?: {
          editor?: {
            asc_GetSeriesSettings?: () => unknown;
            wb?: {
              getWorksheet?: () => {
                setSelection?: (range: unknown) => void;
                model?: {
                  selectionRange?: { getLast?: () => { r1: number; c1: number; r2: number; c2: number } };
                  getRowsCount?: () => number;
                  getColsCount?: () => number;
                };
              };
            };
          };
          Range?: new (c1: number, r1: number, c2: number, r2: number) => unknown;
        };
        __ooSeriesSelectionGuarded?: boolean;
      };
      const seriesApi = seriesWin.Asc?.editor;
      const RangeCtor = seriesWin.Asc?.Range;
      if (
        seriesApi &&
        typeof seriesApi.asc_GetSeriesSettings === 'function' &&
        RangeCtor &&
        !seriesWin.__ooSeriesSelectionGuarded
      ) {
        const origSeries = seriesApi.asc_GetSeriesSettings;
        const MAX_SERIES_CELLS = 200_000;
        seriesApi.asc_GetSeriesSettings = function (this: typeof seriesApi) {
          try {
            const ws = this.wb?.getWorksheet?.();
            const model = ws?.model;
            const last = model?.selectionRange?.getLast?.();
            if (ws && model && last && typeof ws.setSelection === 'function') {
              const area = (last.r2 - last.r1 + 1) * (last.c2 - last.c1 + 1);
              if (area > MAX_SERIES_CELLS) {
                const rows = Math.max(1, model.getRowsCount?.() ?? 1);
                const cols = Math.max(1, model.getColsCount?.() ?? 1);
                const saved = { r1: last.r1, c1: last.c1, r2: last.r2, c2: last.c2 };
                ws.setSelection(new RangeCtor(last.c1, last.r1, Math.min(last.c2, cols), Math.min(last.r2, rows)));
                try {
                  return origSeries.call(this);
                } finally {
                  ws.setSelection(new RangeCtor(saved.c1, saved.r1, saved.c2, saved.r2));
                }
              }
            }
          } catch {
            // any probing failure falls through to the vendor behavior
          }
          return origSeries.call(this);
        };
        seriesWin.__ooSeriesSelectionGuarded = true;
        console.log('[OO] whole-sheet series-settings guard installed');
      }

      // 8. Font-load acceleration. The SDK's CFontLoader works through
      //    fonts_loading strictly one family at a time (LoadFontAsync for
      //    the faces of fonts_loading[0], poll every 50ms until they land,
      //    shift, repeat), so a real CJK deck's 30 families cost 30 serial
      //    round trips of multi-MB downloads -- minutes on a cold CDN path.
      //    Two coordinated patches, both semantics-preserving:
      //    8a. IsNeedDefaultFonts -> false: the Word/Slide editors preload
      //        Arial/Symbol/Wingdings/Courier/Times (12 files, 3.2 MB) on
      //        every open "just in case"; the runtime path (LoadDocumentFonts2)
      //        already fetches any of them on first actual use.
      //    8b. after the vendor enqueues the document's fonts, kick off
      //        LoadFontAsync for every still-unloaded face of every queued
      //        family at once, so the browser downloads them in parallel and
      //        the serial poll finds each one already in flight or done.
      const fontWin = win as unknown as {
        Asc?: {
          editor?: {
            IsNeedDefaultFonts?: () => boolean;
            FontLoader?: {
              fonts_loading?: Array<{
                indexR: number;
                indexI: number;
                indexB: number;
                indexBI: number;
                needR?: boolean;
                needI?: boolean;
                needB?: boolean;
                needBI?: boolean;
                NeedStyles?: number;
              }>;
              fontFiles?: Array<{ CheckLoaded: () => boolean; LoadFontAsync: (path: string, cb: unknown) => unknown }>;
              fontFilesPath?: string;
              LoadDocumentFonts?: (...args: unknown[]) => unknown;
              LoadDocumentFonts2?: (...args: unknown[]) => unknown;
            };
          };
        };
        __ooFontLoadAccelerated?: boolean;
      };
      const fontApi = fontWin.Asc?.editor;
      const loader = fontApi?.FontLoader;
      if (fontApi && loader && typeof loader.LoadDocumentFonts === 'function' && !fontWin.__ooFontLoadAccelerated) {
        fontApi.IsNeedDefaultFonts = () => false;

        const prefetchQueued = () => {
          const files = loader.fontFiles;
          const path = loader.fontFilesPath;
          if (!files || typeof path !== 'string') return;
          let started = 0;
          for (const info of loader.fonts_loading || []) {
            // NeedStyles 15 (all faces) is what the loader itself resolves
            // to when it later inspects the entry; mirror that superset so
            // no face the poll will wait for is left un-requested.
            const wantAll = info.NeedStyles === undefined || (info.NeedStyles & 15) === 15;
            const faces: Array<[boolean | undefined, number]> = [
              [wantAll || info.needR, info.indexR],
              [wantAll || info.needI, info.indexI],
              [wantAll || info.needB, info.indexB],
              [wantAll || info.needBI, info.indexBI],
            ];
            for (const [need, idx] of faces) {
              if (!need || idx < 0) continue;
              const file = files[idx];
              if (!file || file.CheckLoaded()) continue;
              try {
                // LoadFontAsync is idempotent per file: it returns early
                // once a fetch is in flight (Status !== -1).
                file.LoadFontAsync(path, null);
                started++;
              } catch {
                // leave that face to the vendor's serial path
              }
            }
          }
          if (started) console.log(`[OO] font prefetch: ${started} face(s) requested in parallel`);
        };

        for (const name of ['LoadDocumentFonts', 'LoadDocumentFonts2'] as const) {
          const orig = loader[name];
          if (typeof orig !== 'function') continue;
          loader[name] = function (this: typeof loader, ...args: unknown[]) {
            const out = orig.apply(this, args);
            // The vendor has now filled fonts_loading and started family #1;
            // request everything else too.
            try {
              prefetchQueued();
            } catch {
              // acceleration is best-effort
            }
            return out;
          };
        }
        fontWin.__ooFontLoadAccelerated = true;
        console.log(
          '[OO] font-load acceleration installed (no default-font preload, parallel prefetch of queued faces)',
        );
      }

      // 8. Comment bulk actions on an empty selection. The spreadsheet's
      //    removeAllComments/resolveAllComments read
      //    getWorksheet()._getSelection().ranges for the "current selection"
      //    variant, but the selection is null until the grid has been focused
      //    once -- Review -> Remove comments -> "in current selection" (and
      //    the Clear -> Comments path) then throws an uncaught TypeError
      //    *after* History.StartTransaction(), leaving an unclosed
      //    transaction behind. Found by the UI crawl (test/e2e/ui-crawl.spec.ts).
      //    Skip the call when there is nothing selected: removing comments
      //    from an empty selection is a no-op anyway.
      const commentWin = win as unknown as {
        Asc?: {
          editor?: Record<string, unknown> & {
            wb?: { getWorksheet?: () => { _getSelection?: () => unknown } | null };
          };
        };
        __ooCommentSelectionGuarded?: boolean;
      };
      const commentApi = commentWin.Asc?.editor;
      if (
        commentApi &&
        typeof commentApi.asc_RemoveAllComments === 'function' &&
        !commentWin.__ooCommentSelectionGuarded
      ) {
        for (const name of ['asc_RemoveAllComments', 'asc_ResolveAllComments'] as const) {
          const orig = commentApi[name];
          if (typeof orig !== 'function') continue;
          commentApi[name] = function (this: typeof commentApi, ...args: unknown[]) {
            // Signature: (onlyMine, currentSelectionOnly, ...)
            if (args[1]) {
              const sheet = this?.wb?.getWorksheet?.();
              if (!sheet || !sheet._getSelection?.()) {
                console.log(`[OO] ${name} skipped: no cell selection yet`);
                return undefined;
              }
            }
            return (orig as (...a: unknown[]) => unknown).apply(this, args);
          };
        }
        commentWin.__ooCommentSelectionGuarded = true;
        console.log('[OO] comment bulk-action guard installed (no-op without a cell selection)');
      }

      // 9. Canvas context loss. Mobile Chrome discards 2D canvas backing stores
      //    under memory pressure, and this vendor build listens for neither
      //    `contextlost` nor `contextrestored` (grep: zero hits in sdkjs), so
      //    the editor is left showing a blank white page with live scrollbars
      //    -- what GitHub #145 reports after repeatedly changing the zoom of a
      //    presentation on Android, where every zoom step reallocates canvases
      //    at the device pixel ratio. The lever that actually repaints is
      //    WordControl.OnResize (verified: a wiped canvas comes back to a full
      //    render; a plain window resize event does not, the SDK skips it when
      //    the size is unchanged).
      //
      //    Note: the `contextlost` event must NOT be canceled. Per the HTML
      //    spec the UA restores the context only when the event goes
      //    uncanceled, and it then fires `contextrestored`.
      const lossWin = win as unknown as {
        __ooCanvasLossGuarded?: boolean;
        Asc?: {
          editor?: { WordControl?: { OnResize?: () => void; OnScroll?: () => void }; asc_Resize?: () => void };
        };
      };
      if (!lossWin.__ooCanvasLossGuarded) {
        const repaintEditor = (): void => {
          const editorApi = lossWin.Asc?.editor;
          const control = editorApi?.WordControl;
          try {
            if (typeof control?.OnResize === 'function') control.OnResize();
            else if (typeof control?.OnScroll === 'function') control.OnScroll();
            // The spreadsheet editor has no WordControl at all, so without
            // this branch a discarded canvas stayed blank there.
            else if (typeof editorApi?.asc_Resize === 'function') editorApi.asc_Resize();
          } catch (error) {
            console.warn('[OO] repaint after canvas context loss failed:', error);
          }
        };
        // Capture phase: these events do not bubble, but capture still reaches
        // the document on the way down.
        doc.addEventListener(
          'contextlost',
          () => {
            console.warn('[OO] editor canvas context lost (memory pressure); waiting for restore');
            // Some restores arrive without a paint; nudge either way.
            win.setTimeout(repaintEditor, 500);
          },
          true,
        );
        for (const restored of ['contextrestored', 'webglcontextrestored']) {
          doc.addEventListener(
            restored,
            () => {
              console.log('[OO] editor canvas context restored; repainting');
              repaintEditor();
            },
            true,
          );
        }
        lossWin.__ooCanvasLossGuarded = true;
      }

      if (
        win.__ooSharedWorkerShadowed &&
        ooWin.__ooFetchFontsGuarded &&
        imgWin.__ooImagePipelinePatched &&
        saveWin.__ooServerlessSavePatched &&
        laWin.__ooLongActionLeakGuarded
      ) {
        fullyApplied = true;
      }
    } catch {
      // cross-origin frame -- not the editor, skip
    }
  }
  return fullyApplied;
}

/**
 * v9 editor creation against the OnlyOffice Personal vendor build. Unlike the
 * old Web Mode path, this build is driven entirely through the public
 * DocEditor config: document.url is a real (blob) URL the editor fetches and
 * converts internally, saves come back over the 'onlyoffice-file-stream'
 * message (see handleFileStreamMessage), and no SDK-internal patching is
 * needed. `binData` undefined or empty means "new document": the SDK creates
 * a blank one when url is undefined.
 */
/**
 * Default interface theme for the editor. The v9 loader picks `theme-white`
 * (flat white chrome) as the light default; we prefer the classic Office look
 * (`theme-classic-light`, per-app coloured toolbar header). The value goes
 * through `customization.uiTheme`, which api.js turns into the `uitheme=`
 * frame parameter -- and that parameter wins over the editor's own stored
 * choice at boot. So respect a theme the user has already picked in the
 * editor (same-origin `ui-theme-id`) and only fall back to classic when
 * there is none, otherwise every open would reset their preference.
 */
export const DEFAULT_UI_THEME = 'theme-classic-light';
export const UI_THEME_STORAGE_KEY = 'ui-theme-id';

/**
 * Phone-sized viewports (GitHub #145). The vendor ships a separate mobile app
 * bundle, but only its desktop ("main") build carries this package's offline
 * x2t patch, so a phone gets the desktop UI -- whose fixed chrome (left rail
 * plus slide thumbnails, right rail, notes pane) eats about three quarters of
 * a 393 px viewport. What is left is a ~190 px strip, and "fit slide" then
 * computes a zoom in the low tens of percent: the reporter saw 31 %, a Pixel 5
 * viewport measures 12 %.
 */
export const COMPACT_VIEWPORT_MAX_WIDTH = 600;

export type ViewportMetrics = { width: number; height: number; coarsePointer: boolean };

export function readViewportMetrics(): ViewportMetrics {
  if (typeof window === 'undefined') return { width: 0, height: 0, coarsePointer: false };
  return {
    width: window.innerWidth,
    height: window.innerHeight,
    coarsePointer: typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches,
  };
}

/**
 * Width alone is not enough: a phone in landscape is ~850 px wide, which is
 * well over any phone breakpoint, yet its 393 px of height leaves the desktop
 * chrome just as little room (measured: 498 px of canvas, 23 % zoom for a
 * slide). So a touch device counts as compact whenever its *shorter* side is
 * phone-sized, while a mouse-driven window only counts when it is genuinely
 * narrow -- a short but wide desktop window keeps its panels.
 */
export function isCompactViewport(metrics: ViewportMetrics = readViewportMetrics()): boolean {
  const { width, height, coarsePointer } = metrics;
  if (width <= 0) return false;
  if (width <= COMPACT_VIEWPORT_MAX_WIDTH) return true;
  return coarsePointer && Math.min(width, height) <= COMPACT_VIEWPORT_MAX_WIDTH;
}

/**
 * Customization overrides for a phone: give the document the width the side
 * panels were spending, and start at fit-to-width instead of fit-to-slide.
 * The status bar stays -- it carries the zoom control and the slide counter,
 * and the main view scrolls through the slides, so nothing becomes
 * unreachable. Desktop viewports get none of this.
 */
export function compactViewportCustomization(): Record<string, unknown> {
  return {
    // Everything here is one-way: the vendor applies customization once, at
    // boot. So this may only carry settings with no runtime switch --
    // compactHeader has none, and the initial zoom is by definition a
    // start value.
    //
    // Everything reversible is deliberately NOT here and goes through
    // syncCompactLayout instead (the rulers, the notes pane, the slide
    // thumbnails) or through the media query in the injected frame stylesheet
    // (the right panel). Passing `layout: { rightMenu: false }` here looked
    // equivalent and was not: LayoutManager writes an inline `display: none`
    // that no media query can undo, so a document opened in a narrow window
    // lost its object-settings panel permanently, even after the window was
    // widened again (measured before this was moved out).
    compactHeader: true,
    // -2 = fit to width (-1 = fit to page). On a phone the document should use
    // the full width; the vendor's fit-to-page also budgets for the notes pane
    // and toolbars and lands far smaller.
    zoom: -2,
  };
}

export function resolveUiTheme(): string {
  // Follows the site's ranui theme (dark site -> theme-dark) unless the user
  // picked a theme inside the editor; see lib/editor-theme.ts.
  return resolveEditorUiTheme(DEFAULT_UI_THEME);
}

// Keep a mounted editor in step with the site theme (top-bar switch, OS
// switch in system mode) for the page's lifetime; idempotent per module.
if (typeof document !== 'undefined' && typeof MutationObserver !== 'undefined') {
  installEditorThemeFollow(DEFAULT_UI_THEME);
}

function createPersonalEditorInstance(config: {
  fileName: string;
  fileType: string;
  binData?: ArrayBuffer;
  editorLang: string;
}): void {
  const { fileName, fileType, binData, editorLang } = config;

  if (currentDocumentBlobUrl) {
    URL.revokeObjectURL(currentDocumentBlobUrl);
    currentDocumentBlobUrl = null;
  }
  resetDocumentContentReady();

  let url: string | undefined;
  if (binData instanceof ArrayBuffer && binData.byteLength > 0) {
    currentDocumentBlobUrl = URL.createObjectURL(new Blob([binData]));
    url = currentDocumentBlobUrl;
  }

  const normalizedType = fileType.toLowerCase();
  window.editor = new window.DocsAPI.DocEditor('iframe', {
    document: {
      title: fileName,
      url,
      fileType: normalizedType,
      // PDF: decide the app here instead of letting api.js mount the
      // web-apps/apps/common loader that sniffs "is this a form?" first. On
      // static hosts that normalize /index.html to the directory URL (CF
      // Pages answers 308) that loader's `href.match(/common\/index.html/)`
      // never matches and the PDF stays on a blank loader forever -- seen only
      // in production. isForm:false routes straight to the pdf editor, which
      // fills forms too.
      // localOpenFromBinary: the pdf app's offline protocol -- it initialises
      // local permissions itself and waits for the bytes we hand over in
      // onAppReady (DocEditor.openDocument). Without it a PDF sits on the
      // skeleton loader forever (word/cell/slide fetch document.url on their
      // own; the pdf app never does).
      ...(normalizedType === 'pdf' ? { isForm: false, localOpenFromBinary: true } : {}),
      // A fresh key per open bypasses the editor's own document cache
      // (same-name documents with different content would collide otherwise).
      key: `doc-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
      permissions: {
        // Always mount with edit permission. Readonly is enforced after load
        // via asc_setRestriction (see onDocumentReady) so it stays
        // runtime-togglable in both directions -- a view-mode mount is a
        // one-way door that only a full editor rebuild could reopen.
        edit: true,
        download: true,
        print: true,
        chat: false,
        protect: false,
      },
    },
    documentType: DOCUMENT_TYPE_MAP[normalizedType],
    editorConfig: {
      mode: 'edit',
      // No Document Server, no co-editing: pin the mode and hide the Review
      // tab's "Co-editing Mode" switch. Toggling it in this build throws an
      // uncaught "Cannot read properties of null (reading 'ranges')" in the
      // spreadsheet editor (found by the UI crawl).
      coEditing: { mode: 'fast', change: false },
      lang: editorLang,
      user: {
        id: 'local-user',
        name: 'Guest',
      },
      customization: {
        help: false,
        about: false,
        hideRightMenu: true,
        uiTheme: resolveUiTheme(),
        ...(isCompactViewport() ? compactViewportCustomization() : {}),
        features: {
          // Spellcheck is fully disabled (mode:false turns it off, not just
          // locks the toggle): its engine is imported inside a worker on
          // first document load and that request has been observed to hang
          // forever on cold profiles, which keeps isDocumentLoadComplete
          // false and silently breaks every save/export.
          spellcheck: {
            mode: false,
            change: false,
          },
        },
        anonymous: {
          request: false,
          label: 'Guest',
        },
      },
    },
    events: {
      onAppReady: () => {
        // The pdf editor's offline path differs from word/cell/slide: those
        // apps' Offline controllers fetch document.url and convert it
        // themselves, while the pdf app only listens for the host's
        // openDocumentFromBinary command (DocEditor.openDocument({buffer})),
        // queueing it until permissions are initialised. Without this call a
        // PDF sits on the skeleton loader forever (found by pdf-roundtrip.spec:
        // the earlier PDF check only asserted the iframe route).
        if (normalizedType === 'pdf' && binData instanceof ArrayBuffer && binData.byteLength > 0) {
          (
            window.editor as unknown as { openDocument?: (doc: { buffer: ArrayBuffer }) => void } | undefined
          )?.openDocument?.({
            buffer: binData,
          });
        }
        // The SDK pieces the preparation patches can land after onAppReady;
        // keep re-applying (idempotent, cheap) until everything is in place
        // or the safety cap expires, whichever comes first.
        if (prepareEditorIframe()) return;
        const timer = window.setInterval(() => {
          if (prepareEditorIframe()) window.clearInterval(timer);
        }, 200);
        window.setTimeout(() => window.clearInterval(timer), 15_000);
      },
      onDocumentReady: () => {
        markDocumentContentReady();
        // Re-apply in case the header rendered after onAppReady.
        prepareEditorIframe();
        // Reset the tracked state: this is a freshly mounted editor whose
        // panels are whatever the mount-time customization made them.
        compactLayoutApplied = null;
        foldedByUs = { thumbnails: false, notes: false, rulers: false };
        syncCompactLayout(normalizedType, { force: true });
        installViewportFollow(normalizedType);
        // Readonly opens mount with full edit permissions and get locked
        // here instead (asc_setRestriction only works once the document is
        // loaded). Read the live flag rather than the captured config value:
        // setReadonlyMode may have been called while the document loaded.
        if (isReadonlyMode) {
          getSdkEditorApi()?.asc_setRestriction?.(ASC_RESTRICTION_VIEW);
        }
        console.log(`${t('documentLoaded')}${fileName}`);
      },
      // Must be declared even as a no-op: the api layer only runs downloadAs
      // when this callback exists. Actual bytes arrive via the
      // onlyoffice-file-stream message, not through this event.
      onDownloadAs: () => {},
      onError: (event: unknown) => {
        console.error('[OO] editor error:', event);
        // Surface a toast so users see more than a silent console line
        // (issue reports like #113 arrived with nothing but a screenshot of
        // the error dialog's numeric code).
        const data = (event as { data?: { errorCode?: number; errorDescription?: string } } | null)?.data;
        const code = data?.errorCode;
        // -85: the engine sniffed a content/extension mismatch.
        // -82: the open conversion failed (see installOpenFailureGuard).
        const hint =
          code === -85 ? ` ${t('editorErrorFormatMismatch')}` : code === -82 ? ` ${t('editorErrorOpenFailed')}` : '';
        // The numeric code alone is not diagnosable: every issue report so far
        // arrived as a screenshot of this toast (#113, #144). When the open
        // conversion is what failed we know exactly why, so put that reason in
        // the toast too -- truncated, since it is vendor text.
        const cause = code === -82 && documentOpenError ? ` [${documentOpenError.slice(0, 160)}]` : '';
        const detail = [code !== undefined ? `code ${code}` : '', data?.errorDescription].filter(Boolean).join(', ');
        (window as unknown as { message?: { error?: (msg: string) => void } }).message?.error?.(
          `${t('editorErrorToast')}${detail ? ` (${detail})` : ''}${hint}${cause}`,
        );
      },
    },
  } as unknown as ConstructorParameters<typeof window.DocsAPI.DocEditor>[1]);
}

// Public editor creation method. `binData` undefined means "new document":
// the SDK creates a blank one when document.url is undefined.
export function createEditorInstance(config: {
  fileName: string;
  fileType: string;
  binData?: ArrayBuffer;
  readonly?: boolean;
  /** Set only by retryCurrentOpen: keeps the attempt's one retry budget. */
  isRetry?: boolean;
}): Promise<void> {
  openGeneration += 1;
  if (!config.isRetry) {
    // A user-initiated open resets the retry budget for the new document.
    currentOpenAttempt = {
      fileName: config.fileName,
      fileType: config.fileType,
      binData: config.binData,
      readonly: config.readonly ?? false,
      retried: false,
    };
  }
  return queueEditorOperation(async () => {
    const { fileName, fileType, binData, readonly = false } = config;
    isReadonlyMode = readonly;

    // Check if there's an existing editor that needs cleanup
    const hasExistingEditor = !!window.editor;

    // Clean up old editor instance properly
    if (window.editor) {
      // The viewport follow belongs to the document that is going away; the
      // next onDocumentReady installs a fresh one for the new document.
      viewportFollowCleanup?.();
      try {
        console.log('Destroying previous editor instance...');
        window.editor.destroyEditor();

        // When switching between document types, especially from/to PPT,
        // we need more time for cleanup. PPT editors are particularly resource-intensive.
        // Use longer delay when switching editors or when dealing with presentations
        const isPresentation = fileType === 'pptx' || fileType === 'ppt';
        const destroyDelay = hasExistingEditor && isPresentation ? 400 : hasExistingEditor ? 250 : 150;

        // Wait a bit for destroy to complete
        await new Promise((resolve) => setTimeout(resolve, destroyDelay));
      } catch (error) {
        console.warn('Error destroying previous editor:', error);
      }
      window.editor = undefined;
    }

    // Clean up iframe container to ensure clean state
    const iframeContainer = document.getElementById('iframe');
    if (iframeContainer) {
      // Remove all child elements
      while (iframeContainer.firstChild) {
        iframeContainer.removeChild(iframeContainer.firstChild);
      }
    }

    // Additional delay to ensure cleanup completes before creating new editor
    // This is especially important when switching between different document types
    // When switching editors, especially involving PPT, we need more time
    const isPresentation = fileType === 'pptx' || fileType === 'ppt';
    const cleanupDelay = hasExistingEditor && isPresentation ? 400 : hasExistingEditor ? 250 : 150;
    await new Promise((resolve) => setTimeout(resolve, cleanupDelay));

    const editorLang = getOnlyOfficeLang();
    console.log('Creating new editor instance for:', fileName, 'type:', fileType);

    createPersonalEditorInstance({ fileName, fileType, binData, editorLang });
  });
}

// Compact state the layout is currently in, plus which pieces of chrome this
// module folded away. Only what we folded is ever unfolded again: restoring a
// panel the user closed by hand would be worse than leaving it alone.
let compactLayoutApplied: boolean | null = null;
let foldedByUs = { thumbnails: false, notes: false, rulers: false };

/**
 * Bring the editor's layout in line with the viewport it is currently in, and
 * keep it there.
 *
 * The mount-time customization can only describe the viewport the document was
 * opened in, and on a phone that is the wrong one half the time: a device held
 * in landscape is ~850 px wide, so it mounts with the full desktop chrome, and
 * rotating to portrait lands right back in the layout GitHub #145 reports
 * (measured after rotation: 191 px of canvas, 12 % zoom). Chrome that is pure
 * CSS -- the right panel -- follows a media query in the injected stylesheet
 * and needs nothing here; what needs code is the thumbnails panel, the SDK's
 * canvas geometry and the zoom.
 *
 * Only *crossings* act. Plain resizes are the vendor's business, and on mobile
 * they fire constantly as the URL bar slides in and out; re-collapsing panels
 * or refitting the zoom on each of those would fight the user.
 */
function syncCompactLayout(documentType: string, options: { force?: boolean } = {}): void {
  const compact = isCompactViewport();
  if (!options.force && compact === compactLayoutApplied) return;
  const crossed = compact !== compactLayoutApplied;
  compactLayoutApplied = compact;

  const api = getSdkEditorApi();
  if (!api) return;
  const isSlide = DOCUMENT_TYPE_MAP[documentType] === 'slide';

  try {
    if (isSlide && typeof api.ShowThumbnails === 'function') {
      if (compact && !foldedByUs.thumbnails) {
        // A third of a phone viewport goes to slide thumbnails, and each of
        // them is its own canvas. Collapsing the panel is both the width and
        // the memory win; the left rail brings it back in one tap. Skip a
        // panel that is already closed -- it is then the user's to reopen.
        if (measureEditorElementWidth('#id_thumbnails') > 0) {
          api.ShowThumbnails(false);
          foldedByUs.thumbnails = true;
        }
      } else if (!compact && foldedByUs.thumbnails) {
        api.ShowThumbnails(true);
        foldedByUs.thumbnails = false;
      }
    }

    // The notes pane and the rulers cost rows a phone does not have. Both have
    // a getter, so we only fold what is actually open and only unfold what we
    // folded.
    if (isSlide && typeof api.asc_ShowNotes === 'function') {
      if (compact && !foldedByUs.notes && api.getIsNotesShow?.() !== false) {
        api.asc_ShowNotes(false);
        foldedByUs.notes = true;
      } else if (!compact && foldedByUs.notes) {
        api.asc_ShowNotes(true);
        foldedByUs.notes = false;
      }
    }
    if (typeof api.asc_SetViewRulers === 'function') {
      if (compact && !foldedByUs.rulers && api.asc_GetViewRulers?.() !== false) {
        api.asc_SetViewRulers(false);
        foldedByUs.rulers = true;
      } else if (!compact && foldedByUs.rulers) {
        api.asc_SetViewRulers(true);
        foldedByUs.rulers = false;
      }
    }

    if (!crossed) return;
    // The panels around the canvas just changed size, and the SDK sizes its
    // canvas in JS: without a nudge it keeps drawing at the old geometry.
    // WordControl covers word and slide, asc_Resize the spreadsheet.
    setTimeout(() => {
      const current = getSdkEditorApi();
      if (!current) return;
      if (typeof current.WordControl?.OnResize === 'function') current.WordControl.OnResize();
      else if (typeof current.asc_Resize === 'function') current.asc_Resize();
      // Refit only when the available width actually changed underneath the
      // document, i.e. on a crossing -- never on an ordinary resize.
      if (compact && typeof current.zoomFitToWidth === 'function') current.zoomFitToWidth();
    }, 100);
  } catch (error) {
    console.warn('[OO] compact layout sync failed:', error);
  }
}

/**
 * Follow the viewport for the lifetime of the open document: rotation and
 * window resizes re-run the sync above. Debounced, because mobile browsers
 * fire resize on every URL-bar animation frame.
 */
function installViewportFollow(documentType: string): void {
  if (typeof window === 'undefined') return;
  if (viewportFollowCleanup) viewportFollowCleanup();
  let debounce = 0;
  const onViewportChange = () => {
    window.clearTimeout(debounce);
    debounce = window.setTimeout(() => syncCompactLayout(documentType), 200);
  };
  window.addEventListener('resize', onViewportChange);
  window.addEventListener('orientationchange', onViewportChange);
  viewportFollowCleanup = () => {
    window.clearTimeout(debounce);
    window.removeEventListener('resize', onViewportChange);
    window.removeEventListener('orientationchange', onViewportChange);
    viewportFollowCleanup = null;
  };
}

let viewportFollowCleanup: (() => void) | null = null;

// Asc.c_oAscRestrictionType values (public SDK enum).
const ASC_RESTRICTION_NONE = 0;
const ASC_RESTRICTION_VIEW = 128;

type SdkEditorApi = {
  asc_setRestriction?: (value: number) => void;
  asc_removeRestriction?: (value: number) => void;
  /** Presentation editor: show/hide the slide thumbnails panel. */
  ShowThumbnails?: (visible: boolean) => void;
  zoomFitToWidth?: () => void;
  /** word and slide: recompute the canvas geometry after the chrome changed. */
  WordControl?: { OnResize?: () => void };
  /** The spreadsheet editor's equivalent (it has no WordControl). */
  asc_Resize?: () => void;
  /** Presentation editor: the notes pane, with its getter. */
  asc_ShowNotes?: (visible: boolean) => void;
  getIsNotesShow?: () => boolean;
  /** Word and presentation editors: the rulers, with their getter. */
  asc_SetViewRulers?: (visible: boolean) => void;
  asc_GetViewRulers?: () => boolean;
};

/**
 * Width of an element inside the (same-origin) editor frame, 0 when it is
 * absent or hidden. Used to tell "the panel is open" from "the user already
 * closed it" before folding anything away.
 */
function measureEditorElementWidth(selector: string): number {
  for (let i = 0; i < window.frames.length; i++) {
    try {
      const doc = window.frames[i].document;
      const element = doc?.querySelector(selector);
      if (element) return Math.round(element.getBoundingClientRect().width);
    } catch {
      // cross-origin frame -- not the editor
    }
  }
  return 0;
}

// Locate the SDK API instance inside the (same-origin) editor iframe. The
// vendor build exposes it as Asc.editor and aliases it to the frame's own
// `editor` global.
function getSdkEditorApi(): SdkEditorApi | null {
  for (let i = 0; i < window.frames.length; i++) {
    try {
      const win = window.frames[i] as Window & {
        Asc?: { editor?: SdkEditorApi };
        editor?: SdkEditorApi;
      };
      const api = win.Asc?.editor || win.editor;
      if (api && typeof api.asc_setRestriction === 'function') {
        return api;
      }
    } catch {
      // cross-origin frame -- not the editor, skip
    }
  }
  return null;
}

export function setReadonlyMode(readonly: boolean): void {
  isReadonlyMode = readonly;

  // Primary path: the SDK restriction API switches the live editor between
  // view and edit in place, no rebuild. The editor must be mounted with full
  // edit permissions for this to be reversible (see
  // createPersonalEditorInstance: restriction is applied after load, never
  // via permissions.edit=false at mount).
  const api = getSdkEditorApi();
  if (api) {
    if (readonly) {
      api.asc_setRestriction?.(ASC_RESTRICTION_VIEW);
    } else {
      api.asc_removeRestriction?.(ASC_RESTRICTION_VIEW);
      api.asc_setRestriction?.(ASC_RESTRICTION_NONE);
    }
  }

  // Fallback/legacy path; harmless no-op on builds that ignore the command.
  editorSendCommand({
    command: 'processRightsChange',
    data: {
      enabled: !readonly,
      message: readonly ? 'Readonly mode' : '',
    } as any,
  });
}

export function getReadonlyMode(): boolean {
  return isReadonlyMode;
}

export function requestSaveDocument(
  targetExt = 'XLSX',
  options: {
    returnOriginalOnTimeout?: boolean;
  } = {},
): Promise<File> {
  if (!window.editor) {
    return Promise.reject(new Error('No document is open'));
  }

  if (isReadonlyMode) {
    return Promise.reject(new Error('Current document is readonly'));
  }

  if (documentOpenError) {
    return Promise.reject(new Error(`The document failed to open: ${documentOpenError}`));
  }

  if (embeddedSaveRequest) {
    return Promise.reject(new Error('A save request is already in progress'));
  }

  return new Promise<File>((resolve, reject) => {
    const normalizedTargetExt = targetExt.toUpperCase();

    const fallbackId = window.setTimeout(() => {
      if (!embeddedSaveRequest || embeddedSaveRequest.settled) {
        return;
      }

      const { file, fileName } = getDocmentObj() || {};
      const originalExt = getFileExtension(fileName || file?.name || '');

      if (options.returnOriginalOnTimeout && file && originalExt === normalizedTargetExt) {
        const request = embeddedSaveRequest;
        cleanupEmbeddedSaveRequest(request);
        resolveEmbeddedSaveRequest(request, getNormalizedFile(file));
      }
    }, 8000);

    // Generous on purpose: on a slow link the very first save (or a save
    // requested right after open) also pays for the ~10 MB x2t.wasm.gz fetch
    // and the document import; measured 26-50 s from a mainland connection to
    // the CDN edge, which used to trip the old 60 s cap while the stream was
    // still on its way. Failures no longer need the timeout to surface: an
    // open-conversion failure rejects the request immediately
    // (installOpenFailureGuard).
    const timeoutId = window.setTimeout(() => {
      if (!embeddedSaveRequest) {
        return;
      }
      const request = embeddedSaveRequest;
      cleanupEmbeddedSaveRequest(request);
      rejectEmbeddedSaveRequest(request, new Error('Save request timed out before receiving edited file data'));
    }, SAVE_REQUEST_TIMEOUT_MS);

    embeddedSaveRequest = {
      targetExt: normalizedTargetExt,
      resolve,
      reject,
      timeoutId,
      fallbackId,
      settled: false,
    };

    const editor = window.editor;
    if (!editor || typeof editor.downloadAs !== 'function') {
      const request = embeddedSaveRequest;
      cleanupEmbeddedSaveRequest(request);
      rejectEmbeddedSaveRequest(request, new Error('The current editor does not support downloadAs export'));
      return;
    }

    // embeddedSaveRequest above is armed synchronously (so a concurrent call
    // still sees "already in progress" immediately). The export itself is
    // asynchronous: an asc_DownloadAs that fires before the editor finished
    // importing the document is silently dropped by the SDK, and a cold
    // editor boot can take a long time (observed in headless CI / first
    // preview visits). onDocumentReady is a dependable signal
    // (createPersonalEditorInstance wires it), so wait for it -- capped
    // below the request's own 60 s timeout so the trigger still gets a
    // window to fire -- then retry until the SDK reports full readiness
    // (see triggerPersonalDownloadAs) or the request settles.
    const downloadAs = editor.downloadAs.bind(editor);
    const request = embeddedSaveRequest;
    void (async () => {
      await waitForDocumentContentReady(SAVE_READY_WAIT_MS);
      if (documentOpenError && request && !request.settled) {
        cleanupEmbeddedSaveRequest(request);
        rejectEmbeddedSaveRequest(request, new Error(`The document failed to open: ${documentOpenError}`));
        return;
      }
      const retryDeadline = Date.now() + SAVE_RETRY_WINDOW_MS;
      while (!request?.settled && !triggerPersonalDownloadAs(normalizedTargetExt)) {
        if (Date.now() > retryDeadline) {
          downloadAs(normalizedTargetExt);
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    })();
  });
}

export function loadEditorApi(): Promise<void> {
  return new Promise((resolve, reject) => {
    // Check if already loaded
    if (window.DocsAPI) {
      resolve();
      return;
    }

    // Load editor API
    const script = document.createElement('script');
    script.src = './web-apps/apps/api/documents/api.js';
    script.onload = () => resolve();
    script.onerror = (error) => {
      console.error('Failed to load OnlyOffice API:', error);
      alert(t('failedToLoadEditor'));
      reject(error);
    };
    document.head.appendChild(script);
  });
}
