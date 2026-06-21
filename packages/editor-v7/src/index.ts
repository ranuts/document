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

export { X2TConverter } from './document-converter';

export type {
  EmscriptenModule,
  EmscriptenFileSystem,
  ConversionResult,
  BinConversionResult,
  DocumentType,
  SaveEvent,
} from './document-types';

export {
  getDocumentType,
  getBasePath,
  BASE_PATH,
  DOCUMENT_TYPE_MAP,
  getMimeTypeFromExtension,
} from './document-utils';

export {
  t,
  getLanguage,
  setLanguage,
  getOnlyOfficeLang,
  LanguageCode,
} from './i18n';

export { g_sEmpty_bin } from './empty_bin';
