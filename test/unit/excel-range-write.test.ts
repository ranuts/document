import { beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ context: null as unknown }));
vi.mock('../../lib/agent-plugin/editor-bridge', () => ({
  requireEditorContext: () => state.context,
  getEditorContext: () => state.context,
}));
vi.mock('../../lib/onlyoffice/readonly', () => ({ getReadonlyMode: () => false }));
import { writeExcelRangeValues } from '../../lib/agent-plugin/excel-cell-write';
function fixture(corrupt = false) {
  let values = [30, 40, 50];
  const original = [...values];
  const history = {
    Index: -1,
    Points: [] as Array<{ Items: unknown[]; Description: number }>,
    _getLongPointIndex: () => history.Points.findIndex((p) => p.Description === 1),
    startGroupPoints: vi.fn(() => {
      history.Points.push({ Items: [], Description: 1 });
      history.Index++;
    }),
    endGroupPoints: vi.fn(() => {
      for (const p of history.Points) p.Description = 2;
    }),
    cancelGroupPoints: vi.fn(() => {
      values = [...original];
      history.Index = -1;
    }),
    Create_NewPoint: vi.fn(),
    StartTransaction: vi.fn(),
    EndTransaction: vi.fn(),
  };
  const model = {
    getId: () => 'sheet',
    getSheetProtection: () => false,
    isUserProtectedRangesIntersection: () => false,
    getRange3: (r: number) => ({
      hasMerged: () => false,
      getValue: () => String(values[r]),
      getNumberValue: () => values[r],
      getValueData: () => ({ value: { type: 0 } }),
    }),
    selectionRange: { activeCell: { row: 0, col: 0 }, ranges: [{ r1: 0, r2: 2, c1: 0, c2: 0 }] },
  };
  const view = { model, _loadFonts: (_fonts: unknown, callback: () => void) => callback() };
  const api = {
    wb: { getWorksheet: () => view },
    wbModel: { getWorksheetById: () => model },
    isDocumentLoadComplete: true,
    isLoadFullApi: true,
    canEdit: () => true,
    asc_findCell: vi.fn(),
    isLongAction: () => false,
    sync_StartAction: vi.fn(),
    sync_EndAction: vi.fn(),
    asc_PasteData: vi.fn(
      (_format: number, text: string, _a: unknown, _b: unknown, _c: unknown, done: (ok: boolean) => void) => {
        view._loadFonts([], () => {
          values = text.split('\n').map(Number);
          if (corrupt) values[2] = 999;
          history.Points[history.Index].Items.push({});
          done(true);
        });
      },
    ),
  };
  state.context = {
    api,
    Asc: { Range: class {}, c_oAscAsyncActionType: { BlockInteraction: 1 }, c_oAscAsyncAction: { ApplyChanges: 2 } },
    AscCommon: {
      History: history,
      g_specialPasteHelper: { Api: api, Paste_Process_End: vi.fn() },
      c_oAscClipboardDataFormat: { Text: 4 },
    },
    AscDFH: { historydescription_GroupPoints: 2 },
  };
  return {
    api,
    history,
    values: () => values,
    undo: () => {
      values = [...original];
      history.Index--;
    },
  };
}
beforeEach(() => {
  state.context = null;
});
it('writes numeric rows in one native paste and one history group, preserving Undo', async () => {
  const f = fixture();
  await writeExcelRangeValues('A1:A3', [[1], [2], [3]]);
  expect(f.values()).toEqual([1, 2, 3]);
  expect(f.api.asc_PasteData).toHaveBeenCalledOnce();
  expect(f.history.startGroupPoints).toHaveBeenCalledOnce();
  expect(f.history.endGroupPoints).toHaveBeenCalledOnce();
  f.undo();
  expect(f.values()).toEqual([30, 40, 50]);
});
it('rolls back the whole owned write if any cell fails numeric readback', async () => {
  const f = fixture(true);
  await expect(writeExcelRangeValues('A1:A3', [[1], [2], [3]])).rejects.toThrow();
  expect(f.values()).toEqual([30, 40, 50]);
  expect(f.history.cancelGroupPoints).toHaveBeenCalledOnce();
});
it('rejects matrix dimensions before selection or native paste', async () => {
  const f = fixture();
  await expect(writeExcelRangeValues('A1:A3', [[1, 2], [3], [4]])).rejects.toThrow();
  expect(f.api.asc_findCell).not.toHaveBeenCalled();
  expect(f.api.asc_PasteData).not.toHaveBeenCalled();
});
