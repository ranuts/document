import { isHtmlDocument, isZipContainer, saveFileToDisk as ranutsSaveFileToDisk } from 'ranuts/utils';
import 'ranui/message';
import { t } from '@ranuts/shared/i18n';
import { getDocumentMimeType } from '@ranuts/shared/document-utils';

/**
 * What a file is, and how it leaves the browser.
 *
 * Signatures, media types and the descriptions a save dialog shows -- the
 * facts about a document that the converter needs but that have nothing to do
 * with running x2t.
 */
// Serialized editor documents start with a 4-byte engine signature.
const EDITOR_BIN_SIGNATURES = new Set(['DOCY', 'XLSY', 'PPTY', 'VSDY']);

export function hasEditorBinSignature(bin: Uint8Array): boolean {
  if (bin.length < 4) return false;
  return EDITOR_BIN_SIGNATURES.has(String.fromCharCode(bin[0]!, bin[1]!, bin[2]!, bin[3]!));
}

// Byte sniffing lives in ranuts (ecosystem first): a ZIP container is what the
// v9 engine's offline save trigger emits instead of an editor bin, and the HTML
// sniff catches "this .xls is really an HTML <table>", which the bundled
// x2t.wasm cannot import at all (its HTML importer is stubbed out).
export { isHtmlDocument, isZipContainer };

const FILE_DESCRIPTION_MAP: Record<string, string> = {
  docx: 'Word Document',
  doc: 'Word 97-2003 Document',
  odt: 'OpenDocument Text',
  pdf: 'PDF Document',
  xlsx: 'Excel Workbook',
  xls: 'Excel 97-2003 Workbook',
  ods: 'OpenDocument Spreadsheet',
  pptx: 'PowerPoint Presentation',
  ppt: 'PowerPoint 97-2003 Presentation',
  odp: 'OpenDocument Presentation',
  txt: 'Text Document',
  rtf: 'Rich Text Format',
  csv: 'CSV File',
};

/**
 * Save a finished file to the user's disk. Adapter over ranuts'
 * `saveFileToDisk` (File System Access API with an anchor fallback): this
 * build adds the document-flavoured type description the picker shows and the
 * ranui success toast. A dismissed dialog resolves without a toast; any other
 * failure rejects so the caller can surface it. Shared by the convert-and-
 * download path and the v9 file-stream save path (lib/onlyoffice-editor.ts).
 */
export async function saveFileToDisk(data: Blob | Uint8Array, fileName: string, mimeType?: string): Promise<void> {
  const extension = fileName.split('.').pop()?.toLowerCase() || '';
  const written = await ranutsSaveFileToDisk(data, fileName, {
    mimeType: mimeType || getDocumentMimeType(fileName),
    description: FILE_DESCRIPTION_MAP[extension] || 'Document',
  });
  if (!written) return;
  // ranui/message registers a global `window.message` toast API (untyped).
  (window as unknown as { message?: { success?: (msg: string) => void } }).message?.success?.(
    `${t('fileSavedSuccess')}${fileName}`,
  );
}

export const MIME_MAP: Record<string, string> = {
  gif: 'image/gif',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  svg: 'image/svg+xml',
  webp: 'image/webp',
  bmp: 'image/bmp',
  tiff: 'image/tiff',
  tif: 'image/tiff',
  emf: 'image/x-emf',
  wmf: 'image/x-wmf',
};
