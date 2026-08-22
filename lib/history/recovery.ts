/**
 * The recovery offer.
 *
 * Snapshots are worthless if nobody is told they exist. A crash or a reload
 * leaves the page open and obvious, but the common case is quieter: the user
 * closes the tab and comes back tomorrow through the homepage, where nothing
 * on screen hints that yesterday's edits were kept. So the editor asks on
 * boot -- the same thing Office does with its Document Recovery pane and
 * WordPress with "there is a more recent autosave, restore it?".
 *
 * The wording follows WordPress rather than "you have a backup": what matters
 * is the comparison. This offer only appears for a document whose snapshot is
 * newer than the last time its bytes reached the disk, and it says when those
 * edits were made so the user can tell which copy is ahead.
 */
import { t } from '@ranuts/shared/i18n';
import { Div, View } from 'ranui/builder';
import { openLocalFile } from '../document';
import { dismissRecovery, getLatestSnapshot, getRecoverableDoc } from './store';
import type { HistoryDoc } from './types';

/** Offers older than this belong on the history page, not in the user's way. */
export const RECOVERY_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const BAR_ID = 'recovery-bar';

/** A short "5 minutes ago" for the offer's headline. */
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

export function dismissRecoveryBar(): void {
  document.getElementById(BAR_ID)?.remove();
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

function buildBar(doc: HistoryDoc): HTMLElement {
  const restore = View('r-button')
    .class('recovery-bar-action')
    .text(t('recoveryRestore'))
    .attr('type', 'primary')
    .on('click', () => {
      dismissRecoveryBar();
      void restoreDocument(doc);
    })
    .build();

  const discard = View('r-button')
    .class('recovery-bar-action')
    .text(t('recoveryDismiss'))
    .attr('variant', 'text')
    .attr('type', 'text')
    .on('click', () => {
      dismissRecoveryBar();
      // Remembered, so the same offer does not greet every reload -- until the
      // document changes again, which makes it news once more.
      void dismissRecovery(doc.id);
    })
    .build();

  const viewAll = View('r-link').class('recovery-bar-link').text(t('recoveryViewAll')).attr('href', '/history').build();

  return Div()
    .id(BAR_ID)
    .class('recovery-bar')
    .role('status')
    .children(
      Div()
        .class('recovery-bar-text')
        .children(
          Div().class('recovery-bar-title').text(t('recoveryTitle')).build(),
          Div()
            .class('recovery-bar-body')
            .text(t('recoveryBody', { title: doc.title, when: formatRelativeTime(doc.updatedAt) }))
            .build(),
        )
        .build(),
      Div().class('recovery-bar-actions').children(restore, discard, viewAll).build(),
    )
    .build();
}

/**
 * Show the offer, if there is one worth showing. Safe to call on every boot:
 * it does nothing when the history is empty, unavailable, or holds only
 * documents that already reached the disk.
 */
export async function offerRecovery(options: { excludeId?: string } = {}): Promise<HistoryDoc | null> {
  const doc = await getRecoverableDoc({ excludeId: options.excludeId, maxAgeMs: RECOVERY_MAX_AGE_MS });
  if (!doc) return null;
  dismissRecoveryBar();
  document.body.appendChild(buildBar(doc));
  return doc;
}
