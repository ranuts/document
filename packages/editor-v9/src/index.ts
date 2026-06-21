// Editor lifecycle
export {
  createEditorInstance,
  loadEditorApi,
  setReadonlyMode,
  getReadonlyMode,
  requestSaveDocument,
  setConverterCallbacks,
  setDocumentStateGetter,
  getSavedFileMimeType,
  getNormalizedFile,
  toUint8Array,
} from './onlyoffice-editor';

// Converter
export { X2TConverter } from './document-converter';

// Types
export type {
  BinConversionResult,
  ConversionResult,
  DocumentType,
  EmscriptenFileSystem,
  EmscriptenModule,
  SaveEvent,
} from './document-types';

// Utilities
export { getDocumentType, getBasePath, getMimeTypeFromExtension, BASE_PATH, DOCUMENT_TYPE_MAP } from './document-utils';

// i18n
export { t, getLanguage, setLanguage, getOnlyOfficeLang, LanguageCode } from './i18n';

// Empty document templates
export { g_sEmpty_bin, g_sEmpty_ooxml } from './empty_bin';

// DOCX/XLSX/PPTX ZIP processing
export { extractDocxMediaUrls, preprocessXlsxLineBreaks, preprocessPptx } from './docx-zip';

// Media player
export { showMediaPlayer, hideMediaPlayer } from './media-player';
