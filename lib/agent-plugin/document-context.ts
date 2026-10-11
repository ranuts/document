import { getEditorApi } from './editor-bridge';
import { readSlideTextSelection, type SlideTextShape } from './slide-text-read';
export interface DocumentContext {
  kind: 'word' | 'cell' | 'slide' | 'pdf';
  range?: string;
  page?: number;
  pages?: number;
  sheet?: string;
  selectionCharacters?: number;
}
export function captureDocumentContext(): DocumentContext | null {
  const api = getEditorApi();
  if (!api?.isDocumentLoadComplete || !api.isLoadFullApi) return null;
  // PDF has its own annotation API, not the Word body/selection contract.
  // Do not expose Word tools merely because spreadsheet/slide methods are absent.
  if (typeof api.isPdfEditor === 'function' && (api.isPdfEditor as () => boolean)()) {
    const page = typeof api.getCurrentPage === 'function' ? (api.getCurrentPage as () => number)() + 1 : undefined;
    const pages = (api.DocumentRenderer as { file?: { pages?: unknown[] } } | undefined)?.file?.pages?.length;
    return {
      kind: 'pdf',
      page,
      pages,
      selectionCharacters: api.pluginMethod_GetSelectedText?.({ TabSymbol: '\t', Numbering: false }).length ?? 0,
    };
  }
  if (typeof api.asc_getActiveRangeStr === 'function') {
    const range = (api.asc_getActiveRangeStr as () => string)();
    let sheet =
      typeof api.asc_getActiveWorksheetName === 'function'
        ? (api.asc_getActiveWorksheetName as () => string)()
        : undefined;
    if (
      !sheet &&
      typeof api.asc_getWorksheetName === 'function' &&
      typeof api.asc_getActiveWorksheetIndex === 'function'
    )
      sheet = (api.asc_getWorksheetName as (index: number) => string)(
        (api.asc_getActiveWorksheetIndex as () => number)(),
      );
    return {
      kind: 'cell',
      ...(typeof range === 'string' && /^[A-Z]{1,3}[1-9]\d*(?::[A-Z]{1,3}[1-9]\d*)?$/.test(range) ? { range } : {}),
      ...(typeof sheet === 'string' ? { sheet: sheet.slice(0, 80) } : {}),
    };
  }
  const logic = (
    api.WordControl as
      | {
          m_oLogicDocument?: {
            Slides?: unknown[];
            GetCurrentController?(): { getTargetDocContent?: SlideTextShape['getDocContent'] } | undefined;
          };
        }
      | undefined
  )?.m_oLogicDocument;
  const slides = logic?.Slides;
  if (slides) {
    const page = typeof api.getCurrentPage === 'function' ? (api.getCurrentPage as () => number)() + 1 : undefined;
    const controller = logic?.GetCurrentController?.();
    const selection = controller?.getTargetDocContent
      ? readSlideTextSelection({ getDocContent: () => controller.getTargetDocContent!() })
      : undefined;
    return { kind: 'slide', page, ...(selection ? { selectionCharacters: selection.selectedText.length } : {}) };
  }
  return {
    kind: 'word',
    selectionCharacters: api.pluginMethod_GetSelectedText?.({ TabSymbol: '\t', Numbering: false }).length ?? 0,
  };
}
/** Resolve only explicit selection references; never infer an entire column from one cell. */
export function resolveContextCommand(input: string, context: DocumentContext | null): string {
  if (context?.kind !== 'cell' || !context.range?.includes(':')) return input;
  const range = context.range;
  if (/^(?:计算|求)选区的?(?:总和|求和)$/.test(input)) return `计算 ${range} 的总和`;
  const target = /^将选区的总和写入\s*([A-Z]{1,3}[1-9]\d*)$/i.exec(input);
  if (target) return `将 ${range} 的总和写入 ${target[1]}`;
  const sort = /^将选区按\s*([A-Z]{1,3})\s*列(升序|降序)排序[，,]?\s*(首行为表头|无表头)$/i.exec(input);
  if (sort) return `将 ${range} 按 ${sort[1]} 列${sort[2]}排序，${sort[3]}`;
  if (/^sum (?:the )?selection$/i.test(input)) return `sum ${range}`;
  return input;
}
