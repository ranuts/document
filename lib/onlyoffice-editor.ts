import 'ranui/message';
import { getOnlyOfficeLang, t } from '@ranuts/shared/i18n';
import { DOCUMENT_TYPE_MAP } from '@ranuts/shared/document-utils';
import { prepareEditorIframe } from './onlyoffice/iframe-guards';
import {
  describeOpenFailure,
  getDocumentOpenError,
  getLastFrameError,
  isDocumentContentReady,
  markDocumentContentReady,
  markDocumentOpenFailed,
  resetOpenState,
} from './onlyoffice/open-state';
import {
  classifyOpenFailure,
  isOpenRetryInFlight,
  registerOpenAttempt,
  releaseOpenAttemptBytes,
  setOpenRunner,
} from './onlyoffice/open-failure';
import { markDocumentDirty, markDocumentSaved, resetUnsavedChanges } from './unsaved-guard';
import { getSdkEditorApi, ASC_RESTRICTION_VIEW } from './onlyoffice/sdk-api';
import { getReadonlyMode, setReadonlyState } from './onlyoffice/readonly';
import { resolveUiTheme } from './onlyoffice/ui-theme';
import {
  describeMemoryVerdict,
  isWasmAllocationFailure,
  probeX2tMemory,
  resolveBuildBitness,
  X2T_INITIAL_MB,
} from './onlyoffice/wasm-memory';
import {
  cleanupViewportFollow,
  compactViewportCustomization,
  installViewportFollow,
  isCompactViewport,
  resetCompactLayoutState,
  syncCompactLayout,
} from './onlyoffice/viewport';

/**
 * Editor lifecycle: mount a document in the vendor's v9 build, rebuild it for
 * the next one, and load the API bundle. Everything the mounted editor needs
 * around it lives under ./onlyoffice -- the runtime guards (iframe-guards),
 * the save channel (save-stream), open state and failure handling, the
 * viewport layout, the readonly restriction and the SDK accessors.
 *
 * The exports below are this package's public surface; lib/embed-api,
 * lib/web-mcp, lib/converter and the unit tests import them from here.
 */
export {
  SAVE_READY_WAIT_MS,
  SAVE_RETRY_WINDOW_MS,
  SAVE_REQUEST_TIMEOUT_MS,
  requestSaveDocument,
} from './onlyoffice/save-stream';
export { getNormalizedFile, getSavedFileMimeType, toUint8Array } from './onlyoffice/file-helpers';
export { describeOpenFailure, noteFrameError } from './onlyoffice/open-state';
export { classifyOpenFailure, isOpenRetryInFlight, openAttemptHoldsBytes } from './onlyoffice/open-failure';
export {
  describeMemoryVerdict,
  isWasmAllocationFailure,
  probeX2tMemory,
  resolveBuildBitness,
  X2T_INITIAL_MB,
  X2T_INITIAL_PAGES,
  X2T_MAXIMUM_PAGES,
} from './onlyoffice/wasm-memory';
export { releaseWasmBinary } from './onlyoffice/guards/wasm-binary-release';
export {
  awaitFontSystem,
  isFontSystemReady,
  FONT_SYSTEM_WAIT_MS,
  FONT_WAIT_PROBE,
  type FontSystemWindow,
} from './onlyoffice/font-system';
export { getReadonlyMode, setReadonlyMode } from './onlyoffice/readonly';
export { DEFAULT_UI_THEME, UI_THEME_STORAGE_KEY, resolveUiTheme } from './onlyoffice/ui-theme';
export {
  COMPACT_VIEWPORT_MAX_WIDTH,
  compactViewportCustomization,
  isCompactViewport,
  readViewportMetrics,
  resetCompactLayoutState,
  syncCompactLayout,
  type ViewportMetrics,
} from './onlyoffice/viewport';

// Editor operation queue: creating and destroying editors must never overlap.
let editorOperationQueue: Promise<void> = Promise.resolve();

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
  resetOpenState();

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
        // The open succeeded, so the retry budget is spent and the bytes kept
        // for it are dead weight -- the editor holds the document itself, and
        // the blob it was mounted from is a second copy already. Keeping a
        // third for the rest of the session is exactly the kind of ballast
        // that gets a phone's canvas discarded under memory pressure (#145).
        releaseOpenAttemptBytes();
        // Re-apply in case the header rendered after onAppReady.
        prepareEditorIframe();
        // This is a freshly mounted editor whose panels are whatever the
        // mount-time customization made them.
        resetCompactLayoutState();
        syncCompactLayout(normalizedType, { force: true });
        installViewportFollow(normalizedType);
        // Readonly opens mount with full edit permissions and get locked
        // here instead (asc_setRestriction only works once the document is
        // loaded). Read the live flag rather than the captured config value:
        // setReadonlyMode may have been called while the document loaded.
        if (getReadonlyMode()) {
          getSdkEditorApi()?.asc_setRestriction?.(ASC_RESTRICTION_VIEW);
        }
        console.log(`${t('documentLoaded')}${fileName}`);
      },
      // The editor's modified flag. This is the only signal the app has that
      // there is work worth protecting, and it has to be wired here: the
      // serverless save guard routes Save/Ctrl+S to asc_DownloadAs, so the
      // SDK's own "document saved" bookkeeping never runs.
      onDocumentStateChange: (event: unknown) => {
        const modified = (event as { data?: boolean } | null)?.data;
        if (modified === false) {
          // The SDK says there is nothing to save: a fresh document, or undo
          // walked the history back to the state it was opened in.
          markDocumentSaved();
        } else {
          markDocumentDirty();
        }
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
        // A -82 whose recorded cause is a refused wasm allocation is not a
        // verdict on the file at all -- x2t never got instantiated -- so it
        // must not carry the "may be corrupted" wording, which sends the user
        // looking at a file that is fine (GitHub #144).
        const failure = getDocumentOpenError() ?? getLastFrameError() ?? '';
        // Through classifyOpenFailure, not isWasmAllocationFailure alone: the
        // classifier puts `Conversion failed with code` FIRST on purpose, and
        // a document big enough to exhaust the heap mid conversion fails with
        // an exit code AND the word "memory". That one is x2t's verdict on the
        // bytes, and answering it with "close tabs / use a 64-bit browser"
        // sends the user off to fix their browser over a file it will never
        // convert. Keep the two readings of the same message in one place.
        const outOfMemory =
          code === -82 && classifyOpenFailure(failure) === 'environment' && isWasmAllocationFailure(failure);
        const hint =
          code === -85
            ? ` ${t('editorErrorFormatMismatch')}`
            : outOfMemory
              ? // The heap size the message quotes comes from the wasm binary, not
                // from eight hand-written copies of "283"; the probe skips its
                // own 283 MB commit while a rebuilt editor is asking for one.
                ` ${t('editorErrorOutOfMemory', { mb: X2T_INITIAL_MB })}${describeMemoryVerdict(
                  probeX2tMemory({ skipCommit: isOpenRetryInFlight() }),
                )}`
              : code === -82
                ? ` ${t('editorErrorOpenFailed')}`
                : '';
        // The numeric code alone is not diagnosable: every issue report so far
        // arrived as a screenshot of this toast (#113, #144). When the open
        // conversion is what failed we know exactly why, so put that reason in
        // the toast too -- truncated, since it is vendor text.
        const cause = describeOpenFailure(code, getDocumentOpenError(), getLastFrameError());
        // A -82 the vendor raised itself (its window.onerror path) never went
        // through installOpenFailureGuard, so nothing has marked the document
        // as failed yet and every save would wait out its full timeout.
        if (code === -82 && !isDocumentContentReady()) {
          markDocumentOpenFailed(getDocumentOpenError() ?? getLastFrameError() ?? `editor reported error ${code}`);
        }
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
  registerOpenAttempt(config);
  // A new document is taking over the frame: whatever was unsaved belonged to
  // the one being replaced.
  resetUnsavedChanges();
  // Asked once per session, well before any failure needs to report it: the
  // answer is only read from the out-of-memory branch of the error toast.
  resolveBuildBitness();
  return queueEditorOperation(async () => {
    const { fileName, fileType, binData, readonly = false } = config;
    setReadonlyState(readonly);

    // Check if there's an existing editor that needs cleanup
    const hasExistingEditor = !!window.editor;

    // Clean up old editor instance properly
    if (window.editor) {
      // The viewport follow belongs to the document that is going away; the
      // next onDocumentReady installs a fresh one for the new document.
      cleanupViewportFollow();
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

// The retry path rebuilds the editor with the same bytes; injected here to
// keep ./onlyoffice/open-failure free of a cycle back into this module.
setOpenRunner(createEditorInstance);
