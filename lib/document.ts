import { createObjectURL } from 'ranuts/utils';
import { View } from 'ranui/builder';
import { getDocmentObj, setDocmentObj } from '@ranuts/shared/store';
import { t } from '@ranuts/shared/i18n';
import 'ranui/message';
import { handleDocumentOperation, loadEditorApi } from './converter';
import { showLoading } from './loading';
import { startDocumentSession } from './history/session';

// Import UI functions with type-only to avoid circular dependency
// These will be passed as callbacks or called after document operations
let hideControlPanelFn: (() => void) | null = null;
let showControlPanelFn: (() => void) | null = null;

export function setUICallbacks(callbacks: { hideControlPanel: () => void; showControlPanel: () => void }): void {
  hideControlPanelFn = callbacks.hideControlPanel;
  showControlPanelFn = callbacks.showControlPanel;
}

// Create a single hidden file input (ranui builder, ecosystem convention).
//
// `display: none`, not `visibility: hidden`: the latter hides the control but
// keeps it in flow, and it is a body child sitting after a 100%-height #app --
// so it added its own 25px below the viewport and gave /editor a page
// scrollbar. A file input is only ever opened programmatically here
// (fileInput.click() below), which display: none does not prevent.
const fileInput = View('input')
  .attr('type', 'file')
  // Must stay in step with DOCUMENT_TYPE_MAP (@ranuts/shared/document-utils): the
  // engine reads OpenDocument and the legacy text formats too, and leaving them
  // out here greys them out in the picker for no reason -- the file the user was
  // sent is right there and cannot be selected.
  .attr('accept', '.docx,.xlsx,.pptx,.doc,.xls,.ppt,.csv,.pdf,.odt,.ods,.odp,.rtf,.txt')
  .attr('style', 'display: none')
  .build() as HTMLInputElement;
document.body.appendChild(fileInput);

export const onCreateNew = async (ext: string, options?: { docId?: string }): Promise<void> => {
  // Callers own the loading indicator (the control panel shows it around this
  // call), so showing one here too would stack two of them.
  try {
    if (hideControlPanelFn) {
      hideControlPanelFn();
    }
    setDocmentObj({
      fileName: 'New_Document' + ext,
      file: undefined,
    });
    await loadEditorApi();
    const { fileName, file: fileBlob } = getDocmentObj();
    await handleDocumentOperation({ file: fileBlob, fileName, isNew: !fileBlob });
    // Recovery points from here on. A blank document is the case with the most
    // to lose: there is no file on disk to fall back to at all.
    startDocumentSession({ title: fileName, origin: 'new', docId: options?.docId });
  } catch (error) {
    console.error('Error creating new document:', error);
    // Ensure control panel is shown on error
    if (showControlPanelFn) {
      showControlPanelFn();
    }
    throw error; // Re-throw so the caller can restore its own UI
  }
};

// Open an already-picked local File (from the file input below, or handed off
// by a static landing page via lib/pending-open.ts).
export const openLocalFile = async (
  file: File,
  options?: {
    /** Continue an existing history row (the file came out of the history). */
    historyId?: string;
  },
): Promise<void> => {
  const { removeLoading } = showLoading();
  try {
    if (hideControlPanelFn) {
      hideControlPanelFn();
    }
    setDocmentObj({
      fileName: file.name,
      file: file,
      url: await createObjectURL(file),
    });
    const { fileName, file: fileBlob } = getDocmentObj();
    await handleDocumentOperation({ file: fileBlob, fileName, isNew: !fileBlob });
    startDocumentSession({ title: file.name, origin: 'local', docId: options?.historyId });
  } catch (error) {
    console.error('Error opening document:', error);
    // Ensure control panel is shown on error
    if (showControlPanelFn) {
      showControlPanelFn();
    }
  } finally {
    // Always remove loading, even if there's an error
    removeLoading();
  }
};

export const onOpenDocument = (): void => {
  // Clear previous event handler and value
  fileInput.onchange = null;
  fileInput.value = '';

  // Define the change handler
  const handleChange = async (event: Event) => {
    const file = (event.target as HTMLInputElement).files?.[0];

    // Clear the handler to prevent multiple triggers
    fileInput.onchange = null;

    // Only process if a file was actually selected
    // If user cancelled, onchange won't fire, nothing happens
    if (file) {
      await openLocalFile(file);
      // Clear file selection so the same file can be selected again
      fileInput.value = '';
    }
    // If no file selected, nothing happens (user cancelled)
  };

  // Set the change handler
  fileInput.onchange = handleChange;

  // Trigger file picker click event
  fileInput.click();
};

/**
 * Why `?file=` / `?src=` did not open, in the reader's own language.
 *
 * This used to be `alert()` with an English string built from the exception,
 * which for the most common failure said "Failed to open document: Failed to
 * fetch" -- a browser modal, untranslated, naming nothing the reader can act
 * on. That message is what a cross-origin refusal looks like: `fetch` rejects
 * with a TypeError and no status, because the response was never handed to the
 * page. A site that does not send `Access-Control-Allow-Origin` cannot be read
 * by this one, and no amount of retrying changes that.
 *
 * A dropped connection rejects identically, and the two cannot be told apart
 * from here -- the browser deliberately does not say which it was. So the
 * message covers both and points at the way out either way: download the file
 * and open it from the device, which always works because that path never
 * leaves the browser.
 */
function reportUrlOpenFailure(error: unknown): void {
  // A TypeError from fetch means the request never produced a response;
  // anything else already carries a status or a parse failure worth quoting.
  const unreachable = error instanceof TypeError;
  const detail = error instanceof Error ? error.message : String(error);
  const text = unreachable ? t('openUrlUnreachable') : `${t('openUrlFailed')}${detail}`;
  // ranui/message registers a global `window.message` toast API (untyped).
  const toast = (window as unknown as { message?: { error?: (msg: string) => void } }).message;
  if (toast?.error) toast.error(text);
  else console.error(text);
}

export const openDocumentFromUrl = async (
  url: string,
  fileName?: string,
  options?: {
    readonly?: boolean;
    fetchOptions?: RequestInit;
    /** Continue an existing history row (a reload of `?saved=<id>&file=<url>`). */
    docId?: string;
  },
): Promise<void> => {
  const { removeLoading } = showLoading();
  try {
    if (hideControlPanelFn) {
      hideControlPanelFn();
    }

    // Fetch the file from URL
    console.log('Fetching document from URL:', url);
    // eslint-disable-next-line n/no-unsupported-features/node-builtins
    const response = await fetch(url, options?.fetchOptions);

    if (!response.ok) {
      throw new Error(`Failed to fetch document: ${response.status} ${response.statusText}`);
    }

    // Get file name from URL or Content-Disposition header, or use provided name
    let finalFileName = fileName;
    if (!finalFileName) {
      // Try to get filename from Content-Disposition header
      const contentDisposition = response.headers.get('Content-Disposition');
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (filenameMatch && filenameMatch[1]) {
          finalFileName = filenameMatch[1].replace(/['"]/g, '');
        }
      }

      // If still no filename, extract from URL. Resolve against the current
      // page so relative URLs (?file=/docs/report.xlsx) keep their real file
      // name instead of falling back to the extensionless "document", which
      // then fails the editor's fileType validation.
      if (!finalFileName) {
        try {
          const urlObj = new URL(url, window.location.href);
          const pathname = urlObj.pathname;
          finalFileName = pathname.split('/').pop() || 'document';
          // Remove query parameters if any
          finalFileName = finalFileName.split('?')[0];
        } catch {
          finalFileName = 'document';
        }
      }
    }

    // Get file blob
    const blob = await response.blob();
    const file = new File([blob], finalFileName, { type: blob.type });

    // Set document object
    setDocmentObj({
      fileName: finalFileName,
      file: file,
      url: await createObjectURL(file),
    });

    // Initialize and open document
    const { fileName: docFileName, file: fileBlob } = getDocmentObj();
    await handleDocumentOperation({
      file: fileBlob,
      fileName: docFileName,
      isNew: !fileBlob,
      readonly: options?.readonly,
    });
    startDocumentSession({ title: docFileName, origin: 'url', docId: options?.docId });
  } catch (error) {
    console.error('Error opening document from URL:', error);
    reportUrlOpenFailure(error);
    if (showControlPanelFn) {
      showControlPanelFn();
    }
  } finally {
    removeLoading();
  }
};
