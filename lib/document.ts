import { createObjectURL } from 'ranuts/utils';
import { getDocmentObj, setDocmentObj } from '../store';
import { handleDocumentOperation, initX2T, loadEditorApi, loadScript } from './converter';
import { showLoading } from './loading';

// Import UI functions with type-only to avoid circular dependency
// These will be passed as callbacks or called after document operations
let hideControlPanelFn: (() => void) | null = null;
let showControlPanelFn: (() => void) | null = null;
let showMenuGuideFn: (() => void) | null = null;

export function setUICallbacks(callbacks: {
  hideControlPanel: () => void;
  showControlPanel: () => void;
  showMenuGuide: () => void;
}): void {
  hideControlPanelFn = callbacks.hideControlPanel;
  showControlPanelFn = callbacks.showControlPanel;
  showMenuGuideFn = callbacks.showMenuGuide;
}

// Create a single file input element
const fileInput = document.createElement('input');
fileInput.type = 'file';
fileInput.accept = '.docx,.xlsx,.pptx,.doc,.xls,.ppt,.csv';
fileInput.style.setProperty('visibility', 'hidden');
document.body.appendChild(fileInput);

export const onCreateNew = async (ext: string): Promise<void> => {
  // Note: Loading is now shown in the menu button click handler
  // This function should not show loading again to avoid double loading indicators
  try {
    // Always hide control panel and ensure FAB is visible when creating new document
    if (hideControlPanelFn) {
      hideControlPanelFn();
    }
    setDocmentObj({
      fileName: 'New_Document' + ext,
      file: undefined,
    });
    await loadScript();
    await loadEditorApi();
    await initX2T();
    const { fileName, file: fileBlob } = getDocmentObj();
    await handleDocumentOperation({ file: fileBlob, fileName, isNew: !fileBlob });
    // Show menu guide after document is loaded
    if (showMenuGuideFn) {
      setTimeout(() => {
        showMenuGuideFn!();
      }, 1000);
    }
  } catch (error) {
    console.error('Error creating new document:', error);
    // Ensure control panel is shown on error
    if (showControlPanelFn) {
      showControlPanelFn();
    }
    throw error; // Re-throw to let the menu button handler catch it
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
        await initX2T();
        const { fileName, file: fileBlob } = getDocmentObj();
        await handleDocumentOperation({ file: fileBlob, fileName, isNew: !fileBlob });
        // Clear file selection so the same file can be selected again
        fileInput.value = '';
        // Show menu guide after document is loaded
        if (showMenuGuideFn) {
          setTimeout(() => {
            showMenuGuideFn!();
          }, 1000);
        }
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
    }
    // If no file selected, nothing happens (user cancelled)
  };

  // Set the change handler
  fileInput.onchange = handleChange;

  // Trigger file picker click event
  fileInput.click();
};

export const openDocumentFromUrl = async (url: string, fileName?: string): Promise<void> => {
  const { removeLoading } = showLoading();
  try {
    if (hideControlPanelFn) {
      hideControlPanelFn();
    }

    // Fetch the file from URL
    console.log('Fetching document from URL:', url);
    // eslint-disable-next-line n/no-unsupported-features/node-builtins
    const response = await fetch(url);

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

      // If still no filename, extract from URL
      if (!finalFileName) {
        try {
          const urlObj = new URL(url);
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
    await initX2T();
    const { fileName: docFileName, file: fileBlob } = getDocmentObj();
    await handleDocumentOperation({ file: fileBlob, fileName: docFileName, isNew: !fileBlob });

    // Show menu guide after document is loaded
    if (showMenuGuideFn) {
      setTimeout(() => {
        showMenuGuideFn!();
      }, 1000);
    }
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
