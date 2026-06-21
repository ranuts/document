import 'ranui/message';
import { createObjectURL } from 'ranuts/utils';
import { getDocmentObj } from '../store';
import { getOnlyOfficeLang, t } from './i18n';
import { c_oAscFileType2 } from './file-types';
import type { BinConversionResult, SaveEvent } from './document-types';
import { getMimeTypeFromExtension } from './document-utils';
import { g_sEmpty_ooxml } from './empty_bin';
import { extractDocxMediaUrls, preprocessXlsxLineBreaks, preprocessPptx } from './docx-zip';
import { showMediaPlayer } from './media-player';

// Import converter function to avoid circular dependency
let convertBinToDocumentFn:
  | ((bin: Uint8Array, fileName: string, targetExt?: string) => Promise<BinConversionResult>)
  | null = null;
let convertBinToDocumentAndDownloadFn:
  | ((bin: Uint8Array, fileName: string, targetExt?: string) => Promise<BinConversionResult>)
  | null = null;

export function setConverterCallbacks(callbacks: {
  convert: (bin: Uint8Array, fileName: string, targetExt?: string) => Promise<BinConversionResult>;
  convertAndDownload: (bin: Uint8Array, fileName: string, targetExt?: string) => Promise<BinConversionResult>;
}): void {
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

// Suppress expected serverless-mode dialogs inside the editor iframe.
// Investigation (2026-06-19) showed that "Connection is lost" (CoAuthoringDisconnect error)
// goes through Common.UI.alert(o), NOT Common.UI.warning(o). We patch both.
// Called from onAppReady with same-origin iframe access (more reliable than Vite middleware).
//
// CRITICAL: app.js chains Common.UI.alert(s).$window.attr("data-value", t) in n.onError.
// Returning undefined from alert() causes "Cannot read properties of undefined (reading
// '$window')".  We must return a chainable mock dialog instead of undefined.
function suppressDialogsInFrame(frameWindow: any): void {
  const SUPPRESSED_MSGS = ['Connection is lost', 'error occurred during the work'];
  const shouldSuppress = (opts: any): boolean => {
    const msg: string = opts?.msg ?? '';
    return typeof msg === 'string' && SUPPRESSED_MSGS.some((s) => msg.indexOf(s) !== -1);
  };

  // Build a chainable no-op that satisfies .$window.attr(...) and similar chained calls
  // from app.js error handlers without throwing.
  const jq: Record<string, unknown> = {};
  ['attr', 'on', 'off', 'show', 'hide', 'css', 'addClass', 'removeClass', 'find', 'remove',
   'val', 'text', 'html', 'prop', 'data', 'trigger', 'focus', 'blur', 'one', 'click'].forEach((m) => {
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

    // "Connection is lost" (Asc.c_oAscError.ID.CoAuthoringDisconnect) calls Common.UI.alert
    const origAlert = ui.alert.bind(ui);
    ui.alert = (opts: any) => (shouldSuppress(opts) ? MOCK_DIALOG : origAlert(opts));

    console.log('[OO] dialog suppression active in iframe (warning + alert)');
  };
  poll();
}

// 9.3.0 renamed sendCommand → serviceCommand; try serviceCommand first for forward compat.
function editorSendCommand(params: { command: string; data: Record<string, any> }): void {
  const ed = window.editor as any;
  if (!ed) return;
  if (typeof ed.serviceCommand === 'function') {
    ed.serviceCommand(params);
  } else if (typeof ed.sendCommand === 'function') {
    ed.sendCommand(params);
  }
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

async function handleSaveDocument(event: any) {
  console.log('Save document event:', event);

  // 9.3.0: api.js dispatches onSaveDocument with event.data = ArrayBuffer (raw DOCY binary).
  // 7.4.1: api.js dispatched onSave with event.data = { data: { data: Uint8Array }, option: { outputformat } }.
  let binaryData: Uint8Array;
  let targetFormat: string;
  const { fileName } = getDocmentObj() || {};

  if (event.data instanceof ArrayBuffer) {
    // 9.3.0 path — onSaveDocument fires with raw binary transferred via postMessage
    binaryData = new Uint8Array(event.data);
    const ext = (fileName?.split('.').pop() || 'docx').toUpperCase();
    targetFormat = fileName?.toLowerCase().endsWith('.csv') ? 'CSV' : ext;
    console.log(`[OO] save 9.3.0 binary ${binaryData.byteLength} bytes → format ${targetFormat}`);
  } else if (event.data?.data?.data) {
    // 7.4.1 path — nested object with Uint8Array and outputformat
    const { data, option } = event.data as SaveEvent['data'] extends infer T ? T : never;
    binaryData = (data as any).data as Uint8Array;
    targetFormat = c_oAscFileType2[(option as any).outputformat] || 'DOCX';
    if (fileName?.toLowerCase().endsWith('.csv')) targetFormat = 'CSV';
    console.log(`[OO] save 7.4.1 format ${targetFormat}`);
  } else {
    console.warn('[OO] handleSaveDocument: unrecognized event format', typeof event.data);
    return;
  }

  if (embeddedSaveRequest) {
    if (!convertBinToDocumentFn) {
      throw new Error('Converter callback not set');
    }

    const request = embeddedSaveRequest;
    cleanupEmbeddedSaveRequest(request);

    try {
      const result = await convertBinToDocumentFn(binaryData, fileName, request.targetExt || targetFormat);
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
    await convertBinToDocumentAndDownloadFn(binaryData, fileName, targetFormat);
  } else {
    throw new Error('Converter callback not set');
  }

  // Notify editor that save is complete
  editorSendCommand({ command: 'asc_onSaveCallback', data: { err_code: 0 } });
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

    // Publish media blob URLs so the iframe's HTMLImageElement.src patch can
    // redirect /media/word/media/<file> requests to the pre-extracted blobs.
    (window as unknown as Record<string, unknown>).__mediaCache = mediaUrls ?? {};

    // Store binary in a window-level slot so the iframe mock can access it
    // via window.parent.__pendingBinary in LocalStartOpen.
    let pendingCopy: Uint8Array;
    {
      let src: Uint8Array;
      if (binData instanceof Uint8Array) {
        src = binData;
      } else if (binData instanceof ArrayBuffer) {
        src = new Uint8Array(binData);
      } else if (typeof binData === 'string' && binData.includes(';')) {
        // DOCY/XLSY string format: 'DOCY;v5;{byteLen};{base64data}'
        const base64 = binData.split(';').slice(3).join(';');
        const binaryStr = atob(base64);
        src = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          src[i] = binaryStr.charCodeAt(i);
        }
      } else {
        src = new Uint8Array(0);
      }
      pendingCopy = new Uint8Array(src.byteLength);
      pendingCopy.set(src);
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
          canCoAuthoring: false,
          coEditing: {
            mode: 'strict',
            change: false,
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
          onAppReady: async () => {
            if (mediaUrls) {
              editorSendCommand({ command: 'asc_setImageUrls', data: { urls: mediaUrls } });
            }
            // Web Mode 9.3.0: access the SDK api object directly via same-origin iframe.
            const iframeEl = document.querySelector('iframe') as HTMLIFrameElement | null;
            const iwin = iframeEl?.contentWindow as any;
            const api = iwin?.Asc?.editor;
            console.log('[OO] onAppReady', { hasIframe: !!iframeEl, hasApi: !!api });

            // Suppress "Connection is lost" / EditingError -25 dialogs directly in the iframe.
            // This is the reliable path — Vite middleware injection has proven unreliable.
            if (iwin) suppressDialogsInFrame(iwin);
            if (typeof api?.asc_openDocumentFromBytes !== 'function') {
              // 7.4.1 fallback
              editorSendCommand({ command: 'asc_openDocument', data: { buf: binData } });
              return;
            }

            const editorApp = iwin?.DE ?? iwin?.SSE ?? iwin?.PE;
            const mainCtrl = editorApp?.getController?.('Main');
            if (!mainCtrl) return;

            // STEP 1: Wait for loadDocument to run (sets mainCtrl.document, registers
            // asc_onGetEditorPermissions callback, calls asc_setDocInfo + asc_getEditorPermissions).
            // api.js sends 'init' + 'opendocument' postMessages in the same turn as our callback,
            // so the iframe hasn't processed them yet. Poll until both are done.
            let waited = 0;
            while ((!mainCtrl.appOptions?.user || !mainCtrl.document) && waited < 3000) {
              await new Promise((r) => setTimeout(r, 50));
              waited += 50;
            }
            console.log('[OO] loadDocument ready after', waited, 'ms');

            // STEP 2: Intercept onEditorPermissions so ANY call (from SDK license check or
            // manually) always uses fakePerms. The SDK fires asc_onGetEditorPermissions after
            // asc_getEditorPermissions() which requires server license verification. Without
            // a real server the response may set isEdit=false. This patch ensures isEdit=true.
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
                // Always substitute fakePerms — ignore whatever the license server returns
                try {
                  return origPerms(fakePerms);
                } catch (e) {
                  console.warn('[OO] onEditorPermissions(fakePerms) failed', e);
                }
              };
            }

            // STEP 3: Wait for SDK to fire asc_onGetEditorPermissions (sets _isPermissionsInited).
            // The SDK fires this after asc_getEditorPermissions() completes — which requires
            // a socket.io response from the server. With our noop server it may never fire,
            // so after 2s we manually trigger it to unblock document loading.
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
            console.log(
              '[OO] permissions ready: isEdit=',
              mainCtrl.appOptions?.isEdit,
              'inited=',
              mainCtrl._isPermissionsInited,
            );

            // STEP 4: Inject document bytes.
            let ooxmlBytes: Uint8Array;
            if (typeof binData === 'string' && binData.includes(';')) {
              // New document — convert base64 empty template to bytes.
              const ext = '.' + (fileName.split('.').pop()?.toLowerCase() || 'docx');
              if (ext === '.pptx') {
                const templateResponse = await fetch('/sdkjs/slide/themes/src/01_blank.pptx');
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
              const originalFileBytes = (window as unknown as { __pendingOriginalFile?: unknown })
                .__pendingOriginalFile;
              const shouldUseOriginalOoxml =
                ['docx', 'xlsx', 'pptx'].includes(fileType.toLowerCase()) && originalFileBytes instanceof Uint8Array;
              if (shouldUseOriginalOoxml) {
                ooxmlBytes = new Uint8Array(originalFileBytes);
                console.log('[OO] using original OOXML bytes for local preview', ooxmlBytes.byteLength, 'bytes');
              } else {
                ooxmlBytes = pendingCopy;
              }
            }
            if (ooxmlBytes.byteLength > 0) {
              // For DOCX/XLSX/PPTX opened directly, re-extract images from the ZIP bytes
              // using their original filenames, because x2t may rename them during conversion
              // (e.g. image1.tiff → image3.jpg), breaking the SDK's image URL mapping.
              if (['docx', 'xlsx', 'pptx'].includes(fileType.toLowerCase())) {
                try {
                  const zipMedia = await extractDocxMediaUrls(ooxmlBytes);
                  if (Object.keys(zipMedia).length > 0) {
                    const cache = (window as unknown as Record<string, unknown>).__mediaCache as Record<string, string>;
                    for (const [key, url] of Object.entries(zipMedia)) {
                      cache[key] = url;
                    }
                    console.log('[OO] media cache updated from ZIP:', Object.keys(zipMedia));
                  }
                } catch (e) {
                  console.warn('[OO] ZIP media extraction failed:', e);
                }
              }

              // Intercept api.gqc("showMediaControl", ...) / gqc("play", ...) so that
              // clicking a video/audio shape in PPTX opens a browser-native overlay player.
              // In Desktop mode the SDK delegates these calls to AscDesktopEditor; in Web
              // Mode gqc is a no-op stub. We replace it with our own implementation that
              // looks up blob URLs from __mediaCache and opens showMediaPlayer.
              if (api && !('__gqcPatched' in api)) {
                (api as Record<string, unknown>).__gqcPatched = true;
                const origGqc = typeof api.gqc === 'function' ? (api.gqc as (...a: unknown[]) => unknown).bind(api) : null;
                const VIDEO_EXTS = /\.(mp4|webm|mov|avi|mkv|wmv|m4v)$/i;
                const AUDIO_EXTS = /\.(mp3|wav|ogg|m4a|aac|wma|flac)$/i;
                (api as Record<string, unknown>).gqc = function (command: unknown, _mediaInfo: unknown) {
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
                  if (origGqc) return origGqc(command, _mediaInfo);
                };
                console.log('[OO] api.gqc patched for browser-native media playback');
              }

              // x2t (v7.5 path) normalised literal "&#10;" text in XLSX cells to real
              // LF bytes during conversion.  When we bypass x2t and pass raw OOXML,
              // the SDK's XML parser returns the 5-char text "&#10;" verbatim.
              // Pre-process XLSX bytes to change &amp;#10; → &#10; (a proper XML
              // numeric character reference) so the SDK decodes it to U+000A.
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
              // PPTX preprocessing: fix two SDK bugs in Web Mode 9.3.0 before parsing.
              // See preprocessPptx() in docx-zip.ts for details.
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
              // CRITICAL FIX: SDK's Shc()/Mrc() checks !a.AscDesktopEditor. Our polyfill
              // makes it truthy, so the Desktop branch runs: calls LocalStartOpen() (our noop)
              // and discards the document bytes without feeding them to WASM.
              // BRj()/rxk() is the web path that actually starts document loading.
              // Patch the SDK-specific gating function to always call the web path.
              // Keep patches active (no restore): if WASM isn't ready yet, BRj/rxk stores
              // bytes in KXb/U4b and processes them when the font-load callback fires again.
              //
              // Word SDK:  Shc(d) → BRj(d)
              // Cell SDK:  Mrc(d) → rxk(d)
              // (Slide SDK uses a different loading path and does not need this patch.)
              const patchWebPath = (shcName: string, brjName: string, historyFlag: string, contentReadyCb: string) => {
                const a = api as any;
                if (typeof a[shcName] !== 'function' || typeof a[brjName] !== 'function') return;
                a[shcName] = function (d: unknown) {
                  if (d) {
                    try {
                      a[contentReadyCb]?.('asc_onDocumentContentReady', function () {
                        const w = iwin;
                        if (w?.Z$) w.Z$(w.Asc?.editor || w.editor);
                        if (w?.X$) w.X$(w.Asc?.editor || w.editor);
                        setTimeout(function () { if (w?.UpdateInstallPlugins) w.UpdateInstallPlugins(); }, 10);
                      });
                      if (iwin?.AscCommon?.History) (iwin.AscCommon.History as any)[historyFlag] = true;
                    } catch (_e) {}
                  }
                  return a[brjName](d);
                };
              };
              patchWebPath('Shc', 'BRj', 'C0a', 'b_');   // Word SDK
              patchWebPath('Mrc', 'rxk', 'J6a', 'tW');   // Cell SDK
              patchWebPath('K8b', 'Fzj', '$cb', 'aN');   // Slide SDK
              api.asc_openDocumentFromBytes(ooxmlBytes);
              if (!api.I0c && typeof api.Aqg === 'function') {
                // Serverless Web Mode has no server auth/openedAt response. Without this,
                // the SDK reaches 100% load progress but never emits asc_onDocumentContentReady.
                api.Aqg(Date.now());
              }
              if (!api.cSd && typeof api.LNg === 'function') {
                // Spreadsheet editor uses cSd/LNg as the same openedAt gate.
                api.LNg(Date.now());
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
          },
          onDocumentReady: () => {
            console.log(`${t('documentLoaded')}${fileName}`);
            // Note: For CSV files, the save dialog may show XLSX format,
            // but the actual save will be forced to CSV format in handleSaveDocument
          },
          // 9.3.0: api.js maps this event to canSaveDocumentToBinary flag, name changed from 7.4.1 onSave
          onSaveDocument: handleSaveDocument,
          onDownloadAs: handleDownloadAs,
          // writeFile
          // TODO: writeFile - handle when pasting images from external sources
          writeFile: handleWriteFile,
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
    },
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

    editor.downloadAs(normalizedTargetExt);
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
