/**
 * The history database: the single place that knows the schema, and the single
 * place that decides IndexedDB is unusable.
 *
 * Two stores, deliberately: `docs` holds small metadata rows the list view
 * reads by the hundred, `blobs` holds the megabytes. A list that had to page
 * through documents with their bytes attached would pull the whole library
 * into memory to render ten rows.
 *
 * Every entry point resolves rather than throws when the database cannot be
 * opened at all (private browsing, storage disabled, a corrupted profile).
 * History is a safety net, and a safety net that breaks the editor when it is
 * unavailable is worse than no net -- the same posture lib/pending-open.ts
 * takes for the landing-page handoff.
 */
export const DB_NAME = 'document-history';
export const DB_VERSION = 1;

export const DOCS_STORE = 'docs';
export const BLOBS_STORE = 'blobs';

/** `docs` ordered by snapshot time -- the list view's default order. */
export const DOCS_BY_UPDATED = 'by_updatedAt';
/** All revisions of one document, for retention trimming and deletion. */
export const BLOBS_BY_DOC = 'by_docId';

let dbPromise: Promise<IDBDatabase | null> | null = null;

function hasIndexedDb(): boolean {
  return typeof indexedDB !== 'undefined';
}

export function openHistoryDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase | null>((resolve) => {
    if (!hasIndexedDb()) {
      resolve(null);
      return;
    }
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      resolve(null);
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DOCS_STORE)) {
        const docs = db.createObjectStore(DOCS_STORE, { keyPath: 'id' });
        docs.createIndex(DOCS_BY_UPDATED, 'updatedAt');
      }
      if (!db.objectStoreNames.contains(BLOBS_STORE)) {
        const blobs = db.createObjectStore(BLOBS_STORE, { keyPath: ['docId', 'rev'] });
        blobs.createIndex(BLOBS_BY_DOC, 'docId');
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      // Another tab opened a newer version: let go rather than block it, and
      // stop serving reads from a connection whose schema is behind.
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
  return dbPromise;
}

/** Promisify one IndexedDB request. Only ever called inside a live transaction. */
export function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

/**
 * Run `work` inside one transaction and resolve when the transaction commits,
 * not when the last request succeeds -- a value read back before the commit is
 * not yet a value anyone else can see.
 *
 * Resolves `null` when there is no usable database. Rejects with the real
 * error (`QuotaExceededError` in particular) when a transaction fails, because
 * the write path has to tell "out of room, evict and retry" apart from
 * "something is broken, give up quietly".
 */
export async function withStores<T>(
  names: string[],
  mode: IDBTransactionMode,
  work: (tx: IDBTransaction) => Promise<T>,
): Promise<T | null> {
  const db = await openHistoryDb();
  if (!db) return null;

  return new Promise<T | null>((resolve, reject) => {
    let tx: IDBTransaction;
    try {
      tx = db.transaction(names, mode);
    } catch (error) {
      reject(error);
      return;
    }

    let result: T;
    let failure: unknown;

    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(failure ?? tx.error ?? new Error('IndexedDB transaction failed'));
    tx.onabort = () => reject(failure ?? tx.error ?? new DOMException('Transaction aborted', 'AbortError'));

    work(tx).then(
      (value) => {
        result = value;
      },
      (error) => {
        // Remember why: aborting replaces tx.error with a plain AbortError and
        // the caller would lose the QuotaExceededError it needs to act on.
        failure = error;
        try {
          tx.abort();
        } catch {
          // Already finished; the handlers above have the outcome.
        }
      },
    );
  });
}

/** Test seam: drop the cached connection so the next call reopens. */
export function resetHistoryDbForTests(): void {
  void dbPromise?.then((db) => db?.close());
  dbPromise = null;
}
