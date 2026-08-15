import 'ranui/message';
import { getDocmentObj } from '@ranuts/shared/store';
import { getOnlyOfficeLang, t } from '@ranuts/shared/i18n';
import { oAscFileType } from './file-types';
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
  win.addEventListener('unhandledrejection', (event) => {
    const reason = (event as PromiseRejectionEvent).reason as { message?: unknown } | undefined;
    const message = String(reason && typeof reason === 'object' ? (reason.message ?? reason) : reason);
    if (!OPEN_FAILURE_PATTERN.test(message)) return;
    console.error('[OO] open conversion failed:', message);
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
        style.textContent = '#header-logo, .btn-current-user, #tlb-box-users { display: none !important; }';
        (doc.head || doc.documentElement).appendChild(style);
      }

      if (!win.__ooSharedWorkerShadowed) {
        Object.defineProperty(win, 'SharedWorker', { value: undefined, configurable: true });
        win.__ooSharedWorkerShadowed = true;
        console.log('[OO] SharedWorker shadowed in editor iframe (spellchecker uses a dedicated worker)');
      }

      // 3. Guard the vendor build's AscCommon.fetchFonts: it reads
      //    AscFonts.g_font_infos.forEach unconditionally, but on a cold
      //    profile the open-document conversion can run before the font
      //    system has populated that array, crashing the conversion
      //    ("Cannot read properties of undefined (reading 'forEach')") and
      //    leaving the document permanently half-open. Import conversions
      //    don't need fonts, so report "no fonts" until the font system is
      //    up; exports (PDF) happen much later, when it always is.
      const ooWin = win as unknown as {
        AscCommon?: { fetchFonts?: (cb: (fonts: unknown[]) => void) => unknown };
        AscFonts?: { g_font_infos?: unknown };
        __ooFetchFontsGuarded?: boolean;
      };
      if (ooWin.AscCommon && typeof ooWin.AscCommon.fetchFonts === 'function' && !ooWin.__ooFetchFontsGuarded) {
        const origFetchFonts = ooWin.AscCommon.fetchFonts;
        ooWin.AscCommon.fetchFonts = function (cb: (fonts: unknown[]) => void) {
          if (!ooWin.AscFonts || !Array.isArray(ooWin.AscFonts.g_font_infos)) {
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

      if (
        win.__ooSharedWorkerShadowed &&
        ooWin.__ooFetchFontsGuarded &&
        imgWin.__ooImagePipelinePatched &&
        saveWin.__ooServerlessSavePatched
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
      lang: editorLang,
      user: {
        id: 'local-user',
        name: 'Guest',
      },
      customization: {
        help: false,
        about: false,
        hideRightMenu: true,
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
        const detail = [code !== undefined ? `code ${code}` : '', data?.errorDescription].filter(Boolean).join(', ');
        (window as unknown as { message?: { error?: (msg: string) => void } }).message?.error?.(
          `${t('editorErrorToast')}${detail ? ` (${detail})` : ''}${hint}`,
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
}): Promise<void> {
  return queueEditorOperation(async () => {
    const { fileName, fileType, binData, readonly = false } = config;
    isReadonlyMode = readonly;

    // Check if there's an existing editor that needs cleanup
    const hasExistingEditor = !!window.editor;

    // Clean up old editor instance properly
    if (window.editor) {
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

// Asc.c_oAscRestrictionType values (public SDK enum).
const ASC_RESTRICTION_NONE = 0;
const ASC_RESTRICTION_VIEW = 128;

type SdkEditorApi = {
  asc_setRestriction?: (value: number) => void;
  asc_removeRestriction?: (value: number) => void;
};

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

    const timeoutId = window.setTimeout(() => {
      if (!embeddedSaveRequest) {
        return;
      }
      const request = embeddedSaveRequest;
      cleanupEmbeddedSaveRequest(request);
      rejectEmbeddedSaveRequest(request, new Error('Save request timed out before receiving edited file data'));
    }, 60000);

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
      await waitForDocumentContentReady(45_000);
      if (documentOpenError && request && !request.settled) {
        cleanupEmbeddedSaveRequest(request);
        rejectEmbeddedSaveRequest(request, new Error(`The document failed to open: ${documentOpenError}`));
        return;
      }
      const retryDeadline = Date.now() + 45_000;
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
