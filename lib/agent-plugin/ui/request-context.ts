import { readPdfPageText } from '../pdf-text-read';
import { getEditorApi } from '../editor-bridge';
import { readWordBodyText } from '../word-text-read';
import { readPresentationShapeText } from '../slide-text-read';
import { captureComposerContext } from './composer-context';
import type { DocumentContext } from '../document-context';

interface ReadContent {
  page?: number;
  pages?: number;
  scope: 'pdf-page' | 'document-body' | 'active-sheet-used-range' | 'presentation-text';
  text?: string;
  range?: string;
  truncated?: boolean;
  unavailable?: true;
}
export interface RequestContext {
  editor: DocumentContext | null;
  selection: { text: string; truncated: boolean };
  content?: ReadContent;
}
const MAX_CHARACTERS = 8000;
const MAX_CELLS = 2000;
function column(index: number): string {
  let result = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26))
    result = String.fromCharCode(65 + ((n - 1) % 26)) + result;
  return result;
}
/** Fresh reference data for this request. Never selects all or changes the cursor. */
export function captureRequestContext(): RequestContext {
  const selected = captureComposerContext();
  const result: RequestContext = {
    editor: selected.context,
    selection: { text: selected.text, truncated: selected.truncated },
  };
  const api = getEditorApi();
  if (!selected.context || !api) return result;
  const scope: ReadContent['scope'] =
    selected.context.kind === 'pdf'
      ? 'pdf-page'
      : selected.context.kind === 'cell'
        ? 'active-sheet-used-range'
        : selected.context.kind === 'slide'
          ? 'presentation-text'
          : 'document-body';
  result.content = { scope, unavailable: true };
  if (selected.context.kind === 'pdf') {
    const page = selected.context.page;
    result.content = { scope, page, pages: selected.context.pages, unavailable: true };
    if (page) {
      try {
        const read = readPdfPageText(api, page);
        if (read) result.content = { scope, ...read };
      } catch {
        /* Keep unavailable distinct from an empty page. */
      }
    }
    return result;
  }
  try {
    let text: string | undefined;
    let truncated = false;
    let range: string | undefined;
    const logic = (api.WordControl as { m_oLogicDocument?: unknown } | undefined)?.m_oLogicDocument;
    if (selected.context.kind === 'word') text = readWordBodyText(logic);
    else if (selected.context.kind === 'slide') {
      const slides = (
        logic as { Slides?: Array<{ cSld: { spTree: Parameters<typeof readPresentationShapeText>[0][] } }> }
      )?.Slides;
      if (slides) {
        text = '';
        for (const [index, slide] of slides.entries()) {
          const body = slide.cSld.spTree.map(readPresentationShapeText).filter(Boolean).join('\n');
          if (body) text += `${text ? '\n\n' : ''}Slide ${index + 1}:\n${body}`;
          if (text.length > MAX_CHARACTERS) {
            truncated = true;
            break;
          }
        }
      }
    } else {
      const model = (
        api.wb as
          | {
              getWorksheet(): {
                model: {
                  getMinimalRange?(): { r1: number; r2: number; c1: number; c2: number } | null;
                  getRange3(r1: number, c1: number, r2: number, c2: number): { getValue(): string };
                };
              };
            }
          | undefined
      )?.getWorksheet().model;
      if (model?.getMinimalRange) {
        const bounds = model.getMinimalRange();
        text = '';
        if (bounds) {
          if (
            ![bounds.r1, bounds.r2, bounds.c1, bounds.c2].every((n) => Number.isInteger(n) && n >= 0) ||
            bounds.r2 < bounds.r1 ||
            bounds.c2 < bounds.c1 ||
            bounds.r2 >= 1048576 ||
            bounds.c2 >= 16384
          )
            throw new Error('Invalid used range');
          const endColumn = Math.min(bounds.c2, bounds.c1 + 19);
          const endRow = Math.min(bounds.r2, bounds.r1 + Math.floor(MAX_CELLS / (endColumn - bounds.c1 + 1)) - 1);
          const rows: string[] = [];
          for (let row = bounds.r1; row <= endRow; row++) {
            const cells: string[] = [];
            for (let col = bounds.c1; col <= endColumn; col++)
              cells.push(model.getRange3(row, col, row, col).getValue());
            rows.push(cells.join('\t'));
          }
          range = `${column(bounds.c1)}${bounds.r1 + 1}:${column(endColumn)}${endRow + 1}`;
          text = rows.join('\n');
          truncated = endColumn < bounds.c2 || endRow < bounds.r2;
        }
      }
    }
    if (typeof text === 'string')
      result.content = {
        scope,
        text: text.slice(0, MAX_CHARACTERS),
        truncated: truncated || text.length > MAX_CHARACTERS,
        ...(range ? { range } : {}),
      };
  } catch {
    /* An unavailable read must not be represented as an empty document. */
  }
  return result;
}
