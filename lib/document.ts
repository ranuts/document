import { createObjectURL } from 'ranuts/utils';
import { View } from 'ranui/builder';
import { getDocmentObj, setDocmentObj } from '@ranuts/shared/store';
import { handleDocumentOperation, loadEditorApi } from './converter';
import { showLoading } from './loading';

// Import UI functions with type-only to avoid circular dependency
// These will be passed as callbacks or called after document operations
let hideControlPanelFn: (() => void) | null = null;
let showControlPanelFn: (() => void) | null = null;

export function setUICallbacks(callbacks: { hideControlPanel: () => void; showControlPanel: () => void }): void {
  hideControlPanelFn = callbacks.hideControlPanel;
  showControlPanelFn = callbacks.showControlPanel;
}

// Create a single hidden file input (ranui builder, ecosystem convention)
const fileInput = View('input')
  .attr('type', 'file')
  .attr('accept', '.docx,.xlsx,.pptx,.doc,.xls,.ppt,.csv,.pdf')
  .attr('style', 'visibility: hidden')
  .build() as HTMLInputElement;
document.body.appendChild(fileInput);

export const onCreateNew = async (ext: string): Promise<void> => {
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
export const openLocalFile = async (file: File): Promise<void> => {
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

export const openDocumentFromUrl = async (
  url: string,
  fileName?: string,
  options?: {
    readonly?: boolean;
    fetchOptions?: RequestInit;
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
  } catch (error) {
    console.error('Error opening document from URL:', error);
    alert(`Failed to open document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    if (showControlPanelFn) {
      showControlPanelFn();
    }
  } finally {
    removeLoading();
  }
};
