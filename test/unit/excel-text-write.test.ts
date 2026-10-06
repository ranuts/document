import { expect, it, vi } from 'vitest';
import { writeExcelLiteralText } from '../../lib/agent-plugin/excel-text-write';
function fixture() {
  let format = '0.00',
    value = '30',
    release!: () => void;
  const history = {
    Index: -1,
    Points: [] as Array<{ Items: unknown[]; Description: number }>,
    _getLongPointIndex: () => history.Points.findIndex((p) => p.Description === 1),
    startGroupPoints: () => {
      history.Points.push({ Items: [], Description: 1 });
      history.Index++;
    },
    endGroupPoints: vi.fn(() => {
      history.Points = history.Points.slice(0, history.Index + 1);
      for (const p of history.Points) p.Description = 2;
    }),
    cancelGroupPoints: vi.fn(() => {
      value = '30';
      format = '0.00';
      history.Index = -1;
    }),
    Create_NewPoint: vi.fn(),
    StartTransaction: vi.fn(),
    EndTransaction: vi.fn(),
  };
  const cell = {
    getNumFormat: () => ({ sFormat: format }),
    setNumFormat: (next: string) => {
      format = next;
      history.Points[history.Index].Items.push({});
    },
    getValue: () => value,
    hasMerged: () => false,
  };
  const view = {
    _loadFonts: (_fonts: unknown, cb: () => void) => {
      release = cb;
    },
  };
  const api = {
    isDocumentLoadComplete: true,
    isLoadFullApi: true,
    canEdit: () => true,
    isLongAction: () => false,
    sync_StartAction: vi.fn(),
    sync_EndAction: vi.fn(),
    asc_PasteData: (
      _f: number,
      text: string,
      _a: unknown,
      _b: unknown,
      _c: unknown,
      complete: (ok?: boolean) => void,
    ) => {
      view._loadFonts([], () => {
        value = text;
        history.Points[history.Index].Items.push({});
        complete(true);
      });
    },
  };
  const endPaste = vi.fn();
  const scope = {
    api,
    view,
    cell,
    model: { getSheetProtection: () => false, isUserProtectedRangesIntersection: () => false },
    history,
    nativeRange: {},
    readonly: false,
    isCurrent: () => true,
    isDocumentCurrent: () => true,
    endPaste,
    codes: { BlockInteraction: 1, ApplyChanges: 2 },
    clipboardFormat: 4,
    closedGroupDescription: 2,
  };
  return { scope, history, api, cell, endPaste, release: () => release() };
}
it('writes exact text, restores format, and closes a single native group and interaction mask', async () => {
  const f = fixture();
  const pending = writeExcelLiteralText(f.scope, '00123');
  f.release();
  await pending;
  expect(f.cell.getValue()).toBe('00123');
  expect(f.cell.getNumFormat().sFormat).toBe('0.00');
  expect(f.history.cancelGroupPoints).not.toHaveBeenCalled();
  expect(f.history.endGroupPoints).toHaveBeenCalledOnce();
  expect(f.history.EndTransaction).toHaveBeenCalledOnce();
  expect(f.api.sync_EndAction).toHaveBeenCalledOnce();
});
it('cancels an owned pending write and disables delayed insertion', async () => {
  const f = fixture(),
    abort = new AbortController();
  const pending = writeExcelLiteralText(f.scope, '00123', abort.signal);
  abort.abort();
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  f.release();
  expect(f.cell.getValue()).toBe('30');
  expect(f.cell.getNumFormat().sFormat).toBe('0.00');
  expect(f.history.cancelGroupPoints).toHaveBeenCalledOnce();
  expect(f.api.sync_EndAction).toHaveBeenCalledOnce();
});
it('preserves foreign edits instead of canceling or merging the group', async () => {
  const f = fixture();
  const pending = writeExcelLiteralText(f.scope, '00123');
  const foreign = {};
  f.history.Points[f.history.Index].Items.push(foreign);
  f.release();
  await expect(pending).rejects.toThrow('Paste ownership has expired');
  expect(f.cell.getValue()).toBe('30');
  expect(f.history.Points[0].Items).toContain(foreign);
  expect(f.history.cancelGroupPoints).not.toHaveBeenCalled();
  expect(f.history.endGroupPoints).not.toHaveBeenCalled();
  expect(f.history.Points[0].Description).toBe(2);
  expect(f.api.sync_EndAction).toHaveBeenCalledOnce();
});

it('does not overwrite a foreign format applied to the target while fonts are pending', async () => {
  const f = fixture();
  const pending = writeExcelLiteralText(f.scope, '00123');
  f.cell.setNumFormat('0%');
  f.release();
  await expect(pending).rejects.toThrow();
  expect(f.cell.getNumFormat().sFormat).toBe('0%');
  expect(f.history.cancelGroupPoints).not.toHaveBeenCalled();
});

it('does not undo a foreign edit when Stop arrives before the deferred callback resumes', async () => {
  const f = fixture(),
    abort = new AbortController();
  const pending = writeExcelLiteralText(f.scope, '00123', abort.signal);
  const foreign = {};
  f.history.Points[0].Items.push(foreign);
  abort.abort();
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  f.release();
  expect(f.history.cancelGroupPoints).not.toHaveBeenCalled();
  expect(f.history.Points[0].Items).toContain(foreign);
});

it('rolls back an owned failure before temporary formatting changes the cell', async () => {
  const f = fixture();
  f.cell.setNumFormat = () => {
    throw new Error('format unavailable');
  };
  await expect(writeExcelLiteralText(f.scope, '00123')).rejects.toThrow('format unavailable');
  expect(f.history.cancelGroupPoints).toHaveBeenCalledOnce();
});

it('releases its own old Redo backup after foreign edits without restoring that branch', async () => {
  const f = fixture(),
    abort = new AbortController();
  const future = { Items: [{}], Description: 2 };
  f.history.Points.push(future);
  const backups: Array<typeof f.history.Points> = [];
  Object.assign(f.history, {
    StoredData: backups,
    SaveRedoPoints: () => backups.push(f.history.Points.slice(f.history.Index + 1)),
    PopRedoPoints: () => f.history.Points.push(...backups.pop()!),
  });
  const open = f.history.startGroupPoints;
  f.history.startGroupPoints = () => {
    f.history.Points.length = f.history.Index + 1;
    open();
  };
  const pending = writeExcelLiteralText(f.scope, '00123', abort.signal);
  f.history.Points[0].Items.push({ foreign: true });
  abort.abort();
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  expect(f.history.cancelGroupPoints).not.toHaveBeenCalled();
  expect(backups).toHaveLength(0);
  expect(f.history.Points).not.toContain(future);
});

it('rolls back its own pending edits after target navigation without treating navigation as foreign history', async () => {
  const f = fixture(),
    abort = new AbortController();
  let targetCurrent = true;
  f.scope.isCurrent = () => targetCurrent;
  const pending = writeExcelLiteralText(f.scope, '00123', abort.signal);
  targetCurrent = false;
  abort.abort();
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  f.release();
  expect(f.history.cancelGroupPoints).toHaveBeenCalledOnce();
  expect(f.cell.getValue()).toBe('30');
  expect(f.cell.getNumFormat().sFormat).toBe('0.00');
});

it.each([false, true])(
  'preserves foreign edits after native completion before promise cleanup (Stop=%s)',
  async (stop) => {
    const f = fixture(),
      abort = new AbortController();
    let targetCurrent = true;
    f.scope.isCurrent = () => targetCurrent;
    const pending = writeExcelLiteralText(f.scope, '00123', abort.signal);
    f.release();
    const foreign = {};
    f.history.Points[0].Items.push(foreign);
    if (stop) {
      targetCurrent = false;
      abort.abort();
    }
    await expect(pending).rejects.toThrow();
    expect(f.history.cancelGroupPoints).not.toHaveBeenCalled();
    expect(f.history.endGroupPoints).not.toHaveBeenCalled();
    expect(f.history.Points[0].Items).toContain(foreign);
  },
);

it('checks ownership after format restoration before the group continuation resumes', async () => {
  const f = fixture(),
    foreign = {};
  const set = f.cell.setNumFormat;
  f.cell.setNumFormat = (format) => {
    set(format);
    if (format === '0.00') queueMicrotask(() => f.history.Points[0].Items.push(foreign));
  };
  const pending = writeExcelLiteralText(f.scope, '00123');
  f.release();
  await expect(pending).rejects.toThrow();
  expect(f.history.cancelGroupPoints).not.toHaveBeenCalled();
  expect(f.history.endGroupPoints).not.toHaveBeenCalled();
  expect(f.history.Points[0].Items).toContain(foreign);
});
it('checks ownership again after final readback before closing the history group', async () => {
  const f = fixture(),
    foreign = {};
  const read = f.cell.getValue;
  f.cell.getValue = () => {
    queueMicrotask(() => f.history.Points[0].Items.push(foreign));
    return read();
  };
  const pending = writeExcelLiteralText(f.scope, '00123');
  f.release();
  await expect(pending).rejects.toThrow();
  expect(f.history.cancelGroupPoints).not.toHaveBeenCalled();
  expect(f.history.endGroupPoints).not.toHaveBeenCalled();
  expect(f.history.Points[0].Items).toContain(foreign);
});
