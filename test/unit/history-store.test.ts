import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DB_NAME, resetHistoryDbForTests } from '../../lib/history/db';
import {
  DEFAULT_PAGE_SIZE,
  MAX_REVS_PER_DOC,
  clearAllHistory,
  deleteDoc,
  dismissRecovery,
  getDoc,
  getLatestSnapshot,
  getRecoverableDoc,
  historyUsage,
  pruneExpired,
  listDocs,
  markOpened,
  markSavedToDisk,
  putSnapshot,
  resetHistoryClockForTests,
  storageBudget,
} from '../../lib/history/store';
import { MAX_AGE_MS, daysUntilExpiry, hasUnsavedWork } from '../../lib/history/types';

function bytes(size: number, fill = 65): Uint8Array {
  return new Uint8Array(size).fill(fill);
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

// jsdom ships no StorageManager; the budget path reads one when it exists.
function mockQuota(quota: number): void {
  Object.defineProperty(navigator, 'storage', {
    value: { estimate: () => Promise.resolve({ quota, usage: 0 }) },
    configurable: true,
  });
}

describe('history store', () => {
  beforeEach(wipe);
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('stores a snapshot and reads its metadata back', async () => {
    const doc = await putSnapshot({ title: 'Report.docx', origin: 'local', bytes: bytes(128) });

    expect(doc).not.toBeNull();
    expect(doc?.title).toBe('Report.docx');
    expect(doc?.ext).toBe('docx');
    expect(doc?.size).toBe(128);
    expect(doc?.totalBytes).toBe(128);
    expect(doc?.revCount).toBe(1);

    const { items, total } = await listDocs();
    expect(total).toBe(1);
    expect(items[0].id).toBe(doc?.id);
  });

  it('appends revisions to the same document and hands back the newest bytes', async () => {
    const first = await putSnapshot({ title: 'Report.docx', origin: 'local', bytes: bytes(10, 1) });
    const second = await putSnapshot({ id: first!.id, title: 'Report.docx', origin: 'local', bytes: bytes(20, 2) });

    expect(second?.id).toBe(first!.id);
    expect(second?.revCount).toBe(2);
    expect(second?.totalBytes).toBe(30);

    const latest = await getLatestSnapshot(first!.id);
    expect(latest?.byteLength).toBe(20);
    expect(latest!.bytes[0]).toBe(2);

    // One document, not two.
    expect((await listDocs()).total).toBe(1);
  });

  it('keeps only the newest revisions and accounts for the bytes it dropped', async () => {
    let id: string | undefined;
    for (let i = 0; i < MAX_REVS_PER_DOC + 2; i += 1) {
      const doc = await putSnapshot({ id, title: 'Long.docx', origin: 'local', bytes: bytes(100) });
      id = doc!.id;
    }

    const doc = await getDoc(id!);
    expect(doc?.revCount).toBe(MAX_REVS_PER_DOC);
    expect(doc?.totalBytes).toBe(MAX_REVS_PER_DOC * 100);
    expect(await historyUsage()).toBe(MAX_REVS_PER_DOC * 100);

    // The surviving revisions are the newest ones.
    const latest = await getLatestSnapshot(id!);
    expect(latest?.rev).toBe(MAX_REVS_PER_DOC + 1);
  });

  it('pages the list newest first and clamps a page past the end', async () => {
    for (let i = 0; i < DEFAULT_PAGE_SIZE + 5; i += 1) {
      await putSnapshot({ title: `Doc-${i}.docx`, origin: 'local', bytes: bytes(8) });
    }

    const first = await listDocs();
    expect(first.items).toHaveLength(DEFAULT_PAGE_SIZE);
    expect(first.total).toBe(DEFAULT_PAGE_SIZE + 5);
    expect(first.items[0].title).toBe(`Doc-${DEFAULT_PAGE_SIZE + 4}.docx`);

    const second = await listDocs({ page: 2 });
    expect(second.items).toHaveLength(5);

    const past = await listDocs({ page: 99 });
    expect(past.page).toBe(2);
    expect(past.items).toHaveLength(5);
  });

  it('searches titles case-insensitively and by substring, including Chinese', async () => {
    await putSnapshot({ title: 'Quarterly Report.docx', origin: 'local', bytes: bytes(8) });
    await putSnapshot({ title: '年度总结报告.docx', origin: 'local', bytes: bytes(8) });
    await putSnapshot({ title: 'budget.xlsx', origin: 'local', bytes: bytes(8) });

    expect((await listDocs({ query: 'report' })).total).toBe(1);
    expect((await listDocs({ query: 'REPORT' })).total).toBe(1);
    // Substring, not prefix -- the thing an IndexedDB key range cannot do.
    expect((await listDocs({ query: '总结' })).total).toBe(1);
    expect((await listDocs({ query: 'nothing' })).total).toBe(0);
  });

  it('deletes a document together with its bytes', async () => {
    const doc = await putSnapshot({ title: 'Gone.docx', origin: 'local', bytes: bytes(64) });

    expect(await deleteDoc(doc!.id)).toBe(true);
    expect(await getDoc(doc!.id)).toBeNull();
    expect(await getLatestSnapshot(doc!.id)).toBeNull();
    expect(await historyUsage()).toBe(0);
  });

  it('clears the library, bytes included', async () => {
    const a = await putSnapshot({ title: 'A.docx', origin: 'local', bytes: bytes(64) });
    await putSnapshot({ title: 'B.docx', origin: 'local', bytes: bytes(64) });

    expect(await clearAllHistory()).toBe(true);
    expect((await listDocs()).total).toBe(0);
    // The promise a "clear everything" button makes is about the content, not
    // the index: the bytes have to be gone too.
    expect(await getLatestSnapshot(a!.id)).toBeNull();
  });

  it('evicts the least-recently-opened document when the budget is exceeded', async () => {
    mockQuota(600);
    expect(await storageBudget()).toBe(300);

    const cold = await putSnapshot({ title: 'Cold.docx', origin: 'local', bytes: bytes(100) });
    const warm = await putSnapshot({ title: 'Warm.docx', origin: 'local', bytes: bytes(100) });
    await markOpened(warm!.id);
    // Pushes the library past the 300-byte budget.
    const fresh = await putSnapshot({ title: 'Fresh.docx', origin: 'local', bytes: bytes(150) });

    const titles = (await listDocs()).items.map((doc) => doc.title);
    expect(titles).toContain('Fresh.docx');
    expect(titles).not.toContain('Cold.docx');
    expect(await getLatestSnapshot(cold!.id)).toBeNull();
    expect(await getDoc(fresh!.id)).not.toBeNull();
  });

  it('makes room and retries once when the browser refuses a write', async () => {
    await putSnapshot({ title: 'Old.docx', origin: 'local', bytes: bytes(16) });

    const put = IDBObjectStore.prototype.put;
    let thrown = false;
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, ...args) {
      if (!thrown && this.name === 'blobs') {
        thrown = true;
        throw Object.assign(new Error('quota'), { name: 'QuotaExceededError' });
      }
      return put.apply(this, args as Parameters<typeof put>);
    });

    const doc = await putSnapshot({ title: 'New.docx', origin: 'local', bytes: bytes(16) });

    expect(thrown).toBe(true);
    expect(doc).not.toBeNull();
    // The retry paid for itself by dropping the coldest document.
    expect((await listDocs()).items.map((row) => row.title)).toEqual(['New.docx']);
  });

  it('deletes documents that went seven days without being touched', async () => {
    const stale = await putSnapshot({ title: 'Stale.docx', origin: 'local', bytes: bytes(16) });
    const fresh = await putSnapshot({ title: 'Fresh.docx', origin: 'local', bytes: bytes(16) });

    // Only Date is faked: faking timers as well would stall fake-indexeddb,
    // which drives its transactions through the macrotask queue.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + MAX_AGE_MS + 1000);
    // Coming back to the fresh one restarts its clock; nobody touched the other.
    await markOpened(fresh!.id);

    expect(await pruneExpired()).toEqual([stale!.id]);
    expect(await getDoc(stale!.id)).toBeNull();
    expect(await getLatestSnapshot(stale!.id)).toBeNull();
    expect(await getDoc(fresh!.id)).not.toBeNull();
    vi.useRealTimers();
  });

  it('sweeps expired documents on the next write, without waiting for a visit', async () => {
    const stale = await putSnapshot({ title: 'Stale.docx', origin: 'local', bytes: bytes(16) });

    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + MAX_AGE_MS + 1000);
    await putSnapshot({ title: 'Later.docx', origin: 'local', bytes: bytes(16) });

    expect(await getDoc(stale!.id)).toBeNull();
    expect((await listDocs()).items.map((doc) => doc.title)).toEqual(['Later.docx']);
    vi.useRealTimers();
  });

  it('counts the days a document has left', async () => {
    const doc = await putSnapshot({ title: 'Counting.docx', origin: 'local', bytes: bytes(8) });

    expect(daysUntilExpiry(doc!, doc!.updatedAt)).toBe(7);
    expect(daysUntilExpiry(doc!, doc!.updatedAt + 6.5 * 24 * 60 * 60 * 1000)).toBe(1);
    expect(daysUntilExpiry(doc!, doc!.updatedAt + MAX_AGE_MS + 1)).toBe(0);
  });

  it('offers only documents whose work never reached the disk', async () => {
    const doc = await putSnapshot({ title: 'Unsaved.docx', origin: 'local', bytes: bytes(8) });
    expect(hasUnsavedWork(doc!)).toBe(true);
    expect((await getRecoverableDoc())?.id).toBe(doc!.id);

    await markSavedToDisk(doc!.id);
    expect(await getRecoverableDoc()).toBeNull();
  });

  it('stops offering a document the user dismissed, until it changes again', async () => {
    const doc = await putSnapshot({ title: 'Dismissed.docx', origin: 'local', bytes: bytes(8) });

    await dismissRecovery(doc!.id);
    expect(await getRecoverableDoc()).toBeNull();

    // A new snapshot is new work: worth offering again.
    await putSnapshot({ id: doc!.id, title: 'Dismissed.docx', origin: 'local', bytes: bytes(9) });
    expect((await getRecoverableDoc())?.id).toBe(doc!.id);
  });

  it('never offers the document already open in this editor', async () => {
    const doc = await putSnapshot({ title: 'Current.docx', origin: 'local', bytes: bytes(8) });

    expect(await getRecoverableDoc({ excludeId: doc!.id })).toBeNull();
  });
});
