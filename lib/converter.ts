import { getExtensions } from 'ranuts/utils';
import { g_sEmpty_bin } from './empty_bin';
import { t } from '@ranuts/shared/i18n';
import { X2TConverter } from '@ranuts/converter';
import { OO_VARIANT, createEditorInstance, loadEditorApi, setConverterCallbacks } from './onlyoffice-editor';
import { getDocumentType } from '@ranuts/shared/document-utils';
import type { BinConversionResult, ConversionResult, EmscriptenModule } from '@ranuts/shared/document-types';

// Export types
export type {
  ConversionResult,
  BinConversionResult,
  EmscriptenModule,
  DocumentType,
  SaveEvent,
} from '@ranuts/shared/document-types';

// Export constants
export { oAscFileType, c_oAscFileType2 } from './file-types';

// Export utilities
export { getDocumentType, getBasePath, BASE_PATH, DOCUMENT_TYPE_MAP } from '@ranuts/shared/document-utils';

// Singleton instance
const x2tConverter = new X2TConverter();

// Export converter methods.
// v9 (OnlyOffice Personal vendor build) runs all conversion inside the editor
// iframe via its own bundled x2t_helper; the page-level x2t WASM is neither
// shipped nor needed there, so loading it becomes a no-op.
export const loadScript = (): Promise<void> => (OO_VARIANT === 'v9' ? Promise.resolve() : x2tConverter.loadScript());
export const initX2T = (): Promise<EmscriptenModule | null> =>
  OO_VARIANT === 'v9' ? Promise.resolve(null) : x2tConverter.initialize();
export const convertDocument = (file: File): Promise<ConversionResult> => x2tConverter.convertDocument(file);
export const convertBinToDocument = (
  bin: Uint8Array,
  fileName: string,
  targetExt?: string,
  media?: Record<string, string>,
): Promise<BinConversionResult> => x2tConverter.convertBinToDocument(bin, fileName, targetExt, media);
export const convertBinToDocumentAndDownload = (
  bin: Uint8Array,
  fileName: string,
  targetExt?: string,
  media?: Record<string, string>,
): Promise<BinConversionResult> => x2tConverter.convertBinToDocumentAndDownload(bin, fileName, targetExt, media);

// Export editor functions
export { createEditorInstance, loadEditorApi };

// Set up converter callback for editor
setConverterCallbacks({
  convert: convertBinToDocument,
  convertAndDownload: convertBinToDocumentAndDownload,
});

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
    // extension only for the v9 CSV case below.
    let openFileType = fileType;

    // Get document content
    let documentData: {
      bin: ArrayBuffer | string;
      media?: any;
    };

    if (isNew) {
      // New document uses empty template
      const emptyBin = g_sEmpty_bin[`.${fileType}`];
      if (!emptyBin) {
        throw new Error(`${t('unsupportedFileType')}${fileType}`);
      }
      documentData = { bin: emptyBin };
    } else if (OO_VARIANT === 'v9') {
      // v9 opens documents through the editor's own internal converter (the
      // page hands it a blob URL, see createPersonalEditorInstance) -- the
      // page-level x2t is not involved at all.
      if (!file) throw new Error(t('invalidFileObject'));
      if (fileType.toLowerCase() === 'csv') {
        // The vendor editor's internal x2t cannot ingest raw CSV (its import
        // needs delimiter/encoding parameters the bundled helper never
        // passes; opening one fails with a generic error dialog). Reuse the
        // proven v7 SheetJS conversion and open the equivalent XLSX instead;
        // saves are converted back to CSV in handleFileStreamMessage so the
        // user still gets a .csv out (GitHub #13/#33).
        const csvData = new Uint8Array(await file.arrayBuffer());
        const xlsxFile = await x2tConverter.convertCsvToXlsx(csvData, fileName);
        documentData = { bin: await xlsxFile.arrayBuffer() };
        openFileType = 'xlsx';
      } else {
        documentData = { bin: await file.arrayBuffer() };
      }
    } else {
      // Opening existing document requires conversion
      if (!file) throw new Error(t('invalidFileObject'));
      // @ts-expect-error convertDocument handles the file type conversion
      documentData = await convertDocument(file);
    }

    // Create editor instance (now returns a Promise, uses queue internally)
    await createEditorInstance({
      fileName,
      fileType: openFileType,
      binData: documentData.bin,
      media: documentData.media,
      readonly,
    });
  } catch (error: any) {
    console.error(`${t('documentOperationFailed')}`, error);
    alert(`${t('documentOperationFailed')}${error.message}`);
    throw error;
  }
}
