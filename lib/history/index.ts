/**
 * Wiring for the local history feature. Kept in one place so the editor entry
 * has a single call, and so the pieces that must not import each other -- the
 * save channel and the autosave scheduler -- stay uncoupled.
 */
import { setSavedToDiskListener } from '../onlyoffice/save-stream';
import { getAutosaveDocId } from './autosave';
import { markSavedToDisk, pruneExpired } from './store';

export function initDocumentHistory(): void {
  // Expiry has to happen on its own, not when someone thinks to visit the
  // history page: "this browser forgets after seven days" is only a promise if
  // nothing has to be done to collect on it.
  void pruneExpired();

  setSavedToDiskListener(() => {
    // The document now exists on disk, so its history row has nothing left to
    // offer back. Without this the recovery bar would keep flagging a document
    // the user already saved.
    const id = getAutosaveDocId();
    if (id) void markSavedToDisk(id);
  });
}

export { beginAutosaveSession, isAutosaveEnabled, setAutosaveEnabled, stopAutosaveSession } from './autosave';
export { clearAllHistory, deleteDoc, getLatestSnapshot, getRecoverableDoc, listDocs } from './store';
export type { HistoryDoc } from './types';
