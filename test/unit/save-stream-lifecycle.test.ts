import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('../../lib/history/autosave', () => ({
  getAutosaveDocId: () => 'save-document',
  beginAutosaveSession: vi.fn(),
  isAutosaveEnabled: () => true,
  setAutosaveEnabled: vi.fn(),
  stopAutosaveSession: vi.fn(),
}));
import { initDocumentHistory } from '../../lib/history/index';
import { getDoc, putSnapshot } from '../../lib/history/store';
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
  expect(hasUnsavedChanges()).toBe(false);
  expect(history.Reset_SavedIndex).toHaveBeenCalledOnce();
});

it('a busy SDK ignoring another request preserves the accepted export save point', async () => {
  setDiskWriter(async () => 'written');
  startExport();
  (frame.contentWindow as any).Asc.editor.isLongAction = () => true;
  startExport();
  sendFile(false);
  await new Promise((resolve) => setTimeout(resolve, 10));
  expect(hasUnsavedChanges()).toBe(false);
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
