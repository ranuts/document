import { getExtensions } from 'ranuts/utils';
import { t } from '@ranuts/shared/i18n';
import { X2TConverter } from '@ranuts/converter';
import { createEditorInstance, loadEditorApi } from './onlyoffice-editor';
import { getDocumentType } from '@ranuts/shared/document-utils';

// Export types
export type { ConversionResult, BinConversionResult, EmscriptenModule, DocumentType } from '@ranuts/shared/document-types';

// Export constants
export { oAscFileType, c_oAscFileType2 } from './file-types';

// Export utilities
export { getDocumentType, getBasePath, BASE_PATH, DOCUMENT_TYPE_MAP } from '@ranuts/shared/document-utils';

// SheetJS-only converter used for the CSV open path below; the page never
// loads the x2t WASM itself -- all document conversion happens inside the
// editor iframe via its bundled x2t_helper.
const x2tConverter = new X2TConverter();

// Export editor functions
export { createEditorInstance, loadEditorApi };

// Merged file operation method
export async function handleDocumentOperation(options: {
  isNew: boolean;
  fileName: string;
  file?: File;
  readonly?: boolean;
}): Promise<void> {
  try {
    const { isNew, fileName, file, readonly = false } = options;
    const fileType = fileName.split('.').pop() || getExtensions(file?.type || '')[0] || '';
    const _docType = getDocumentType(fileType);
    // The type the editor is asked to open as; differs from the file's own
    // extension only for the CSV case below.
    let openFileType = fileType;

    // New documents pass no binData: the SDK creates a blank one when
    // document.url is undefined (no empty-template blob needed).
    let binData: ArrayBuffer | undefined;

    if (!isNew) {
      // The editor opens documents through its own internal converter (the
      // page hands it a blob URL, see createPersonalEditorInstance).
      if (!file) throw new Error(t('invalidFileObject'));
      if (fileType.toLowerCase() === 'csv') {
        // The vendor editor's internal x2t cannot ingest raw CSV (its import
        // needs delimiter/encoding parameters the bundled helper never
        // passes; opening one fails with a generic error dialog). Convert to
        // XLSX with SheetJS and open that instead; saves are converted back
        // to CSV in handleFileStreamMessage so the user still gets a .csv
        // out (GitHub #13/#33).
        const csvData = new Uint8Array(await file.arrayBuffer());
        const xlsxFile = await x2tConverter.convertCsvToXlsx(csvData, fileName);
        binData = await xlsxFile.arrayBuffer();
        openFileType = 'xlsx';
      } else {
        binData = await file.arrayBuffer();
      }
    }

    // Create editor instance (returns a Promise, uses queue internally)
    await createEditorInstance({
      fileName,
      fileType: openFileType,
      binData,
      readonly,
    });
  } catch (error: any) {
    console.error(`${t('documentOperationFailed')}`, error);
    alert(`${t('documentOperationFailed')}${error.message}`);
    throw error;
  }
}
