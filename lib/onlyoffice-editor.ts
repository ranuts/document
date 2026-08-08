import 'ranui/message';
import { createObjectURL } from 'ranuts/utils';
import { getDocmentObj } from '@ranuts/shared/store';
import { getOnlyOfficeLang, t } from '@ranuts/shared/i18n';
import { c_oAscFileType2 } from './file-types';
import type { BinConversionResult, SaveEvent } from '@ranuts/shared/document-types';
import { BASE_PATH, getMimeTypeFromExtension } from '@ranuts/shared/document-utils';
import { extractDocxMediaUrls, preprocessPptx, preprocessXlsxLineBreaks } from '@ranuts/converter';
import { g_sEmpty_ooxml } from './empty_bin-v9';
import { showMediaPlayer } from './media-player';

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

/**
 * v9 Web Mode has no real collaboration server, so the SDK's "Connection is lost"
 * dialog (and its generic error dialog) fire on every load. Both go through
 * Common.UI.alert, not .warning, despite the message reading like a warning.
 * Called with same-origin access to the editor iframe's window from onAppReady.
 *
 * app.js chains `Common.UI.alert(o).$window.attr(...)` in its own error handler, so
 * returning undefined from our patched alert() throws downstream -- return a
 * chainable no-op dialog instead.
 */
function suppressDialogsInFrame(frameWindow: any): void {
  // The SDK localizes these messages, so matching by English substring only
  // catches the en-US UI. Add the translation here as each locale is verified
  // against a live editor (see docs/explorations for how this list grew) --
  // matching by Asc.c_oAscError.ID would be more robust than message text, but
  // the error object passed to Common.UI.alert/warning wasn't confirmed to
  // carry that code through to opts. zh-CN confirmed 2026-08-05.
  const SUPPRESSED_MSGS = [
    'Connection is lost',
    'error occurred during the work',
    '使用文档时出错', // zh-CN: "An error occurred while working with the document"
    '连接失败', // zh-CN: "Connection failed. You can still view the document..." (a second,
    // distinct dialog from the one above -- same underlying CoAuthoringDisconnect
    // event, different message. See suppressCoAuthoringDisconnect for why the
    // dialog is only half the problem.)
  ];
  const shouldSuppress = (opts: any): boolean => {
    const msg: string = opts?.msg ?? '';
    return typeof msg === 'string' && SUPPRESSED_MSGS.some((s) => msg.indexOf(s) !== -1);
  };

  const jq: Record<string, unknown> = {};
  [
    'attr',
    'on',
    'off',
    'show',
    'hide',
    'css',
    'addClass',
    'removeClass',
    'find',
    'remove',
    'val',
    'text',
    'html',
    'prop',
    'data',
    'trigger',
    'focus',
    'blur',
    'one',
    'click',
  ].forEach((m) => {
    jq[m] = () => jq;
  });
  (jq as any).length = 0;
  const MOCK_DIALOG = { $window: jq, close: () => {}, show: () => {}, hide: () => {}, remove: () => {} };

  let attempts = 0;
  const poll = () => {
    const ui = frameWindow.Common?.UI;
    if (ui?.__dlgSuppressed) return;
    if (!ui || typeof ui.warning !== 'function' || typeof ui.alert !== 'function') {
      if (attempts++ < 50) setTimeout(poll, 200);
      return;
    }
    ui.__dlgSuppressed = true;

    const origWarning = ui.warning.bind(ui);
    ui.warning = (opts: any) => (shouldSuppress(opts) ? MOCK_DIALOG : origWarning(opts));

    const origAlert = ui.alert.bind(ui);
    ui.alert = (opts: any) => (shouldSuppress(opts) ? MOCK_DIALOG : origAlert(opts));

    console.log('[OO] dialog suppression active in iframe (warning + alert)');
  };
  poll();
}

/**
 * v9 Web Mode's fake Engine.IO handshake doesn't implement real ping/pong
 * keep-alive, so the SDK eventually decides the collaboration connection has
 * dropped and fires asc_onCoAuthoringDisconnect / the "api:disconnect"
 * notification. Every editor's Main controller listens for both and responds
 * by *hiding* the Download/Print/Edit header buttons (see
 * onApiCoAuthoringDisconnect in app.js) -- suppressing the dialog alone still
 * leaves Save/Print/Download disabled. Common.NotificationCenter is a
 * Backbone Events bus; swallowing this one event name here (from onAppReady,
 * before any real disconnect can have been detected yet) stops that specific
 * side effect without touching the dialog suppression above.
 */
function suppressCoAuthoringDisconnect(frameWindow: any): void {
  let attempts = 0;
  const poll = () => {
    const center = frameWindow.Common?.NotificationCenter;
    if (!center || typeof center.trigger !== 'function') {
      if (attempts++ < 50) setTimeout(poll, 200);
      return;
    }
    if (center.__disconnectSuppressed) return;
    center.__disconnectSuppressed = true;

    const origTrigger = center.trigger.bind(center);
    center.trigger = (name: string, ...args: unknown[]) => {
      if (name === 'api:disconnect') return center;
      return origTrigger(name, ...args);
    };
    console.log('[OO] api:disconnect notification suppressed in iframe');
  };
  poll();
}

/**
 * Common.Controllers.Desktop.systemThemeSupported()/-Type() read a "theme"
 * field off a config object (r.theme) that a real native desktop host
 * populates via Desktop.init(); our AscDesktopEditor polyfill makes
 * Desktop.isActive() report true without ever providing that config, so the
 * very first UI pass that renders the theme picker crashes with "Cannot read
 * properties of undefined (reading 'theme')" (confirmed live -- leaves that
 * toolbar area blank, see the "changesError" console entry).
 *
 * Worse than cosmetic: this crash fires from inside an
 * asc_onStartAction/asc_onEndAction pair, so the exception skips the matching
 * end-action and permanently leaks AscCommon.Uc's start/end-action nesting
 * counter by one. Once that counter is nonzero, AscCommon.Uc.Tra() is true --
 * the first guard in every document-mutation restriction check (Cf -> ugb),
 * so ALL edits silently stop working, not just this theme UI: confirmed live
 * that typing into a fresh document does nothing while the counter is stuck,
 * and works again as soon as it's back to 0. Guarding these two methods so
 * the exception never escapes fixes both the blank UI and the stuck counter.
 */
function patchDesktopThemeCrash(frameWindow: any): void {
  let attempts = 0;
  const poll = () => {
    const desktop = frameWindow.Common?.Controllers?.Desktop;
    if (!desktop || typeof desktop.systemThemeSupported !== 'function') {
      if (attempts++ < 50) setTimeout(poll, 200);
      return;
    }
    if (desktop.__themeCrashPatched) return;
    desktop.__themeCrashPatched = true;

    const origSupported = desktop.systemThemeSupported.bind(desktop);
    desktop.systemThemeSupported = () => {
      try {
        return origSupported();
      } catch {
        return false;
      }
    };
    if (typeof desktop.systemThemeType === 'function') {
      const origType = desktop.systemThemeType.bind(desktop);
      desktop.systemThemeType = () => {
        try {
          return origType();
        } catch {
          return 'light';
        }
      };
    }
    console.log('[OO] Desktop.systemThemeSupported/-Type crash-guarded in iframe');
  };
  poll();
}

/**
 * v9 Web Mode has no working UI flow to complete the SDK's normal "download as
 * PDF" settings dialog (no real collaboration server behind it, same root cause
 * as everything else this file works around). onDownloadAs (app.js) detours
 * PDF/PDFA specifically to a Common.NotificationCenter 'download:settings'
 * event instead of calling asc_DownloadAs directly -- a real user would see a
 * page/print-range dialog with its own "Download" button. Intercept that event
 * and call the offline-save-trigger-patched asc_DownloadAs ourselves instead of
 * letting the (non-functional here) dialog open. Must run after the Ncj/DOj/mTi
 * patch below has replaced asc_DownloadAs, since it reads api.asc_DownloadAs at
 * call time (not capture time), so ordering between the two patches doesn't
 * matter as long as both are in place before a save is actually requested.
 */
function suppressDownloadSettingsDialog(frameWindow: any): void {
  let attempts = 0;
  const poll = () => {
    const center = frameWindow.Common?.NotificationCenter;
    if (!center || typeof center.trigger !== 'function') {
      if (attempts++ < 50) setTimeout(poll, 200);
      return;
    }
    if (center.__downloadSettingsSuppressed) return;
    center.__downloadSettingsSuppressed = true;

    const origTrigger = center.trigger.bind(center);
    center.trigger = (name: string, ...args: unknown[]) => {
      if (name === 'download:settings') {
        (frameWindow.Asc?.editor as any)?.asc_DownloadAs?.();
        return center;
      }
      return origTrigger(name, ...args);
    };
    console.log('[OO] download:settings dialog bypassed in iframe');
  };
  poll();
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

async function handleSaveDocument(event: { data: SaveEvent['data'] | ArrayBuffer }) {
  console.log('Save document event:', event);

  // v9's onSaveDocument fires with event.data as a raw ArrayBuffer (transferred
  // straight over postMessage). v7's onSave fires with the nested
  // { data: { data: Uint8Array }, option: { outputformat } } shape instead.
  let binaryData: Uint8Array;
  let targetFormat: string;
  const { fileName } = getDocmentObj() || {};

  if (event.data instanceof ArrayBuffer) {
    binaryData = new Uint8Array(event.data);
    const ext = (fileName?.split('.').pop() || 'docx').toUpperCase();
    targetFormat = fileName?.toLowerCase().endsWith('.csv') ? 'CSV' : ext;
    console.log(`Saving v9 binary ${binaryData.byteLength} bytes as ${targetFormat} format`);
  } else if (event.data?.data?.data) {
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
    await convertBinToDocumentAndDownloadFn(binaryData, fileName, targetFormat, media);
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

/**
 * v9 Web Mode has no document server, so `asc_openDocument`'s postMessage-based
 * `buf` transport doesn't apply -- the SDK's own OOXML importer is invoked
 * directly via `asc_openDocumentFromBytes` on the (same-origin) editor iframe's
 * `Asc.editor`, bypassing x2t entirely for the open path (x2t is still used for
 * saving/exporting, via convertBinToDocumentFn as before).
 *
 * This is a faithful port of the "Web Mode" implementation validated in
 * docs/explorations/2026-06-19-word-excel-ppt-browser-debug.md against the exact
 * SDK build vendored in public-v9/ -- the internal function names it patches
 * (Shc/BRj/Mrc/rxk/K8b/Fzj, Aqg/LNg/rdg) are minified symbols specific to that
 * build. Don't "clean this up" without re-verifying against the real SDK: every
 * step here works around a specific, debugged failure mode, not a style choice.
 */
async function runWebModeOnAppReady(params: {
  fileName: string;
  fileType: string;
  binData: ArrayBuffer | string;
  mediaUrls: Record<string, string> | undefined;
}): Promise<void> {
  const { fileName, fileType, binData, mediaUrls } = params;

  (window as unknown as Record<string, unknown>).__mediaCache = mediaUrls ?? {};
  // Bridge for the iframe's AddImageUrl patch (public-v9/onlyoffice-iframe-patch.js,
  // section 3) to register a resolved remote-image blob into the SAME `media` map
  // handleWriteFile uses, so requestSaveDocument's convertBinToDocumentFn call
  // writes real bytes for it instead of x2t fetching the (nonexistent, dev-server
  // 404) '/media/<path>' URL over HTTP. __mediaCache above is a separate map used
  // only for on-screen <img> redirect and is not visible to the converter.
  (window as unknown as Record<string, unknown>).__registerSaveMedia = (path: string, blobUrl: string) => {
    media[path] = blobUrl;
  };

  const iframeEl = document.querySelector('iframe') as HTMLIFrameElement | null;
  const iwin = iframeEl?.contentWindow as any;
  const api = iwin?.Asc?.editor;
  console.log('[OO] onAppReady', { hasIframe: !!iframeEl, hasApi: !!api });

  // Reliable path for "Connection is lost" / EditingError dialogs -- more
  // reliable than trying to inject this from outside the iframe beforehand.
  if (iwin) {
    suppressDialogsInFrame(iwin);
    suppressCoAuthoringDisconnect(iwin);
    patchDesktopThemeCrash(iwin);
  }

  if (typeof api?.asc_openDocumentFromBytes !== 'function') {
    // SDK didn't expose the Web Mode entry point -- fall back to the v7 path.
    const buf = typeof binData === 'string' ? binData : toBase64(toUint8Array(binData));
    editorSendCommand({ command: 'asc_openDocument', data: { buf } });
    return;
  }

  const editorApp = iwin?.DE ?? iwin?.SSE ?? iwin?.PE;
  const mainCtrl = editorApp?.getController?.('Main');
  if (!mainCtrl) return;

  // STEP 1: wait for loadDocument to run (sets mainCtrl.document, registers the
  // asc_onGetEditorPermissions callback). api.js sends 'init' + 'opendocument'
  // postMessages in the same turn as onAppReady, so the iframe hasn't processed
  // them yet -- poll until it has.
  let waited = 0;
  while ((!mainCtrl.appOptions?.user || !mainCtrl.document) && waited < 3000) {
    await new Promise((r) => setTimeout(r, 50));
    waited += 50;
  }
  console.log('[OO] loadDocument ready after', waited, 'ms');

  // STEP 2: the SDK fires asc_onGetEditorPermissions after a license check that
  // requires a real server; without one it may resolve isEdit=false. Patch
  // onEditorPermissions so any call substitutes a permissive fake response.
  const versionStr =
    editorApp
      ?.getController?.('LeftMenu')
      ?.leftMenu?.getMenu?.('about')
      ?.txtVersionNum?.match(/^(\d+\.\d+\.\d+)/)?.[1] ?? '9.3.0';
  const fakePerms = {
    asc_getLicenseType: () => 3, // c_oLicenseResult.Success
    asc_getBuildVersion: () => versionStr,
    asc_getRights: () => 1, // c_oRights.Edit
    asc_getIsAnalyticsEnable: () => false,
    asc_getIsLight: () => false,
    asc_getLicenseMode: () => 0,
    asc_getIsBeta: () => false,
    asc_getCanBranding: () => false,
    asc_getCustomization: () => false,
    asc_getLiveViewerSupport: () => false,
  };
  if (!mainCtrl._isPermissionsInited && typeof mainCtrl.onEditorPermissions === 'function') {
    const origPerms = mainCtrl.onEditorPermissions.bind(mainCtrl);
    mainCtrl.onEditorPermissions = (_perms: any) => {
      try {
        return origPerms(fakePerms);
      } catch (e) {
        console.warn('[OO] onEditorPermissions(fakePerms) failed', e);
      }
    };
  }

  // STEP 3: the SDK normally fires asc_onGetEditorPermissions after a socket.io
  // round-trip that never happens here. Give it 2s, then trigger manually.
  waited = 0;
  while (!mainCtrl._isPermissionsInited && waited < 2000) {
    await new Promise((r) => setTimeout(r, 100));
    waited += 100;
  }
  if (!mainCtrl._isPermissionsInited) {
    console.log('[OO] SDK did not fire permissions after 2s, calling manually');
    try {
      mainCtrl.onEditorPermissions(fakePerms);
    } catch (e) {
      console.warn('[OO] manual onEditorPermissions failed', e);
    }
  }
  console.log('[OO] permissions ready: isEdit=', mainCtrl.appOptions?.isEdit, 'inited=', mainCtrl._isPermissionsInited);

  // onDownloadAs (fired by our own downloadAs()/Save button) checks
  // appOptions.canDownload and silently no-ops via Gateway.reportError if
  // false -- no dialog, no console output, easy to mistake for the click
  // simply not registering. It starts true (derived from our own
  // permissions.download config) but setMode() flips it back to false the
  // moment anything treats the connection as lost (isDisconnected), same
  // root cause as suppressCoAuthoringDisconnect above. Pin it true with a
  // property so a later setMode() call can't quietly re-disable it.
  if (mainCtrl.appOptions) {
    let canDownload = true;
    let canPrint = true;
    Object.defineProperty(mainCtrl.appOptions, 'canDownload', {
      get: () => canDownload,
      set: (v) => {
        canDownload = true;
        if (!v) console.log('[OO] blocked an attempt to disable canDownload');
      },
      configurable: true,
    });
    Object.defineProperty(mainCtrl.appOptions, 'canPrint', {
      get: () => canPrint,
      set: (v) => {
        canPrint = true;
        if (!v) console.log('[OO] blocked an attempt to disable canPrint');
      },
      configurable: true,
    });
  }

  // STEP 4: resolve the bytes to inject. A string binData means the "new
  // document" empty-template path (lib/converter.ts's handleDocumentOperation
  // picks it for isNew); substitute the raw-OOXML template instead of the
  // x2t .bin-format one that string actually contains, since it's the wrong
  // format for the Web Mode importer. Otherwise binData is already raw OOXML
  // -- converter.ts skips x2t entirely for v9's open path (see OO_VARIANT
  // check there), so no further decoding is needed here.
  let ooxmlBytes: Uint8Array;
  if (typeof binData === 'string') {
    const ext = `.${fileName.split('.').pop()?.toLowerCase() || 'docx'}`;
    if (ext === '.pptx') {
      // g_sEmpty_ooxml's pptx entry is missing parts the slide engine's own
      // loader expects (preprocessPptx patches around some of it, but not
      // all -- it still crashes deep inside sdk-all-min.js's loader).
      // sdkjs ships a real, complete blank presentation for this exact
      // purpose; fetch that instead of the minimal blob for the other types.
      const templateResponse = await fetch(`${BASE_PATH}sdkjs/slide/themes/src/01_blank.pptx`);
      if (!templateResponse.ok) {
        throw new Error(`Failed to load PPTX template: ${templateResponse.status}`);
      }
      ooxmlBytes = new Uint8Array(await templateResponse.arrayBuffer());
    } else {
      const ooxmlB64 = g_sEmpty_ooxml[ext] || g_sEmpty_ooxml['.docx'];
      const binaryStr = atob(ooxmlB64);
      ooxmlBytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) ooxmlBytes[i] = binaryStr.charCodeAt(i);
    }
    console.log('[OO] new doc', ext, ooxmlBytes.byteLength, 'bytes');
  } else {
    ooxmlBytes = toUint8Array(binData);
  }

  if (ooxmlBytes.byteLength === 0) return;

  // x2t may rename images during conversion (e.g. image1.tiff -> image3.jpg),
  // breaking the SDK's image URL mapping -- re-extract from the ZIP bytes
  // using their original filenames when opening docx/xlsx/pptx directly.
  if (['docx', 'xlsx', 'pptx'].includes(fileType.toLowerCase())) {
    try {
      const zipMedia = await extractDocxMediaUrls(ooxmlBytes);
      if (Object.keys(zipMedia).length > 0) {
        const cache = (window as unknown as Record<string, unknown>).__mediaCache as Record<string, string>;
        Object.assign(cache, zipMedia);
        console.log('[OO] media cache updated from ZIP:', Object.keys(zipMedia));
      }
    } catch (e) {
      console.warn('[OO] ZIP media extraction failed:', e);
    }
  }

  // In Desktop mode the SDK delegates api.gqc("showMediaControl"/"play", ...)
  // to AscDesktopEditor; in Web Mode it's a no-op stub. Replace it with a
  // browser-native overlay player backed by __mediaCache.
  if (api && !('__gqcPatched' in api)) {
    (api as Record<string, unknown>).__gqcPatched = true;
    const origGqc = typeof api.gqc === 'function' ? (api.gqc as (...a: unknown[]) => unknown).bind(api) : null;
    const VIDEO_EXTS = /\.(mp4|webm|mov|avi|mkv|wmv|m4v)$/i;
    const AUDIO_EXTS = /\.(mp3|wav|ogg|m4a|aac|wma|flac)$/i;
    (api as Record<string, unknown>).gqc = function (command: unknown, mediaInfo: unknown) {
      if (command === 'showMediaControl' || command === 'play') {
        const cache = (window as unknown as Record<string, unknown>).__mediaCache as Record<string, string>;
        const entries = Object.entries(cache)
          .filter(([k]) => VIDEO_EXTS.test(k) || AUDIO_EXTS.test(k))
          .map(([k, url]) => ({ key: k, url, isVideo: VIDEO_EXTS.test(k) }));
        if (entries.length > 0) {
          showMediaPlayer(entries);
        } else {
          console.log('[OO] gqc', command, '— no media in cache');
        }
        return;
      }
      if (origGqc) return origGqc(command, mediaInfo);
    };
    console.log('[OO] api.gqc patched for browser-native media playback');
  }

  // x2t (v7 path) normalises literal "&#10;" text in XLSX cells to real LF
  // bytes during conversion. Raw OOXML bypasses that, so the SDK's XML parser
  // sees the 5-char text "&#10;" verbatim -- fix it up before parsing.
  if (fileType.toLowerCase() === 'xlsx') {
    try {
      const fixed = await preprocessXlsxLineBreaks(ooxmlBytes);
      if (fixed !== ooxmlBytes) {
        console.log('[OO] XLSX preprocessed: normalised &#10; line-break escapes');
        ooxmlBytes = fixed;
      }
    } catch (e) {
      console.warn('[OO] XLSX preprocessing failed (continuing with original bytes):', e);
    }
  }
  // See preprocessPptx() in packages/converter/src/docx-zip.ts for what this fixes.
  if (fileType.toLowerCase() === 'pptx') {
    try {
      const fixed = await preprocessPptx(ooxmlBytes);
      if (fixed !== ooxmlBytes) {
        console.log('[OO] PPTX preprocessed (showMasterPhAnim stripped, docProps/app.xml injected if missing)');
        ooxmlBytes = fixed;
      }
    } catch (e) {
      console.warn('[OO] PPTX preprocessing failed (continuing with original bytes):', e);
    }
  }

  console.log('[OO] asc_openDocumentFromBytes', ooxmlBytes.byteLength, 'bytes');
  // The SDK's Shc()/Mrc() gating functions check `!a.AscDesktopEditor` to decide
  // whether to run the Desktop path (which calls LocalStartOpen and discards
  // the bytes without feeding them to WASM) or the Web path (BRj/rxk, which
  // actually starts loading). Our AscDesktopEditor polyfill makes that check
  // truthy, so we patch the gate itself to always take the Web path.
  //   Word SDK:  Shc(d) -> BRj(d)
  //   Cell SDK:  Mrc(d) -> rxk(d)
  //   Slide SDK: K8b(d) -> Fzj(d)
  //
  // See markDocumentContentReady/waitForDocumentContentReady near the top of
  // this file for why the save path needs to wait for this signal rather
  // than assuming readiness right after asc_openDocumentFromBytes returns.
  resetDocumentContentReady();
  // Safety net in case asc_onDocumentContentReady never fires for some reason
  // -- force any deferred/waiting save(s) through rather than hanging forever.
  setTimeout(() => {
    if (!documentContentReady) {
      console.warn('[OO] asc_onDocumentContentReady did not fire within 15s -- forcing deferred save(s) anyway');
      markDocumentContentReady();
    }
  }, 15000);

  const patchWebPath = (shcName: string, brjName: string, historyFlag: string, contentReadyCb: string) => {
    const a = api as any;
    if (typeof a[shcName] !== 'function' || typeof a[brjName] !== 'function') return;
    a[shcName] = function (d: unknown) {
      if (d) {
        try {
          a[contentReadyCb]?.('asc_onDocumentContentReady', function () {
            markDocumentContentReady();
            const w = iwin;
            if (w?.Z$) w.Z$(w.Asc?.editor || w.editor);
            if (w?.X$) w.X$(w.Asc?.editor || w.editor);
            setTimeout(function () {
              if (w?.UpdateInstallPlugins) w.UpdateInstallPlugins();
            }, 10);
          });
          if (iwin?.AscCommon?.History) (iwin.AscCommon.History as any)[historyFlag] = true;
        } catch {}
      }
      return a[brjName](d);
    };
  };
  patchWebPath('Shc', 'BRj', 'C0a', 'b_');
  patchWebPath('Mrc', 'rxk', 'J6a', 'tW');
  patchWebPath('K8b', 'Fzj', '$cb', 'aN');

  // Both the toolbar Save button and our own requestSaveDocument() ->
  // downloadAs() ultimately call the SDK's internal asc_Save (raw name: oja
  // for word/slide, xxa for cell) or, for cell specifically, a separate
  // asc_DownloadAs raw entry point (iZd) that doesn't route through xxa at
  // all. Like Shc/Mrc/K8b above, these functions' "has a real desktop host"
  // check is fooled by the AscDesktopEditor polyfill, so they take the
  // Desktop branch (DesktopOfflineAppDocumentStartSave ->
  // AscDesktopEditor.LocalFileSave) -- which is built for a native app
  // writing to disk via OS APIs and never hands the document bytes back to
  // this page. Unlike opening, there's no "give me the web-path version of
  // asc_Save" swap here; instead, each engine has its own separate offline-
  // save entry point (Ncj/DOj/mTi per editor type) that calls
  // asc_onSaveDocument directly with the serialized bytes when
  // asc_isSupportFeature('ooxml') is true (confirmed true in this build) --
  // redirect straight to that instead of trying to fix up asc_Save's Desktop
  // branch. The three names are NOT mutually exclusive on the api object --
  // sdk-all-min.js bundles all three engines together, so e.g. the cell
  // editor's api also exposes a `Ncj` method (word's trigger name) that is
  // unrelated and silently no-ops; picking by existence (`a.Ncj ?? a.DOj`)
  // therefore picks the wrong one for cell. Select by the known fileType
  // instead. Confirmed working via direct testing (chrome-devtools MCP):
  // after this patch, downloadAs(), the toolbar Save button, and Excel's
  // separate DownloadAs entry point all reach handleSaveDocument with real
  // serialized bytes.
  const a = api as any;
  const lowerFileType = fileType.toLowerCase();
  const triggerName = ['pptx', 'ppt'].includes(lowerFileType)
    ? 'mTi'
    : ['xlsx', 'xls', 'csv'].includes(lowerFileType)
      ? 'DOj'
      : 'Ncj';
  if (typeof a[triggerName] === 'function') {
    const triggerSave = () => {
      if (documentContentReady) {
        return a[triggerName]?.call(a, true);
      }
      console.log('[OO] save requested before document content ready -- deferring');
      contentReadyWaiters.push(() => a[triggerName]?.call(a, true));
    };
    for (const rawName of ['oja', 'xxa', 'iZd']) {
      if (typeof a[rawName] === 'function') a[rawName] = triggerSave;
    }
    if (typeof a.asc_Save === 'function') a.asc_Save = triggerSave;
    if (typeof a.asc_DownloadAs === 'function') a.asc_DownloadAs = triggerSave;
  } else {
    console.warn(
      `[OO] no offline save trigger (${triggerName}) found for fileType ${fileType} -- Save will likely no-op`,
    );
  }
  suppressDownloadSettingsDialog(iwin);

  api.asc_openDocumentFromBytes(ooxmlBytes);

  // Serverless Web Mode has no server auth/openedAt response. Without these,
  // the SDK reaches 100% load progress but never emits asc_onDocumentContentReady.
  if (!api.I0c && typeof api.Aqg === 'function') {
    api.Aqg(Date.now()); // word/cell openedAt gate
  }
  if (!api.cSd && typeof api.LNg === 'function') {
    api.LNg(Date.now()); // spreadsheet openedAt gate (separate flag from word/cell)
  }
  if (!api.kvd && typeof api.rdg === 'function') {
    let presentationWaited = 0;
    while ((!api.Jne || !api.ta?.Ha) && presentationWaited < 5000) {
      await new Promise((r) => setTimeout(r, 100));
      presentationWaited += 100;
    }
    try {
      api.rdg(Date.now());
      console.log('[OO] presentation openedAt gate after', presentationWaited, 'ms');
    } catch (e) {
      console.warn('[OO] presentation openedAt gate failed', e);
    }
  }
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
          // v9 Web Mode: explicitly opt out of collaboration/co-authoring so the
          // SDK doesn't wait on a real coauthoring server that will never answer.
          ...(OO_VARIANT === 'v9'
            ? {
                canCoAuthoring: false,
                coEditing: { mode: 'strict', change: false },
              }
            : {}),
        },
        events: {
          onAppReady: () => {
            if (OO_VARIANT === 'v9') {
              void runWebModeOnAppReady({ fileName, fileType, binData, mediaUrls });
              return;
            }

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
            // (v9's stuck status-bar "loading" label -- same underlying cause as the
            // busy-counter leak -- is handled generally by the watchdog in
            // public-v9/onlyoffice-iframe-patch.js section 4c, not here: it recurs on
            // more than just initial load, e.g. opening the numbering gallery.)
          },
          onDownloadAs: handleDownloadAs,
          // writeFile
          // TODO: writeFile - handle when pasting images from external sources
          writeFile: handleWriteFile,
          // v9 renamed this event from onSave to onSaveDocument (and changed its
          // payload shape -- handleSaveDocument handles both, see there).
          ...(OO_VARIANT === 'v9' ? { onSaveDocument: handleSaveDocument } : { onSave: handleSaveDocument }),
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
    const downloadAs = editor.downloadAs.bind(editor);
    if (documentContentReady) {
      downloadAs(normalizedTargetExt);
    } else {
      void waitForDocumentContentReady().then(() => {
        downloadAs(normalizedTargetExt);
      });
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
