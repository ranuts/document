import { readWordBodyText } from './word-text-read';
import type { DocumentContext } from './document-context';
import { captureDocumentContext } from './document-context';
import type { DocumentToolPlan } from './document-tool-plan';
import { parseDocumentToolPlan } from './document-tool-plan';
import { requireEditorApi, getEditorApi, type EditorApi } from './editor-bridge';
import { getReadonlyMode } from '../onlyoffice/readonly';
import { agentTools } from './tools';
import { parseOfficeRange } from './office-tools';
import { assertReviewSelection, captureReviewCharacters, matchesTextEdit } from './verify-text-edit';
import { readSlideTextSelection, type SlideTextShape } from './slide-text-read';

export interface DocumentToolTarget {
  readonly context: DocumentContext;
  readonly label: string;
  readonly selectedText: string;
  isCurrent(write?: boolean): boolean;
  assertSupported?(plan: DocumentToolPlan): void;
  verify?(plan: DocumentToolPlan): Promise<boolean | undefined>;
}
interface History {
  Index: number;
  Points: Array<{ Items: unknown[] }>;
}
interface SheetModel {
  selectionRange: {
    ranges: Array<{ c1: number; c2: number; r1: number; r2: number }>;
    activeCell: { col: number; row: number };
  };
  getRange3(
    r1: number,
    c1: number,
    r2: number,
    c2: number,
  ): {
    getValue(): string;
    getNumberValue?(): number | null;
    getValueData?(): { value: { type: number } } | null;
  };
}
interface ScopeApi extends EditorApi {
  isViewMode?: boolean;
  WordControl?: {
    m_oLogicDocument?: {
      Slides?: unknown[];
      GetSelectedSlides?(): number[];
      GetSelectionState?(): unknown;
      GetText?(): string;
      GetDocPosType?(): number;
      GetCurrentController?(): {
        selectedObjects?: unknown[];
        getTargetDocContent?():
          | (NonNullable<ReturnType<NonNullable<SlideTextShape['getDocContent']>>> & { GetSelectionState?(): unknown })
          | undefined;
      };
    };
  };
  getCurrentPage?(): number;
  asc_getActiveWorksheetIndex?(): number;
  asc_getWorksheetId?(index: number): string;
  wb?: { getWorksheet(): { model: SheetModel } };
}
const interactions = new WeakMap<Document, { revision: number }>();
function interaction(doc: Document): { revision: number } {
  let state = interactions.get(doc);
  if (!state) {
    state = { revision: 0 };
    interactions.set(doc, state);
    const observed = state;
    for (const event of ['pointerdown', 'keydown', 'paste', 'cut', 'drop'])
      doc.addEventListener(event, () => observed.revision++, true);
  }
  return state;
}

/** Bind document identity, version and selection before invoking a model. */
export function captureDocumentToolTarget(): DocumentToolTarget {
  const api = requireEditorApi() as ScopeApi;
  if (!api.isDocumentLoadComplete || !api.isLoadFullApi) throw new Error('Editor is still loading');
  const context = captureDocumentContext();
  if (!context) throw new Error('Editor is still loading');
  const frame = [...document.querySelectorAll<HTMLIFrameElement>('iframe')].find((element) => {
    try {
      const win = element.contentWindow as unknown as { editor?: unknown; Asc?: { editor?: unknown } };
      return (win?.editor ?? win?.Asc?.editor) === api;
    } catch {
      return false;
    }
  });
  if (!frame?.contentWindow || !frame.contentDocument) throw new Error('Editor frame is unavailable');
  const win = frame.contentWindow as unknown as { AscCommon?: { History?: History } };
  const history = win.AscCommon?.History;
  const historyIndex = history?.Index;
  const points = history?.Points?.map((point) => ({ point, length: point.Items.length }));
  const tracked = Number.isInteger(historyIndex) && !!points;
  const logic = api.WordControl?.m_oLogicDocument;
  const controller = context.kind === 'slide' ? logic?.GetCurrentController?.() : undefined;
  const selectedObjects = controller?.selectedObjects?.slice();
  const selectedContent = controller?.getTargetDocContent?.();
  const model = context.kind === 'cell' ? api.wb?.getWorksheet().model : undefined;
  const state = interaction(frame.contentDocument),
    revision = state.revision;
  const position = () => {
    if (context.kind === 'slide') {
      const selection = selectedContent?.GetSelectionState?.();
      if (selectedContent && selection == null) return undefined;
      return JSON.stringify([api.getCurrentPage?.(), logic?.GetSelectedSlides?.(), selection]);
    }
    if (context.kind === 'cell')
      return JSON.stringify([
        api.asc_getActiveWorksheetIndex?.(),
        model?.selectionRange.ranges.map(({ c1, c2, r1, r2 }) => [c1, c2, r1, r2]),
        model?.selectionRange.activeCell.col,
        model?.selectionRange.activeCell.row,
      ]);
    return JSON.stringify(logic?.GetSelectionState?.());
  };
  const capturedPosition = position();
  const selectedText =
    context.kind === 'word'
      ? api.pluginMethod_GetSelectedText({ TabSymbol: '\t', Numbering: false }).replace(/\r\n/g, '\n')
      : context.kind === 'slide'
        ? (readSlideTextSelection({ getDocContent: () => selectedContent })?.selectedText ?? '')
        : '';
  const beforeText = context.kind === 'word' && logic?.GetDocPosType?.() === 0 ? readWordBodyText(logic) : undefined;
  const currentReviewMode = () =>
    context.kind === 'word' && typeof api.asc_IsTrackRevisions === 'function' && api.asc_IsTrackRevisions();
  const reviewMode = currentReviewMode();
  const beforeReview = reviewMode ? captureReviewCharacters(logic) : undefined;
  const sameDocument = () =>
    frame.isConnected &&
    getEditorApi() === api &&
    api.WordControl?.m_oLogicDocument === logic &&
    (!model || api.wb?.getWorksheet().model === model);
  const sameSlideSelection = () =>
    context.kind !== 'slide' ||
    (logic?.GetCurrentController?.() === controller &&
      controller?.getTargetDocContent?.() === selectedContent &&
      (selectedObjects === undefined
        ? controller?.selectedObjects === undefined
        : controller?.selectedObjects?.length === selectedObjects.length &&
          selectedObjects.every((shape, index) => controller.selectedObjects![index] === shape)));
  const isCurrent = (write = true) => {
    try {
      if (
        !sameDocument() ||
        !sameSlideSelection() ||
        state.revision !== revision ||
        position() !== capturedPosition ||
        currentReviewMode() !== reviewMode
      )
        return false;
      if (write && (getReadonlyMode() || api.isViewMode || !tracked || capturedPosition === undefined)) return false;
      if (!history) return !write;
      return (
        win.AscCommon?.History === history &&
        history.Index === historyIndex &&
        history.Points.length === points!.length &&
        points!.every(({ point, length }, index) => history.Points[index] === point && point.Items.length === length)
      );
    } catch {
      return false;
    }
  };
  const verify = async (plan: DocumentToolPlan): Promise<boolean | undefined> => {
    if (plan.readOnly) return undefined;
    if (plan.tool === 'set_review_mode') return sameDocument() && api.asc_IsTrackRevisions() === plan.input.enabled;
    const textEdit = ['insert_text', 'replace_selection'].includes(plan.tool) && typeof beforeText === 'string';
    const cellEdit = plan.tool === 'set_cell' && !!model;
    if (!textEdit && !cellEdit) return undefined;
    for (let attempt = 0; attempt < 31; attempt++) {
      if (!sameDocument() || state.revision !== revision) return false;
      const afterText = textEdit ? readWordBodyText(logic) : undefined;
      if (
        textEdit &&
        typeof afterText === 'string' &&
        (!reviewMode || beforeReview !== undefined) &&
        matchesTextEdit(
          beforeText!,
          afterText!,
          selectedText,
          String(plan.input.text),
          reviewMode ? { before: beforeReview!, after: captureReviewCharacters(logic) ?? [] } : undefined,
        )
      )
        return true;
      if (cellEdit) {
        const cell = parseOfficeRange(String(plan.input.cell));
        const stored = model!.getRange3(cell.r1, cell.c1, cell.r2, cell.c2);
        if (stored.getValue() === plan.input.value) return true;
        // Auto entry parses numbers; native storage normalizes 001, 1.0 and -0.
        // Literal text must retain every character and never use numeric equivalence.
        const value = String(plan.input.value);
        if (
          plan.input.valueType !== 'text' &&
          /^-?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value) &&
          Number.isFinite(Number(value)) &&
          stored.getValueData?.()?.value.type === 0 &&
          stored.getNumberValue?.() === Number(value)
        )
          return true;
      }
      if (attempt < 30) await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return false;
  };
  return Object.freeze({
    context: Object.freeze(context),
    label:
      context.kind === 'slide'
        ? `PPT · ${context.page ?? ''}`
        : context.kind === 'cell'
          ? `Excel · ${context.sheet ?? ''} ${context.range ?? ''}`
          : 'DOCX',
    selectedText,
    assertSupported: (plan: DocumentToolPlan) => {
      if (
        context.kind === 'word' &&
        logic?.GetDocPosType?.() === 0 &&
        ['insert_text', 'replace_selection'].includes(plan.tool) &&
        beforeText === undefined
      )
        throw new Error('Document change could not be verified');
      if (reviewMode && ['insert_text', 'replace_selection'].includes(plan.tool))
        assertReviewSelection(beforeReview, selectedText);
    },
    isCurrent,
    verify,
  });
}

/** Confirmation is consumed before execution, including failed API calls. */
export class DocumentToolAction {
  readonly plan: DocumentToolPlan;
  private consumed = false;
  private output: unknown;
  get result(): unknown {
    return this.output;
  }
  constructor(
    readonly target: DocumentToolTarget,
    plan: DocumentToolPlan,
  ) {
    this.plan = parseDocumentToolPlan(JSON.stringify({ tool: plan.tool, input: plan.input }), target.context);
  }
  isCurrent(): boolean {
    return !this.consumed && this.target.isCurrent(!this.plan.readOnly);
  }
  cancel(): void {
    this.consumed = true;
  }
  async apply(signal?: AbortSignal): Promise<'sent' | 'verified'> {
    signal?.throwIfAborted();
    if (!this.isCurrent()) throw new Error('This proposal has expired. Generate a new proposal.');
    this.target.assertSupported?.(this.plan);
    this.consumed = true;
    this.output = await agentTools[this.plan.tool].execute(this.plan.input, signal);
    const verified = await this.target.verify?.(this.plan);
    if (verified === false)
      throw new Error('The change could not be verified. Check the document and use Undo if needed.');
    if (
      verified === true ||
      (this.output && typeof this.output === 'object' && 'verified' in this.output && this.output.verified === true)
    )
      return 'verified';
    return 'sent';
  }
}
