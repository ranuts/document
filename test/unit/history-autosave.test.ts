import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// vi.mock is hoisted above the imports, so the doubles have to be too.
const { requestSaveDocument, getReadonlyMode } = vi.hoisted(() => ({
  requestSaveDocument: vi.fn(),
  getReadonlyMode: vi.fn(() => false),
}));

vi.mock('../../lib/onlyoffice/save-stream', () => ({ requestSaveDocument }));
vi.mock('../../lib/onlyoffice/readonly', () => ({ getReadonlyMode }));

import {
  IDLE_GRACE_MS,
  SNAPSHOT_INTERVAL_MS,
  beginAutosaveSession,
  getAutosaveDocId,
  isAutosaveSessionActive,
  setAutosaveEnabled,
  shouldSnapshot,
  stopAutosaveSession,
  takeSnapshot,
} from '../../lib/history/autosave';
import { DB_NAME, resetHistoryDbForTests } from '../../lib/history/db';
import { getLatestSnapshot, listDocs } from '../../lib/history/store';
import { markDocumentDirty, resetUnsavedGuardForTests } from '../../lib/unsaved-guard';

const ready: import('../../lib/history/autosave').SnapshotDecision = {
  now: 1_000_000,
  enabled: true,
  dirty: true,
  readonly: false,
  holdsLock: true,
  lastSnapshotAt: 1_000_000 - SNAPSHOT_INTERVAL_MS,
  lastEditAt: 1_000_000 - IDLE_GRACE_MS,
  exporting: false,
};

function fileOf(values: number[], name = 'Report.docx'): File {
  return new File([new Uint8Array(values).buffer], name);
}

async function wipe(): Promise<void> {
  resetHistoryDbForTests();
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
}

describe('autosave scheduling rule', () => {
  it('fires when there is work, a lull, and time since the last snapshot', () => {
    expect(shouldSnapshot(ready)).toBe(true);
  });

  it('holds off for every reason on its own', () => {
    expect(shouldSnapshot({ ...ready, enabled: false })).toBe(false);
    expect(shouldSnapshot({ ...ready, dirty: false })).toBe(false);
    expect(shouldSnapshot({ ...ready, readonly: true })).toBe(false);
    expect(shouldSnapshot({ ...ready, holdsLock: false })).toBe(false);
    expect(shouldSnapshot({ ...ready, exporting: true })).toBe(false);
    // Too soon after the previous snapshot.
    expect(shouldSnapshot({ ...ready, lastSnapshotAt: ready.now - 1 })).toBe(false);
    // Still typing: an export on top of active editing is felt.
    expect(shouldSnapshot({ ...ready, lastEditAt: ready.now })).toBe(false);
  });
});

describe('autosave session', () => {
  beforeEach(async () => {
    await wipe();
    resetUnsavedGuardForTests();
    requestSaveDocument.mockReset();
    getReadonlyMode.mockReturnValue(false);
    setAutosaveEnabled(true);
    window.history.replaceState(null, '', '/editor');
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  });

  afterEach(() => {
    stopAutosaveSession();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('exports the document in its own format and stores the bytes', async () => {
    requestSaveDocument.mockResolvedValue(fileOf([1, 2, 3]));
    await beginAutosaveSession({ title: 'Report.docx', origin: 'local' });

    const doc = await takeSnapshot();

    expect(requestSaveDocument).toHaveBeenCalledWith('DOCX');
    expect(doc?.title).toBe('Report.docx');
    expect(Array.from((await getLatestSnapshot(doc!.id))!.bytes)).toEqual([1, 2, 3]);
    expect(getAutosaveDocId()).toBe(doc!.id);
  });

  it('keeps appending to the same row across snapshots', async () => {
    requestSaveDocument.mockResolvedValue(fileOf([1]));
    await beginAutosaveSession({ title: 'Report.docx', origin: 'local' });

    const first = await takeSnapshot();
    const second = await takeSnapshot();

    expect(second?.id).toBe(first?.id);
    expect(second?.revCount).toBe(2);
    expect((await listDocs()).total).toBe(1);
  });

  it('does not start in embed mode', async () => {
    window.history.replaceState(null, '', '/editor?embed=1');

    await beginAutosaveSession({ title: 'Report.docx', origin: 'local' });

    expect(isAutosaveSessionActive()).toBe(false);
  });

  it('does not start when the user turned autosave off', async () => {
    setAutosaveEnabled(false);

    await beginAutosaveSession({ title: 'Report.docx', origin: 'local' });

    expect(isAutosaveSessionActive()).toBe(false);
    setAutosaveEnabled(true);
  });

  it('stays quiet when another tab holds the document lock', async () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      // The Web Locks contract for ifAvailable: the callback runs with null
      // when someone else already holds the lock.
      locks: { request: (_name: string, _opts: unknown, cb: (lock: null) => unknown) => Promise.resolve(cb(null)) },
    });
    requestSaveDocument.mockResolvedValue(fileOf([1]));

    await beginAutosaveSession({ title: 'Shared.docx', origin: 'local' });
    markDocumentDirty();
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));

    // The other tab is the one writing this document's history; two tabs
    // taking turns would interleave two divergent documents into one row.
    expect(requestSaveDocument).not.toHaveBeenCalled();
  });

  it('takes a snapshot when the page is hidden, without waiting for the interval', async () => {
    requestSaveDocument.mockResolvedValue(fileOf([9]));
    await beginAutosaveSession({ title: 'Hidden.docx', origin: 'local' });
    markDocumentDirty();

    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    // The handler starts the export without awaiting; let it settle.
    await vi.waitFor(async () => expect((await listDocs()).total).toBe(1));
  });

  it('does not snapshot a read-only document', async () => {
    getReadonlyMode.mockReturnValue(true);
    requestSaveDocument.mockResolvedValue(fileOf([1]));
    await beginAutosaveSession({ title: 'Locked.docx', origin: 'local' });
    markDocumentDirty();

    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));

    expect(requestSaveDocument).not.toHaveBeenCalled();
  });

  it('gives up after repeated export failures instead of retrying forever', async () => {
    requestSaveDocument.mockRejectedValue(new Error('export failed'));
    await beginAutosaveSession({ title: 'Broken.docx', origin: 'local' });

    await takeSnapshot();
    await takeSnapshot();
    expect(isAutosaveSessionActive()).toBe(true);
    await takeSnapshot();

    expect(isAutosaveSessionActive()).toBe(false);
  });

  it('waits its turn while a user-initiated save owns the channel', async () => {
    requestSaveDocument.mockRejectedValue(new Error('A save request is already in progress'));
    await beginAutosaveSession({ title: 'Busy.docx', origin: 'local' });

    await takeSnapshot();
    await takeSnapshot();
    await takeSnapshot();
    await takeSnapshot();

    // Losing the race to the user is not a failure, so the session survives.
    expect(isAutosaveSessionActive()).toBe(true);
  });

  it('reuses the history row of a file that was open before', async () => {
    requestSaveDocument.mockResolvedValue(fileOf([1]));
    await beginAutosaveSession({ title: 'Daily.docx', origin: 'local' });
    const first = await takeSnapshot();

    stopAutosaveSession();
    await beginAutosaveSession({ title: 'Daily.docx', origin: 'local' });
    const second = await takeSnapshot();

    expect(second?.id).toBe(first?.id);
    expect((await listDocs()).total).toBe(1);
  });

  it('gives every blank document its own row', async () => {
    requestSaveDocument.mockResolvedValue(fileOf([1], 'New_Document.docx'));
    await beginAutosaveSession({ title: 'New_Document.docx', origin: 'new' });
    const first = await takeSnapshot();

    stopAutosaveSession();
    await beginAutosaveSession({ title: 'New_Document.docx', origin: 'new' });
    const second = await takeSnapshot();

    // They are different documents that happen to share the default name.
    expect(second?.id).not.toBe(first?.id);
    expect((await listDocs()).total).toBe(2);
  });
});
