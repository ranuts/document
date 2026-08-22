/**
 * Reading and writing the local document history.
 *
 * Two things make this more than a CRUD wrapper:
 *
 * Retention. Snapshots are taken automatically, so without a ceiling the
 * database grows until the browser refuses a write -- and a write refused at
 * the wrong moment is exactly the edit the user wanted back. Each document
 * keeps a handful of revisions and the library as a whole keeps to a budget,
 * evicting whole documents by least-recently-opened.
 *
 * Quota. `QuotaExceededError` is treated as "make room and try once more",
 * never as a crash: browsers hand out very different amounts of room (a share
 * of free disk on Chromium, far less on WebKit) and eviction can happen behind
 * our back, so the write path has to cope rather than assume.
 *
 * Everything here resolves to a null/empty result when IndexedDB is missing;
 * see lib/history/db.ts for why.
 */
import { BLOBS_BY_DOC, BLOBS_STORE, DOCS_STORE, requestToPromise, withStores } from './db';
import type { HistoryDoc, HistoryOrigin, HistorySnapshot } from './types';
import { MAX_AGE_MS, expiresAt } from './types';

/** Revisions kept per document: the newest plus two recovery points behind it. */
export const MAX_REVS_PER_DOC = 3;
/** Hard ceiling for the whole library, whatever the browser would allow. */
export const MAX_TOTAL_BYTES = 500 * 1024 * 1024;
/** Never claim more than this share of the origin's reported quota. */
export const QUOTA_SHARE = 0.5;
/** Re-exported so callers can state the retention window without importing types. */
export { MAX_AGE_MS };
/** Default page size for the history list. */
export const DEFAULT_PAGE_SIZE = 20;

export interface SnapshotInput {
  /** Existing document to append a revision to; omitted for a new one. */
  id?: string;
  title: string;
  origin: HistoryOrigin;
  bytes: Blob | ArrayBuffer | Uint8Array;
}

export interface DocListResult {
  items: HistoryDoc[];
  /** Rows matching the query, before paging. */
  total: number;
  page: number;
  pageSize: number;
}

/**
 * A strictly increasing timestamp.
 *
 * `updatedAt` is the list's sort key, and two snapshots taken inside the same
 * millisecond -- which happens whenever anything writes in a loop -- would
 * otherwise order arbitrarily and shuffle rows between pages. Nudging the
 * clock forward keeps the order the user watched being created.
 */
let lastStamp = 0;
function stamp(): number {
  const now = Date.now();
  lastStamp = now > lastStamp ? now : lastStamp + 1;
  return lastStamp;
}

function newId(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return uuid;
  return `doc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

async function toBytes(bytes: Blob | ArrayBuffer | Uint8Array): Promise<Uint8Array> {
  if (bytes instanceof Uint8Array) return bytes;
  if (bytes instanceof ArrayBuffer) return new Uint8Array(bytes);
  return new Uint8Array(await bytes.arrayBuffer());
}

export function extensionOf(title: string): string {
  const match = /\.([a-z0-9]+)$/i.exec(title.trim());
  return match ? match[1].toLowerCase() : '';
}

function isQuotaError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const name = (error as { name?: string }).name;
  return name === 'QuotaExceededError' || name === 'NS_ERROR_FILE_NO_DEVICE_SPACE';
}

/** All metadata rows, newest snapshot first. */
async function readAllDocs(tx: IDBTransaction): Promise<HistoryDoc[]> {
  const rows = ((await requestToPromise(tx.objectStore(DOCS_STORE).getAll())) ?? []) as HistoryDoc[];
  return rows.sort((a, b) => b.updatedAt - a.updatedAt);
}

/**
 * How many bytes the library may occupy. Asks the browser first: a 500 MB
 * ceiling means nothing on an origin that was only granted 100 MB, and holding
 * back half of what we are given leaves room for the vendor caches the editor
 * itself depends on.
 */
export async function storageBudget(): Promise<number> {
  try {
    const estimate = await navigator.storage?.estimate?.();
    const quota = estimate?.quota;
    if (typeof quota === 'number' && quota > 0) {
      return Math.min(MAX_TOTAL_BYTES, Math.floor(quota * QUOTA_SHARE));
    }
  } catch {
    // No Storage API (or it refused): fall back to the fixed ceiling.
  }
  return MAX_TOTAL_BYTES;
}

/** Delete every revision of one document. Caller owns the transaction. */
async function deleteBlobsOf(tx: IDBTransaction, docId: string): Promise<void> {
  const store = tx.objectStore(BLOBS_STORE);
  const keys = await requestToPromise(store.index(BLOBS_BY_DOC).getAllKeys(IDBKeyRange.only(docId)));
  for (const key of keys) store.delete(key);
}

/** Drop revisions past MAX_REVS_PER_DOC, oldest first. Returns bytes freed. */
async function trimRevisions(tx: IDBTransaction, docId: string): Promise<number> {
  const store = tx.objectStore(BLOBS_STORE);
  const rows = ((await requestToPromise(store.index(BLOBS_BY_DOC).getAll(IDBKeyRange.only(docId)))) ??
    []) as HistorySnapshot[];
  if (rows.length <= MAX_REVS_PER_DOC) return 0;

  const doomed = rows.sort((a, b) => a.rev - b.rev).slice(0, rows.length - MAX_REVS_PER_DOC);
  let freed = 0;
  for (const row of doomed) {
    store.delete([row.docId, row.rev]);
    freed += row.byteLength;
  }
  return freed;
}

/**
 * Delete everything past its seven days. Runs inside whatever transaction the
 * caller already has: expiry has to be something the browser does on its own,
 * not something that waits for the user to visit a page.
 */
async function sweepExpired(tx: IDBTransaction, now: number): Promise<string[]> {
  const docs = await readAllDocs(tx);
  const expired = docs.filter((doc) => expiresAt(doc) <= now);
  for (const doc of expired) {
    await deleteBlobsOf(tx, doc.id);
    tx.objectStore(DOCS_STORE).delete(doc.id);
  }
  return expired.map((doc) => doc.id);
}

/**
 * Evict whole documents, least-recently-opened first, until the library fits
 * the budget. `protectedId` is the document being written right now: evicting
 * it to make room for itself would be a loop that ends in an empty database.
 */
async function enforceBudget(tx: IDBTransaction, budget: number, protectedId: string): Promise<void> {
  const docs = await readAllDocs(tx);
  let total = docs.reduce((sum, doc) => sum + (doc.totalBytes || 0), 0);
  if (total <= budget) return;

  const candidates = docs.filter((doc) => doc.id !== protectedId).sort((a, b) => a.lastOpenedAt - b.lastOpenedAt);

  for (const doc of candidates) {
    if (total <= budget) break;
    await deleteBlobsOf(tx, doc.id);
    tx.objectStore(DOCS_STORE).delete(doc.id);
    total -= doc.totalBytes || 0;
  }
}

async function writeSnapshot(payload: Uint8Array, input: SnapshotInput, budget: number): Promise<HistoryDoc | null> {
  const byteLength = payload.byteLength;
  const now = stamp();
  const title = input.title.trim() || 'Untitled';

  return withStores([DOCS_STORE, BLOBS_STORE], 'readwrite', async (tx) => {
    const docs = tx.objectStore(DOCS_STORE);
    const existing = input.id ? ((await requestToPromise(docs.get(input.id))) as HistoryDoc | undefined) : undefined;

    const doc: HistoryDoc = existing
      ? {
          ...existing,
          title,
          titleLower: title.toLowerCase(),
          ext: extensionOf(title),
          size: byteLength,
          totalBytes: existing.totalBytes + byteLength,
          updatedAt: now,
          revCount: existing.revCount + 1,
          nextRev: existing.nextRev + 1,
        }
      : {
          id: input.id ?? newId(),
          title,
          titleLower: title.toLowerCase(),
          ext: extensionOf(title),
          origin: input.origin,
          size: byteLength,
          totalBytes: byteLength,
          createdAt: now,
          updatedAt: now,
          lastOpenedAt: now,
          revCount: 1,
          nextRev: 1,
        };

    const rev = existing ? existing.nextRev : 0;
    const snapshot: HistorySnapshot = { docId: doc.id, rev, savedAt: now, bytes: payload, byteLength };
    tx.objectStore(BLOBS_STORE).put(snapshot);

    // Expiry first: room freed by documents that were due to go anyway is room
    // the budget does not have to take from documents that are still current.
    await sweepExpired(tx, now);

    const freed = await trimRevisions(tx, doc.id);
    doc.totalBytes -= freed;
    doc.revCount = Math.min(doc.revCount, MAX_REVS_PER_DOC);
    docs.put(doc);

    await enforceBudget(tx, budget, doc.id);
    return doc;
  });
}

/**
 * Append a snapshot, enforcing retention in the same transaction.
 *
 * Returns the stored metadata row, or null when the snapshot could not be
 * kept -- the caller (the autosave scheduler) treats that as "stop trying and
 * tell the user", because an autosave that fails in silence is worse than one
 * that was never switched on.
 */
export async function putSnapshot(input: SnapshotInput): Promise<HistoryDoc | null> {
  const budget = await storageBudget();
  const payload = await toBytes(input.bytes);
  try {
    return await writeSnapshot(payload, input, budget);
  } catch (error) {
    if (!isQuotaError(error)) return null;
    // Out of room: drop the coldest document and try once. Retrying forever
    // would trade the user's whole library for one snapshot.
    const evicted = await evictColdest(input.id);
    if (!evicted) return null;
    try {
      return await writeSnapshot(payload, input, budget);
    } catch {
      return null;
    }
  }
}

/** Delete the least-recently-opened document. Returns false when there is none. */
async function evictColdest(protectedId?: string): Promise<boolean> {
  try {
    return (
      (await withStores([DOCS_STORE, BLOBS_STORE], 'readwrite', async (tx) => {
        const docs = (await readAllDocs(tx)).filter((doc) => doc.id !== protectedId);
        if (!docs.length) return false;
        const coldest = docs.sort((a, b) => a.lastOpenedAt - b.lastOpenedAt)[0];
        await deleteBlobsOf(tx, coldest.id);
        tx.objectStore(DOCS_STORE).delete(coldest.id);
        return true;
      })) ?? false
    );
  } catch {
    return false;
  }
}

/**
 * One page of the history list, newest first, optionally filtered by title.
 *
 * Filtering happens in memory on purpose. IndexedDB can only range-scan a key,
 * which gets prefix matching and nothing else -- no substring, no case
 * folding, and nothing usable for Chinese titles. Metadata rows are well under
 * a kilobyte, so reading them all and filtering is both simpler and more
 * capable than a prefix index; the day a library is large enough for that to
 * hurt, this is the one function that has to change.
 */
export async function listDocs(
  options: { query?: string; page?: number; pageSize?: number } = {},
): Promise<DocListResult> {
  const pageSize = Math.max(1, options.pageSize ?? DEFAULT_PAGE_SIZE);
  const query = (options.query ?? '').trim().toLowerCase();

  let rows: HistoryDoc[] = [];
  try {
    rows = (await withStores([DOCS_STORE], 'readonly', (tx) => readAllDocs(tx))) ?? [];
  } catch {
    rows = [];
  }

  const matched = query ? rows.filter((doc) => doc.titleLower.includes(query)) : rows;
  const pageCount = Math.max(1, Math.ceil(matched.length / pageSize));
  // Clamp rather than return an empty page: deleting the last row of the last
  // page would otherwise leave the user staring at nothing.
  const page = Math.min(Math.max(1, options.page ?? 1), pageCount);
  const start = (page - 1) * pageSize;

  return { items: matched.slice(start, start + pageSize), total: matched.length, page, pageSize };
}

export async function getDoc(id: string): Promise<HistoryDoc | null> {
  try {
    return (
      (await withStores([DOCS_STORE], 'readonly', async (tx) => {
        return ((await requestToPromise(tx.objectStore(DOCS_STORE).get(id))) as HistoryDoc | undefined) ?? null;
      })) ?? null
    );
  } catch {
    return null;
  }
}

/** The newest stored revision of one document, bytes included. */
export async function getLatestSnapshot(id: string): Promise<HistorySnapshot | null> {
  try {
    return (
      (await withStores([BLOBS_STORE], 'readonly', async (tx) => {
        const rows = ((await requestToPromise(
          tx.objectStore(BLOBS_STORE).index(BLOBS_BY_DOC).getAll(IDBKeyRange.only(id)),
        )) ?? []) as HistorySnapshot[];
        if (!rows.length) return null;
        return rows.sort((a, b) => b.rev - a.rev)[0];
      })) ?? null
    );
  } catch {
    return null;
  }
}

/** Remove one document and every revision of it. */
export async function deleteDoc(id: string): Promise<boolean> {
  try {
    return (
      (await withStores([DOCS_STORE, BLOBS_STORE], 'readwrite', async (tx) => {
        await deleteBlobsOf(tx, id);
        tx.objectStore(DOCS_STORE).delete(id);
        return true;
      })) ?? false
    );
  } catch {
    return false;
  }
}

/**
 * Empty the library. This is the promise the UI makes to anyone on a shared
 * machine, so it clears the bytes as well as the index -- a "clear" that only
 * dropped metadata would leave every document sitting in the blob store.
 */
export async function clearAllHistory(): Promise<boolean> {
  try {
    return (
      (await withStores([DOCS_STORE, BLOBS_STORE], 'readwrite', async (tx) => {
        tx.objectStore(DOCS_STORE).clear();
        tx.objectStore(BLOBS_STORE).clear();
        return true;
      })) ?? false
    );
  } catch {
    return false;
  }
}

async function patchDoc(id: string, patch: Partial<HistoryDoc>): Promise<HistoryDoc | null> {
  try {
    return (
      (await withStores([DOCS_STORE], 'readwrite', async (tx) => {
        const store = tx.objectStore(DOCS_STORE);
        const doc = (await requestToPromise(store.get(id))) as HistoryDoc | undefined;
        if (!doc) return null;
        const next = { ...doc, ...patch };
        store.put(next);
        return next;
      })) ?? null
    );
  } catch {
    return null;
  }
}

/** The document was opened in the editor: it is the warmest thing in the library. */
export function markOpened(id: string): Promise<HistoryDoc | null> {
  return patchDoc(id, { lastOpenedAt: stamp() });
}

/** Bytes reached the user's disk, so this document has nothing left to recover. */
export function markSavedToDisk(id: string): Promise<HistoryDoc | null> {
  return patchDoc(id, { savedToDiskAt: stamp() });
}

/**
 * Delete expired documents now. Called when the app starts and when the
 * history page opens, so the seven days hold even for someone who edits
 * nothing (a write would otherwise be the only thing that sweeps).
 */
/**
 * Test seam. The monotonic clock is module-wide and only ever moves forward,
 * which is right in a browser tab and wrong across tests: one case that winds
 * the system clock forward would otherwise stamp every later case's records
 * with a time in the future, and nothing would ever look expired again.
 */
export function resetHistoryClockForTests(): void {
  lastStamp = 0;
}

export async function pruneExpired(): Promise<string[]> {
  try {
    return (await withStores([DOCS_STORE, BLOBS_STORE], 'readwrite', (tx) => sweepExpired(tx, Date.now()))) ?? [];
  } catch {
    return [];
  }
}

/** Total bytes the library currently occupies, metadata only. */
export async function historyUsage(): Promise<number> {
  try {
    const rows = (await withStores([DOCS_STORE], 'readonly', (tx) => readAllDocs(tx))) ?? [];
    return rows.reduce((sum, doc) => sum + (doc.totalBytes || 0), 0);
  } catch {
    return 0;
  }
}
