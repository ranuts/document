import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const stream = vi.hoisted(() => ({
  requestSaveDocument: vi.fn(),
  diskWriter: null as null | ((file: File) => Promise<string>),
  saved: null as null | (() => void),
}));
vi.mock('../../lib/onlyoffice/save-stream', () => ({
  requestSaveDocument: stream.requestSaveDocument,
  setDiskWriter: (writer: (file: File) => Promise<string>) => {
    stream.diskWriter = writer;
  },
  setSavedToDiskListener: (listener: () => void) => {
    stream.saved = listener;
  },
}));
vi.mock('../../lib/onlyoffice/readonly', () => ({ getReadonlyMode: () => false }));

import {
  beginAutosaveSession,
  clearDocumentSession,
  getActiveDocumentId,
  stopAutosaveSession,
  setAutosaveEnabled,
  takeSnapshot,
  isAutosaveSessionActive,
} from '../../lib/history/autosave';
import { initDocumentHistory } from '../../lib/history';
import { resetHistoryDbForTests } from '../../lib/history/db';
import { getDoc, putSnapshot, resetHistoryClockForTests } from '../../lib/history/store';
import { resetSaveTargetsForTests, saveToDiskFile } from '../../lib/save-target';
import { startDocumentSession } from '../../lib/history/session';

const file = () => new File([new Uint8Array([1, 2, 3])], 'Report.docx');

beforeEach(() => {
  clearDocumentSession();
  resetHistoryDbForTests();
  resetHistoryClockForTests();
  resetSaveTargetsForTests();
  vi.stubGlobal('indexedDB', new IDBFactory());
  stream.requestSaveDocument.mockReset();
  setAutosaveEnabled(true);
  window.history.replaceState(null, '', '/editor');
  initDocumentHistory();
});
afterEach(() => {
  clearDocumentSession();
  resetHistoryDbForTests();
  resetSaveTargetsForTests();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function authorizeTarget(docId: string): Promise<Blob[]> {
  const writes: Blob[] = [];
  vi.stubGlobal('showSaveFilePicker', async () => ({
    name: 'Report.docx',
    createWritable: async () => ({
      write: async (data: Blob) => {
        writes.push(data);
      },
      close: async () => {},
    }),
  }));
  expect(await saveToDiskFile(docId, file(), 'Document')).toBe('written');
  vi.stubGlobal('showSaveFilePicker', () => {
    throw new Error('An existing authorized target should be reused');
  });
  return writes;
}

it.each(['disabled-before-open', 'disabled-after-open', 'quota-stopped'])(
  'writes the authorized active file when recovery is %s',
  async (mode) => {
    if (mode === 'disabled-before-open') setAutosaveEnabled(false);
    startDocumentSession({ docId: 'active', title: 'Report.docx', origin: 'local' });
    const writes = await authorizeTarget('active');
    if (mode === 'disabled-after-open') setAutosaveEnabled(false);
    if (mode === 'quota-stopped') {
      vi.stubGlobal('navigator', { storage: { estimate: async () => ({ quota: 2 }) } });
      stream.requestSaveDocument.mockResolvedValue(file());
      expect(await takeSnapshot()).toBeNull();
    }
    expect(isAutosaveSessionActive()).toBe(false);

    const updated = file();
    expect(await stream.diskWriter!(updated)).toBe('written');
    expect(writes).toEqual([expect.any(Blob), updated]);
  },
);

it('routes direct autosave callers to the newest identity while recovery is disabled', async () => {
  setAutosaveEnabled(false);
  await beginAutosaveSession({ docId: 'old', title: 'Report.docx', origin: 'local' });
  const oldWrites = await authorizeTarget('old');
  await beginAutosaveSession({ docId: 'new', title: 'Report.docx', origin: 'local' });
  const newWrites = await authorizeTarget('new');
  expect(await stream.diskWriter!(file())).toBe('written');
  expect(oldWrites).toHaveLength(1);
  expect(newWrites).toHaveLength(2);
});

it('marks the active recovery row saved after autosave is stopped', async () => {
  await beginAutosaveSession({ docId: 'active', title: 'Report.docx', origin: 'local' });
  await putSnapshot({ id: 'active', title: 'Report.docx', origin: 'local', bytes: new Uint8Array([1]) });
  setAutosaveEnabled(false);
  stream.saved!();
  await vi.waitFor(async () => expect((await getDoc('active'))?.savedToDiskAt).toEqual(expect.any(Number)));
});

it('stops recovery without losing file identity until the document is explicitly closed', async () => {
  await beginAutosaveSession({ docId: 'active', title: 'Report.docx', origin: 'local' });
  const writes = await authorizeTarget('active');
  stopAutosaveSession();
  expect(getActiveDocumentId()).toBe('active');
  expect(await stream.diskWriter!(file())).toBe('written');
  expect(writes).toHaveLength(2);

  clearDocumentSession();
  window.history.replaceState(null, '', '/editor?saved=active');
  expect(getActiveDocumentId()).toBeNull();
  expect(await stream.diskWriter!(file())).toBe('unavailable');
  expect(writes).toHaveLength(2);
});

it('does not authorize disk routing from an unvalidated saved URL', async () => {
  window.history.replaceState(null, '', '/editor?saved=untrusted');
  const writes = await authorizeTarget('untrusted');
  expect(await stream.diskWriter!(file())).toBe('unavailable');
  expect(writes).toHaveLength(1);
});
