import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const { requestSaveDocument } = vi.hoisted(() => ({ requestSaveDocument: vi.fn() }));
vi.mock('../../lib/onlyoffice/save-stream', () => ({ requestSaveDocument }));
vi.mock('../../lib/onlyoffice/readonly', () => ({ getReadonlyMode: () => false }));

import {
  beginAutosaveSession,
  clearDocumentSession,
  getActiveDocumentId,
  getAutosaveDocId,
  isAutosaveSessionActive,
  setAutosaveEnabled,
  stopAutosaveSession,
  takeSnapshot,
} from '../../lib/history/autosave';
import { resetHistoryDbForTests } from '../../lib/history/db';
import { getLatestSnapshot, resetHistoryClockForTests } from '../../lib/history/store';
import { markDocumentDirty, resetUnsavedGuardForTests } from '../../lib/unsaved-guard';

interface LockRequest {
  name: string;
  callback: (lock: unknown) => unknown;
  resolve: () => void;
}
let requests: LockRequest[];
let released: string[];

function grant(index: number): void {
  const request = requests[index];
  const held = request.callback({ name: request.name, mode: 'exclusive' });
  void Promise.resolve(held).then(() => {
    released.push(request.name);
    request.resolve();
  });
}

beforeEach(() => {
  clearDocumentSession();
  resetHistoryDbForTests();
  resetHistoryClockForTests();
  resetUnsavedGuardForTests();
  requests = [];
  released = [];
  vi.stubGlobal('indexedDB', new IDBFactory());
  vi.stubGlobal('navigator', {
    locks: {
      request: (name: string, _options: unknown, callback: (lock: unknown) => unknown) =>
        new Promise<void>((resolve) => {
          requests.push({ name, callback, resolve });
        }),
    },
  });
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  setAutosaveEnabled(true);
  window.history.replaceState(null, '', '/editor');
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  requestSaveDocument.mockReset().mockResolvedValue(new File([new Uint8Array([7, 8])], 'Report.docx'));
});
afterEach(() => {
  clearDocumentSession();
  resetHistoryDbForTests();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it.each(['stop', 'clear', 'disable'])(
  'releases a late document lock after %s without reinstalling recovery',
  async (mode) => {
    const pending = beginAutosaveSession({ docId: 'old', title: 'Old.docx', origin: 'local' });
    if (mode === 'stop') stopAutosaveSession();
    if (mode === 'clear') clearDocumentSession();
    if (mode === 'disable') setAutosaveEnabled(false);
    const listener = vi.spyOn(document, 'addEventListener');
    grant(0);
    await pending;

    expect(isAutosaveSessionActive()).toBe(false);
    expect(getActiveDocumentId()).toBe(mode === 'clear' ? null : 'old');
    expect(released).toEqual(['document-history:old']);
    expect(vi.getTimerCount()).toBe(0);
    expect(listener.mock.calls.filter(([type]) => type === 'visibilitychange')).toEqual([]);
    markDocumentDirty();
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(await takeSnapshot()).toBeNull();
    expect(requestSaveDocument).not.toHaveBeenCalled();
    expect(await getLatestSnapshot('old')).toBeNull();
  },
);

it.each([
  [0, 1],
  [1, 0],
])('keeps replacement B when pending locks resolve in order %i then %i', async (first, second) => {
  const old = beginAutosaveSession({ docId: 'A', title: 'A.docx', origin: 'local' });
  const current = beginAutosaveSession({ docId: 'B', title: 'B.docx', origin: 'local' });
  grant(first);
  await (first === 0 ? old : current);
  expect(getActiveDocumentId()).toBe('B');
  if (first === 0) expect(isAutosaveSessionActive()).toBe(false);
  grant(second);
  await Promise.all([old, current]);

  expect(getActiveDocumentId()).toBe('B');
  expect(getAutosaveDocId()).toBe('B');
  expect(released).toEqual(['document-history:A']);
  expect(vi.getTimerCount()).toBe(1);
  await takeSnapshot();
  expect(await getLatestSnapshot('A')).toBeNull();
  expect(Array.from((await getLatestSnapshot('B'))!.bytes)).toEqual([7, 8]);
  clearDocumentSession();
  await Promise.resolve();
  expect(released).toEqual(['document-history:A', 'document-history:B']);
  expect(vi.getTimerCount()).toBe(0);
});
