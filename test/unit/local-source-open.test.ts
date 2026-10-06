import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
const { convert, load, save } = vi.hoisted(() => ({
  convert: vi.fn(async (_request: unknown) => {}),
  load: vi.fn(async () => {}),
  save: vi.fn(),
}));
// The actual UI/open/session/store flow runs; only native SDK conversion is replaced.
vi.mock('../../lib/converter', () => ({ handleDocumentOperation: convert, loadEditorApi: load }));
vi.mock('../../lib/onlyoffice/save-stream', () => ({ requestSaveDocument: save }));
import { openLocalFile, onCreateNew } from '../../lib/document';
import { readActiveSource, rememberActiveSource } from '../../lib/active-document-source';
import { beginAutosaveSession, takeSnapshot, stopAutosaveSession } from '../../lib/history/autosave';
import { getLatestSnapshot } from '../../lib/history/store';
import { resetHistoryDbForTests } from '../../lib/history/db';

beforeEach(() => {
  resetHistoryDbForTests();
  vi.stubGlobal('indexedDB', new IDBFactory());
  sessionStorage.clear();
  convert.mockReset();
  convert.mockResolvedValue(undefined);
  window.history.replaceState(null, '', '/editor');
});
afterEach(() => {
  stopAutosaveSession();
  resetHistoryDbForTests();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const original = () => new File(['original bytes'], 'Original.docx');
describe('local open retains its reload source', () => {
  it('keeps a source under the actual stamped document id', async () => {
    await openLocalFile(original());
    const id = new URL(location.href).searchParams.get('saved');
    expect(id).toBeTruthy();
    expect(await (await readActiveSource(id!))?.text()).toBe('original bytes');
  });
  it('waits for source commit before stamping the reload identity', async () => {
    const file = original();
    let finish!: (buffer: ArrayBuffer) => void;
    const read = vi.spyOn(file, 'arrayBuffer').mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const opening = openLocalFile(file);
    await vi.waitFor(() => expect(read).toHaveBeenCalled());
    expect(new URL(location.href).searchParams.get('saved')).toBeNull();
    finish(new TextEncoder().encode('original bytes').buffer);
    await opening;
    const id = new URL(location.href).searchParams.get('saved')!;
    expect(await (await readActiveSource(id))?.text()).toBe('original bytes');
  });
  it('retires the previous autosave while the replacement source is still being stored', async () => {
    await beginAutosaveSession({ docId: 'old', title: 'Old.docx', origin: 'local' });
    save.mockResolvedValue(new File([new Uint8Array([1, 2, 3])], 'Old.docx'));
    expect(await takeSnapshot()).not.toBeNull();
    const file = original();
    let finish!: (buffer: ArrayBuffer) => void;
    const read = vi.spyOn(file, 'arrayBuffer').mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const opening = openLocalFile(file);
    await vi.waitFor(() => expect(read).toHaveBeenCalled());
    save.mockResolvedValue(new File([new Uint8Array([9, 9])], 'Replacement.docx'));
    const snapshot = await takeSnapshot();
    finish(new Uint8Array([4, 5]).buffer);
    await opening;
    expect(snapshot).toBeNull();
    expect(Array.from(new Uint8Array((await getLatestSnapshot('old'))!.bytes))).toEqual([1, 2, 3]);
  });
  it('does not block opening when source storage fails', async () => {
    const open = indexedDB.open.bind(indexedDB);
    vi.spyOn(indexedDB, 'open').mockImplementation((name, version) => {
      if (name === 'document-active-sources') throw new Error('denied');
      return open(name, version);
    });
    await openLocalFile(original());
    expect(new URL(location.href).searchParams.get('saved')).toBeTruthy();
  });
  it('releases the previous source after a new document successfully opens', async () => {
    await rememberActiveSource('old', original());
    await onCreateNew('.docx');
    expect(await readActiveSource('old')).toBeNull();
  });
  it('preserves the previous source when opening another local file fails', async () => {
    await rememberActiveSource('old', original());
    window.history.replaceState(null, '', '/editor?saved=old');
    convert.mockRejectedValueOnce(new Error('conversion failed'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await openLocalFile(new File(['other'], 'Other.docx'));
    expect(await (await readActiveSource('old'))?.text()).toBe('original bytes');
    expect(new URL(location.href).searchParams.get('saved')).toBe('old');
  });

  it('finishes the mounted session when a newer open attempt fails', async () => {
    const file = original();
    let finish!: (buffer: ArrayBuffer) => void;
    const read = vi.spyOn(file, 'arrayBuffer').mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const first = openLocalFile(file);
    await vi.waitFor(() => expect(read).toHaveBeenCalled());
    convert.mockRejectedValueOnce(new Error('conversion failed'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await openLocalFile(new File(['failed'], 'Failed.docx'));
    finish(new Uint8Array([4, 5]).buffer);
    await first;
    const id = new URL(location.href).searchParams.get('saved');
    expect(id).toBeTruthy();
    expect(await readActiveSource(id!)).not.toBeNull();
  });
  it('does not let an older delayed source overwrite the newer session identity', async () => {
    const file = original();
    let finish!: (buffer: ArrayBuffer) => void;
    const read = vi.spyOn(file, 'arrayBuffer').mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const first = openLocalFile(file);
    await vi.waitFor(() => expect(read).toHaveBeenCalled());
    await openLocalFile(new File(['newer'], 'Newer.docx'));
    const currentId = new URL(location.href).searchParams.get('saved')!;
    finish(new TextEncoder().encode('original bytes').buffer);
    await first;
    expect(new URL(location.href).searchParams.get('saved')).toBe(currentId);
    expect(await (await readActiveSource(currentId))?.text()).toBe('newer');
  });
});
