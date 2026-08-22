import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
        close: async () => undefined,
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

  it('can be unlinked deliberately', async () => {
    usePicker(fakeHandle().handle);
    await saveToDiskFile('doc-1', file(), 'Document');

    await forgetSaveTarget('doc-1');

    expect(await getSaveTargetName('doc-1')).toBeNull();
  });
});
