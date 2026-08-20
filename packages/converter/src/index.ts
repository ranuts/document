/**
 * @ranuts/converter — in-browser Office conversion via OnlyOffice x2t (WASM).
 *
 * The x2t WASM module is expected on `window.Module` (loaded by the host); this
 * package wraps it with a typed converter plus DOCX/PPTX media + line-break
 * preprocessing. Depends on @ranuts/shared for types / file-type utils / i18n.
 */
export {
  X2TConverter,
  canStreamWasm,
  hasEditorBinSignature,
  isHtmlDocument,
  isZipContainer,
  saveFileToDisk,
  sniffAndRebuild,
  x2tInstantiateError,
  CANVAS_PDF_INPUT_FORMAT,
  PDF_OUTPUT_FORMAT,
} from './document-converter';
export {
  extractDocxMediaUrls,
  preprocessDocxRuby,
  preprocessPptx,
  preprocessXlsxLineBreaks,
  unwrapRubyXml,
} from './docx-zip';
