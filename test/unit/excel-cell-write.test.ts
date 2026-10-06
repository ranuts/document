import { expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ context: null as unknown, readonly: false }));
const writer = vi.hoisted(() => vi.fn(async (_scope: unknown, _text: string, _signal?: AbortSignal) => {}));
vi.mock('../../lib/agent-plugin/editor-bridge', () => ({
  requireEditorContext: () => state.context,
  getEditorContext: () => state.context,
}));
vi.mock('../../lib/onlyoffice/readonly', () => ({ getReadonlyMode: () => state.readonly }));
vi.mock('../../lib/agent-plugin/excel-text-write', () => ({ writeExcelLiteralText: writer }));
import { writeExcelCellText } from '../../lib/agent-plugin/excel-cell-write';
function fixture() {
  const cell = {
    getNumFormat: () => ({ sFormat: 'General' }),
    setNumFormat: vi.fn(),
    getValue: () => '30',
    hasMerged: () => false,
  };
  const model = {
    getId: () => 'sheet',
    getRange3: vi.fn(() => cell),
    getSheetProtection: () => false,
    isUserProtectedRangesIntersection: () => false,
    selectionRange: { activeCell: { row: 1, col: 1 }, ranges: [{ r1: 1, r2: 1, c1: 1, c2: 1 }] },
  };
  const view = { model };
  const wbModel = { getWorksheetById: () => model };
  const api = {
    wb: { getWorksheet: () => view },
    wbModel,
    isDocumentLoadComplete: true,
    isLoadFullApi: true,
    canEdit: () => true,
    asc_findCell: vi.fn(),
    asc_PasteData: vi.fn(),
    isLongAction: () => false,
    sync_StartAction: vi.fn(),
    sync_EndAction: vi.fn(),
  };
  const history = {
    Index: -1,
    Points: [],
    Create_NewPoint: vi.fn(),
    StartTransaction: vi.fn(),
    EndTransaction: vi.fn(),
    startGroupPoints: vi.fn(),
    endGroupPoints: vi.fn(),
    cancelGroupPoints: vi.fn(),
    _getLongPointIndex: () => -1,
  };
  const helper = { Api: api, Paste_Process_End: vi.fn() };
  state.context = {
    api,
    Asc: {
      Range: class {
        constructor(
          public c1: number,
          public r1: number,
          public c2: number,
          public r2: number,
        ) {}
      },
      c_oAscAsyncActionType: { BlockInteraction: 1 },
      c_oAscAsyncAction: { ApplyChanges: 2 },
    },
    AscCommon: { History: history, g_specialPasteHelper: helper, c_oAscClipboardDataFormat: { Text: 4 } },
    AscDFH: { historydescription_GroupPoints: 2 },
  };
  state.readonly = false;
  writer.mockClear();
  return { api, model, view, helper };
}
it('binds text writing to the exact native cell and passes cancellation', async () => {
  const f = fixture(),
    abort = new AbortController();
  await writeExcelCellText('B2', '00123', abort.signal);
  expect(f.model.getRange3).toHaveBeenCalledWith(1, 1, 1, 1);
  expect(f.api.asc_findCell).toHaveBeenCalledWith('B2');
  expect(writer).toHaveBeenCalledWith(expect.objectContaining({ api: f.api, model: f.model }), '00123', abort.signal);
  const scope = writer.mock.calls[0][0] as unknown as { isCurrent(): boolean; isDocumentCurrent(): boolean };
  expect(scope.isCurrent()).toBe(true);
  f.model.selectionRange.activeCell.row = 2;
  expect(scope.isCurrent()).toBe(false);
  expect(scope.isDocumentCurrent()).toBe(true);
});
it('rejects protected and readonly targets before moving selection', async () => {
  const f = fixture();
  state.readonly = true;
  await expect(writeExcelCellText('B2', '00123')).rejects.toThrow('read-only');
  expect(f.api.asc_findCell).not.toHaveBeenCalled();
  expect(writer).not.toHaveBeenCalled();
});
it('does not end a replaced paste helper', async () => {
  const f = fixture();
  await writeExcelCellText('B2', '00123');
  const scope = writer.mock.calls[0][0] as unknown as { endPaste(): void };
  (state.context as { AscCommon: { g_specialPasteHelper: unknown } }).AscCommon.g_specialPasteHelper = {};
  scope.endPaste();
  expect(f.helper.Paste_Process_End).not.toHaveBeenCalled();
});
