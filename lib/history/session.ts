/**
 * Starting an editing session: give the document an identity, put it in the
 * URL, and start taking recovery points.
 *
 * The identity comes first and comes from here, not from the history store,
 * because it has to exist before there is anything to store. Two consequences
 * worth stating:
 *
 * - The URL becomes `?saved=<id>`, so a reload lands back on the same document
 *   instead of on a second blank one, and the history page's Open link is the
 *   same URL the editor was already using.
 * - Identity never depends on the file name. Names repeat -- two people each
 *   have a Report.docx, one person has last year's as well -- and matching on
 *   them merged unrelated documents into one row.
 *
 * A row is still only created when the first snapshot is taken, so opening a
 * document and reading it leaves nothing behind.
 */
import { beginAutosaveSession } from './autosave';
import type { HistoryOrigin } from './types';

export function newDocumentId(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return uuid;
  return `doc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Put `?saved=<id>` in the address bar, dropping the one-shot open parameters. */
export function stampDocumentIdInUrl(docId: string): void {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (url.searchParams.get('saved') === docId) return;
  url.searchParams.set('saved', docId);
  // `open=local` hands a file over exactly once; leaving it in the URL would
  // make a reload look for a file that was already consumed.
  url.searchParams.delete('open');
  window.history.replaceState(null, '', url);
}

export function startDocumentSession(input: { title: string; origin: HistoryOrigin; docId?: string }): string {
  const docId = input.docId || newDocumentId();
  stampDocumentIdInUrl(docId);
  void beginAutosaveSession({ docId, title: input.title, origin: input.origin });
  return docId;
}
