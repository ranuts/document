import { expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ context: undefined as any }));
vi.mock('../../lib/agent-plugin/editor-bridge', () => ({
  requireEditorApi: () => state.context.api,
  requireEditorContext: () => state.context,
  getEditorContext: () => state.context,
}));
vi.mock('../../lib/onlyoffice/readonly', () => ({ getReadonlyMode: () => false }));
import { setCellTool } from '../../lib/agent-plugin/tools';
import { sumRangeTool } from '../../lib/agent-plugin/office-tools';

function fixture() {
  let value = '',
    formula = '',
    release = () => {},
    format = 'General';
  const history = {
    Index: -1,
    Points: [] as Array<{ Items: unknown[]; Description: number }>,
    _getLongPointIndex: () => history.Points.findIndex((p) => p.Description === 1),
    startGroupPoints: () => {
      history.Points.push({ Items: [], Description: 1 });
      history.Index++;
    },
    endGroupPoints: vi.fn(() => {
      for (const p of history.Points) p.Description = 2;
    }),
    cancelGroupPoints: vi.fn(() => {
      value = '';
      formula = '';
      history.Index = -1;
    }),
    Create_NewPoint: vi.fn(),
    StartTransaction: vi.fn(),
    EndTransaction: vi.fn(),
  };
  const target = {
    getValue: () => value,
    getFormula: () => formula,
    getNumberValue: () => (formula ? 5 : Number(value)),
    getValueData: () => ({ value: { type: 0 } }),
    hasMerged: () => false,
    getNumFormat: () => ({ sFormat: format }),
    setNumFormat: (s: string) => {
      format = s;
    },
  };
  const source = { ...target, getValue: () => '5', getNumberValue: () => 5, getFormula: () => '' };
  const model = {
    getId: () => 'sheet',
    getRange3: (_r: number, c: number) => (c === 1 ? target : source),
    getSheetProtection: () => false,
    isUserProtectedRangesIntersection: () => false,
    selectionRange: { activeCell: { row: 0, col: 1 }, ranges: [{ r1: 0, r2: 0, c1: 1, c2: 1 }] },
  };
  const view = {
    model,
    _loadFonts: (_f: unknown, cb: () => void) => {
      release = cb;
    },
  };
  const insert = (text: string) => {
    value = text.startsWith('=') ? '5' : String(Number(text));
    formula = text.startsWith('=') ? text.slice(1) : '';
    history.Points[history.Index]?.Items.push({});
  };
  const api = {
    wb: { getWorksheet: () => view },
    wbModel: { getWorksheetById: () => model },
    isDocumentLoadComplete: true,
    isLoadFullApi: true,
    canEdit: () => true,
    isLongAction: () => false,
    sync_StartAction: vi.fn(),
    sync_EndAction: vi.fn(),
    asc_findCell: vi.fn(),
    pluginMethod_PasteText: (text: string) => view._loadFonts([], () => insert(text)),
    asc_PasteData: (_f: number, text: string, _a: unknown, _b: unknown, _c: unknown, done: (ok: boolean) => void) =>
      view._loadFonts([], () => {
        insert(text);
        done(true);
      }),
  };
  const helper = { Api: api, Paste_Process_End: vi.fn() };
  state.context = {
    api,
    Asc: { Range: class {}, c_oAscAsyncActionType: { BlockInteraction: 1 }, c_oAscAsyncAction: { ApplyChanges: 2 } },
    AscCommon: { History: history, g_specialPasteHelper: helper, c_oAscClipboardDataFormat: { Text: 4 } },
    AscDFH: { historydescription_GroupPoints: 2 },
  };
  return { target, history, api, release: () => release() };
}
const cases = [
  ['auto set_cell', (signal: AbortSignal) => setCellTool.execute({ cell: 'B1', value: '00123' }, signal)],
  ['sum_range', (signal: AbortSignal) => sumRangeTool.execute({ range: 'A1', target: 'B1' }, signal)],
] as const;
it.each(cases)('%s rejects Stop and prevents the pending native insertion', async (_name, execute) => {
  const f = fixture(),
    abort = new AbortController();
  const pending = execute(abort.signal);
  abort.abort();
  f.release();
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  expect(f.target.getValue()).toBe('');
  expect(f.history.cancelGroupPoints).toHaveBeenCalledOnce();
  expect(f.api.sync_EndAction).toHaveBeenCalledOnce();
});
it.each(cases)('%s preserves foreign history when Stop arrives', async (_name, execute) => {
  const f = fixture(),
    abort = new AbortController();
  const pending = execute(abort.signal);
  const foreign = {};
  f.history.Points[f.history.Index]?.Items.push(foreign);
  abort.abort();
  f.release();
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  expect(f.target.getValue()).toBe('');
  expect(f.history.cancelGroupPoints).not.toHaveBeenCalled();
  expect(f.history.Points[0].Items).toContain(foreign);
});
it.each(cases)('%s waits for completion and preserves native numeric/formula semantics', async (name, execute) => {
  const f = fixture(),
    abort = new AbortController();
  const pending = execute(abort.signal);
  let settled = false;
  pending.then(() => {
    settled = true;
  });
  await Promise.resolve();
  await Promise.resolve();
  expect(settled).toBe(false);
  expect(f.target.getValue()).toBe('');
  f.release();
  await pending;
  expect(f.target.getValue()).toBe(name === 'sum_range' ? '5' : '123');
  expect(f.target.getFormula()).toBe(name === 'sum_range' ? 'SUM(A1)' : '');
  expect(f.target.getNumFormat().sFormat).toBe('General');
  expect(f.history.endGroupPoints).toHaveBeenCalledOnce();
});

it('explicit auto keeps formulas instead of forcing literal text', async () => {
  const f = fixture();
  const pending = setCellTool.execute({ cell: 'B1', value: '=SUM(A1)', valueType: 'auto' });
  f.release();
  await pending;
  expect(f.target.getFormula()).toBe('SUM(A1)');
  expect(f.target.getNumFormat().sFormat).toBe('General');
});

it.each(cases)('%s rejects timeout and disables a later native insertion', async (_name, execute) => {
  vi.useFakeTimers();
  try {
    const f = fixture();
    const pending = execute(new AbortController().signal);
    const rejected = expect(pending).rejects.toThrow('Native paste timed out');
    await vi.advanceTimersByTimeAsync(10000);
    await rejected;
    f.release();
    expect(f.target.getValue()).toBe('');
    expect(f.history.cancelGroupPoints).toHaveBeenCalledOnce();
    expect(f.api.sync_EndAction).toHaveBeenCalledOnce();
  } finally {
    vi.useRealTimers();
  }
});

it.each(cases)('%s preserves foreign edits between native completion and promise cleanup', async (_name, execute) => {
  const f = fixture(),
    foreign = {};
  const pending = execute(new AbortController().signal);
  f.release();
  f.history.Points[0].Items.push(foreign);
  await expect(pending).rejects.toThrow();
  expect(f.history.Points[0].Items).toContain(foreign);
  expect(f.history.cancelGroupPoints).not.toHaveBeenCalled();
  expect(f.history.endGroupPoints).not.toHaveBeenCalled();
});

it('rolls back an owned SUM whose native formula readback is wrong', async () => {
  const f = fixture();
  // Keep the destination empty during the preflight, then invalidate readback.
  let reads = 0;
  f.target.getFormula = () => (reads++ ? 'SUM(A2)' : '');
  const pending = sumRangeTool.execute({ range: 'A1', target: 'B1' });
  f.release();
  await expect(pending).rejects.toThrow('could not be verified');
  expect(f.history.cancelGroupPoints).toHaveBeenCalledOnce();
  expect(f.target.getValue()).toBe('');
});
