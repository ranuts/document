/**
 * Reading the history database from a test.
 *
 * Every spec that checks what autosave stored needs the same handful of
 * guards, and getting them wrong does not merely fail -- it hangs, and takes
 * the app down with it. A versionless `indexedDB.open` on a database that does
 * not exist yet *creates* an empty version 1 with no object stores (the app
 * opens version 2 and creates its stores there, see lib/history/db.ts). Asking
 * that empty database for `docs` throws inside the `onsuccess` handler, where
 * nothing is listening: the promise never settles, so the connection is never
 * closed, and a stray open connection then blocks the app's own upgrade -- so
 * the snapshot the test is waiting for can never be written. A spec that races
 * autosave, which is every spec that reads this database, loses that race
 * sooner or later.
 *
 * So: one guarded reader, used by all of them.
 */
import type { Page } from '@playwright/test';

export interface HistoryRow {
  id: string;
  title: string;
  size: number;
  savedToDiskAt?: number;
}

const DB_NAME = 'document-history';

/**
 * Run `read` against an existing store, or resolve `fallback` if the database
 * or the store is not there yet. Closes the connection on every path.
 */
const withStore = <T>(page: Page, store: string, wantKeys: boolean, fallback: T) =>
  page.evaluate(
    ([dbName, storeName, keysOnly, empty]) =>
      new Promise<T>((resolve) => {
        const request = indexedDB.open(dbName as string);
        const done = (db: IDBDatabase | null, value: unknown): void => {
          db?.close();
          resolve(value as T);
        };
        request.onerror = () => resolve(empty as T);
        request.onsuccess = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(storeName as string)) return done(db, empty);
          try {
            const objectStore = db.transaction(storeName as string, 'readonly').objectStore(storeName as string);
            const query = keysOnly ? objectStore.getAllKeys() : objectStore.getAll();
            query.onsuccess = () => done(db, query.result);
            query.onerror = () => done(db, empty);
          } catch {
            // The store was dropped between the check and the transaction.
            done(db, empty);
          }
        };
      }),
    [DB_NAME, store, wantKeys, fallback] as const,
  );

/** The metadata rows autosave has stored, or none if it has stored nothing. */
export const readHistoryDocs = (page: Page): Promise<HistoryRow[]> => withStore<HistoryRow[]>(page, 'docs', false, []);

/** The keys in one history store -- what survived a delete, or an expiry sweep. */
export const readHistoryKeys = (page: Page, store: 'docs' | 'blobs'): Promise<string[]> =>
  withStore<string[]>(page, store, true, []);
