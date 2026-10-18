import 'fake-indexeddb/auto';
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const { opened } = vi.hoisted(() => ({ opened: vi.fn(async (_file: File, _options?: unknown) => {}) }));
vi.mock('../../lib/document', () => ({ openLocalFile: opened }));
vi.mock('../../lib/history/autosave', () => ({
  getActiveDocumentId: () => 'save-document',
  clearDocumentSession: vi.fn(),
  beginAutosaveSession: vi.fn(),
  isAutosaveEnabled: () => true,
  setAutosaveEnabled: vi.fn(),
  stopAutosaveSession: vi.fn(),
  cancelPendingSnapshot: vi.fn(),
}));
import { rememberActiveSource, readActiveSource } from '../../lib/active-document-source';
import { restoreSavedDocument } from '../../lib/history/recovery';
import { initDocumentHistory } from '../../lib/history/index';
import { getDoc, putSnapshot, deleteDoc } from '../../lib/history/store';
import { resetHistoryDbForTests } from '../../lib/history/db';
import { resetSaveTargetsForTests } from '../../lib/save-target';
import { markDocumentDirty, hasUnsavedChanges, resetUnsavedGuardForTests } from '../../lib/unsaved-guard';
import { setDiskWriter, setSavedToDiskListener } from '../../lib/onlyoffice/save-stream';
import { installServerlessSaveSemantics } from '../../lib/onlyoffice/guards/serverless-save';
import { setDocmentObj } from '@ranuts/shared/store';
let frame: HTMLIFrameElement;
let history: { Index: number; Points: Array<{ Items: object[] }>; Reset_SavedIndex: ReturnType<typeof vi.fn> };
let conversions: Array<Promise<{ binary: Uint8Array }>>;
beforeEach(async () => {
  sessionStorage.clear();
  opened.mockClear();
  resetHistoryDbForTests();
  resetSaveTargetsForTests();
  resetUnsavedGuardForTests();
  vi.stubGlobal('indexedDB', new IDBFactory());
  window.history.replaceState(null, '', '/editor');
  await putSnapshot({ id: 'save-document', title: 'Report.docx', origin: 'local', bytes: new Uint8Array([1]) });
  frame = document.createElement('iframe');
  frame.name = 'frameEditor';
  document.body.append(frame);
  setDocmentObj({ fileName: 'Report.docx' });
  history = { Index: 0, Points: [{ Items: [{}] }], Reset_SavedIndex: vi.fn() };
  conversions = [];
  const converter = {
    convertFromBin: async () => ({ binary: new Uint8Array([1, 2, 3]) }),
    downloadFile: vi.fn(),
  };
  const api = {
    asc_Save: vi.fn(),
    CheckChangedDocument: vi.fn(),
    isLongAction: () => false,
    asc_DownloadAs: () => {
      if (!api.isLongAction()) conversions.push(converter.convertFromBin());
    },
  };
  Object.assign(frame.contentWindow!, {
    AscCommon: { History: history, x2t: converter },
    Asc: {
      editor: api,
      asc_CDownloadOptions: class {},
    },
  });
  installServerlessSaveSemantics(frame.contentWindow!);
  initDocumentHistory();
  markDocumentDirty();
});
afterEach(() => {
  frame.remove();
  setDiskWriter(null);
  setSavedToDiskListener(null);
  resetHistoryDbForTests();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
function startExport() {
  (frame.contentWindow as any).Asc.editor.asc_DownloadAs({});
}
async function sendFile(start = true, index = 0, extension = 'docx') {
  if (start) startExport();
  const result = await conversions.splice(index, 1)[0];
  (frame.contentWindow as any).AscCommon.x2t.downloadFile(result.binary, `Report.${extension}`);
  window.dispatchEvent(
    new MessageEvent('message', {
      source: frame.contentWindow,
      origin: location.origin,
      data: {
        type: 'onlyoffice-file-stream',
        fileName: `Report.${extension}`,
        fileType: extension,
        buffer: new Uint8Array([1, 2, 3]).buffer,
      },
    }),
  );
}
it.each(['linked writer', 'fallback'])('retains unsaved work after cancelling the %s picker', async (path) => {
  const picker = vi.fn(async () => {
    throw new DOMException('Cancelled', 'AbortError');
  });
  vi.stubGlobal('showSaveFilePicker', picker);
  if (path === 'fallback') setDiskWriter(null);
  sendFile();
  await vi.waitFor(() => expect(picker).toHaveBeenCalledOnce());
  await new Promise((resolve) => setTimeout(resolve, 10));
  expect(hasUnsavedChanges()).toBe(true);
  expect((await getDoc('save-document'))?.savedToDiskAt).toBeUndefined();
});
it('clears unsaved work only after the write has committed', async () => {
  let finish!: () => void;
  const closed = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const picker = vi.fn(async () => ({
    name: 'Report.docx',
    createWritable: async () => ({ write: async () => undefined, close: () => closed }),
  }));
  vi.stubGlobal('showSaveFilePicker', picker);
  sendFile();
  await vi.waitFor(() => expect(picker).toHaveBeenCalledOnce());
  expect(hasUnsavedChanges()).toBe(true);
  finish();
  await vi.waitFor(() => expect(hasUnsavedChanges()).toBe(false));
  await vi.waitFor(async () => expect((await getDoc('save-document'))?.savedToDiskAt).toBeTypeOf('number'));
  expect(history.Reset_SavedIndex).toHaveBeenCalledWith(true);
});

it.each(['export', 'write', 'same undo point', 'document switch'])(
  'keeps newer work protected after a change during %s',
  async (phase) => {
    let finish!: (outcome: 'written') => void;
    const writer = vi.fn(
      () =>
        new Promise<'written'>((resolve) => {
          finish = resolve;
        }),
    );
    setDiskWriter(writer);
    startExport();
    if (phase === 'export') {
      history.Points.push({ Items: [{}] });
      history.Index++;
    }
    sendFile(false);
    await vi.waitFor(() => expect(writer).toHaveBeenCalledOnce());
    if (phase === 'same undo point') history.Points[0].Items.push({});
    if (phase === 'write') {
      history.Points.push({ Items: [{}] });
      history.Index++;
    }
    if (phase === 'document switch') setDocmentObj({ fileName: 'Replacement.docx' });
    markDocumentDirty();
    finish('written');
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(hasUnsavedChanges()).toBe(true);
    expect(history.Reset_SavedIndex).not.toHaveBeenCalled();
    expect((await getDoc('save-document'))?.savedToDiskAt).toBeUndefined();
  },
);

it('a cancelled or failed export does not prevent a later successful save', async () => {
  setDiskWriter(async () => 'written');
  startExport();
  // No stream is returned for a failed conversion or a dismissed export dialog.
  conversions.shift();
  history.Points.push({ Items: [{}] });
  history.Index++;
  startExport();
  sendFile(false);
  await new Promise((resolve) => setTimeout(resolve, 10));
  await vi.waitFor(() => expect(hasUnsavedChanges()).toBe(false));
  expect(history.Reset_SavedIndex).toHaveBeenCalledOnce();
});

it('a busy SDK ignoring another request preserves the accepted export save point', async () => {
  setDiskWriter(async () => 'written');
  startExport();
  (frame.contentWindow as any).Asc.editor.isLongAction = () => true;
  startExport();
  sendFile(false);
  await new Promise((resolve) => setTimeout(resolve, 10));
  await vi.waitFor(() => expect(hasUnsavedChanges()).toBe(false));
  expect(history.Reset_SavedIndex).toHaveBeenCalledOnce();
});

it('serializes writes so an older save cannot overwrite a newer saved version', async () => {
  let finish!: () => void;
  const firstWrite = new Promise<void>((resolve) => {
    finish = resolve;
  });
  let disk = '';
  let calls = 0;
  setDiskWriter(async () => {
    const version = ++calls;
    if (version === 1) await firstWrite;
    disk = `version ${version}`;
    return 'written';
  });
  sendFile();
  await vi.waitFor(() => expect(calls).toBe(1));
  history.Points.push({ Items: [{}] });
  history.Index++;
  sendFile();
  await new Promise((resolve) => setTimeout(resolve, 10));
  expect(calls).toBe(1);
  expect(hasUnsavedChanges()).toBe(true);
  finish();
  await vi.waitFor(() => expect(calls).toBe(2));
  await vi.waitFor(() => expect(hasUnsavedChanges()).toBe(false));
  expect(disk).toBe('version 2');
});

it('does not attribute an older conversion stream to a newer accepted export', async () => {
  let writes = 0;
  setDiskWriter(async () => {
    writes++;
    return 'written';
  });
  startExport();
  history.Points.push({ Items: [{}] });
  history.Index++;
  startExport();
  await sendFile(false);
  await vi.waitFor(() => expect(writes).toBe(1));
  expect(hasUnsavedChanges()).toBe(true);
  await sendFile(false);
  await vi.waitFor(() => expect(hasUnsavedChanges()).toBe(false));
});

it('does not overwrite the latest saved bytes when conversions finish out of order', async () => {
  let writes = 0;
  setDiskWriter(async () => {
    writes++;
    return 'written';
  });
  startExport();
  history.Points.push({ Items: [{}] });
  history.Index++;
  startExport();
  await sendFile(false, 1); // Newer conversion completes first.
  await vi.waitFor(() => expect(hasUnsavedChanges()).toBe(false));
  await sendFile(false);
  await new Promise((resolve) => setTimeout(resolve, 10));
  expect(writes).toBe(1);
});

it.each([
  ['pdf', 'docx'],
  ['docx', 'pdf'],
])('preserves an earlier %s export when a later %s conversion completes first', async (earlier, later) => {
  const names: string[] = [];
  setDiskWriter(async (file) => {
    names.push(file.name);
    return 'written';
  });
  startExport();
  startExport();
  await sendFile(false, 1, later);
  await vi.waitFor(() => expect(names).toHaveLength(1));
  await sendFile(false, 0, earlier);
  await vi.waitFor(() => expect(names).toEqual([`Report.${later}`, `Report.${earlier}`]));
});

// The bytes cross the real stream, source database and history database before
// recovery opens them. An assertion on savedToDiskAt alone missed this loss.
it.each(['older snapshot', 'no snapshot'])('reloads the actual disk save with %s', async (prior) => {
  if (prior === 'no snapshot') await deleteDoc('save-document');
  await rememberActiveSource('save-document', new File(['original O'], 'Report.docx'));
  setDiskWriter(async () => 'written');
  await sendFile();
  await vi.waitFor(() => expect(hasUnsavedChanges()).toBe(false));
  await vi.waitFor(async () => {
    opened.mockClear();
    expect(await restoreSavedDocument('save-document')).toBe(true);
    expect(new Uint8Array(await opened.mock.calls[0][0].arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
  });
  // Reopening calls rememberActiveSource again, so repeated reloads retain the
  // saved source's precedence over the older recovery revision as well.
  await rememberActiveSource('save-document', opened.mock.calls[0][0]);
  opened.mockClear();
  expect(await restoreSavedDocument('save-document')).toBe(true);
  expect(new Uint8Array(await opened.mock.calls[0][0].arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
});

it('restores a later unsaved snapshot ahead of the disk save', async () => {
  await rememberActiveSource('save-document', new File(['original O'], 'Report.docx'));
  setDiskWriter(async () => 'written');
  await sendFile();
  await vi.waitFor(async () => expect((await getDoc('save-document'))?.savedToDiskAt).toBeTypeOf('number'));
  await putSnapshot({ id: 'save-document', title: 'Report.docx', origin: 'local', bytes: new Uint8Array([67]) });
  expect(await restoreSavedDocument('save-document')).toBe(true);
  expect(await opened.mock.calls[0][0].text()).toBe('C');
});

it('keeps a prior recovery point when saving the reload source fails', async () => {
  await rememberActiveSource('save-document', new File(['original O'], 'Report.docx'));
  const put = IDBObjectStore.prototype.put;
  vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, value, key) {
    if (this.name === 'sources') throw new DOMException('full', 'QuotaExceededError');
    return put.call(this, value, key);
  });
  setDiskWriter(async () => 'written');
  await sendFile();
  await vi.waitFor(() => expect(hasUnsavedChanges()).toBe(false));
  await new Promise((resolve) => setTimeout(resolve, 30));
  expect((await getDoc('save-document'))?.savedToDiskAt).toBeUndefined();
  expect(await restoreSavedDocument('save-document')).toBe(true);
  expect(new Uint8Array(await opened.mock.calls[0][0].arrayBuffer())).toEqual(new Uint8Array([1]));
});

it('keeps the editable source after saving an export in another format', async () => {
  await rememberActiveSource('save-document', new File(['editable source'], 'Report.docx'));
  setDiskWriter(async () => 'written');
  await sendFile(true, 0, 'pdf');
  await vi.waitFor(() => expect(hasUnsavedChanges()).toBe(false));
  await new Promise((resolve) => setTimeout(resolve, 30));
  expect(await (await readActiveSource('save-document'))?.text()).toBe('editable source');
  expect((await getDoc('save-document'))?.savedToDiskAt).toBeUndefined();
});

it('publishes save completion only after the saved reload bytes are durable', async () => {
  await rememberActiveSource('save-document', new File(['original O'], 'Report.docx'));
  const read = File.prototype.arrayBuffer;
  let finish!: (value: ArrayBuffer) => void;
  const reading = vi.fn();
  vi.spyOn(File.prototype, 'arrayBuffer').mockImplementation(function (this: File) {
    if (this.size !== 3 || reading.mock.calls.length) return read.call(this);
    reading();
    return new Promise((resolve) => {
      finish = resolve;
    });
  });
  setDiskWriter(async () => 'written');
  await sendFile();
  await vi.waitFor(() => expect(reading).toHaveBeenCalled());
  expect(hasUnsavedChanges()).toBe(true);
  expect(history.Reset_SavedIndex).not.toHaveBeenCalled();
  finish(new Uint8Array([1, 2, 3]).buffer);
  await vi.waitFor(() => expect(hasUnsavedChanges()).toBe(false));
  expect(await restoreSavedDocument('save-document')).toBe(true);
  expect(new Uint8Array(await opened.mock.calls[0][0].arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
});

it.each([
  ['doc', 'docx'],
  ['xls', 'xlsx'],
  ['ppt', 'pptx'],
])('retains the editable %s save normalized by the editor as %s', async (originalExt, savedExt) => {
  await deleteDoc('save-document');
  setDocmentObj({ fileName: `Report.${originalExt}` });
  await rememberActiveSource('save-document', new File(['legacy original O'], `Report.${originalExt}`));
  setDiskWriter(async () => 'written');
  await sendFile(true, 0, savedExt);
  await vi.waitFor(() => expect(hasUnsavedChanges()).toBe(false));
  expect(await restoreSavedDocument('save-document')).toBe(true);
  expect(opened.mock.calls[0][0].name).toBe(`Report.${savedExt}`);
  expect(new Uint8Array(await opened.mock.calls[0][0].arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
});

it('preserves newer C recovery when older disk B finishes after further editing', async () => {
  let finish!: (outcome: 'written') => void;
  setDiskWriter(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await sendFile();
  await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
  history.Points.push({ Items: [{}] });
  history.Index++;
  markDocumentDirty();
  await putSnapshot({ id: 'save-document', title: 'Report.docx', origin: 'local', bytes: new Uint8Array([67]) });
  finish('written');
  await new Promise((resolve) => setTimeout(resolve, 30));
  expect(hasUnsavedChanges()).toBe(true);
  expect((await getDoc('save-document'))?.savedToDiskAt).toBeUndefined();
  expect(await restoreSavedDocument('save-document')).toBe(true);
  expect(await opened.mock.calls[0][0].text()).toBe('C');
});

it('restores a newer snapshot after quota eviction recreated its history row', async () => {
  await rememberActiveSource('save-document', new File(['original O'], 'Report.docx'));
  setDiskWriter(async () => 'written');
  await sendFile();
  await vi.waitFor(() => expect(hasUnsavedChanges()).toBe(false));
  vi.stubGlobal('navigator', { storage: { estimate: async () => ({ quota: 6 }) } });
  await putSnapshot({ id: 'other', title: 'Other.docx', origin: 'local', bytes: new Uint8Array([8, 8, 8]) });
  expect(await getDoc('save-document')).toBeNull();
  await putSnapshot({ id: 'save-document', title: 'Report.docx', origin: 'local', bytes: new Uint8Array([67]) });
  expect(await restoreSavedDocument('save-document')).toBe(true);
  expect(await opened.mock.calls[0][0].text()).toBe('C');
});

it('keeps saved B bytes when C is typed while the reload source is still being stored', async () => {
  await rememberActiveSource('save-document', new File(['original O'], 'Report.docx'));
  const originalRead = File.prototype.arrayBuffer;
  let finish!: (value: ArrayBuffer) => void;
  const reading = vi.fn();
  vi.spyOn(File.prototype, 'arrayBuffer').mockImplementation(function (this: File) {
    if (this.size !== 3 || reading.mock.calls.length) return originalRead.call(this);
    reading();
    return new Promise((resolve) => {
      finish = resolve;
    });
  });
  setDiskWriter(async () => 'written');
  await sendFile();
  await vi.waitFor(() => expect(reading).toHaveBeenCalled());
  history.Points.push({ Items: [{}] });
  history.Index++;
  markDocumentDirty();
  finish(new Uint8Array([1, 2, 3]).buffer);
  await vi.waitFor(async () => {
    expect(new Uint8Array(await (await readActiveSource('save-document'))!.arrayBuffer())).toEqual(
      new Uint8Array([1, 2, 3]),
    );
  });
  expect(hasUnsavedChanges()).toBe(true);
  expect(history.Reset_SavedIndex).not.toHaveBeenCalled();
  expect(await restoreSavedDocument('save-document')).toBe(true);
  expect(new Uint8Array(await opened.mock.calls[0][0].arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
});

it('keeps saved source provenance across two reloads from a stale inherited pointer', async () => {
  await rememberActiveSource('save-document', new File(['original O'], 'Report.docx'));
  const inheritedPointer = sessionStorage.getItem('document-active-source')!;
  setDiskWriter(async () => 'written');
  await sendFile();
  await vi.waitFor(() => expect(hasUnsavedChanges()).toBe(false));
  // A dormant duplicate still has the old pointer metadata after the parent
  // updates the shared source slot in place with saved B.
  sessionStorage.setItem('document-active-source', inheritedPointer);
  for (let reload = 0; reload < 2; reload++) {
    opened.mockClear();
    expect(await restoreSavedDocument('save-document')).toBe(true);
    const recovered = opened.mock.calls[0][0];
    expect(new Uint8Array(await recovered.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
    await rememberActiveSource('save-document', recovered);
  }
});
