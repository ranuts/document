/** Native PDF text extraction. Virtual selection keeps the user's caret/selection untouched. */
interface PdfFile {
  pages: Array<{ text?: unknown }>;
  copySelection?(page: number, output: { Text: string }): unknown;
}
export interface PdfPageText {
  page: number;
  pages: number;
  text: string;
  truncated: boolean;
}
export function readPdfPageText(
  api: { DocumentRenderer?: unknown },
  page: number,
  maxChars = 8000,
): PdfPageText | undefined {
  const file = (api.DocumentRenderer as { file?: PdfFile } | undefined)?.file;
  if (!file?.pages || !file.copySelection) return undefined;
  if (!Number.isInteger(page) || page < 1 || page > file.pages.length) throw new Error('Invalid PDF page');
  if (!Number.isInteger(maxChars) || maxChars < 1 || maxChars > 8000) throw new Error('Invalid maximum text length');
  if (!file.pages[page - 1]?.text) return undefined;
  const reader = Object.create(file);
  reader.isSelectionUse = () => true;
  reader.sortSelection = () => ({
    Page1: page - 1,
    Page2: page - 1,
    Line1: 0,
    Line2: Infinity,
    Glyph1: 0,
    Glyph2: Infinity,
  });
  const output = { Text: '' };
  file.copySelection.call(reader, page - 1, output);
  const text = output.Text.replace(/\r\n?/g, '\n');
  return { page, pages: file.pages.length, text: text.slice(0, maxChars), truncated: text.length > maxChars };
}
