import { getDocmentObj } from '@ranuts/shared/store';
import { t } from '@ranuts/shared/i18n';
import { X2TConverter, saveFileToDisk } from '@ranuts/converter';
import { oAscFileType } from '../file-types';
import { getFileExtension, getNormalizedFile, getSavedFileMimeType } from './file-helpers';
import { getDocumentLifetimeSignal, getDocumentOpenError, waitForDocumentContentReady } from './open-state';
import { getReadonlyMode } from './readonly';
import { isEmbedMode } from '../embed-mode';
import { markDocumentSaved } from '../unsaved-guard';
import type { SaveOutcome } from '../save-target';
import { captureSavePoint, commitSavePoint } from './save-point';

/**
 * Notified when bytes actually reach the user's disk.
 *
 * Injected rather than imported: the history layer exports through this
 * module, so importing it back would close a cycle. Same shape as
 * setConverterCallbacks elsewhere in the app.
 */
let savedToDiskListener: (() => void) | null = null;

export function setSavedToDiskListener(listener: (() => void) | null): void {
  savedToDiskListener = listener;
}

/**
 * Optional writer that puts the bytes straight into the file the document came
 * from, instead of downloading a new copy (see lib/save-target.ts).
 *
 * Injected for the same reason as the listener above -- it needs the document's
 * identity, which lives in the history layer, and that layer exports through
 * this module. Returns the write outcome: cancellation stops without clearing dirty state,
 * and unavailable writers fall back to the download.
 */
let diskWriter: ((file: File) => Promise<SaveOutcome>) | null = null;

export function setDiskWriter(writer: ((file: File) => Promise<SaveOutcome>) | null): void {
  diskWriter = writer;
}

/**
 * The v9 save channel end to end: the request the caller holds, the export
 * trigger on the editor frame, and the 'onlyoffice-file-stream' message the
 * finished bytes come back on.
 */

type EmbeddedSaveRequest = {
  targetExt?: string;
  resolve: (file: File) => void;
  reject: (error: Error) => void;
  timeoutId: number;
  fallbackId: number;
  settled: boolean;
  claimed: boolean;
  isCurrent: () => boolean;
  signal: AbortSignal;
  onAbort: () => void;
};

let embeddedSaveRequest: EmbeddedSaveRequest | null = null;
// The SDK serializes synchronously inside asc_DownloadAs, then converts
// asynchronously. Only that invocation may claim the programmatic request;
// later toolbar saves must keep their own disk destination.
let triggeringSaveRequest: EmbeddedSaveRequest | null = null;

// requestSaveDocument budget. Readiness (onDocumentReady) may take long on a
// cold, slow link: the editor first downloads and inflates x2t.wasm
// (~10 MB) before it can import the document. The hard timeout stays above
// the readiness wait plus the export retry window so a slow-but-alive save
// still gets through; dead saves fail fast through documentOpenError.
export const SAVE_READY_WAIT_MS = 150_000;
export const SAVE_RETRY_WINDOW_MS = 25_000;
export const SAVE_REQUEST_TIMEOUT_MS = 180_000;

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
  request.signal.removeEventListener('abort', request.onAbort);
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

function standaloneExportState(win: Window, sequence = 0, request: EmbeddedSaveRequest | null = null) {
  const source = getDocmentObj();
  const editor = window.editor;
  const point = captureSavePoint();
  return {
    source,
    sequence,
    point,
    request,
    isCurrent: () =>
      getDocmentObj() === source &&
      window.editor === editor &&
      document.querySelector<HTMLIFrameElement>('iframe[name="frameEditor"]')?.contentWindow === win,
  };
}
const readyExports = new WeakMap<Window, Array<ReturnType<typeof standaloneExportState>>>();
const diskWrites = new WeakMap<object, Promise<void>>();
const exportSequences = new WeakMap<object, number>();
const writtenSequences = new WeakMap<object, number>();

/** Bind serialized bytes to their conversion, then queue them in actual stream order. */
export function installSaveStreamTracking(win: Window): boolean {
  type Result = { binary: object };
  type Converter = {
    convertFromBin(request: unknown): Promise<Result>;
    downloadFile(binary: object, fileName: string): void;
    __ooSaveStreamTracked?: boolean;
  };
  const converter = (win as Window & { AscCommon?: { x2t?: Converter } }).AscCommon?.x2t;
  if (!converter?.convertFromBin || !converter.downloadFile) return false;
  if (converter.__ooSaveStreamTracked) return true;
  const outputs = new WeakMap<object, ReturnType<typeof standaloneExportState>>();
  const convert = converter.convertFromBin;
  const download = converter.downloadFile;
  converter.convertFromBin = function (input) {
    // The SDK has just synchronously serialized its history into input.binary.
    // isLongAction ends before this promise settles, so it cannot identify saves.
    const source = getDocmentObj();
    const sequence = (exportSequences.get(source) ?? 0) + 1;
    exportSequences.set(source, sequence);
    const candidate = triggeringSaveRequest;
    const request = candidate && !candidate.claimed && candidate.isCurrent() ? candidate : null;
    if (request) request.claimed = true;
    const state = standaloneExportState(win, sequence, request);
    return convert.call(this, input).then((result) => {
      if (result?.binary && typeof result.binary === 'object') outputs.set(result.binary, state);
      return result;
    });
  };
  converter.downloadFile = function (binary, fileName) {
    const state = outputs.get(binary) ?? { ...standaloneExportState(win), point: null };
    outputs.delete(binary);
    const ready = readyExports.get(win) ?? [];
    ready.push(state);
    readyExports.set(win, ready);
    download.call(this, binary, fileName);
  };
  converter.__ooSaveStreamTracked = true;
  return true;
}

function routeSavedFile(file: File, state: ReturnType<typeof standaloneExportState>): void {
  if (!state.isCurrent()) return;
  if (state.request) {
    const request = state.request;
    if (request !== embeddedSaveRequest || request.settled) return;
    if (!ensureCurrentSaveRequest(request)) return;
    cleanupEmbeddedSaveRequest(request);
    resolveEmbeddedSaveRequest(request, file);
    return;
  }

  if (isEmbedMode()) {
    console.warn('Local save is disabled in iframe embed mode. Use document:save from the parent page.');
    return;
  }

  // Only ordinary saves reuse the linked document destination. Other formats
  // use independent export pickers and must not suppress each other's output.
  const regularSave = getFileExtension(file.name) === getFileExtension(state.source.fileName);

  const reachedDisk = (): void => {
    // Reaching the user's disk is the only thing that clears the unsaved-changes
    // warning: an autosave snapshot lives in this browser, a saved file does not.
    if (regularSave)
      writtenSequences.set(state.source, Math.max(writtenSequences.get(state.source) ?? 0, state.sequence));
    if (state.isCurrent() && commitSavePoint(state.point)) {
      markDocumentSaved();
      savedToDiskListener?.();
    }
  };

  // Write back to the document's own file where that is possible, and download
  // a copy where it is not. Both end in the same place from the app's point of
  // view: the bytes are on the user's disk.
  const write = async (): Promise<void> => {
    try {
      // A queued save may outlive the document that requested it.
      if (!state.isCurrent()) return;
      // Conversions can finish out of order as well as writes. Once a newer
      // export reached disk, an older late result must never replace it.
      if (regularSave && (writtenSequences.get(state.source) ?? 0) > state.sequence) return;
      const outcome = await diskWriter?.(file);
      if (outcome === 'cancelled') return;
      if (outcome === 'written') {
        reachedDisk();
        return;
      }
      if (await saveFileToDisk(file, file.name)) reachedDisk();
    } catch (error) {
      notifyOperationFailed(error);
    }
  };
  // File System Access can keep several writable streams open. Preserve save
  // order so a slow older close cannot overwrite a newer committed file.
  const pending = (diskWrites.get(state.source) ?? Promise.resolve()).then(write);
  diskWrites.set(state.source, pending);
  void pending.finally(() => {
    if (diskWrites.get(state.source) === pending) diskWrites.delete(state.source);
  });
}

function handleFileStreamMessage(event: MessageEvent): void {
  // Exported bytes may reach an already-authorized file handle. Only the
  // current vendor frame may supply them, never a host, opener or sibling.
  const editorFrame = document.querySelector<HTMLIFrameElement>('iframe[name="frameEditor"]');
  if (event.origin !== window.location.origin || !editorFrame || event.source !== editorFrame.contentWindow) {
    return;
  }
  const data = event.data as FileStreamMessage | undefined;
  if (!data || data.type !== 'onlyoffice-file-stream' || !(data.buffer instanceof ArrayBuffer)) {
    return;
  }

  const buffer = data.buffer;
  const win = editorFrame.contentWindow!;
  const ready = readyExports.get(win);
  const state = ready?.shift() ?? { ...standaloneExportState(win), point: null };
  if (!ready?.length) readyExports.delete(win);
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
  const requestedExt = state.request?.targetExt;
  const wantsCsvBack =
    ext === 'xlsx' &&
    (requestedExt === 'CSV' || (requestedExt === undefined && !!docName?.toLowerCase().endsWith('.csv')));
  if (wantsCsvBack) {
    void (async () => {
      try {
        sheetJsConverter ??= new X2TConverter();
        const csvBytes = await sheetJsConverter.xlsxToCsvBytes(new Uint8Array(buffer));
        routeSavedFile(new File([csvBytes], `${baseName}.csv`, { type: 'text/csv' }), state);
      } catch (error) {
        console.error('Failed to convert saved XLSX back to CSV, keeping XLSX:', error);
        routeSavedFile(new File([buffer], `${baseName}.xlsx`, { type: getSavedFileMimeType('a.xlsx') }), state);
      }
    })();
    return;
  }

  const savedName = `${baseName}.${ext}`;
  routeSavedFile(new File([buffer], savedName, { type: getSavedFileMimeType(savedName) }), state);
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
function triggerPersonalDownloadAs(targetExt: string, request: EmbeddedSaveRequest): boolean {
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
            isLongAction?: () => boolean;
          }
        | undefined;
      if (api && typeof api.asc_DownloadAs === 'function' && AscNs?.asc_CDownloadOptions) {
        // onDocumentReady fires while the full API bundle (sdk-all.js) may
        // still be loading on a cold cache; an export fired in that window
        // crashes inside the SDK's font collector ("Cannot read properties
        // of undefined (reading 'forEach')") or is silently dropped. Only
        // fire once the SDK itself reports full readiness -- the caller's
        // retry loop keeps polling until then.
        if (!api.isLoadFullApi || !api.isDocumentLoadComplete || api.isLongAction?.()) return false;
        // The readiness callback and guard-install retry can race on a cold
        // load. Never start an export whose conversion cannot carry its owner.
        if (!installSaveStreamTracking(window.frames[i])) return false;
        runRequestedExport(request, () => api.asc_DownloadAs!(new AscNs.asc_CDownloadOptions!(code)));
        return true;
      }
    } catch {
      // cross-origin frame or editor not booted yet -- keep looking
    }
  }
  return false;
}

function ensureCurrentSaveRequest(request: EmbeddedSaveRequest): boolean {
  if (request.settled) return false;
  if (request.isCurrent()) return true;
  cleanupEmbeddedSaveRequest(request);
  rejectEmbeddedSaveRequest(request, new DOMException('Document changed before save completed', 'AbortError'));
  return false;
}

function runRequestedExport(request: EmbeddedSaveRequest, action: () => void): void {
  if (!ensureCurrentSaveRequest(request)) return;
  triggeringSaveRequest = request;
  try {
    action();
  } finally {
    triggeringSaveRequest = null;
  }
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

  if (getReadonlyMode()) {
    return Promise.reject(new Error('Current document is readonly'));
  }

  const openError = getDocumentOpenError();
  if (openError) {
    return Promise.reject(new Error(`The document failed to open: ${openError}`));
  }

  if (embeddedSaveRequest) {
    return Promise.reject(new Error('A save request is already in progress'));
  }

  const source = getDocmentObj();
  const editor = window.editor;
  const signal = getDocumentLifetimeSignal();
  if (signal.aborted) return Promise.reject(signal.reason);

  return new Promise<File>((resolve, reject) => {
    const normalizedTargetExt = targetExt.toUpperCase();

    const fallbackId = window.setTimeout(() => {
      if (!ensureCurrentSaveRequest(request)) return;

      const { file, fileName } = source;
      const originalExt = getFileExtension(fileName || file?.name || '');

      if (options.returnOriginalOnTimeout && file && originalExt === normalizedTargetExt) {
        cleanupEmbeddedSaveRequest(request);
        resolveEmbeddedSaveRequest(request, getNormalizedFile(file));
      }
    }, 8000);

    // Generous on purpose: on a slow link the very first save (or a save
    // requested right after open) also pays for the ~10 MB x2t.wasm fetch
    // and the document import; measured 26-50 s from a mainland connection to
    // the CDN edge, which used to trip the old 60 s cap while the stream was
    // still on its way. Failures no longer need the timeout to surface: an
    // open-conversion failure rejects the request immediately
    // (installOpenFailureGuard).
    const timeoutId = window.setTimeout(() => {
      if (!ensureCurrentSaveRequest(request)) return;
      cleanupEmbeddedSaveRequest(request);
      rejectEmbeddedSaveRequest(request, new Error('Save request timed out before receiving edited file data'));
    }, SAVE_REQUEST_TIMEOUT_MS);

    const request: EmbeddedSaveRequest = {
      targetExt: normalizedTargetExt,
      resolve,
      reject,
      timeoutId,
      fallbackId,
      settled: false,
      claimed: false,
      signal,
      isCurrent: () => !signal.aborted && getDocmentObj() === source && window.editor === editor,
      onAbort: () => {
        cleanupEmbeddedSaveRequest(request);
        rejectEmbeddedSaveRequest(request, signal.reason);
      },
    };
    embeddedSaveRequest = request;
    signal.addEventListener('abort', request.onAbort, { once: true });

    if (!editor || typeof editor.downloadAs !== 'function') {
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
    // below the request's own timeout so the trigger still gets a
    // window to fire -- then retry until the SDK reports full readiness
    // (see triggerPersonalDownloadAs) or the request settles.
    const downloadAs = editor.downloadAs.bind(editor);
    void (async () => {
      await waitForDocumentContentReady(SAVE_READY_WAIT_MS, signal);
      if (!ensureCurrentSaveRequest(request)) return;
      const failure = getDocumentOpenError();
      if (failure && request && !request.settled) {
        cleanupEmbeddedSaveRequest(request);
        rejectEmbeddedSaveRequest(request, new Error(`The document failed to open: ${failure}`));
        return;
      }
      const retryDeadline = Date.now() + SAVE_RETRY_WINDOW_MS;
      while (ensureCurrentSaveRequest(request) && !triggerPersonalDownloadAs(normalizedTargetExt, request)) {
        if (Date.now() > retryDeadline) {
          runRequestedExport(request, () => downloadAs(normalizedTargetExt));
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    })().catch((error: Error) => {
      cleanupEmbeddedSaveRequest(request);
      rejectEmbeddedSaveRequest(request, error);
    });
  });
}

/**
 * A conversion that failed *after* the document was open is a failed export,
 * not a failed open: the SDK reports it through asc_onError itself, and all
 * that is left to do is stop the pending save from waiting out its timeout.
 */
export function failPendingSaveConversion(message: string): void {
  const request = embeddedSaveRequest;
  if (!request || request.settled) return;
  cleanupEmbeddedSaveRequest(request);
  rejectEmbeddedSaveRequest(request, new Error(`Save conversion failed: ${message}`));
}
