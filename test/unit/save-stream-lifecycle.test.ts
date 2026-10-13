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
let frame: HTMLIFrameElement;
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
function sendFile() {
  window.dispatchEvent(
    new MessageEvent('message', {
      source: frame.contentWindow,
      origin: location.origin,
      data: {
        type: 'onlyoffice-file-stream',
        fileName: 'Report.docx',
        fileType: 'docx',
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
});
