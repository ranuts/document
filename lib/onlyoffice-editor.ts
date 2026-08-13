import 'ranui/message';
import { createObjectURL } from 'ranuts/utils';
import { getDocmentObj } from '@ranuts/shared/store';
import { getOnlyOfficeLang, t } from '@ranuts/shared/i18n';
import { c_oAscFileType2, oAscFileType } from './file-types';
import type { BinConversionResult, SaveEvent } from '@ranuts/shared/document-types';
import { DOCUMENT_TYPE_MAP, getMimeTypeFromExtension } from '@ranuts/shared/document-utils';
import { X2TConverter } from '@ranuts/converter';

// Selected via `vite --mode v9` / `vite build --mode v9` (see vite.config.ts); defaults
// to v7 for the normal dev/build/test commands. See docs/explorations for why v9 needs
// a materially different document-loading path (Web Mode) instead of a small config diff.
export const OO_VARIANT: 'v7' | 'v9' = import.meta.env.MODE === 'v9' ? 'v9' : 'v7';

// v9.3.0 renamed sendCommand -> serviceCommand. Try serviceCommand first so this
// works unchanged on both versions instead of gating every call site on OO_VARIANT.
function editorSendCommand(params: { command: string; data: Record<string, any> }): void {
  const editor = window.editor as any;
  if (!editor) return;
  if (typeof editor.serviceCommand === 'function') {
    editor.serviceCommand(params);
  } else if (typeof editor.sendCommand === 'function') {
    editor.sendCommand(params);
  }
}

// Import converter function to avoid circular dependency
type ConvertBinFn = (
  bin: Uint8Array,
  fileName: string,
  targetExt?: string,
  media?: Record<string, string>,
) => Promise<BinConversionResult>;
let convertBinToDocumentFn: ConvertBinFn | null = null;
let convertBinToDocumentAndDownloadFn: ConvertBinFn | null = null;

export function setConverterCallbacks(callbacks: { convert: ConvertBinFn; convertAndDownload: ConvertBinFn }): void {
  convertBinToDocumentFn = callbacks.convert;
  convertBinToDocumentAndDownloadFn = callbacks.convertAndDownload;
}

// Global media mapping object
const media: Record<string, string> = {};

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

// v9 Web Mode only: asc_openDocumentFromBytes returns before the engine has
// finished internal setup (fonts load asynchronously; a class the save path
// depends on -- the cell engine's `za` metadata handler, at minimum -- is
// only constructed once that finishes, ~5-6s after open in testing). Calling
// editor.downloadAs() (requestSaveDocument's own save path) that early either
// crashes deep inside the SDK ("Cannot read properties of null (reading
// 'P_g')") or, worse, silently produces no response at all if the DocEditor
// wrapper's own postMessage handshake with the iframe isn't ready yet either
// -- reliably reproduced by calling document:save immediately after
// document:opened via the embed API, since a scripted parent has no natural
// "give the user a few seconds to look at it" delay the way a human clicking
// Save does. asc_onDocumentContentReady fires right around when the engine
// actually becomes ready (confirmed via live timing: e.g. za set at
// +6033ms, asc_onDocumentContentReady at +6097ms), so gate on it instead of
// assuming readiness. v7 never sets this true (no Web Mode init path calls
// markDocumentContentReady), so it must default true there or every v7 save
// would eat a pointless 15s timeout.
let documentContentReady = OO_VARIANT !== 'v9';
let contentReadyWaiters: Array<() => void> = [];

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
  contentReadyWaiters = [];
}

// Resolves immediately if already ready; otherwise waits for
// markDocumentContentReady() (or a safety-net timeout -- see
// runWebModeOnAppReady) so callers never hang forever.
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
  const extension = fileName.split('.').pop()?.toLowerCase() || '';
  const mimeMap: Record<string, string> = {
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    doc: 'application/msword',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    xls: 'application/vnd.ms-excel',
    csv: 'text/csv',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ppt: 'application/vnd.ms-powerpoint',
    pdf: 'application/pdf',
  };
  return mimeMap[extension] || 'application/octet-stream';
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

/**
 * Base64-encode binary data in chunks (avoids blowing the call stack on
 * String.fromCharCode(...bytes) for large documents).
 *
 * asc_openDocument's `buf` is sent to OnlyOffice's internal editor iframe via
 * window.postMessage. Some embedding hosts (e.g. Qt WebEngine, see #113) have
 * been observed losing ArrayBuffer/TypedArray contents across that boundary,
 * which OnlyOffice then can't recognize as a valid document and reports as a
 * format mismatch. A base64 string survives postMessage/structured-clone
 * universally, so we send that instead -- the same approach already used for
 * the empty "new document" template in empty_bin.ts.
 */
function toBase64(bytes: Uint8Array): string {
  const CHUNK_SIZE = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK_SIZE));
  }
  return btoa(binary);
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

/**
 * Save a finished file to the user's disk: File System Access API when
 * available (native save dialog), plain anchor download otherwise.
 */
async function saveFileLocally(file: File): Promise<void> {
  const picker = (
    window as unknown as {
      showSaveFilePicker?: (opts: {
        suggestedName: string;
        types: Array<{ description: string; accept: Record<string, string[]> }>;
      }) => Promise<{
        createWritable: () => Promise<{ write: (d: Blob) => Promise<void>; close: () => Promise<void> }>;
      }>;
    }
  ).showSaveFilePicker;

  if (typeof picker !== 'function') {
    const url = await createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    }, 100);
    return;
  }

  try {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const mime = getSavedFileMimeType(file.name);
    const handle = await picker.call(window, {
      suggestedName: file.name,
      types: [{ description: 'Document', accept: { [mime]: [`.${ext}`] } }],
    });
    const writable = await handle.createWritable();
    await writable.write(file);
    await writable.close();
    (window as unknown as { message?: { success?: (msg: string) => void } }).message?.success?.(
      `${t('fileSavedSuccess')}${file.name}`,
    );
  } catch (error) {
    if ((error as Error).name === 'AbortError') return;
    (window as unknown as { message?: { error?: (msg: string) => void } }).message?.error?.(
      `${t('documentOperationFailed')}${error instanceof Error ? error.message : String(error)}`,
    );
  }
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

  void saveFileLocally(file);
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

if (OO_VARIANT === 'v9' && typeof window !== 'undefined') {
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

/**
 * Handle file write request (mainly for handling pasted images)
 * @param event - OnlyOffice editor file write event
 */
async function handleWriteFile(event: any) {
  try {
    console.log('Write file event:', event);

    const { data: eventData } = event;
    if (!eventData) {
      console.warn('No data provided in writeFile event');
      return;
    }

    const {
      data: imageData, // Uint8Array image data
      file: fileName, // File name, e.g., "display8image-174799443357-0.png"
      _target, // Target object containing frameOrigin and other info
    } = eventData;

    // Validate data
    if (!imageData || !(imageData instanceof Uint8Array)) {
      throw new Error('Invalid image data: expected Uint8Array');
    }

    if (!fileName || typeof fileName !== 'string') {
      throw new Error('Invalid file name');
    }

    // Extract extension from file name
    const fileExtension = fileName.split('.').pop()?.toLowerCase() || 'png';
    const mimeType = getMimeTypeFromExtension(fileExtension);

    // Create Blob object
    const blob = new Blob([imageData as unknown as BlobPart], { type: mimeType });

    // Create object URL
    const objectUrl = await createObjectURL(blob);
    // Add image URL to media mapping using original file name as key
    media[`media/${fileName}`] = objectUrl;
    editorSendCommand({
      command: 'asc_setImageUrls',
      data: {
        urls: media,
      },
    });

    editorSendCommand({
      command: 'asc_writeFileCallback',
      data: {
        // Image base64
        path: objectUrl,
        imgName: fileName,
      },
    });
    console.log(`Successfully processed image: ${fileName}, URL: ${media}`);
  } catch (error: any) {
    console.error('Error handling writeFile:', error);

    // Notify editor that file processing failed
    editorSendCommand({
      command: 'asc_writeFileCallback',
      data: {
        success: false,
        error: error.message,
      },
    });

    if (event.callback && typeof event.callback === 'function') {
      event.callback({
        success: false,
        error: error.message,
      });
    }
  }
}

// v7's onSave handler. v9 never registers this event -- its saves arrive as
// finished files over the onlyoffice-file-stream message instead (see
// handleFileStreamMessage).
async function handleSaveDocument(event: { data: SaveEvent['data'] }) {
  console.log('Save document event:', event);

  let binaryData: Uint8Array;
  let targetFormat: string;
  const { fileName } = getDocmentObj() || {};

  if (event.data?.data?.data) {
    const { data, option } = event.data;
    binaryData = data.data;
    // Only force CSV format if the original file is CSV. This check ensures XLSX
    // and other file types are not affected -- CSV files are converted to XLSX
    // internally, so the editor may return XLSX format for them.
    targetFormat = fileName?.toLowerCase().endsWith('.csv') ? 'CSV' : c_oAscFileType2[option.outputformat];
    console.log(`Saving as ${targetFormat} format (original file: ${fileName})`);
  } else {
    console.warn('handleSaveDocument: unrecognized event shape', typeof event.data);
    return;
  }

  if (embeddedSaveRequest) {
    if (!convertBinToDocumentFn) {
      throw new Error('Converter callback not set');
    }

    const request = embeddedSaveRequest;
    cleanupEmbeddedSaveRequest(request);

    try {
      const result = await convertBinToDocumentFn(binaryData, fileName, request.targetExt || targetFormat, media);
      const bytes = toUint8Array(result.data);
      const file = new File([bytes as BlobPart], result.fileName, { type: getSavedFileMimeType(result.fileName) });
      resolveEmbeddedSaveRequest(request, file);
    } catch (error) {
      rejectEmbeddedSaveRequest(request, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  } else if (isEmbedMode()) {
    console.warn('Local save is disabled in iframe embed mode. Use document:save from the parent page.');
  } else if (convertBinToDocumentAndDownloadFn) {
    try {
      await convertBinToDocumentAndDownloadFn(binaryData, fileName, targetFormat, media);
    } catch (error) {
      // Surface the failure to the user instead of leaving an uncaught
      // rejection with no UI feedback; still fall through so the editor's
      // save state is cleared below.
      console.error('Failed to convert and save document:', error);
      (window as unknown as { message?: { error?: (msg: string) => void } }).message?.error?.(
        `${t('documentOperationFailed')}${error instanceof Error ? error.message : String(error)}`,
      );
    }
  } else {
    throw new Error('Converter callback not set');
  }

  // Notify editor that save is complete
  editorSendCommand({
    command: 'asc_onSaveCallback',
    data: { err_code: 0 },
  });
}

async function handleDownloadAs(event: { data?: { url?: string; fileType?: string } }): Promise<void> {
  if (!embeddedSaveRequest) {
    console.warn('Local download is disabled in iframe embed mode. Use document:save from the parent page.');
    return;
  }

  const request = embeddedSaveRequest;
  cleanupEmbeddedSaveRequest(request);

  try {
    const url = event.data?.url;
    if (!url) {
      throw new Error('Download URL is empty');
    }

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch exported file: ${response.status} ${response.statusText}`);
    }

    const blob = await response.blob();
    const { fileName } = getDocmentObj() || {};
    const baseName = (fileName || 'document').replace(/\.[^/.]+$/, '');
    const ext = (request.targetExt || event.data?.fileType || 'XLSX').toLowerCase();
    const savedFileName = `${baseName}.${ext}`;
    const file = new File([blob], savedFileName, { type: blob.type || getSavedFileMimeType(savedFileName) });
    resolveEmbeddedSaveRequest(request, file);
  } catch (error) {
    rejectEmbeddedSaveRequest(request, error instanceof Error ? error : new Error(String(error)));
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
 */
function prepareEditorIframe(): void {
  for (let i = 0; i < window.frames.length; i++) {
    try {
      const win = window.frames[i] as Window & { __ooSharedWorkerShadowed?: boolean };
      const doc = win.document;
      if (!doc) continue;

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
    } catch {
      // cross-origin frame -- not the editor, skip
    }
  }
}

/**
 * v9 editor creation against the OnlyOffice Personal vendor build. Unlike the
 * old Web Mode path, this build is driven entirely through the public
 * DocEditor config: document.url is a real (blob) URL the editor fetches and
 * converts internally, saves come back over the 'onlyoffice-file-stream'
 * message (see handleFileStreamMessage), and no SDK-internal patching is
 * needed. `binData` as a string (the v7 empty-template constant) or an empty
 * buffer means "new document": the SDK creates a blank one when url is
 * undefined.
 */
function createPersonalEditorInstance(config: {
  fileName: string;
  fileType: string;
  binData: ArrayBuffer | string;
  readonly: boolean;
  editorLang: string;
}): void {
  const { fileName, fileType, binData, readonly, editorLang } = config;

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
        edit: !readonly,
        download: true,
        print: true,
        chat: false,
        protect: false,
      },
    },
    documentType: DOCUMENT_TYPE_MAP[normalizedType],
    editorConfig: {
      mode: readonly ? 'view' : 'edit',
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
        prepareEditorIframe();
        // The spell engine class registers with the SDK bundle, which can
        // land after onAppReady; keep re-applying (idempotent, cheap) so the
        // stub is in place before the document-load code spawns the worker.
        const timer = window.setInterval(prepareEditorIframe, 200);
        window.setTimeout(() => window.clearInterval(timer), 15_000);
      },
      onDocumentReady: () => {
        markDocumentContentReady();
        // Re-apply in case the header rendered after onAppReady.
        prepareEditorIframe();
        console.log(`${t('documentLoaded')}${fileName}`);
      },
      // Must be declared even as a no-op: the api layer only runs downloadAs
      // when this callback exists. Actual bytes arrive via the
      // onlyoffice-file-stream message, not through this event.
      onDownloadAs: () => {},
      onError: (event: unknown) => {
        console.error('[OO] editor error:', event);
      },
    },
  } as unknown as ConstructorParameters<typeof window.DocsAPI.DocEditor>[1]);
}

// Public editor creation method
export function createEditorInstance(config: {
  fileName: string;
  fileType: string;
  binData: ArrayBuffer | string;
  media?: any;
  readonly?: boolean;
}): Promise<void> {
  return queueEditorOperation(async () => {
    const { fileName, fileType, binData, media: mediaUrls, readonly = false } = config;
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

    if (OO_VARIANT === 'v9') {
      createPersonalEditorInstance({ fileName, fileType, binData, readonly, editorLang });
      return;
    }

    try {
      window.editor = new window.DocsAPI.DocEditor('iframe', {
        document: {
          title: fileName,
          url: fileName, // Use file name as identifier
          fileType: fileType,
          permissions: {
            edit: !readonly,
            download: !readonly,
            chat: false,
            protect: false,
          },
        },
        editorConfig: {
          lang: editorLang,
          // Always provide a non-empty user name. The SDK's getInitials() throws
          // on a blank name, which crashed preview/readonly mode for anonymous
          // users (#25). A default Guest user avoids that path.
          user: {
            id: 'guest',
            name: 'Guest',
          },
          customization: {
            help: false,
            about: false,
            hideRightMenu: true,
            features: {
              spellcheck: {
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
            // Set media resources
            if (mediaUrls) {
              editorSendCommand({
                command: 'asc_setImageUrls',
                data: { urls: mediaUrls },
              });
            }

            // Load document content. See toBase64() for why this is sent as a
            // base64 string rather than the raw ArrayBuffer/Uint8Array.
            const buf = typeof binData === 'string' ? binData : toBase64(toUint8Array(binData));
            editorSendCommand({
              command: 'asc_openDocument',
              data: { buf },
            });
          },
          onDocumentReady: () => {
            console.log(`${t('documentLoaded')}${fileName}`);
            // Note: For CSV files, the save dialog may show XLSX format,
            // but the actual save will be forced to CSV format in handleSaveDocument
          },
          onDownloadAs: handleDownloadAs,
          // writeFile
          // TODO: writeFile - handle when pasting images from external sources
          writeFile: handleWriteFile,
          onSave: handleSaveDocument,
        },
      });
    } catch (error) {
      console.error('Error creating editor instance:', error);
      throw error;
    }
  });
}

export function setReadonlyMode(readonly: boolean): void {
  isReadonlyMode = readonly;
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
    // still sees "already in progress" immediately). The ready case below
    // calls downloadAs() synchronously, same as before this gate existed
    // (tests assert this happens synchronously, and it's simply the normal
    // case for v7 and for v9 saves that aren't racing the initial open);
    // only the not-yet-ready case (v9 only) defers until
    // waitForDocumentContentReady resolves. See markDocumentContentReady.
    // v9 exports go straight through the editor iframe's asc_DownloadAs (see
    // triggerPersonalDownloadAs); v7 keeps the api-level downloadAs path.
    const downloadAs = editor.downloadAs.bind(editor);
    if (OO_VARIANT === 'v9') {
      // An asc_DownloadAs that fires before the editor finished importing the
      // document is silently dropped by the SDK, and a cold editor boot can
      // take well over the default ready-gate cap (observed in headless CI /
      // first preview visits). onDocumentReady is a dependable signal on v9
      // (createPersonalEditorInstance wires it), so wait for it with a cap
      // matching the request's own 60 s timeout, then retry the trigger
      // briefly in case the editor frame is still being attached.
      void (async () => {
        await waitForDocumentContentReady(60_000);
        // Keep retrying until the SDK reports full readiness (see
        // triggerPersonalDownloadAs) -- a cold cache can spend a long time
        // loading the full API bundle after onDocumentReady. The request's
        // own 60 s timeout is the overall bound.
        const retryDeadline = Date.now() + 45_000;
        while (!triggerPersonalDownloadAs(normalizedTargetExt)) {
          if (Date.now() > retryDeadline) {
            downloadAs(normalizedTargetExt);
            return;
          }
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      })();
    } else if (documentContentReady) {
      downloadAs(normalizedTargetExt);
    } else {
      void waitForDocumentContentReady().then(() => downloadAs(normalizedTargetExt));
    }
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
