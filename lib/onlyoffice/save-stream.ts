import { getDocmentObj } from '@ranuts/shared/store';
import { t } from '@ranuts/shared/i18n';
import { X2TConverter, saveFileToDisk } from '@ranuts/converter';
import { oAscFileType } from '../file-types';
import { getFileExtension, getNormalizedFile, getSavedFileMimeType } from './file-helpers';
import { getDocumentOpenError, waitForDocumentContentReady } from './open-state';
import { getReadonlyMode } from './readonly';

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
      const failure = getDocumentOpenError();
      if (failure && request && !request.settled) {
        cleanupEmbeddedSaveRequest(request);
        rejectEmbeddedSaveRequest(request, new Error(`The document failed to open: ${failure}`));
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
