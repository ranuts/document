import { readSlideShapeText, type SlideTextShape } from './slide-text-read';
interface Paragraph {
  Content?: unknown[];
  TextPr?: { Set_RFonts(fonts: unknown): void };
  Recalc_CompiledPr?(): void;
}
interface EndRun {
  Type?: number;
  Content?: Array<{ Type?: number }>;
  Get_CompiledPr?(force: boolean): { RFonts?: { Copy?(): unknown } };
}
function unverified(): never {
  throw new Error('Document change could not be verified');
}
/** The native serializer reads Paragraph.TextPr for paragraph-end fonts.
 * Materialize effective fonts only for separators inserted by the owned paste.
 */
export function preserveSlideParagraphEndFonts(shape: SlideTextShape, start: number, end: number): void {
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start) unverified();
  const content = shape.getDocContent?.();
  if (!Array.isArray(content?.Content)) unverified();
  const changes: Array<{ paragraph: Paragraph; fonts: unknown }> = [];
  let offset = 0;
  for (const value of content.Content) {
    if (!value || typeof value !== 'object') unverified();
    const paragraph = value as Paragraph;
    const text = readSlideShapeText({ getDocContent: () => ({ Content: [paragraph], GetText: () => '' }) });
    if (text === undefined) unverified();
    const length = text.replace(/\r\n?/g, '\n').length;
    const endOffset = offset + length - 1;
    if (endOffset >= start && endOffset < end) {
      const run = paragraph.Content?.at(-1) as EndRun | undefined;
      if (
        run?.Type !== 39 ||
        run.Content?.length !== 1 ||
        run.Content[0].Type !== 4 ||
        typeof paragraph.TextPr?.Set_RFonts !== 'function' ||
        typeof paragraph.Recalc_CompiledPr !== 'function'
      )
        unverified();
      const original = run.Get_CompiledPr?.(false).RFonts;
      const fonts = original?.Copy?.();
      if (!fonts || typeof fonts !== 'object' || fonts === original) unverified();
      changes.push({ paragraph, fonts });
    }
    offset += length;
  }
  if (end > offset) unverified();
  for (const { paragraph, fonts } of changes) {
    paragraph.TextPr!.Set_RFonts(fonts);
    paragraph.Recalc_CompiledPr!();
  }
}
