/**
 * Wiring for the local history feature. Kept in one place so the editor entry
 * has a single call, and so the pieces that must not import each other -- the
 * save channel and the autosave scheduler -- stay uncoupled.
 */
import { setDiskWriter, setSavedToDiskListener } from '../onlyoffice/save-stream';
import { saveToDiskFile } from '../save-target';
import { getAutosaveDocId } from './autosave';
import { extensionOf, markSavedToDisk, pruneExpired } from './store';
import { getDocmentObj } from '@ranuts/shared/store';

export function initDocumentHistory(): void {
  // Expiry has to happen on its own, not when someone thinks to visit the
  // history page: "this browser forgets after seven days" is only a promise if
  // nothing has to be done to collect on it.
  void pruneExpired();

  // Saving writes back to the file the document came from, once the user has
  // pointed at one. The document id is what links the two, which is why this
  // is wired here rather than inside the save channel.
  setDiskWriter(async (file) => {
    const docId = getAutosaveDocId();
    if (!docId) return 'unavailable';
    const sourceName = getDocmentObj()?.fileName || file.name;
    return saveToDiskFile(docId, file, 'Document', {
      rememberTarget: extensionOf(sourceName) === extensionOf(file.name),
    });
  });

  setSavedToDiskListener(() => {
    // The document now exists on disk, so its history row has nothing left to
    // offer back. Without this the recovery bar would keep flagging a document
    // the user already saved.
    const id = getAutosaveDocId();
    if (id) void markSavedToDisk(id);
  });
}

export { beginAutosaveSession, isAutosaveEnabled, setAutosaveEnabled, stopAutosaveSession } from './autosave';
export { clearAllHistory, deleteDoc, getLatestSnapshot, listDocs } from './store';
export type { HistoryDoc } from './types';
