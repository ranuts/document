import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  captureDocumentToolTarget,
  DocumentToolAction,
  type DocumentToolTarget,
} from '../../lib/agent-plugin/document-tool-action';
import { agentTools } from '../../lib/agent-plugin/tools';
import { parseDocumentToolPlan } from '../../lib/agent-plugin/document-tool-plan';
const plan = (tool: string, input: Record<string, unknown>, kind: 'word' | 'cell' | 'slide') =>
  parseDocumentToolPlan(JSON.stringify({ tool, input }), { kind });
function target(): DocumentToolTarget {
  return { context: { kind: 'slide', page: 1 }, label: 'PPT · 1', selectedText: '', isCurrent: () => true };
}
function mount() {
  const history = { Index: -1, Points: [] as Array<{ Items: unknown[] }> };
  let page = 0;
  const logic = { Slides: [{}], GetSelectedSlides: () => [page] };
  const api = {
    isDocumentLoadComplete: true,
    isLoadFullApi: true,
    WordControl: { m_oLogicDocument: logic },
    getCurrentPage: () => page,
  };
  const frame = document.createElement('iframe');
  frame.name = 'frameEditor';
  document.body.append(frame);
  Object.assign(frame.contentWindow!, { editor: api, AscCommon: { History: history } });
  return { frame, api, history, logic, navigate: () => page++ };
}
afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});
it('revises a text proposal through validation and consumes only the replaced proposal', () => {
  const scope = { context: { kind: 'word' as const }, label: 'DOCX', selectedText: 'old', isCurrent: () => true };
  const action = new DocumentToolAction(scope, plan('insert_text', { text: 'first' }, 'word'));
  expect(() => action.revise('')).toThrow();
  expect(action.isCurrent()).toBe(true);
  const revised = action.revise('second');
  expect(revised.plan.input.text).toBe('second');
  expect(revised.review).toEqual({ kind: 'text', before: 'old', after: 'second' });
  expect(action.isCurrent()).toBe(false);
  expect(revised.isCurrent()).toBe(true);
});
it('does not revive an expired target through revision', () => {
  const scope = { context: { kind: 'word' as const }, label: 'DOCX', selectedText: '', isCurrent: () => false };
  const action = new DocumentToolAction(scope, plan('insert_text', { text: 'first' }, 'word'));
  expect(() => action.revise('second')).toThrow(/expired/);
});
it('captures actual Excel values and formulas for the explicit target, without moving selection', () => {
  const state = mount();
  const model = {
    selectionRange: { ranges: [{ c1: 0, c2: 0, r1: 0, r2: 0 }], activeCell: { col: 0, row: 0 } },
    getRange3: (r: number, c: number) => ({ getValue: () => `${r}:${c}`, getFormula: () => '=A1+1' }),
  };
  Object.assign(state.api, {
    asc_getActiveRangeStr: () => 'A1',
    asc_getActiveWorksheetIndex: () => 0,
    asc_getWorksheetName: () => 'Budget',
    wb: { getWorksheet: () => ({ model }) },
  });
  const action = new DocumentToolAction(
    captureDocumentToolTarget(),
    plan('set_cell', { cell: 'B2', value: '9' }, 'cell'),
  );
  expect(action.review).toEqual({
    kind: 'cells',
    total: 1,
    sampled: false,
    rows: [{ address: 'B2', before: '1:1', formula: '=A1+1', after: '9' }],
  });
  expect(model.selectionRange.activeCell).toEqual({ col: 0, row: 0 });
  expect(action.target.context.sheet).toBe('Budget');
});
it('captures the native PPT selection as exact Unicode text for the tool context', () => {
  const state = mount();
  const content = {
    GetText: () => '\uf600 ',
    GetSelectedText: () => '😀\t',
    GetSelectionState: () => [{ cursor: 0 }],
    Content: [
      {
        Content: [
          {
            Type: 39,
            Selection: { Use: true, StartPos: 0, EndPos: 2 },
            Content: [{ Type: 1, GetCodePoint: () => 0x1f600 }, { Type: 21 }, { Type: 4 }],
          },
        ],
      },
    ],
  };
  Object.assign(state.logic, { GetCurrentController: () => ({ getTargetDocContent: () => content }) });
  const captured = captureDocumentToolTarget();
  expect(captured.selectedText).toBe('😀\t');
  expect(captured.context.selectionCharacters).toBe(3);
});
it.each(['shape', 'content', 'selection', 'controller'])(
  'expires PPT writes if the captured %s changes without history or DOM events',
  async (change) => {
    const state = mount();
    const position = { cursor: 0 };
    let content = { GetSelectionState: () => [{ ...position }] };
    let controller = { selectedObjects: [{}], getTargetDocContent: () => content };
    Object.assign(state.logic, { GetCurrentController: () => controller });
    const captured = captureDocumentToolTarget();
    expect(captured.isCurrent()).toBe(true);
    if (change === 'shape') controller.selectedObjects = [{}];
    if (change === 'content') content = { GetSelectionState: () => [{ ...position }] };
    if (change === 'selection') position.cursor++;
    if (change === 'controller') controller = { ...controller };
    const execute = vi.spyOn(agentTools.add_slide_text, 'execute');
    await expect(
      new DocumentToolAction(captured, plan('add_slide_text', { text: 'Hello' }, 'slide')).apply(),
    ).rejects.toThrow(/expired/);
    expect(execute).not.toHaveBeenCalled();
  },
);
it('expires PPT capture if a previously unavailable drawing selection appears', () => {
  const state = mount();
  const controller = { selectedObjects: undefined as unknown[] | undefined };
  Object.assign(state.logic, { GetCurrentController: () => controller });
  const captured = captureDocumentToolTarget();
  expect(captured.isCurrent()).toBe(true);
  controller.selectedObjects = [{}];
  expect(captured.isCurrent()).toBe(false);
});
it('blocks PPT writes when active text selection state cannot be captured while retaining read access', () => {
  const state = mount();
  const content = {};
  const controller = { selectedObjects: [], getTargetDocContent: () => content };
  Object.assign(state.logic, { GetCurrentController: () => controller });
  const captured = captureDocumentToolTarget();
  expect(captured.isCurrent(false)).toBe(true);
  expect(captured.isCurrent(true)).toBe(false);
});
it.each([false, true])('expires a Word target if revision tracking changes from %s', async (initial) => {
  const { api } = mount();
  let tracking = initial;
  Object.assign(api, {
    WordControl: { m_oLogicDocument: { GetSelectionState: () => [{ cursor: 0 }] } },
    pluginMethod_GetSelectedText: () => '',
    asc_IsTrackRevisions: () => tracking,
  });
  const captured = captureDocumentToolTarget();
  expect(captured.isCurrent()).toBe(true);
  tracking = !initial;
  const execute = vi.spyOn(agentTools.insert_text, 'execute');
  await expect(
    new DocumentToolAction(captured, plan('insert_text', { text: 'Hello' }, 'word')).apply(),
  ).rejects.toThrow(/expired/);
  expect(execute).not.toHaveBeenCalled();
});
describe('reviewed document API operations', () => {
  it('does not execute before apply and consumes one confirmed action', async () => {
    const execute = vi
      .spyOn(agentTools.slide_action, 'execute')
      .mockResolvedValue({ verified: true, count: 2, page: 2 });
    const action = new DocumentToolAction(target(), plan('slide_action', { action: 'add' }, 'slide'));
    expect(execute).not.toHaveBeenCalled();
    await expect(action.apply()).resolves.toBe('verified');
    expect(action.result).toMatchObject({ count: 2 });
    await expect(action.apply()).rejects.toThrow(/expired/);
    expect(execute).toHaveBeenCalledTimes(1);
  });
  it('cancel and stale target prevent execution', async () => {
    const execute = vi.spyOn(agentTools.slide_action, 'execute').mockResolvedValue({ verified: true });
    const action = new DocumentToolAction(target(), plan('slide_action', { action: 'add' }, 'slide'));
    action.cancel();
    await expect(action.apply()).rejects.toThrow();
    const stale = target();
    stale.isCurrent = () => false;
    await expect(
      new DocumentToolAction(stale, plan('slide_action', { action: 'add' }, 'slide')).apply(),
    ).rejects.toThrow();
    expect(execute).not.toHaveBeenCalled();
  });
  it('revalidates the plan and never trusts a model-provided readOnly flag', () => {
    expect(
      () => new DocumentToolAction(target(), { tool: 'set_cell', input: { cell: 'A1', value: 'x' }, readOnly: true }),
    ).toThrow();
    const action = new DocumentToolAction(target(), { tool: 'slide_action', input: { action: 'add' }, readOnly: true });
    expect(action.plan.readOnly).toBe(false);
  });
  it('failed execution is consumed and mismatched verification is reported', async () => {
    const execute = vi.spyOn(agentTools.slide_action, 'execute').mockRejectedValue(Error('failed'));
    const action = new DocumentToolAction(target(), plan('slide_action', { action: 'add' }, 'slide'));
    await expect(action.apply()).rejects.toThrow('failed');
    await expect(action.apply()).rejects.toThrow(/expired/);
    expect(execute).toHaveBeenCalledTimes(1);
    execute.mockResolvedValue({ verified: true });
    const scope = target();
    scope.verify = async () => false;
    await expect(
      new DocumentToolAction(scope, plan('slide_action', { action: 'add' }, 'slide')).apply(),
    ).rejects.toThrow(/verified/);
  });
  it('does not call an unverified API return a verified change', async () => {
    vi.spyOn(agentTools.slide_action, 'execute').mockResolvedValue({ count: 2 });
    await expect(
      new DocumentToolAction(target(), plan('slide_action', { action: 'add' }, 'slide')).apply(),
    ).resolves.toBe('sent');
  });
  it('captures PPT and invalidates page, history, frame and interaction changes', () => {
    for (const change of ['page', 'history', 'frame', 'interaction']) {
      document.body.replaceChildren();
      const state = mount();
      const scope = captureDocumentToolTarget();
      expect(scope.context).toEqual({ kind: 'slide', page: 1 });
      expect(scope.isCurrent()).toBe(true);
      if (change === 'page') state.navigate();
      if (change === 'history') state.history.Points.push({ Items: [{}] });
      if (change === 'frame') state.frame.remove();
      if (change === 'interaction') state.frame.contentDocument!.dispatchEvent(new Event('keydown'));
      expect(scope.isCurrent()).toBe(false);
    }
  });
  it('allows reads in view mode and blocks mutations', () => {
    const state = mount();
    Object.assign(state.api, { isViewMode: true });
    const scope = captureDocumentToolTarget();
    expect(scope.isCurrent(false)).toBe(true);
    expect(scope.isCurrent(true)).toBe(false);
  });
});

it('verifies a Word replacement using actual content readback', async () => {
  const state = mount();
  let text = 'Alex\r\n';
  Object.assign(state.api, {
    WordControl: {
      m_oLogicDocument: { GetSelectionState: () => [{ cursor: 0 }], GetDocPosType: () => 0, GetText: () => text },
    },
    pluginMethod_GetSelectedText: () => 'Alex\r\n',
  });
  vi.spyOn(agentTools.insert_text, 'execute').mockImplementation(async () => {
    text = 'Hello\r\n';
    return { inserted: true };
  });
  const action = new DocumentToolAction(captureDocumentToolTarget(), plan('insert_text', { text: 'Hello' }, 'word'));
  await expect(action.apply()).resolves.toBe('verified');
});
it('binds the worksheet model and verifies an explicit cell without moving the selection', async () => {
  const state = mount();
  let value = 'before';
  const model = {
    selectionRange: { ranges: [{ c1: 0, c2: 2, r1: 0, r2: 2 }], activeCell: { row: 0, col: 0 } },
    getRange3: () => ({ getValue: () => value }),
  };
  const view = { model };
  Object.assign(state.api, {
    asc_getActiveRangeStr: () => 'A1:C3',
    asc_getActiveWorksheetIndex: () => 0,
    wb: { getWorksheet: () => view },
  });
  const scope = captureDocumentToolTarget();
  expect(scope.context.kind).toBe('cell');
  vi.spyOn(agentTools.set_cell, 'execute').mockImplementation(async () => {
    value = 'after';
    return { written: true };
  });
  await expect(
    new DocumentToolAction(scope, plan('set_cell', { cell: 'B2', value: 'after' }, 'cell')).apply(),
  ).resolves.toBe('verified');
  view.model = { ...model };
  expect(scope.isCurrent()).toBe(false);
});
it('blocks writes when document version tracking is unavailable', () => {
  const state = mount();
  Object.assign(state.frame.contentWindow!, { AscCommon: {} });
  const scope = captureDocumentToolTarget();
  expect(scope.isCurrent(false)).toBe(true);
  expect(scope.isCurrent(true)).toBe(false);
});
it('captures spreadsheet coordinates without serializing SDK back references', () => {
  const state = mount();
  const selection = { ranges: [{ c1: 0, c2: 1, r1: 0, r2: 1 }], activeCell: { col: 0, row: 0 } };
  Object.assign(selection, { workbook: selection });
  const model = { selectionRange: selection, getRange3: () => ({ getValue: () => '' }) };
  Object.assign(state.api, {
    asc_getActiveRangeStr: () => 'A1:B2',
    asc_getActiveWorksheetIndex: () => 0,
    wb: { getWorksheet: () => ({ model }) },
  });
  const scope = captureDocumentToolTarget();
  expect(scope.isCurrent()).toBe(true);
  selection.ranges[0].c2 = 2;
  expect(scope.isCurrent()).toBe(false);
});

it('aborted action cannot execute a document tool', async () => {
  const execute = vi.spyOn(agentTools.slide_action, 'execute').mockResolvedValue({ verified: true });
  const abort = new AbortController();
  abort.abort();
  const action = new DocumentToolAction(target(), plan('slide_action', { action: 'add' }, 'slide'));
  await expect(action.apply(abort.signal)).rejects.toMatchObject({ name: 'AbortError' });
  expect(execute).not.toHaveBeenCalled();
});

it('checks captured operation support before executing any native tool', async () => {
  const execute = vi.spyOn(agentTools.slide_action, 'execute').mockResolvedValue({ verified: true, count: 2, page: 2 });
  const captured = {
    ...target(),
    assertSupported: () => {
      throw new Error('Unsupported tracked structure');
    },
  };
  const action = new DocumentToolAction(captured, plan('slide_action', { action: 'add' }, 'slide'));
  await expect(action.apply()).rejects.toThrow('Unsupported tracked structure');
  expect(execute).not.toHaveBeenCalled();
});

it('captures literal tabs without generated numbering in the Word tool target', () => {
  const { api } = mount();
  const getter = vi.fn((options?: { TabSymbol: string; Numbering: boolean }) =>
    options?.TabSymbol === '\t' && options.Numbering === false ? '😀\t' : '1. 😀 ',
  );
  Object.assign(api, { WordControl: { m_oLogicDocument: {} }, pluginMethod_GetSelectedText: getter });
  expect(captureDocumentToolTarget().selectedText).toBe('😀\t');
});

// Native numeric entry normalizes its lexical representation (for example 1.0 -> 1).
it.each(['1.0', '001', '-0', '1e3', '-2.5E-2', '.5'])(
  'verifies auto numeric entry %s by its stored numeric value',
  async (input) => {
    const state = mount();
    const number = Number(input);
    const model = {
      selectionRange: { ranges: [{ c1: 0, c2: 0, r1: 0, r2: 0 }], activeCell: { row: 0, col: 0 } },
      getRange3: () => ({
        getValue: () => String(number),
        getNumberValue: () => number,
        getValueData: () => ({ value: { type: 0 } }),
      }),
    };
    Object.assign(state.api, {
      asc_getActiveRangeStr: () => 'A1',
      asc_getActiveWorksheetIndex: () => 0,
      wb: { getWorksheet: () => ({ model }) },
    });
    const scope = captureDocumentToolTarget();
    await expect(scope.verify!(plan('set_cell', { cell: 'A1', value: input }, 'cell'))).resolves.toBe(true);
  },
);
it('does not accept numeric normalization for a literal text assignment', async () => {
  vi.useFakeTimers();
  try {
    const state = mount();
    const model = {
      selectionRange: { ranges: [{ c1: 0, c2: 0, r1: 0, r2: 0 }], activeCell: { row: 0, col: 0 } },
      getRange3: () => ({
        getValue: () => '1',
        getNumberValue: () => 1,
        getValueData: () => ({ value: { type: 0 } }),
      }),
    };
    Object.assign(state.api, {
      asc_getActiveRangeStr: () => 'A1',
      asc_getActiveWorksheetIndex: () => 0,
      wb: { getWorksheet: () => ({ model }) },
    });
    const outcome = captureDocumentToolTarget().verify!(
      plan('set_cell', { cell: 'A1', value: '001', valueType: 'text' }, 'cell'),
    );
    await vi.runAllTimersAsync();
    await expect(outcome).resolves.toBe(false);
  } finally {
    vi.useRealTimers();
  }
});

it('reviews a comment as an addition and preserves the selected anchor', () => {
  const { api } = mount();
  Object.assign(api, {
    WordControl: { m_oLogicDocument: {} },
    pluginMethod_GetSelectedText: () => 'Existing paragraph',
  });
  const action = new DocumentToolAction(
    captureDocumentToolTarget(),
    plan('add_comment', { text: 'Please check this' }, 'word'),
  );
  expect(action.review).toEqual({ kind: 'text', before: '', after: 'Please check this', anchor: 'Existing paragraph' });
});

it('reviews a new slide text box as an addition even when the target has selected text', () => {
  const scope = { ...target(), selectedText: 'Existing title' };
  const action = new DocumentToolAction(scope, plan('add_slide_text', { text: 'New text box' }, 'slide'));
  expect(action.review).toEqual({ kind: 'text', before: '', after: 'New text box', anchor: 'Existing title' });
});

it('binds a PDF proposal to its page, history and document identity, and allows a text revision', () => {
  const state = mount();
  const pdf = { annots: [], History: state.history };
  Object.assign(state.api, {
    isPdfEditor: () => true,
    getPDFDoc: () => pdf,
    DocumentRenderer: { file: { pages: [{ text: [] }], Selection: {} } },
    pluginMethod_GetSelectedText: () => '',
  });
  const target = captureDocumentToolTarget();
  const action = new DocumentToolAction(target, {
    tool: 'add_pdf_comment',
    input: { page: 1, text: 'Check budget' },
    readOnly: false,
  });
  expect(action.isCurrent()).toBe(true);
  expect(action.review).toEqual({ kind: 'text', before: '', after: 'Check budget' });
  const revised = action.revise('Check dates');
  expect(revised.plan.input.page).toBe(1);
  state.navigate();
  expect(revised.isCurrent()).toBe(false);
});
it('expires a PDF note when the document history changes before confirmation', () => {
  const state = mount();
  const pdf = { annots: [], History: state.history };
  Object.assign(state.api, {
    isPdfEditor: () => true,
    getPDFDoc: () => pdf,
    DocumentRenderer: { file: { pages: [{ text: [] }], Selection: {} } },
    pluginMethod_GetSelectedText: () => '',
  });
  const target = captureDocumentToolTarget();
  state.history.Index++;
  expect(target.isCurrent()).toBe(false);
});
