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
  EXPORT_DUTY_CYCLE,
  IDLE_GRACE_MS,
  MAX_SNAPSHOT_INTERVAL_MS,
  MIN_SNAPSHOT_INTERVAL_MS,
  SNAPSHOT_INTERVAL_MS,
  snapshotInterval,
  beginAutosaveSession,
  getAutosaveDocId,
  isAutosaveSessionActive,
  setAutosaveEnabled,
  shouldSnapshot,
  stopAutosaveSession,
  takeSnapshot,
} from '../../lib/history/autosave';
import { DB_NAME, resetHistoryDbForTests } from '../../lib/history/db';
import { getLatestSnapshot, listDocs, resetHistoryClockForTests } from '../../lib/history/store';
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
  lastExportMs: null,
};

function fileOf(values: number[], name = 'Report.docx'): File {
  return new File([new Uint8Array(values).buffer], name);
}

async function wipe(): Promise<void> {
  resetHistoryDbForTests();
  resetHistoryClockForTests();
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
}

describe('snapshot interval', () => {
  it('spends a fixed fraction of the session exporting', () => {
    // 200 ms of work every 60 s is 1/300 of the time.
    expect(snapshotInterval(200)).toBe(200 * EXPORT_DUTY_CYCLE);
  });

  it('does not chase a fast machine below the floor', () => {
    // Measured desktop cost: 42 ms for a small docx would earn a 13 s interval,
    // which buys little and interrupts often, so the floor takes over. The
    // heaviest measured shape (123 ms, a 20k-row workbook) lands above it on
    // its own -- the duty cycle, not the floor, is doing the work there.
    expect(snapshotInterval(42)).toBe(MIN_SNAPSHOT_INTERVAL_MS);
    expect(snapshotInterval(123)).toBe(123 * EXPORT_DUTY_CYCLE);
    expect(snapshotInterval(123)).toBeGreaterThan(MIN_SNAPSHOT_INTERVAL_MS);
  });

  it('backs off on a slow device instead of fighting it', () => {
    // A phone taking 600 ms per export gets 180 s, not 30 s. The device tells
    // us it is slow by being slow; nothing has to detect it.
    expect(snapshotInterval(600)).toBe(MAX_SNAPSHOT_INTERVAL_MS);
    expect(snapshotInterval(5_000)).toBe(MAX_SNAPSHOT_INTERVAL_MS);
  });

  it('has an answer before the first export is timed', () => {
    expect(snapshotInterval(null)).toBe(SNAPSHOT_INTERVAL_MS);
    expect(snapshotInterval(0)).toBe(SNAPSHOT_INTERVAL_MS);
  });
});

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
    // And "too soon" moves with the machine: an export that cost 600 ms buys
    // the ceiling, so an interval that was long enough a moment ago is not.
    expect(
      shouldSnapshot({ ...ready, lastExportMs: 600, lastSnapshotAt: ready.now - MIN_SNAPSHOT_INTERVAL_MS - 1 }),
    ).toBe(false);
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
    await beginAutosaveSession({ docId: 'report', title: 'Report.docx', origin: 'local' });

    const doc = await takeSnapshot();

    expect(requestSaveDocument).toHaveBeenCalledWith('DOCX');
    expect(doc?.title).toBe('Report.docx');
    expect(Array.from((await getLatestSnapshot(doc!.id))!.bytes)).toEqual([1, 2, 3]);
    expect(getAutosaveDocId()).toBe(doc!.id);
  });

  it('keeps appending to the same row across snapshots', async () => {
    requestSaveDocument.mockResolvedValue(fileOf([1]));
    await beginAutosaveSession({ docId: 'report', title: 'Report.docx', origin: 'local' });

    const first = await takeSnapshot();
    const second = await takeSnapshot();

    expect(second?.id).toBe(first?.id);
    expect(second?.revCount).toBe(2);
    expect((await listDocs()).total).toBe(1);
  });

  it('does not start in embed mode', async () => {
    window.history.replaceState(null, '', '/editor?embed=1');

    await beginAutosaveSession({ docId: 'report', title: 'Report.docx', origin: 'local' });

    expect(isAutosaveSessionActive()).toBe(false);
  });

  it('does not start when the user turned autosave off', async () => {
    setAutosaveEnabled(false);

    await beginAutosaveSession({ docId: 'report', title: 'Report.docx', origin: 'local' });

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

    await beginAutosaveSession({ docId: 'shared', title: 'Shared.docx', origin: 'local' });
    markDocumentDirty();
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));

    // The other tab is the one writing this document's history; two tabs
    // taking turns would interleave two divergent documents into one row.
    expect(requestSaveDocument).not.toHaveBeenCalled();
  });

  it('takes a snapshot when the page is hidden, without waiting for the interval', async () => {
    requestSaveDocument.mockResolvedValue(fileOf([9]));
    await beginAutosaveSession({ docId: 'hidden', title: 'Hidden.docx', origin: 'local' });
    markDocumentDirty();

    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    // The handler starts the export without awaiting; let it settle.
    await vi.waitFor(async () => expect((await listDocs()).total).toBe(1));
  });

  it('does not snapshot a read-only document', async () => {
    getReadonlyMode.mockReturnValue(true);
    requestSaveDocument.mockResolvedValue(fileOf([1]));
    await beginAutosaveSession({ docId: 'locked', title: 'Locked.docx', origin: 'local' });
    markDocumentDirty();

    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));

    expect(requestSaveDocument).not.toHaveBeenCalled();
  });

  it('gives up after repeated export failures instead of retrying forever', async () => {
    requestSaveDocument.mockRejectedValue(new Error('export failed'));
    await beginAutosaveSession({ docId: 'broken', title: 'Broken.docx', origin: 'local' });

    await takeSnapshot();
    await takeSnapshot();
    expect(isAutosaveSessionActive()).toBe(true);
    await takeSnapshot();

    expect(isAutosaveSessionActive()).toBe(false);
  });

  it('waits its turn while a user-initiated save owns the channel', async () => {
    requestSaveDocument.mockRejectedValue(new Error('A save request is already in progress'));
    await beginAutosaveSession({ docId: 'busy', title: 'Busy.docx', origin: 'local' });

    await takeSnapshot();
    await takeSnapshot();
    await takeSnapshot();
    await takeSnapshot();

    // Losing the race to the user is not a failure, so the session survives.
    expect(isAutosaveSessionActive()).toBe(true);
  });

  it('keeps writing to the row its id names, across sessions', async () => {
    requestSaveDocument.mockResolvedValue(fileOf([1]));
    await beginAutosaveSession({ docId: 'daily', title: 'Daily.docx', origin: 'local' });
    const first = await takeSnapshot();

    stopAutosaveSession();
    await beginAutosaveSession({ docId: 'daily', title: 'Daily.docx', origin: 'local' });
    const second = await takeSnapshot();

    expect(second?.id).toBe(first?.id);
    expect((await listDocs()).total).toBe(1);
  });

  it('keeps documents with the same name apart', async () => {
    // Every blank document is called New_Document.docx, and plenty of people
    // have two unrelated Report.docx files. Identity is the id, never the name.
    requestSaveDocument.mockResolvedValue(fileOf([1], 'New_Document.docx'));
    await beginAutosaveSession({ docId: 'first-blank', title: 'New_Document.docx', origin: 'new' });
    const first = await takeSnapshot();

    stopAutosaveSession();
    await beginAutosaveSession({ docId: 'second-blank', title: 'New_Document.docx', origin: 'new' });
    const second = await takeSnapshot();

    expect(second?.id).not.toBe(first?.id);
    expect((await listDocs()).total).toBe(2);
  });
  it('defers a cached departure export and stores a recovery point after a stable return', async () => {
    requestSaveDocument.mockResolvedValue(fileOf([7, 8]));
    await beginAutosaveSession({ docId: 'cached', title: 'Cached.docx', origin: 'local' });
    markDocumentDirty();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(requestSaveDocument).not.toHaveBeenCalled();
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    await vi.advanceTimersByTimeAsync(1999);
    expect(requestSaveDocument).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await vi.waitFor(async () => expect(Array.from((await getLatestSnapshot('cached'))!.bytes)).toEqual([7, 8]));
  });
  it('cancels the resumed export on rapid cached departure and preserves recovery on the final return', async () => {
    requestSaveDocument.mockResolvedValue(fileOf([9]));
    await beginAutosaveSession({ docId: 'repeated', title: 'Repeated.docx', origin: 'local' });
    markDocumentDirty();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    for (let cycle = 0; cycle < 2; cycle++) {
      window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
      expect(requestSaveDocument).not.toHaveBeenCalled();
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
      await vi.advanceTimersByTimeAsync(1000);
    }
    expect(requestSaveDocument).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1000);
    await vi.waitFor(async () => expect(Array.from((await getLatestSnapshot('repeated'))!.bytes)).toEqual([9]));
  });
  it('keeps noncached hidden departure recovery enabled', async () => {
    requestSaveDocument.mockResolvedValue(fileOf([3]));
    await beginAutosaveSession({ docId: 'noncached', title: 'Noncached.docx', origin: 'local' });
    markDocumentDirty();
    window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false }));
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.waitFor(async () => expect(Array.from((await getLatestSnapshot('noncached'))!.bytes)).toEqual([3]));
  });
  it('waits for recent typing to settle before resumed recovery', async () => {
    requestSaveDocument.mockResolvedValue(fileOf([4]));
    await beginAutosaveSession({ docId: 'typing', title: 'Typing.docx', origin: 'local' });
    markDocumentDirty();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    await vi.advanceTimersByTimeAsync(1500);
    markDocumentDirty();
    await vi.advanceTimersByTimeAsync(1999);
    expect(requestSaveDocument).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await vi.waitFor(async () => expect(Array.from((await getLatestSnapshot('typing'))!.bytes)).toEqual([4]));
  });
  it('does not let a stopped session resume exports into its replacement', async () => {
    requestSaveDocument.mockResolvedValue(fileOf([5]));
    await beginAutosaveSession({ docId: 'old', title: 'Old.docx', origin: 'local' });
    markDocumentDirty();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    stopAutosaveSession();
    await beginAutosaveSession({ docId: 'new', title: 'New.docx', origin: 'local' });
    await vi.advanceTimersByTimeAsync(2000);
    expect(requestSaveDocument).not.toHaveBeenCalled();
    expect(await getLatestSnapshot('old')).toBeNull();
    expect(await getLatestSnapshot('new')).toBeNull();
  });
  it('does not let an overdue periodic tick bypass the restored-page grace period', async () => {
    requestSaveDocument.mockResolvedValue(fileOf([6]));
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
    await beginAutosaveSession({ docId: 'overdue', title: 'Overdue.docx', origin: 'local' });
    markDocumentDirty();
    window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
    await vi.advanceTimersByTimeAsync(59000);
    expect(requestSaveDocument).not.toHaveBeenCalled();
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    await vi.advanceTimersByTimeAsync(1999);
    expect(requestSaveDocument).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await vi.waitFor(async () => expect(Array.from((await getLatestSnapshot('overdue'))!.bytes)).toEqual([6]));
  });
  it('does not store a late export from a stopped session or interfere with its replacement', async () => {
    let finish!: (file: File) => void;
    requestSaveDocument.mockImplementationOnce(
      () =>
        new Promise<File>((resolve) => {
          finish = resolve;
        }),
    );
    await beginAutosaveSession({ docId: 'old-export', title: 'Old.docx', origin: 'local' });
    const pending = takeSnapshot();
    stopAutosaveSession();
    await beginAutosaveSession({ docId: 'replacement', title: 'New.docx', origin: 'local' });
    finish(fileOf([1]));
    expect(await pending).toBeNull();
    expect(await getLatestSnapshot('old-export')).toBeNull();
    expect(getAutosaveDocId()).toBe('replacement');
    requestSaveDocument.mockResolvedValue(fileOf([2]));
    await takeSnapshot();
    expect(Array.from((await getLatestSnapshot('replacement'))!.bytes)).toEqual([2]);
  });
  it('does not let an obsolete export failure stop the new document recovery session', async () => {
    requestSaveDocument.mockRejectedValue(new Error('export failed'));
    await beginAutosaveSession({ docId: 'failing-old', title: 'Old.docx', origin: 'local' });
    await takeSnapshot();
    await takeSnapshot();
    let fail!: (error: Error) => void;
    requestSaveDocument.mockImplementationOnce(
      () =>
        new Promise<File>((_resolve, reject) => {
          fail = reject;
        }),
    );
    const pending = takeSnapshot();
    stopAutosaveSession();
    await beginAutosaveSession({ docId: 'healthy-new', title: 'New.docx', origin: 'local' });
    fail(new Error('late old export failed'));
    await pending;
    expect(isAutosaveSessionActive()).toBe(true);
    expect(getAutosaveDocId()).toBe('healthy-new');
    requestSaveDocument.mockResolvedValue(fileOf([3]));
    await takeSnapshot();
    expect(Array.from((await getLatestSnapshot('healthy-new'))!.bytes)).toEqual([3]);
  });
  it('cancels old recovery storage while its quota estimate waits during document replacement', async () => {
    let started!: () => void;
    const estimating = new Promise<void>((resolve) => {
      started = resolve;
    });
    let finish!: (value: { quota: number }) => void;
    const estimate = new Promise<{ quota: number }>((resolve) => {
      finish = resolve;
    });
    vi.stubGlobal('navigator', {
      ...navigator,
      storage: {
        estimate: () => {
          started();
          return estimate;
        },
      },
    });
    requestSaveDocument.mockResolvedValue(fileOf([4]));
    await beginAutosaveSession({ docId: 'old-storage', title: 'Old.docx', origin: 'local' });
    const pending = takeSnapshot();
    await estimating;
    stopAutosaveSession();
    await beginAutosaveSession({ docId: 'new-storage', title: 'New.docx', origin: 'local' });
    finish({ quota: 1000 });
    expect(await pending).toBeNull();
    expect(await getLatestSnapshot('old-storage')).toBeNull();
    expect(getAutosaveDocId()).toBe('new-storage');
    await takeSnapshot();
    expect(Array.from((await getLatestSnapshot('new-storage'))!.bytes)).toEqual([4]);
  });
});
