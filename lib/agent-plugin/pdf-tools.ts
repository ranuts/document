import type { AgentTool } from '@ranuts/agent-core/types';
import { requireEditorContext, requireEditorApi, type EditorApi } from './editor-bridge';
import { readPdfPageText } from './pdf-text-read';
import { getReadonlyMode } from '../onlyoffice/readonly';
interface PdfAnnotation {
  GetId(): string;
  GetPage(): number;
  GetContents(): string;
}
export interface PdfDocument {
  annots: PdfAnnotation[];
  History: { Index: number; Points: Array<{ Items: unknown[] }> };
  DoAction(action: () => string, description: number): string | false;
  CancelAction(): void;
  AddAnnot(annot: PdfAnnotation, page: number): void;
}
export function getPdfDocument(api: EditorApi): PdfDocument {
  if (
    !api.isDocumentLoadComplete ||
    !api.isLoadFullApi ||
    typeof api.isPdfEditor !== 'function' ||
    !(api.isPdfEditor as () => boolean)()
  )
    throw new Error('PDF is not ready');
  if (typeof api.getPDFDoc !== 'function') throw new Error('PDF comments are unavailable');
  return (api.getPDFDoc as () => PdfDocument)();
}
export const getPdfTextTool: AgentTool = {
  name: 'get_pdf_text',
  description:
    'PDF only. Read selectable text on one loaded page (default current page), without changing selection. Returns exact page scope; does not read scanned images or the whole file.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: { page: { type: 'integer', minimum: 1 }, maxChars: { type: 'integer', minimum: 1, maximum: 8000 } },
  },
  readOnlyHint: true,
  execute: async (input) => {
    const api = requireEditorApi();
    getPdfDocument(api);
    const page = input.page ?? (api.getCurrentPage as () => number)() + 1;
    const read = readPdfPageText(api, Number(page), Number(input.maxChars ?? 8000));
    return read ? { ...read, scope: 'pdf-page' } : { page, scope: 'pdf-page', unavailable: true };
  },
};
export const addPdfCommentTool: AgentTool = {
  name: 'add_pdf_comment',
  readOnlyHint: false,
  description:
    'PDF only. Add one page note to the supplied page after user review. Does not replace PDF body text or annotate selected glyphs. Text is the note content.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['page', 'text'],
    properties: { page: { type: 'integer', minimum: 1 }, text: { type: 'string', minLength: 1, maxLength: 8000 } },
  },
  execute: async (input, signal) => {
    signal?.throwIfAborted();
    const ctx = requireEditorContext();
    const api = ctx.api;
    const doc = getPdfDocument(api);
    const count = (api.DocumentRenderer as { file: { pages: unknown[] } }).file.pages.length;
    const page = Number(input.page);
    if (
      !Number.isInteger(page) ||
      page < 1 ||
      page > count ||
      typeof input.text !== 'string' ||
      !input.text.trim() ||
      input.text.length > 8000
    )
      throw new Error('Invalid PDF comment');
    if (getReadonlyMode() || api.isViewMode) throw new Error('This PDF is read only');
    const pdf = ctx.AscPDF;
    const description = ctx.AscDFH?.historydescription_Pdf_AddComment;
    if (!pdf || description === undefined || !ctx.AscCommon?.CreateGUID)
      throw new Error('PDF comments are unavailable');
    if (typeof doc.CancelAction !== 'function') throw new Error('PDF comments are unavailable');
    let failed = false;
    let failure: unknown;
    const id = doc.DoAction(() => {
      try {
        const annot = pdf.CreateAnnotByProps(
          {
            rect: [20, 20, 40, 40],
            name: ctx.AscCommon!.CreateGUID!(),
            type: pdf.ANNOTATIONS_TYPES.Text,
            contents: input.text,
            author: 'AI assistant',
          },
          doc,
        );
        doc.AddAnnot(annot, page - 1);
        return annot.GetId();
      } catch (error) {
        failed = true;
        failure = error;
        doc.CancelAction();
        return '';
      }
    }, description);
    if (failed) throw failure;
    const stored = doc.annots.find((annot) => annot.GetId() === id);
    if (!stored || stored.GetPage() !== page - 1 || stored.GetContents() !== input.text)
      throw new Error('PDF comment could not be verified');
    return { id, page, text: stored.GetContents(), verified: true };
  },
};
