import { captureDocumentContext, type DocumentContext } from '../document-context';
import { getEditorApi } from '../editor-bridge';
import { readSlideTextSelection, type SlideTextShape } from '../slide-text-read';
import { parseOfficeRange } from '../office-tools';
export interface ComposerContext {
  context: DocumentContext | null;
  text: string;
  truncated: boolean;
}
/** Read only the current selection. Bound range reads before visiting SDK cells. */
export function captureComposerContext(): ComposerContext {
  const context = captureDocumentContext();
  const api = getEditorApi();
  let text = '';
  let truncated = false;
  try {
    if (context?.kind === 'word' || context?.kind === 'pdf')
      text = api?.pluginMethod_GetSelectedText({ TabSymbol: '\t', Numbering: false }) ?? '';
    else if (context?.kind === 'slide') {
      const logic = (
        api?.WordControl as
          | {
              m_oLogicDocument?: { GetCurrentController?(): { getTargetDocContent?: SlideTextShape['getDocContent'] } };
            }
          | undefined
      )?.m_oLogicDocument;
      const content = logic?.GetCurrentController?.()?.getTargetDocContent?.();
      text = readSlideTextSelection({ getDocContent: () => content })?.selectedText ?? '';
    } else if (context?.kind === 'cell' && context.range) {
      if (
        !context.sheet &&
        typeof api?.asc_getWorksheetName === 'function' &&
        typeof api?.asc_getActiveWorksheetIndex === 'function'
      ) {
        const name = (api.asc_getWorksheetName as (index: number) => string)(
          (api.asc_getActiveWorksheetIndex as () => number)(),
        );
        if (typeof name === 'string') context.sheet = name.slice(0, 80);
      }
      const range = parseOfficeRange(context.range);
      const count = (range.r2 - range.r1 + 1) * (range.c2 - range.c1 + 1);
      if (count > 200) return { context, text: '', truncated: true };
      const model = (
        api as unknown as {
          wb?: {
            getWorksheet(): {
              model: { getRange3(r1: number, c1: number, r2: number, c2: number): { getValue(): string } };
            };
          };
        }
      )?.wb?.getWorksheet().model;
      if (model) {
        const rows: string[] = [];
        for (let row = range.r1; row <= range.r2; row++) {
          const values: string[] = [];
          for (let col = range.c1; col <= range.c2; col++) values.push(model.getRange3(row, col, row, col).getValue());
          rows.push(values.join('\t'));
        }
        text = rows.join('\n');
      }
    }
  } catch {
    if (context?.kind === 'cell') truncated = true;
    text = '';
  }
  text = text.replace(/\r\n/g, '\n');
  truncated ||= text.length > 8000;
  return { context, text: text.slice(0, 8000), truncated };
}
