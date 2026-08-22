/**
 * Getting back to a stored snapshot.
 *
 * Recovery is offered where the user is not already in the middle of
 * something -- the landing page's "continue last time" line and the /history
 * list -- and both of those end here: they hand over a document id, and this
 * puts its newest bytes back in the editor.
 *
 * There used to be a card that made the offer on editor boot as well. It had
 * to go: /editor never opens empty, so the card always arrived on top of a
 * document the user had just opened, to talk about a different one.
 */
import { openLocalFile } from '../document';
import { getLatestSnapshot } from './store';
import type { HistoryDoc } from './types';

/** A short "5 minutes ago", for the history list's timestamps. */
export function formatRelativeTime(timestamp: number, now = Date.now()): string {
  const seconds = Math.round((timestamp - now) / 1000);
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['second', 60],
    ['minute', 60],
    ['hour', 24],
    ['day', 7],
    ['week', 5],
  ];
  let value = seconds;
  let unit: Intl.RelativeTimeFormatUnit = 'second';
  for (const [name, size] of units) {
    unit = name;
    if (Math.abs(value) < size) break;
    value = Math.round(value / size);
  }
  try {
    return new Intl.RelativeTimeFormat(document.documentElement.lang || undefined, { numeric: 'auto' }).format(
      value,
      unit,
    );
  } catch {
    return new Date(timestamp).toLocaleString();
  }
}

/**
 * Reopen the document from its newest snapshot.
 *
 * The bytes go back in through the ordinary local-file path, so everything
 * downstream -- the editor mount, the store, the autosave session -- behaves
 * exactly as it does for a file the user picked, with one difference: the
 * session is told which history row this came from, so editing continues that
 * row instead of starting a second one for the same document.
 */
export async function restoreDocument(doc: HistoryDoc): Promise<boolean> {
  const snapshot = await getLatestSnapshot(doc.id);
  if (!snapshot) return false;
  // Records come back from IndexedDB as a whole buffer, never a view into a
  // larger one, so handing over the buffer avoids copying tens of megabytes.
  const file = new File([snapshot.bytes.buffer as ArrayBuffer], doc.title);
  await openLocalFile(file, { historyId: doc.id });
  return true;
}
