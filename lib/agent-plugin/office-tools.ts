import { writeExcelCellValue } from './excel-cell-write';
import type { AgentTool } from '@ranuts/agent-core/types';
import { requireEditorApi, getEditorContext, type EditorApi } from './editor-bridge';
import { pasteSlideText, type NativePasteApi } from './native-paste';
import { withBlockingEditorAction } from './editor-action';
import { preserveNativeRedo } from './native-redo';
import { positionSlideText } from './slide-text-position';
import { inheritedSlideShapes, type InheritedSlide } from './slide-text-obstacles';
import { readSlideShapeBounds } from './slide-text-layout';
import { getReadonlyMode } from '../onlyoffice/readonly';
import { readSlideShapeText, readSlideTextSelection, type SlideTextShape } from './slide-text-read';
import { preserveSlideParagraphEndFonts } from './slide-paragraph-fonts';

interface CellRange {
  getValueData(): { value: { type: number } } | null;
  getValue(): string;
  getFormula(): string;
  getNumberValue(): number | null;
  hasMerged?(): unknown;
}
interface SheetModel {
  getRange3(r1: number, c1: number, r2: number, c2: number): CellRange;
  getSheetProtection?(): unknown;
  isUserProtectedRangesIntersection?(range: unknown): boolean;
  TableParts?: unknown[];
  AutoFilter?: unknown;
  pivotTables?: unknown[];
  selectionRange: { activeCell: { row: number; col: number } };
}
interface SheetView {
  model: SheetModel;
  setSelection(range: unknown): void;
}
interface OfficeApi extends EditorApi {
  canEdit?(): boolean;
  isSlideShow?(): boolean;
  isLongAction?(): boolean;
  sync_StartAction?(type: number, action: number): void;
  sync_EndAction?(type: number, action: number): void;
  ImgApply?(properties: { Width?: number; Position?: { X: number; Y: number } }): void;
  wb?: { getWorksheet(): SheetView };
  asc_sortCells?(options: { type: number }): void;
  WordControl?: {
    m_oLogicDocument?: {
      Slides?: Array<
        InheritedSlide & {
          cSld: {
            spTree: Array<{
              bounds?: { l: number; t: number; r: number; b: number };
              getText?(): string;
              getDocContent?(): { GetText(options: Record<string, never>): string };
            }>;
          };
        }
      >;
      GetCurrentController?(): {
        resetSelection(): void;
        getTargetDocContent?: SlideTextShape['getDocContent'];
        selectedObjects?: Array<{ bounds?: { l: number; t: number; r: number; b: number } }>;
      };
      GetWidthMM?(): number;
      GetHeightMM?(): number;
      IsMasterMode?(): boolean;
      CanEdit?(): boolean;
      Recalculate?(data?: { Drawings: { All: boolean; Map: Record<string, never> } }): void;
      Document_UpdateInterfaceState?(): void;
      GetSelectedSlides?(): number[];
    };
  };
  AddSlide?(): void;
  DublicateSlide?(): void;
  goToPage?(index: number): void;
  getCurrentPage?(): number;
}
function fail(code: string): never {
  throw new Error(code);
}
function ready(write: boolean): OfficeApi {
  if (write && getReadonlyMode()) fail('Document is read-only');
  const api = requireEditorApi() as OfficeApi;
  if (!api.isDocumentLoadComplete || !api.isLoadFullApi) fail('Editor is still loading');
  if (write && (api.isViewMode === true || api.canEdit?.() === false)) fail('Document is read-only');
  return api;
}
export function parseOfficeRange(input: string) {
  if (typeof input !== 'string') return fail('officeInvalidRange');
  const match = /^([A-Z]{1,3})([1-9]\d*)(?::([A-Z]{1,3})([1-9]\d*))?$/.exec(input.toUpperCase());
  if (!match) return fail('officeInvalidRange');
  const column = (letters: string) =>
    [...letters].reduce((value, letter) => value * 26 + letter.charCodeAt(0) - 64, 0) - 1;
  const c1 = column(match[1]),
    r1 = Number(match[2]) - 1;
  const c2 = column(match[3] ?? match[1]),
    r2 = Number(match[4] ?? match[2]) - 1;
  if (c2 >= 16384 || r2 >= 1048576 || c1 > c2 || r1 > r2 || (c2 - c1 + 1) * (r2 - r1 + 1) > 5000)
    fail('officeInvalidRange');
  return { c1, c2, r1, r2 };
}
function sheet(api: OfficeApi): SheetView {
  const view = api.wb?.getWorksheet();
  if (!view?.model || typeof view.model.getRange3 !== 'function') return fail('officeSpreadsheetOnly');
  return view;
}
function ensureWritable(view: SheetView, range: ReturnType<typeof parseOfficeRange>) {
  if (view.model.getSheetProtection?.() || view.model.isUserProtectedRangesIntersection?.(range))
    fail('officeProtectedRange');
}
async function verify(api: OfficeApi, current: () => boolean, check: () => boolean) {
  for (let attempt = 0; attempt < 30; attempt++) {
    if (requireEditorApi() !== api || !current()) fail('This proposal has expired. Generate a new proposal.');
    if (check()) return;
    await new Promise<void>((resolve) => setTimeout(resolve, 50));
  }
  fail('The change could not be verified. Check the document and use Undo if needed.');
}
export const getRangeTool: AgentTool<{ range: string }, { range: string; text: string }> = {
  name: 'get_range',
  description:
    'Excel only. Read every cell in an explicit local range (max 5000 cells), with addresses and values. Never changes selection or cells.',
  inputSchema: {
    type: 'object',
    properties: { range: { type: 'string' } },
    required: ['range'],
    additionalProperties: false,
  },
  readOnlyHint: true,
  execute: async ({ range }, signal) => {
    const bounds = parseOfficeRange(range);
    const model = sheet(ready(false)).model;
    const lines = [range.toUpperCase()];
    let length = lines[0].length;
    for (let r = bounds.r1; r <= bounds.r2; r++) {
      for (let c = bounds.c1; c <= bounds.c2; c++) {
        signal?.throwIfAborted();
        let column = '';
        for (let n = c + 1; n > 0; n = Math.floor((n - 1) / 26))
          column = String.fromCharCode(65 + ((n - 1) % 26)) + column;
        const line = `${column}${r + 1}: ${JSON.stringify(model.getRange3(r, c, r, c).getValue())}`;
        length += line.length + 1;
        if (length > 80000) fail('officeRangeReadTooLarge');
        lines.push(line);
      }
    }
    return { range: range.toUpperCase(), text: lines.join('\n') };
  },
};

export function parseOfficeRanges(ranges: string): string[] {
  const list = ranges
    .toUpperCase()
    .split(',')
    .map((range) => range.trim());
  if (!list.length || list.length > 10) fail('officeInvalidRange');
  let cells = 0;
  for (const range of list) {
    const bounds = parseOfficeRange(range);
    cells += (bounds.r2 - bounds.r1 + 1) * (bounds.c2 - bounds.c1 + 1);
  }
  if (cells > 5000) fail('officeInvalidRange');
  return list;
}
export const getRangesTool: AgentTool<{ ranges: string }, { text: string }> = {
  name: 'get_ranges',
  description:
    'Excel only. Read all cells in up to 10 explicit comma-separated local regions, max 5000 cells total. Preserve each requested region. Never modifies cells or selection.',
  inputSchema: {
    type: 'object',
    properties: { ranges: { type: 'string' } },
    required: ['ranges'],
    additionalProperties: false,
  },
  readOnlyHint: true,
  execute: async ({ ranges }, signal) => {
    const list = parseOfficeRanges(ranges);
    const results: string[] = [];
    let length = 0;
    for (const range of list) {
      signal?.throwIfAborted();
      const result = await getRangeTool.execute({ range }, signal);
      length += result.text.length + (results.length ? 2 : 0);
      if (length > 80000) fail('officeRangeReadTooLarge');
      results.push(result.text);
    }
    signal?.throwIfAborted();
    return { text: results.join('\n\n') };
  },
};

export const sumRangeTool: AgentTool<
  { range: string; target?: string },
  { sum: number; range: string; target?: string; verified: true }
> = {
  name: 'sum_range',
  description:
    'Excel only. Sum numeric values in an explicit local range (max 5000 cells). Text and blanks are ignored as in SUM; errors are rejected. Optional explicit empty destination receives a verified SUM formula; never guesses a destination.',
  inputSchema: {
    type: 'object',
    properties: { range: { type: 'string' }, target: { type: 'string' } },
    required: ['range'],
    additionalProperties: false,
  },
  // The optional target makes this a potentially mutating tool.
  readOnlyHint: false,
  execute: async ({ range, target }, signal) => {
    signal?.throwIfAborted();
    const bounds = parseOfficeRange(range);
    const destination = target === undefined ? undefined : parseOfficeRange(target);
    if (
      destination &&
      (destination.c1 !== destination.c2 ||
        destination.r1 !== destination.r2 ||
        (destination.c1 >= bounds.c1 &&
          destination.c1 <= bounds.c2 &&
          destination.r1 >= bounds.r1 &&
          destination.r1 <= bounds.r2))
    )
      fail('officeInvalidTarget');
    const api = ready(!!destination),
      view = sheet(api),
      model = view.model;
    let sum = 0;
    for (let r = bounds.r1; r <= bounds.r2; r++)
      for (let c = bounds.c1; c <= bounds.c2; c++) {
        const cell = model.getRange3(r, c, r, c);
        if (destination && cell.getFormula()) fail('officeSumFormulaSource');
        // Bundled SDK AscCommon.CellValueType: Number=0, String=1, Bool=2, Error=3.
        const type = cell.getValueData()?.value.type;
        if (type === 3) fail('officeCellError');
        const number = cell.getNumberValue();
        if (type === 0 && typeof number === 'number') {
          if (!Number.isFinite(number)) fail('officeCellError');
          sum += number;
        }
      }
    if (!Number.isFinite(sum)) fail('officeCellError');
    if (destination) {
      ensureWritable(view, destination);
      const cell = model.getRange3(destination.r1, destination.c1, destination.r2, destination.c2);
      if (cell.getValue() || cell.getFormula() || cell.hasMerged?.()) fail('officeTargetNotEmpty');
      const formula = `SUM(${range.toUpperCase()})`;
      await writeExcelCellValue(
        target!,
        `=${formula}`,
        signal,
        () =>
          cell.getFormula().replace(/^=/, '').toUpperCase() === formula &&
          Math.abs((cell.getNumberValue() ?? NaN) - sum) <= 1e-9 * Math.max(1, Math.abs(sum)),
      );
    }
    return { sum, range, ...(target ? { target } : {}), verified: true };
  },
};
export const sortRangeTool: AgentTool<
  { range: string; column: string; descending: boolean; header: boolean },
  { range: string; verified: true }
> = {
  name: 'sort_range',
  description:
    'Excel only. Sort complete rows inside an explicit rectangular range by a numeric key column. Requires explicit header policy and direction. Refuses formulas, blanks/non-numeric keys, merged cells, protected sheets, tables and filters; never expands the supplied range.',
  inputSchema: {
    type: 'object',
    properties: {
      range: { type: 'string' },
      column: { type: 'string' },
      descending: { type: 'boolean' },
      header: { type: 'boolean' },
    },
    required: ['range', 'column', 'descending', 'header'],
    additionalProperties: false,
  },
  readOnlyHint: false,
  execute: async ({ range, column, descending, header }) => {
    if (typeof column !== 'string' || !/^[A-Z]{1,3}$/i.test(column)) fail('officeInvalidRange');
    const bounds = parseOfficeRange(range),
      key = parseOfficeRange(`${column}1`).c1;
    if (key < bounds.c1 || key > bounds.c2 || typeof descending !== 'boolean' || typeof header !== 'boolean')
      fail('officeInvalidRange');
    const first = bounds.r1 + (header ? 1 : 0);
    if (bounds.r2 - first < 1) fail('officeInvalidRange');
    const api = ready(true),
      view = sheet(api),
      model = view.model;
    ensureWritable(view, bounds);
    const full = model.getRange3(bounds.r1, bounds.c1, bounds.r2, bounds.c2);
    if (full.hasMerged?.() || model.TableParts?.length || model.AutoFilter || model.pivotTables?.length)
      fail('officeSortUnsupported');
    const rows = () =>
      Array.from({ length: bounds.r2 - first + 1 }, (_, i) =>
        Array.from({ length: bounds.c2 - bounds.c1 + 1 }, (_, j) =>
          model.getRange3(first + i, bounds.c1 + j, first + i, bounds.c1 + j).getValue(),
        ),
      );
    for (let r = first; r <= bounds.r2; r++) {
      const keyCell = model.getRange3(r, key, r, key);
      if (keyCell.getValueData()?.value.type !== 0 || !Number.isFinite(keyCell.getNumberValue()))
        fail('officeNumericSortOnly');
      for (let c = bounds.c1; c <= bounds.c2; c++)
        if (model.getRange3(r, c, r, c).getFormula()) fail('officeSortUnsupported');
    }
    const before = rows()
      .map((row) => JSON.stringify(row))
      .sort();
    const heading = header
      ? Array.from({ length: bounds.c2 - bounds.c1 + 1 }, (_, j) =>
          model.getRange3(bounds.r1, bounds.c1 + j, bounds.r1, bounds.c1 + j).getValue(),
        )
      : [];
    if (typeof view.setSelection !== 'function' || typeof api.asc_sortCells !== 'function')
      fail('officeSpreadsheetOnly');
    const rangeObject = model.getRange3(first, bounds.c1, bounds.r2, bounds.c2) as CellRange & { bbox?: unknown };
    if (!rangeObject.bbox) fail('officeSpreadsheetOnly');
    view.setSelection(rangeObject.bbox);
    model.selectionRange.activeCell.row = first;
    model.selectionRange.activeCell.col = key;
    api.asc_sortCells({ type: descending ? 2 : 1 });
    await verify(
      api,
      () => api.wb?.getWorksheet() === view,
      () => {
        const after = rows()
          .map((row) => JSON.stringify(row))
          .sort();
        if (JSON.stringify(after) !== JSON.stringify(before)) return false;
        for (let r = first + 1; r <= bounds.r2; r++) {
          const previous = model.getRange3(r - 1, key, r - 1, key).getNumberValue()!,
            value = model.getRange3(r, key, r, key).getNumberValue()!;
          if (descending ? previous < value : previous > value) return false;
        }
        return (
          !header ||
          heading.every(
            (value, j) => model.getRange3(bounds.r1, bounds.c1 + j, bounds.r1, bounds.c1 + j).getValue() === value,
          )
        );
      },
    );
    return { range, verified: true };
  },
};
export const slideActionTool: AgentTool<
  { action: 'add' | 'duplicate' | 'navigate'; page?: number },
  { count: number; page: number; verified: true }
> = {
  name: 'slide_action',
  description:
    'Presentation only. Add a slide using the editor layout, duplicate exactly the current selected slide, or navigate to an explicit one-based slide number. Does not delete slides or edit master layouts. Verifies slide identity/count or navigation.',
  inputSchema: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['add', 'duplicate', 'navigate'] },
      page: { type: 'integer', minimum: 1 },
    },
    required: ['action'],
    additionalProperties: false,
  },
  readOnlyHint: false,
  execute: async ({ action, page }) => {
    if (!['add', 'duplicate', 'navigate'].includes(action)) fail('officeInvalidSlide');
    const api = ready(action !== 'navigate'),
      logic = api.WordControl?.m_oLogicDocument;
    if (!logic?.Slides || logic.IsMasterMode?.() !== false) fail('officePresentationOnly');
    const slides = logic.Slides,
      before = [...slides],
      current = api.getCurrentPage?.();
    if (action === 'navigate') {
      if (!Number.isInteger(page) || page! < 1 || page! > slides.length || typeof api.goToPage !== 'function')
        fail('officeInvalidSlide');
      api.goToPage(page! - 1);
      await verify(
        api,
        () => api.WordControl?.m_oLogicDocument === logic,
        () => api.getCurrentPage?.() === page! - 1,
      );
    } else {
      if (logic.CanEdit?.() === false) fail('Document is read-only');
      if (api.isSlideShow?.() === true) fail('officePresentationOnly');
      if (action === 'duplicate') {
        const selected = logic.GetSelectedSlides?.();
        if (!selected || selected.length !== 1 || selected[0] !== current || typeof api.DublicateSlide !== 'function')
          fail('officeSelectOneSlide');
        api.DublicateSlide();
      } else {
        if (typeof api.AddSlide !== 'function') fail('officePresentationOnly');
        api.AddSlide();
      }
      await verify(
        api,
        () => api.WordControl?.m_oLogicDocument === logic,
        () => logic.Slides!.length === before.length + 1 && before.every((slide) => logic.Slides!.includes(slide)),
      );
    }
    return { count: logic.Slides.length, page: (api.getCurrentPage?.() ?? 0) + 1, verified: true };
  },
};

export const addSlideTextTool: AgentTool<{ text: string }, { page: number; verified: true }> = {
  name: 'add_slide_text',
  description:
    'Presentation (PPT) only. Add a new text box with the exact plain text on the current slide. Does not replace existing text or shapes. Use only when adding new text is requested.',
  inputSchema: {
    type: 'object',
    properties: { text: { type: 'string' } },
    required: ['text'],
    additionalProperties: false,
  },
  readOnlyHint: false,
  execute: ({ text }, signal) => pasteSlideTextEdit(text, signal),
};

export function replaceSlideText(text: string, signal?: AbortSignal) {
  return pasteSlideTextEdit(text, signal, true);
}

async function pasteSlideTextEdit(text: string, signal?: AbortSignal, replaceSelection = false) {
  signal?.throwIfAborted();
  if (typeof text !== 'string' || !(replaceSelection ? text.length : text.trim()) || text.length > 8000)
    fail('Invalid document tool parameters');
  const api = ready(true),
    logic = api.WordControl?.m_oLogicDocument,
    page = api.getCurrentPage?.();
  if (!logic?.Slides || logic.IsMasterMode?.() !== false || !Number.isInteger(page)) fail('officePresentationOnly');
  if (logic.CanEdit?.() === false) fail('Document is read-only');
  if (api.isSlideShow?.() === true) fail('officePresentationOnly');
  const slide = logic.Slides[page!],
    controller = logic.GetCurrentController?.();
  if (
    !slide?.cSld?.spTree ||
    typeof controller?.resetSelection !== 'function' ||
    typeof api.asc_PasteData !== 'function' ||
    typeof api.pre_Paste !== 'function' ||
    typeof api.ImgApply !== 'function' ||
    typeof logic.Recalculate !== 'function' ||
    typeof logic.GetWidthMM !== 'function' ||
    typeof logic.GetHeightMM !== 'function'
  )
    fail('officePresentationOnly');
  const targetContent = replaceSelection ? controller.getTargetDocContent?.() : undefined;
  const targetShape = replaceSelection
    ? slide.cSld.spTree.find((shape) => shape.getDocContent?.() === targetContent)
    : undefined;
  const selection = targetShape ? readSlideTextSelection(targetShape) : undefined;
  if (replaceSelection && (!targetContent || !targetShape || !selection)) fail('No text selection');
  const context = getEditorContext();
  const type = context?.Asc.c_oAscAsyncActionType?.BlockInteraction;
  const action = context?.Asc.c_oAscAsyncAction?.ApplyChanges;
  if (context?.api !== api || type === undefined || action === undefined) fail('Editor action API is unavailable');
  const format = context.AscCommon?.c_oAscClipboardDataFormat?.Text;
  const helper = context.AscCommon?.g_specialPasteHelper;
  const closedGroupDescription = context.AscDFH?.historydescription_GroupPoints;
  if (replaceSelection && !Number.isInteger(closedGroupDescription)) fail('Editor history API is unavailable');
  if (format === undefined || !helper || helper.Api !== api || typeof helper.Paste_Process_End !== 'function')
    fail('Editor paste API is unavailable');
  const current = () =>
    requireEditorApi() === api &&
    getEditorContext()?.AscCommon?.g_specialPasteHelper === helper &&
    getEditorContext()?.AscCommon?.History === history &&
    helper.Api === api &&
    api.WordControl?.m_oLogicDocument === logic &&
    api.getCurrentPage?.() === page &&
    logic.Slides![page!] === slide &&
    (!replaceSelection ||
      (logic.GetCurrentController?.() === controller && controller.getTargetDocContent?.() === targetContent));
  const history = context.AscCommon?.History;
  if (
    !history ||
    !Number.isInteger(history.Index) ||
    !Array.isArray(history.Points) ||
    typeof history.startGroupPoints !== 'function' ||
    typeof history.endGroupPoints !== 'function' ||
    typeof history.cancelGroupPoints !== 'function' ||
    typeof history._getLongPointIndex !== 'function'
  )
    fail('Editor history API is unavailable');
  const startGroup = history.startGroupPoints,
    endGroup = history.endGroupPoints,
    cancelGroup = history.cancelGroupPoints,
    groupIndex = history._getLongPointIndex;
  if (groupIndex.call(history) !== -1) fail('Editor is busy');
  return withBlockingEditorAction(api, { BlockInteraction: type, ApplyChanges: action }, async () => {
    const historyCurrent = () => {
      try {
        return (
          requireEditorApi() === api &&
          api.WordControl?.m_oLogicDocument === logic &&
          getEditorContext()?.AscCommon?.History === history
        );
      } catch {
        return false;
      }
    };
    const redo = preserveNativeRedo(history, historyCurrent),
      previousIndex = history.Index,
      previousPoints = [...history.Points];
    try {
      startGroup.call(history);
    } catch (error) {
      // A native callback can throw either before or just after creating the empty group point.
      if (
        historyCurrent() &&
        history.Index === previousIndex + 1 &&
        history.Points.length === previousIndex + 2 &&
        previousPoints.slice(0, previousIndex + 1).every((point, index) => history.Points[index] === point) &&
        history.Points[history.Index]?.Items.length === 0 &&
        groupIndex.call(history) === history.Index
      ) {
        cancelGroup.call(history);
        logic.Recalculate?.();
      }
      redo.restore();
      if (historyCurrent()) logic.Document_UpdateInterfaceState?.();
      throw error;
    }
    let restoringRedo = false;
    const openedIndex = history.Index,
      marker = history.Points[openedIndex];
    const ownsGroup = () => {
      try {
        return (
          requireEditorApi() === api &&
          api.WordControl?.m_oLogicDocument === logic &&
          getEditorContext()?.AscCommon?.History === history &&
          history.Points[openedIndex] === marker &&
          groupIndex.call(history) === openedIndex
        );
      } catch {
        return false;
      }
    };
    let pendingPreparation: (() => boolean) | undefined;
    const ownsPaste = () => ownsGroup() && (!pendingPreparation || pendingPreparation());
    try {
      const shapeText = (shape: (typeof slide.cSld.spTree)[number]): string | undefined => readSlideShapeText(shape);
      const recalculate = () => logic.Recalculate!({ Drawings: { All: true, Map: {} } });
      recalculate();
      const before = [...slide.cSld.spTree],
        originalText = before.map(shapeText),
        originalBounds = before.map(readSlideShapeBounds),
        inherited = inheritedSlideShapes(slide, context.AscCommon?.IsHiddenObj),
        size = { width: logic.GetWidthMM!(), height: logic.GetHeightMM!() };
      if (before.some((shape, index) => shape.getDocContent?.() && originalText[index] === undefined))
        fail('Document change could not be verified');
      if (originalBounds.some((bounds) => !bounds)) fail('Document change could not be verified');
      if (!replaceSelection) controller.resetSelection();
      const nativeApi = api as OfficeApi & NativePasteApi;
      const originalPrepare = nativeApi.pre_Paste;
      const capturePasteOwnership = () => {
        const index = history.Index;
        const points = history.Points.map((point) => ({ point, items: [...point.Items] }));
        const position = () =>
          JSON.stringify((targetContent as { GetSelectionState?(): unknown })?.GetSelectionState?.());
        const capturedPosition = position();
        return () =>
          history.Index === index &&
          history.Points.length === points.length &&
          points.every(
            ({ point, items }, offset) =>
              history.Points[offset] === point &&
              point.Items.length === items.length &&
              items.every((item, itemIndex) => point.Items[itemIndex] === item),
          ) &&
          position() === capturedPosition;
      };
      const guardedPrepare: NativePasteApi['pre_Paste'] = function (fonts, images, insert) {
        const proof = capturePasteOwnership();
        pendingPreparation = proof;
        originalPrepare.call(nativeApi, fonts, images, () => {
          // A changed history or cursor must reach pasteSlideText's rejection path.
          // Only the original preparation may release its proof before its own insertion.
          const owned = pendingPreparation === proof && proof();
          if (owned) pendingPreparation = undefined;
          insert();
          if (owned) pendingPreparation = capturePasteOwnership();
        });
      };
      let paste: Promise<void>;
      if (replaceSelection) nativeApi.pre_Paste = guardedPrepare;
      try {
        paste = pasteSlideText(nativeApi, format, text, {
          isCurrent: () => current() && ownsPaste(),
          signal,
          endPaste: () => helper.Paste_Process_End(),
        });
      } finally {
        if (nativeApi.pre_Paste === guardedPrepare) nativeApi.pre_Paste = originalPrepare;
      }
      await paste;
      signal?.throwIfAborted();
      if (replaceSelection) {
        const expected =
          selection!.text.slice(0, selection!.start) +
          text.replace(/\r\n?/g, '\n') +
          selection!.text.slice(selection!.end);
        await verify(
          api,
          () => current() && ownsPaste(),
          () => {
            const shapes = slide.cSld.spTree;
            return (
              shapes.length === before.length &&
              before.every(
                (shape, index) =>
                  shapes[index] === shape &&
                  (shape === targetShape
                    ? shapeText(shape)?.replace(/\r\n?/g, '\n') === expected
                    : shapeText(shape) === originalText[index]) &&
                  JSON.stringify(readSlideShapeBounds(shape)) === JSON.stringify(originalBounds[index]),
              )
            );
          },
        );
        signal?.throwIfAborted();
        const inserted = text.replace(/\r\n?/g, '\n');
        if (inserted.includes('\n')) {
          if (!current() || !ownsPaste()) fail('Document action has expired');
          pendingPreparation = undefined;
          try {
            preserveSlideParagraphEndFonts(targetShape!, selection!.start, selection!.start + inserted.length);
          } finally {
            if (ownsGroup()) pendingPreparation = capturePasteOwnership();
          }
          signal?.throwIfAborted();
          if (!current() || !ownsPaste() || shapeText(targetShape!)?.replace(/\r\n?/g, '\n') !== expected)
            fail('Document change could not be verified');
        }
        return { page: page! + 1, verified: true as const };
      }
      await verify(
        api,
        () => current() && ownsGroup(),
        () => {
          const shapes = slide.cSld.spTree;
          return (
            shapes.length === before.length + 1 &&
            before.every(
              (shape, index) =>
                shapes.includes(shape) &&
                shapeText(shape) === originalText[index] &&
                JSON.stringify(readSlideShapeBounds(shape)) === JSON.stringify(originalBounds[index]),
            ) &&
            shapes
              .filter((shape) => !before.includes(shape))
              .some((shape) => shapeText(shape)?.replace(/\r\n/g, '\n') === `${text.replace(/\r\n/g, '\n')}\n`)
          );
        },
      );
      signal?.throwIfAborted();
      if (!current() || !ownsGroup()) fail('Document action has expired');
      const added = slide.cSld.spTree.find((shape) => !before.includes(shape))!;
      positionSlideText(
        size,
        [...before, ...inherited],
        added,
        controller,
        (properties) => api.ImgApply!(properties),
        recalculate,
      );
      if (
        !current() ||
        !ownsGroup() ||
        before.some((shape, index) => shapeText(shape) !== originalText[index]) ||
        shapeText(added)?.replace(/\r\n/g, '\n') !== `${text.replace(/\r\n/g, '\n')}\n`
      )
        fail('Document change could not be verified');
      return { page: page! + 1, verified: true as const };
    } catch (error) {
      if (ownsPaste()) {
        cancelGroup.call(history);
        restoringRedo = true;
        redo.restore();
        logic.Recalculate?.();
        logic.Document_UpdateInterfaceState?.();
      }
      throw error;
    } finally {
      try {
        if (ownsGroup()) {
          if (ownsPaste()) endGroup.call(history);
          // The SDK's endGroupPoints merges every later point into this one.
          // Close only our marker after ownership loss, preserving foreign points.
          else if (replaceSelection && Number.isInteger(closedGroupDescription))
            marker.Description = closedGroupDescription;
        }
      } finally {
        if (!restoringRedo) redo.discard();
      }
    }
  });
}
