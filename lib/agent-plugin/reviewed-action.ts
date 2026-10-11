import { readWordBodyText } from './word-text-read';
import { parseActionPlan, type ActionEditor, type ActionPlan } from '@ranuts/agent-core/llm/action-plan';
import { getReadonlyMode } from '../onlyoffice/readonly';
import { requireEditorApi, getEditorApi } from './editor-bridge';
import { agentTools } from './tools';
import { assertReviewSelection, captureReviewCharacters, matchesTextEdit } from './verify-text-edit';
import type { ChangeReview } from './ui/change-review';

interface HistoryState {
  Index: number;
  Points: Array<{ Items: unknown[] }>;
}
const interactions = new WeakMap<Document, { revision: number }>();
const identities = new WeakMap<object, number>();
let nextIdentity = 0;
function identity(object: object): number {
  if (!identities.has(object)) identities.set(object, ++nextIdentity);
  return identities.get(object)!;
}
function interactionState(doc: Document): { revision: number } {
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

export interface ActionTarget {
  readonly editor: ActionEditor;
  readonly label: string;
  readonly selectedText: string;
  readonly cell?: string;
  assertSupported?(plan: Readonly<ActionPlan>): void;
  verify?(plan: Readonly<ActionPlan>): Promise<boolean>;
  isCurrent(): boolean;
}

/** SDK internals are isolated here. Unknown history/position support fails closed. */
export function captureActionTarget(): ActionTarget {
  if (getReadonlyMode()) throw new Error('Document is read-only');
  const api = requireEditorApi();
  if (!api.isDocumentLoadComplete || !api.isLoadFullApi) throw new Error('Editor is still loading');
  const frame = [...document.querySelectorAll<HTMLIFrameElement>('iframe')].find((element) => {
    try {
      const win = element.contentWindow as unknown as { editor?: unknown; Asc?: { editor?: unknown } };
      return (win?.editor ?? win?.Asc?.editor) === api;
    } catch {
      return false;
    }
  });
  if (!frame?.contentWindow || !frame.contentDocument) throw new Error('Editor frame is unavailable');
  const win = frame.contentWindow as unknown as { AscCommon?: { History?: HistoryState } };
  const history = win.AscCommon?.History;
  if (!history || !Number.isInteger(history.Index) || !Array.isArray(history.Points))
    throw new Error('Editor version tracking is unavailable');
  // The SDK stores mutation records in history points, including coalesced edits.
  const version = () =>
    JSON.stringify([history.Index, history.Points.map((point) => [identity(point), point.Items.length])]);
  const objectApi = api as unknown as {
    WordControl?: {
      m_oLogicDocument?: {
        Slides?: unknown[];
        GetSelectionState?(): unknown;
        GetText?(): string;
        GetDocPosType?(): number;
      };
    };
    asc_getActiveWorksheetIndex?(): number;
    asc_getWorksheetId?(index: number): string;
    wb?: {
      wsActive: number;
      wsViews: Array<{
        model: {
          selectionRange: {
            ranges: Array<{ c1: number; c2: number; r1: number; r2: number }>;
            activeCell: { col: number; row: number };
          };
        };
      }>;
    };
  };
  const logic = objectApi.WordControl?.m_oLogicDocument;
  const editor: ActionEditor = typeof api.asc_findCell === 'function' ? 'cell' : 'word';
  if (logic?.Slides) throw new Error('Presentation edit proposals are not available yet');
  const position = (): string => {
    if (editor === 'word') {
      if (!logic?.GetSelectionState) throw new Error('Cursor tracking is unavailable');
      const state = logic.GetSelectionState();
      if (!Array.isArray(state) || !state.length) throw new Error('Cursor tracking is unavailable');
      return JSON.stringify(state);
    }
    const index = objectApi.asc_getActiveWorksheetIndex?.();
    const selection = objectApi.wb?.wsViews[index ?? -1]?.model.selectionRange;
    if (index === undefined || !selection) throw new Error('Worksheet tracking is unavailable');
    return JSON.stringify([
      objectApi.asc_getWorksheetId?.(index) ?? index,
      selection.ranges.map(({ c1, c2, r1, r2 }) => [c1, c2, r1, r2]),
      selection.activeCell.col,
      selection.activeCell.row,
    ]);
  };
  let cell: string | undefined;
  if (editor === 'cell') {
    const index = objectApi.asc_getActiveWorksheetIndex?.();
    const selection = objectApi.wb?.wsViews[index ?? -1]?.model.selectionRange;
    const range = selection?.ranges[0];
    if (!selection || selection.ranges.length !== 1 || !range || range.c1 !== range.c2 || range.r1 !== range.r2)
      throw new Error('Select exactly one cell before requesting an edit');
    let column = range.c1 + 1;
    let letters = '';
    while (column > 0) {
      letters = String.fromCharCode(65 + ((column - 1) % 26)) + letters;
      column = Math.floor((column - 1) / 26);
    }
    cell = `${letters}${range.r1 + 1}`;
  }
  const revision = interactionState(frame.contentDocument);
  const capturedVersion = version();
  const capturedPosition = position();
  const capturedInteraction = revision.revision;
  const selectedText = api.pluginMethod_GetSelectedText({ TabSymbol: '\t', Numbering: false }).replace(/\r\n/g, '\n');
  // Read main-document paragraphs; unsupported native text items remain unverifiable.
  const bodyTarget = logic?.GetDocPosType?.() === 0;
  const beforeText = editor === 'word' && bodyTarget ? readWordBodyText(logic) : undefined;
  const currentReviewMode = () =>
    editor === 'word' && typeof api.asc_IsTrackRevisions === 'function' && api.asc_IsTrackRevisions();
  const reviewMode = currentReviewMode();
  const beforeReview = reviewMode ? captureReviewCharacters(logic) : undefined;
  const canVerify = editor === 'word' ? typeof beforeText === 'string' : typeof api.asc_getCellInfo === 'function';
  const verify = canVerify
    ? async (plan: Readonly<ActionPlan>): Promise<boolean> => {
        // Paste may complete asynchronously. Reading never changes the selection.
        for (let attempt = 0; attempt < 31; attempt++) {
          if (!frame.isConnected || getEditorApi() !== api || revision.revision !== capturedInteraction) return false;
          if (editor === 'word') {
            const afterText = readWordBodyText(logic);
            if (
              typeof afterText === 'string' &&
              (!reviewMode || beforeReview !== undefined) &&
              matchesTextEdit(
                beforeText!,
                afterText,
                selectedText,
                plan.input.text,
                reviewMode ? { before: beforeReview!, after: captureReviewCharacters(logic) ?? [] } : undefined,
              )
            )
              return true;
          } else {
            if (position() !== capturedPosition) return false;
            if (api.asc_getCellInfo?.()?.asc_getText() === plan.input.value) return true;
          }
          if (attempt < 30) await new Promise((resolve) => setTimeout(resolve, 50));
        }
        return false;
      }
    : undefined;

  return {
    editor,
    label: editor === 'word' ? 'DOCX' : `XLSX · ${(objectApi.asc_getActiveWorksheetIndex?.() ?? 0) + 1}`,
    selectedText,
    assertSupported: () => {
      if (editor === 'word' && bodyTarget && beforeText === undefined)
        throw new Error('Document change could not be verified');
      if (reviewMode) assertReviewSelection(beforeReview, selectedText);
    },
    cell,
    verify,
    isCurrent: () => {
      try {
        return (
          !getReadonlyMode() &&
          !api.isViewMode &&
          frame.isConnected &&
          getEditorApi() === api &&
          currentReviewMode() === reviewMode &&
          win.AscCommon?.History === history &&
          revision.revision === capturedInteraction &&
          version() === capturedVersion &&
          position() === capturedPosition
        );
      } catch {
        return false;
      }
    },
  };
}

/** A user-confirmed proposal is consumed before executing, including on error. */
export class ReviewedAction {
  readonly plan: Readonly<ActionPlan>;
  readonly review?: ChangeReview;
  private consumed = false;
  constructor(
    readonly target: ActionTarget,
    plan: ActionPlan,
  ) {
    this.plan = parseActionPlan(JSON.stringify(plan), target.editor);
    if (this.plan.tool === 'insert_text')
      this.review = { kind: 'text', before: target.selectedText, after: this.plan.input.text };
    if (target.editor === 'cell' && (!target.cell || this.plan.input.cell !== target.cell))
      throw new Error('Proposal does not match the captured cell');
  }
  revise(text: string): ReviewedAction {
    if (!this.isCurrent()) throw new Error('This proposal has expired. Generate a new proposal.');
    if (this.plan.tool !== 'insert_text') throw new Error('This operation cannot be edited as text');
    const replacement = new ReviewedAction(this.target, { tool: 'insert_text', input: { text } });
    this.cancel();
    return replacement;
  }
  isCurrent(): boolean {
    return !this.consumed && this.target.isCurrent();
  }
  cancel(): void {
    this.consumed = true;
  }
  async apply(signal?: AbortSignal): Promise<'sent' | 'verified'> {
    signal?.throwIfAborted();
    if (!this.isCurrent()) throw new Error('This proposal has expired. Generate a new proposal.');
    this.target.assertSupported?.(this.plan);
    this.consumed = true;
    await agentTools[this.plan.tool].execute(this.plan.input, signal);
    if (!this.target.verify) return 'sent';
    if (!(await this.target.verify(this.plan)))
      throw new Error('The change could not be verified. Check the document and use Undo if needed.');
    return 'verified';
  }
}
