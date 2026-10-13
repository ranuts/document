import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAllHistory, deleteDoc } from '../../lib/history/store';
import { DB_NAME, resetHistoryDbForTests } from '../../lib/history/db';
import {
  canWriteToDisk,
  forgetSaveTarget,
  getSaveTargetName,
  resetSaveTargetsForTests,
  saveToDiskFile,
} from '../../lib/save-target';

/** A stand-in for a file on disk: records what was written to it. */
function fakeHandle(name = 'Report.docx', permission: PermissionState = 'granted') {
  const written: Blob[] = [];
  return {
    written,
    handle: {
      name,
      createWritable: vi.fn(async () => ({
        write: async (data: Blob) => void written.push(data),
        close: async (): Promise<void> => undefined,
      })),
      queryPermission: vi.fn(async () => permission),
      requestPermission: vi.fn(async () => permission),
    },
  };
}

function usePicker(handle: unknown): ReturnType<typeof vi.fn> {
  const picker = vi.fn(async () => handle);
  vi.stubGlobal('showSaveFilePicker', picker);
  return picker;
}

const file = (): File => new File([new Uint8Array([1, 2, 3]).buffer], 'Report.docx');

async function wipe(): Promise<void> {
  resetHistoryDbForTests();
  resetSaveTargetsForTests();
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
}

describe("saving into the document's own file", () => {
  beforeEach(wipe);
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('reports the capability honestly', () => {
    expect(canWriteToDisk()).toBe(false);
    usePicker(fakeHandle().handle);
    expect(canWriteToDisk()).toBe(true);
  });

  it('falls back where the browser has no picker (Safari, Firefox)', async () => {
    expect(await saveToDiskFile('doc-1', file(), 'Document')).toBe('unavailable');
  });

  it('asks for a file the first time and writes the bytes into it', async () => {
    const target = fakeHandle();
    const picker = usePicker(target.handle);

    expect(await saveToDiskFile('doc-1', file(), 'Document')).toBe('written');

    expect(picker).toHaveBeenCalledTimes(1);
    expect(target.written).toHaveLength(1);
    expect(await getSaveTargetName('doc-1')).toBe('Report.docx');
  });

  it('writes straight to that file every time after, without asking again', async () => {
    const target = fakeHandle();
    const picker = usePicker(target.handle);

    await saveToDiskFile('doc-1', file(), 'Document');
    expect(await saveToDiskFile('doc-1', file(), 'Document')).toBe('written');
    expect(await saveToDiskFile('doc-1', file(), 'Document')).toBe('written');

    // The whole point: one dialog, three saves.
    expect(picker).toHaveBeenCalledTimes(1);
    expect(target.written).toHaveLength(3);
  });

  it('keeps one file per document, not one per browser', async () => {
    const first = fakeHandle('First.docx');
    const picker = usePicker(first.handle);
    await saveToDiskFile('doc-1', file(), 'Document');

    const second = fakeHandle('Second.docx');
    picker.mockResolvedValue(second.handle);
    await saveToDiskFile('doc-2', file(), 'Document');

    expect(await getSaveTargetName('doc-1')).toBe('First.docx');
    expect(await getSaveTargetName('doc-2')).toBe('Second.docx');
  });

  it('treats a dismissed dialog as a decision, not a failure', async () => {
    const picker = vi.fn(async () => {
      throw Object.assign(new Error('user closed it'), { name: 'AbortError' });
    });
    vi.stubGlobal('showSaveFilePicker', picker);

    // 'cancelled', not 'unavailable': the caller must not answer a declined
    // save by downloading a copy anyway.
    expect(await saveToDiskFile('doc-1', file(), 'Document')).toBe('cancelled');
  });

  it('drops the link when permission is refused, and asks again next time', async () => {
    const granted = fakeHandle();
    const picker = usePicker(granted.handle);
    await saveToDiskFile('doc-1', file(), 'Document');

    // A handle read back after a reload starts at "prompt"; refuse it.
    granted.handle.queryPermission.mockResolvedValue('prompt');
    granted.handle.requestPermission.mockResolvedValue('denied');
    const denied = fakeHandle('Chosen.docx');
    picker.mockResolvedValue(denied.handle);

    expect(await saveToDiskFile('doc-1', file(), 'Document')).toBe('written');
    expect(picker).toHaveBeenCalledTimes(2);
    expect(await getSaveTargetName('doc-1')).toBe('Chosen.docx');
  });

  it('forgets a file it can no longer write to, so the next save offers a new one', async () => {
    const target = fakeHandle();
    usePicker(target.handle);
    await saveToDiskFile('doc-1', file(), 'Document');

    // The file was moved or deleted between saves.
    target.handle.createWritable.mockRejectedValue(new Error('NotFoundError'));

    expect(await saveToDiskFile('doc-1', file(), 'Document')).toBe('unavailable');
    // Nothing is linked any more: the fallback download covers this save, and
    // the next one starts from the picker again -- which is also how a user
    // saves somewhere else.
    expect(await getSaveTargetName('doc-1')).toBeNull();
  });

  it('exports another format without overwriting or replacing the original target', async () => {
    const original = fakeHandle('Report.docx');
    const picker = usePicker(original.handle);
    await saveToDiskFile('doc-1', file(), 'Document');
    const exported = fakeHandle('Report.pdf');
    picker.mockResolvedValue(exported.handle);
    const pdf = new File(['%PDF-1.7'], 'Report.pdf', { type: 'application/pdf' });
    expect(await saveToDiskFile('doc-1', pdf, 'Document')).toBe('written');
    expect(original.written).toHaveLength(1);
    expect(exported.written).toEqual([pdf]);
    expect(await getSaveTargetName('doc-1')).toBe('Report.docx');
    await saveToDiskFile('doc-1', file(), 'Document');
    expect(original.written).toHaveLength(2);
    expect(picker).toHaveBeenCalledTimes(2);
  });

  it('keeps the original target after cancelling an export to another format', async () => {
    const original = fakeHandle();
    const picker = usePicker(original.handle);
    await saveToDiskFile('doc-1', file(), 'Document');
    picker.mockRejectedValue(new DOMException('Cancelled', 'AbortError'));
    expect(await saveToDiskFile('doc-1', new File(['%PDF'], 'Report.pdf'), 'Document')).toBe('cancelled');
    expect(original.written).toHaveLength(1);
    expect(await getSaveTargetName('doc-1')).toBe('Report.docx');
  });

  it('does not associate an initial export with later ordinary saves', async () => {
    const pdfTarget = fakeHandle('Report.pdf');
    const picker = usePicker(pdfTarget.handle);
    await saveToDiskFile('doc-1', new File(['%PDF'], 'Report.pdf'), 'Document', { rememberTarget: false });
    expect(await getSaveTargetName('doc-1')).toBeNull();
    const original = fakeHandle('Report.docx');
    picker.mockResolvedValue(original.handle);
    await saveToDiskFile('doc-1', file(), 'Document');
    expect(original.written).toHaveLength(1);
    expect(pdfTarget.written).toHaveLength(1);
    expect(await getSaveTargetName('doc-1')).toBe('Report.docx');
  });

  it('keeps the original target when writing an export fails', async () => {
    const original = fakeHandle();
    const picker = usePicker(original.handle);
    await saveToDiskFile('doc-1', file(), 'Document');
    const exported = fakeHandle('Report.pdf');
    exported.handle.createWritable.mockRejectedValue(new Error('disk full'));
    picker.mockResolvedValue(exported.handle);
    expect(await saveToDiskFile('doc-1', new File(['%PDF'], 'Report.pdf'), 'Document')).toBe('unavailable');
    expect(await getSaveTargetName('doc-1')).toBe('Report.docx');
  });

  it.each(['first save', 'existing target'])(
    'does not revive a cleared link after a pending %s commits',
    async (mode) => {
      const target = fakeHandle();
      usePicker(target.handle);
      if (mode === 'existing target') await saveToDiskFile('doc-1', file(), 'Document');
      let finish!: () => void;
      const pendingClose = new Promise<void>((resolve) => {
        finish = resolve;
      });
      target.handle.createWritable.mockImplementation(async () => ({
        write: async (data: Blob) => void target.written.push(data),
        close: () => pendingClose,
      }));
      const saving = saveToDiskFile('doc-1', file(), 'Document');
      await vi.waitFor(() => expect(target.written.length).toBe(mode === 'existing target' ? 2 : 1));
      await clearAllHistory();
      finish();
      expect(await saving).toBe('written');
      expect(await getSaveTargetName('doc-1')).toBeNull();
    },
  );

  it.each(['delete', 'clear'])('forgets in-memory targets when history is removed by %s', async (mode) => {
    usePicker(fakeHandle().handle);
    await saveToDiskFile('doc-1', file(), 'Document');
    expect(await getSaveTargetName('doc-1')).toBe('Report.docx');
    expect(await (mode === 'delete' ? deleteDoc('doc-1') : clearAllHistory())).toBe(true);
    expect(await getSaveTargetName('doc-1')).toBeNull();
  });

  it('can be unlinked deliberately', async () => {
    usePicker(fakeHandle().handle);
    await saveToDiskFile('doc-1', file(), 'Document');

    await forgetSaveTarget('doc-1');

    expect(await getSaveTargetName('doc-1')).toBeNull();
  });
});
