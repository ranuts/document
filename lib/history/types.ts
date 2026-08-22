/** Shapes stored in the history database. Kept apart from the access layer so
 *  the history page, the recovery bar and the autosave scheduler can talk about
 *  records without pulling IndexedDB code into their bundles. */

/** Where the document came from, for the history list's subtitle. */
export type HistoryOrigin = 'local' | 'url' | 'new';

/** One document's metadata row. Small on purpose: the list view reads these and
 *  never touches the bytes, which is what keeps it fast with a full library. */
export interface HistoryDoc {
  id: string;
  /** File name as the user sees it, e.g. `Report.docx`. */
  title: string;
  /** Lower-cased title, the search key (IndexedDB has no case-insensitive compare). */
  titleLower: string;
  /** Extension without the dot, lower-cased. */
  ext: string;
  origin: HistoryOrigin;
  /** Byte length of the newest snapshot (what the list shows). */
  size: number;
  /**
   * Byte length of every snapshot this document still has. Maintained here so
   * the storage budget can be totalled by reading metadata alone -- summing the
   * blob store would mean pulling every stored document into memory to add up
   * its size.
   */
  totalBytes: number;
  createdAt: number;
  /** When the newest snapshot was taken. Drives ordering in the list. */
  updatedAt: number;
  lastOpenedAt: number;
  /** How many snapshots this document currently has stored. */
  revCount: number;
  /** Next revision number to hand out; monotonic, never reused. */
  nextRev: number;
  /**
   * When bytes for this document last reached the user's disk. Compared with
   * `updatedAt` to answer the only question the recovery bar cares about:
   * is there work here that never made it out of the browser?
   */
  savedToDiskAt?: number;
  /** When the user dismissed the recovery offer for this document. */
  dismissedAt?: number;
}

/**
 * One snapshot's bytes, stored under `[docId, rev]`.
 *
 * A typed array rather than a Blob: the bytes arrive as an ArrayBuffer from the
 * editor frame and go back to it as one, so a Blob would add a wrap on the way
 * in and an async unwrap on the way out for no gain. Typed arrays are also the
 * shape every structured-clone implementation round-trips faithfully, which a
 * Blob is not.
 */
export interface HistorySnapshot {
  docId: string;
  rev: number;
  savedAt: number;
  bytes: Uint8Array;
  byteLength: number;
}

/** A document that has edits which never reached the disk. */
export function hasUnsavedWork(doc: HistoryDoc): boolean {
  return doc.updatedAt > (doc.savedToDiskAt ?? 0);
}

/**
 * How long a document stays in the local history.
 *
 * Recovery points are for getting back to work you were in the middle of, not
 * for keeping a library -- Office expires its AutoRecover files too. A fixed
 * window is also the honest version of the privacy promise: "this browser
 * forgets on its own" is something a user can rely on, in a way that "until
 * some quota is reached" is not. Seven days is long enough to cover a holiday
 * weekend and short enough that a shared machine does not accumulate a month
 * of someone's documents.
 */
export const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * When this document is due to be deleted. The clock restarts on either kind
 * of activity -- editing it or just opening it -- so a document someone keeps
 * coming back to never expires under them.
 */
export function expiresAt(doc: HistoryDoc): number {
  return Math.max(doc.updatedAt, doc.lastOpenedAt) + MAX_AGE_MS;
}

/** Whole days left before this document is deleted; 0 means "today". */
export function daysUntilExpiry(doc: HistoryDoc, now = Date.now()): number {
  return Math.max(0, Math.ceil((expiresAt(doc) - now) / (24 * 60 * 60 * 1000)));
}
