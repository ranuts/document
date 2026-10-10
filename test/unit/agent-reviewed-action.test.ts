import { afterEach, expect, it, vi } from 'vitest';
import { captureActionTarget, ReviewedAction } from '../../lib/agent-plugin/reviewed-action';

const state = vi.hoisted(() => ({ readonly: false }));
vi.mock('../../lib/onlyoffice/readonly', () => ({ getReadonlyMode: () => state.readonly }));
const paste = vi.fn();
vi.mock('../../lib/agent-plugin/tools', () => ({
  agentTools: {
    insert_text: { execute: (input: unknown, signal?: AbortSignal) => (signal ? paste(input, signal) : paste(input)) },
  },
}));
function mount() {
  const history = { Index: -1, Points: [] as Array<{ Items: unknown[] }> };
  const position = { cursor: 0 };
  const api = {
    isDocumentLoadComplete: true,
    isLoadFullApi: true,
    WordControl: { m_oLogicDocument: { GetSelectionState: () => [{ ...position }] } },
    pluginMethod_GetSelectionType: () => 'none',
    pluginMethod_GetSelectedText: () => '',
  };
  const frame = document.createElement('iframe');
  frame.name = 'frameEditor';
  document.body.append(frame);
  Object.assign(frame.contentWindow!, { editor: api, AscCommon: { History: history } });
  return { frame, history, position, api };
}
afterEach(() => {
  document.body.innerHTML = '';
  state.readonly = false;
  paste.mockReset();
});
it.each([false, true])('expires a writing target if revision tracking changes from %s', async (initial) => {
  const { api } = mount();
  let tracking = initial;
  Object.assign(api, { asc_IsTrackRevisions: () => tracking });
  const captured = captureActionTarget();
  expect(captured.isCurrent()).toBe(true);
  tracking = !initial;
  await expect(new ReviewedAction(captured, { tool: 'insert_text', input: { text: 'Hello' } }).apply()).rejects.toThrow(
    /expired/,
  );
  expect(paste).not.toHaveBeenCalled();
});
it('does not execute on construction; consumes a confirmed action once', async () => {
  mount();
  const target = captureActionTarget();
  const action = new ReviewedAction(target, { tool: 'insert_text', input: { text: 'Hello' } });
  expect(paste).not.toHaveBeenCalled();
  await action.apply();
  expect(paste).toHaveBeenCalledTimes(1);
  await expect(action.apply()).rejects.toThrow();
});
it.each(['cursor', 'history', 'frame', 'readonly', 'interaction'])('blocks stale %s changes', async (change) => {
  const { frame, history, position } = mount();
  const action = new ReviewedAction(captureActionTarget(), { tool: 'insert_text', input: { text: 'Hello' } });
  if (change === 'cursor') position.cursor++;
  if (change === 'history') {
    history.Index++;
    history.Points.push({ Items: [{}] });
  }
  if (change === 'frame') frame.remove();
  if (change === 'readonly') state.readonly = true;
  if (change === 'interaction') frame.contentDocument!.dispatchEvent(new Event('pointerdown'));
  await expect(action.apply()).rejects.toThrow();
  expect(paste).not.toHaveBeenCalled();
});
it('cancel prevents confirmation and malformed plans cannot bypass parser', async () => {
  mount();
  const target = captureActionTarget();
  const action = new ReviewedAction(target, { tool: 'insert_text', input: { text: 'Hello' } });
  action.cancel();
  await expect(action.apply()).rejects.toThrow();
  expect(() => new ReviewedAction(target, { tool: 'set_cell', input: { cell: 'B2', value: '1250' } })).toThrow();
});
it('fails closed if history tracking is unavailable', () => {
  const { frame } = mount();
  (frame.contentWindow as unknown as { AscCommon: unknown }).AscCommon = null;
  expect(() => captureActionTarget()).toThrow();
});

it('rejects a proposal for a different host-selected cell', () => {
  const target = { editor: 'cell' as const, label: 'C3', cell: 'C3', selectedText: '', isCurrent: () => true };
  expect(() => new ReviewedAction(target, { tool: 'set_cell', input: { cell: 'B2', value: '1250' } })).toThrow(
    'captured cell',
  );
});

it('checks actual readback and consumes a mismatched write without retry', async () => {
  mount();
  const target = {
    editor: 'word' as const,
    label: 'DOCX',
    selectedText: '',
    isCurrent: () => true,
    verify: async () => false,
  };
  const action = new ReviewedAction(target, { tool: 'insert_text', input: { text: 'Hello' } });
  await expect(action.apply()).rejects.toThrow('verified');
  await expect(action.apply()).rejects.toThrow();
  expect(paste).toHaveBeenCalledTimes(1);
});
it('returns verified only when actual readback matches', async () => {
  mount();
  const target = {
    editor: 'word' as const,
    label: 'DOCX',
    selectedText: '',
    isCurrent: () => true,
    verify: async () => true,
  };
  await expect(new ReviewedAction(target, { tool: 'insert_text', input: { text: 'Hello' } }).apply()).resolves.toBe(
    'verified',
  );
});
it('does not call an unverified send a verified edit', async () => {
  mount();
  await expect(
    new ReviewedAction(captureActionTarget(), { tool: 'insert_text', input: { text: 'Hello' } }).apply(),
  ).resolves.toBe('sent');
});

it('reads DOCX content without selecting all and verifies the exact insertion', async () => {
  const { api } = mount();
  let text = '\r\n';
  Object.assign(api.WordControl.m_oLogicDocument, { GetText: () => text, GetDocPosType: () => 0 });
  paste.mockImplementation(() => {
    text = 'Hello\r\n';
  });
  const action = new ReviewedAction(captureActionTarget(), { tool: 'insert_text', input: { text: 'Hello' } });
  expect(text).toBe('\r\n');
  await expect(action.apply()).resolves.toBe('verified');
});
it('binds a single selected cell and rejects a range selection', () => {
  const { api } = mount();
  const range = { c1: 2, c2: 2, r1: 2, r2: 2 };
  Object.assign(api, {
    asc_findCell: () => {},
    asc_getActiveWorksheetIndex: () => 0,
    wb: { wsViews: [{ model: { selectionRange: { ranges: [range], activeCell: { col: 2, row: 2 } } } }] },
  });
  expect(captureActionTarget().cell).toBe('C3');
  range.c2 = 3;
  expect(() => captureActionTarget()).toThrow('exactly one cell');
});

it('keeps verification unavailable for header/footer and drawing selections', () => {
  const { api } = mount();
  Object.assign(api.WordControl.m_oLogicDocument, { GetText: () => 'Main body', GetDocPosType: () => 1 });
  expect(captureActionTarget().verify).toBeUndefined();
});

it('rejects pre-aborted writes and forwards active cancellation to the native tool', async () => {
  mount();
  const target = captureActionTarget();
  const cancelled = new AbortController();
  cancelled.abort(new DOMException('Stopped', 'AbortError'));
  const action = new ReviewedAction(target, { tool: 'insert_text', input: { text: 'Hello' } });
  await expect(action.apply(cancelled.signal)).rejects.toThrow('Stopped');
  expect(paste).not.toHaveBeenCalled();
  const active = new AbortController();
  await action.apply(active.signal);
  expect(paste).toHaveBeenCalledWith({ text: 'Hello' }, active.signal);
});

it('checks captured operation support before a writing action edits the document', async () => {
  mount();
  const captured = {
    ...captureActionTarget(),
    assertSupported: () => {
      throw new Error('Unsupported tracked structure');
    },
  };
  const action = new ReviewedAction(captured, { tool: 'insert_text', input: { text: 'Hello' } });
  await expect(action.apply()).rejects.toThrow('Unsupported tracked structure');
  expect(paste).not.toHaveBeenCalled();
});

it('captures literal tabs without generated numbering in the Word selection', () => {
  const { api } = mount();
  const getter = vi.fn((options?: { TabSymbol: string; Numbering: boolean }) =>
    options?.TabSymbol === '\t' && options.Numbering === false ? '😀\t' : '1. 😀 ',
  );
  Object.assign(api, { pluginMethod_GetSelectedText: getter });
  expect(captureActionTarget().selectedText).toBe('😀\t');
});
