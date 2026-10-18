import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const stream = vi.hoisted(() => ({
  requestSaveDocument: vi.fn(),
  diskWriter: null as null | ((file: File) => Promise<string>),
  saved: null as null | ((file: File, isCurrent: () => boolean) => void),
}));
vi.mock('../../lib/onlyoffice/save-stream', () => ({
  requestSaveDocument: stream.requestSaveDocument,
  setDiskWriter: (writer: (file: File) => Promise<string>) => {
    stream.diskWriter = writer;
  },
  setSavedToDiskListener: (listener: (file: File, isCurrent: () => boolean) => void) => {
    stream.saved = listener;
  },
}));
const { opened } = vi.hoisted(() => ({ opened: vi.fn(async (_file: File, _options?: unknown) => {}) }));
vi.mock('../../lib/document', () => ({ openLocalFile: opened }));
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
import { getDoc, getLatestSnapshot, putSnapshot, resetHistoryClockForTests } from '../../lib/history/store';
import { resetSaveTargetsForTests, saveToDiskFile } from '../../lib/save-target';
import { startDocumentSession } from '../../lib/history/session';

import { rememberActiveSource, readActiveSource } from '../../lib/active-document-source';
import { restoreSavedDocument } from '../../lib/history/recovery';

const file = () => new File([new Uint8Array([1, 2, 3])], 'Report.docx');

beforeEach(() => {
  sessionStorage.clear();
  opened.mockClear();
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
  stream.saved!(file(), () => true);
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

it.each(['export', 'storage'])('discards an older autosave held in %s after disk save B commits', async (phase) => {
  await beginAutosaveSession({ docId: 'active', title: 'Report.docx', origin: 'local' });
  await rememberActiveSource('active', new File(['original O'], 'Report.docx'));
  let finish!: (value: ArrayBuffer | File) => void;
  const older = new File(['old autosave A'], 'Report.docx');
  const waiting = vi.fn(
    () =>
      new Promise<ArrayBuffer | File>((resolve) => {
        finish = resolve;
      }),
  );
  if (phase === 'storage') {
    vi.spyOn(older, 'arrayBuffer').mockImplementation(waiting as () => Promise<ArrayBuffer>);
    stream.requestSaveDocument.mockResolvedValue(older);
  } else stream.requestSaveDocument.mockImplementation(waiting);
  const pending = takeSnapshot();
  await vi.waitFor(() => expect(waiting).toHaveBeenCalled());
  const saved = new File(['disk save B'], 'Report.docx');
  stream.saved!(saved, () => true);
  await vi.waitFor(async () => expect(await (await readActiveSource('active'))?.text()).toBe('disk save B'));
  finish(phase === 'storage' ? new Uint8Array([65]).buffer : older);
  expect(await pending).toBeNull();
  expect(await getLatestSnapshot('active')).toBeNull();
  expect(await restoreSavedDocument('active')).toBe(true);
  expect(await opened.mock.calls[0][0].text()).toBe('disk save B');
  // Cancelling the older export does not stop future recovery of new edits.
  stream.requestSaveDocument.mockResolvedValue(new File(['new unsaved C'], 'Report.docx'));
  await takeSnapshot();
  opened.mockClear();
  expect(await restoreSavedDocument('active')).toBe(true);
  expect(await opened.mock.calls[0][0].text()).toBe('new unsaved C');
});

it('does not promote an unsaved snapshot made while retaining saved source bytes', async () => {
  await beginAutosaveSession({ docId: 'active', title: 'Report.docx', origin: 'local' });
  await rememberActiveSource('active', new File(['original O'], 'Report.docx'));
  await putSnapshot({ id: 'active', title: 'Report.docx', origin: 'local', bytes: new Uint8Array([65]) });
  const saved = new File(['disk save B'], 'Report.docx');
  let finish!: (bytes: ArrayBuffer) => void;
  const reading = vi.spyOn(saved, 'arrayBuffer').mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  stream.saved!(saved, () => true);
  await vi.waitFor(() => expect(reading).toHaveBeenCalled());
  await putSnapshot({ id: 'active', title: 'Report.docx', origin: 'local', bytes: new Uint8Array([67]) });
  finish(new Uint8Array([66]).buffer);
  await vi.waitFor(async () => expect(await (await readActiveSource('active'))?.text()).toBe('B'));
  expect((await getDoc('active'))?.savedToDiskAt).toBeUndefined();
  expect(await restoreSavedDocument('active')).toBe(true);
  expect(await opened.mock.calls[0][0].text()).toBe('C');
});

it.each(['document switch', 'newer save'])('does not publish a late source write after %s', async (mode) => {
  await beginAutosaveSession({ docId: 'active', title: 'Report.docx', origin: 'local' });
  await rememberActiveSource('active', new File(['original O'], 'Report.docx'));
  const saved = new File(['old save B'], 'Report.docx');
  let finish!: (bytes: ArrayBuffer) => void;
  const reading = vi.spyOn(saved, 'arrayBuffer').mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  let current = true;
  stream.saved!(saved, () => current);
  await vi.waitFor(() => expect(reading).toHaveBeenCalled());
  current = false;
  const docId = mode === 'document switch' ? 'replacement' : 'active';
  if (mode === 'document switch') {
    await beginAutosaveSession({ docId, title: 'New.docx', origin: 'local' });
    await rememberActiveSource(docId, new File(['new source C'], 'New.docx'));
  } else {
    stream.saved!(new File(['new source C'], 'Report.docx'), () => true);
    await vi.waitFor(async () => expect(await (await readActiveSource(docId))?.text()).toBe('new source C'));
  }
  finish(new Uint8Array([66]).buffer);
  await new Promise((resolve) => setTimeout(resolve, 30));
  expect(await (await readActiveSource(docId))?.text()).toBe('new source C');
  expect(await getDoc('active')).toBeNull();
});
