/**
 * The autosave metronome.
 *
 * This is deliberately not the SDK's own autosave loop. That loop is switched
 * off on purpose (see onlyoffice/guards/serverless-save.ts): with no document
 * server behind it, it takes a fake save success and greys out the Save button
 * forever. So the app keeps its own beat.
 *
 * The beat is slow, and that is the design. One snapshot is a full export --
 * the SDK serialises the document, x2t converts it, and the bytes come back
 * across the frame boundary, with x2t asking for its 283 MB heap on the way.
 * Editors whose snapshot is a JSON.stringify can afford to write on every
 * keystroke; this one cannot, and a phone that is exporting while its user
 * types is a phone about to lose its canvas (#145). Snapshots therefore need
 * all of: something to save, a lull in the typing, and time since the last one.
 *
 * What this produces is a recovery point, not a save -- Office draws the same
 * line between AutoRecover and Save, and everything here follows it: snapshots
 * never clear the unsaved-changes warning, and never touch the user's file.
 */
import { t } from '@ranuts/shared/i18n';
import { localStorageGetItem, localStorageSetItem } from 'ranuts/utils';
import { requestSaveDocument } from '../onlyoffice/save-stream';
import { getReadonlyMode } from '../onlyoffice/readonly';
import { getLastEditAt, hasUnsavedChanges } from '../unsaved-guard';
import { isEmbedMode } from '../embed-mode';
import { extensionOf, markOpened, putSnapshot } from './store';
import type { HistoryDoc, HistoryOrigin } from './types';

/**
 * Time between snapshots, derived from what the last export actually cost
 * rather than guessed.
 *
 * Measured (bin/export-benchmark.mjs, desktop, warm x2t): 42 ms for a one-page
 * docx, 87 ms for 2000 paragraphs, 123 ms for a 20k-row workbook. The first
 * export of a session costs ~1.2 s because it loads x2t, but that is paid once
 * and not by a snapshot.
 *
 * So the fixed 90 s this started with was an order of magnitude too cautious on
 * a desktop -- and would still be too aggressive on a phone, where the same
 * export runs several times slower on a machine already close to losing its
 * canvas (#145). A single number cannot be right for both.
 *
 * Instead: spend a fixed *fraction* of wall-clock time exporting. At 1/300, a
 * 50 ms export buys a 15 s interval (floored to 30 s), a 200 ms export buys
 * 60 s, and a 600 ms export on a slow phone backs off to the 180 s ceiling.
 * The device decides, by being fast or slow, and nobody has to detect it.
 */
export const MIN_SNAPSHOT_INTERVAL_MS = 30_000;
export const MAX_SNAPSHOT_INTERVAL_MS = 180_000;
/** Export time as a fraction of elapsed time: 1/300 is 0.33% of the session. */
export const EXPORT_DUTY_CYCLE = 300;
/** Interval used before anything has been exported and timed. */
export const SNAPSHOT_INTERVAL_MS = 60_000;

/** The interval an export of `exportMs` earns. */
export function snapshotInterval(exportMs: number | null): number {
  if (!exportMs || exportMs <= 0) return SNAPSHOT_INTERVAL_MS;
  return Math.min(MAX_SNAPSHOT_INTERVAL_MS, Math.max(MIN_SNAPSHOT_INTERVAL_MS, exportMs * EXPORT_DUTY_CYCLE));
}
/** How often the conditions are re-checked. Cheap: it is a handful of comparisons. */
export const TICK_MS = 15_000;
/** Quiet time after the last edit before an export is allowed to start. */
export const IDLE_GRACE_MS = 2_000;
/** Consecutive export failures before this session gives up. */
export const MAX_CONSECUTIVE_FAILURES = 3;

const AUTOSAVE_PREF_KEY = 'document-autosave-enabled';

export interface AutosaveSessionInput {
  /**
   * The document's identity for this editing session.
   *
   * Assigned by the caller before the editor even mounts, and put in the URL,
   * so "which document is this?" has an answer that does not depend on the
   * file name. Names collide -- two people both have a Report.docx, and one
   * person has last year's too -- and an earlier version of this reused a row
   * whenever the name matched, which quietly merged the history of unrelated
   * documents.
   */
  docId: string;
  /** File name as shown to the user. */
  title: string;
  origin: HistoryOrigin;
}

export interface SnapshotDecision {
  now: number;
  enabled: boolean;
  dirty: boolean;
  readonly: boolean;
  holdsLock: boolean;
  lastSnapshotAt: number;
  lastEditAt: number;
  /** An export this session started is still running. */
  exporting: boolean;
  /** How long the last export took, or null before the first one. */
  lastExportMs: number | null;
}

/**
 * Whether this tick should take a snapshot. Split out from the scheduler so
 * the rule can be tested exhaustively without a running editor -- the parts
 * that need one (the export, the frame) are the parts that cannot be.
 */
export function shouldSnapshot(state: SnapshotDecision): boolean {
  if (!state.enabled || !state.dirty || state.readonly || !state.holdsLock || state.exporting) return false;
  if (state.now - state.lastSnapshotAt < snapshotInterval(state.lastExportMs)) return false;
  return state.now - state.lastEditAt >= IDLE_GRACE_MS;
}

export function isAutosaveEnabled(): boolean {
  // Default on. Off by default would mean the feature does not exist for
  // almost everyone, and the loss it prevents happens before anyone goes
  // looking through settings.
  return localStorageGetItem(AUTOSAVE_PREF_KEY) !== 'false';
}

export function setAutosaveEnabled(enabled: boolean): void {
  localStorageSetItem(AUTOSAVE_PREF_KEY, enabled ? 'true' : 'false');
  if (!enabled) stopAutosaveSession();
}

interface ActiveSession {
  title: string;
  origin: HistoryOrigin;
  docId: string;
  ext: string;
  timer: number;
  lastSnapshotAt: number;
  exporting: boolean;
  lastExportMs: number | null;
  failures: number;
  holdsLock: boolean;
  releaseLock: (() => void) | null;
  onVisibility: () => void;
  stopped: boolean;
}

let session: ActiveSession | null = null;

function notify(kind: 'warning' | 'error', text: string): void {
  (window as unknown as { message?: Record<string, ((msg: string) => void) | undefined> }).message?.[kind]?.(text);
}

/**
 * Claim the document for this tab.
 *
 * Two tabs editing one document would otherwise take turns overwriting each
 * other's snapshots, which is worse than not having autosave at all -- the
 * history would end up holding an interleaving of two divergent documents.
 * The lock is held for as long as the session lives; `ifAvailable` means a
 * second tab finds out immediately instead of queueing behind the first.
 */
async function acquireLock(name: string): Promise<{ held: boolean; release: (() => void) | null }> {
  const locks = (navigator as Navigator & { locks?: LockManager }).locks;
  if (!locks?.request) {
    // No Web Locks (older Safari): carry on rather than disable autosave. The
    // cost of the rare double-tab case is lower than the cost of no history.
    return { held: true, release: null };
  }
  return new Promise((resolve) => {
    let release: (() => void) | null = null;
    const held = new Promise<void>((resolveHeld) => {
      release = resolveHeld;
    });
    void locks
      .request(name, { ifAvailable: true }, (lock) => {
        if (!lock) {
          resolve({ held: false, release: null });
          return undefined;
        }
        resolve({ held: true, release });
        return held;
      })
      .catch(() => resolve({ held: true, release: null }));
  });
}

/** Export the document now and store the bytes. Returns the row, or null. */
export async function takeSnapshot(): Promise<HistoryDoc | null> {
  const active = session;
  if (!active || active.exporting || !active.ext) return null;

  active.exporting = true;
  const startedAt = Date.now();
  try {
    const file = await requestSaveDocument(active.ext.toUpperCase());
    const doc = await putSnapshot({
      id: active.docId,
      title: active.title,
      origin: active.origin,
      bytes: await file.arrayBuffer(),
    });
    if (!doc) {
      // The store gave up (no room, and eviction did not help). Stopping and
      // saying so beats a silent autosave, which is the most dangerous kind:
      // the user believes there is a recovery point where there is none.
      notify('warning', t('autosaveStopped'));
      stopAutosaveSession();
      return null;
    }
    active.docId = doc.id;
    active.lastSnapshotAt = Date.now();
    // What this export cost sets the next interval: a slow device asks for
    // snapshots less often without anyone having to identify it as slow.
    active.lastExportMs = active.lastSnapshotAt - startedAt;
    active.failures = 0;
    return doc;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // A save the user asked for owns the channel; this tick simply waits.
    if (!message.includes('already in progress')) {
      active.failures += 1;
      if (active.failures >= MAX_CONSECUTIVE_FAILURES) {
        console.warn('[history] autosave stopped after repeated export failures:', message);
        stopAutosaveSession();
      }
    }
    return null;
  } finally {
    active.exporting = false;
  }
}

function tick(): void {
  const active = session;
  if (!active) return;
  const decision: SnapshotDecision = {
    now: Date.now(),
    enabled: isAutosaveEnabled(),
    dirty: hasUnsavedChanges(),
    readonly: getReadonlyMode(),
    holdsLock: active.holdsLock,
    lastSnapshotAt: active.lastSnapshotAt,
    lastEditAt: getLastEditAt(),
    exporting: active.exporting,
    lastExportMs: active.lastExportMs,
  };
  if (shouldSnapshot(decision)) void takeSnapshot();
}

/**
 * Start watching the document that just opened.
 *
 * Called once per open. Any previous session is stopped first: its document is
 * gone from the frame, and its lock belongs to whoever wants it next.
 */
export async function beginAutosaveSession(input: AutosaveSessionInput): Promise<void> {
  stopAutosaveSession();
  if (typeof window === 'undefined' || isEmbedMode() || !isAutosaveEnabled()) return;

  const ext = extensionOf(input.title);
  // Without an extension there is no export format to ask for. (PDFs and every
  // other supported type do have one, so this is the pathological case only.)
  if (!ext) return;

  const lockName = `document-history:${input.docId}`;
  const { held, release } = await acquireLock(lockName);
  if (!held) {
    notify('warning', t('autosaveOtherTab'));
  }

  const onVisibility = (): void => {
    // The last chance that reliably gets time to run. beforeunload cannot be
    // used for this -- an export is asynchronous and the page is already on
    // its way out -- and a phone being task-switched away never sees one.
    if (document.visibilityState !== 'hidden') return;
    const active = session;
    if (!active || !active.holdsLock || active.exporting) return;
    if (!hasUnsavedChanges() || getReadonlyMode() || !isAutosaveEnabled()) return;
    void takeSnapshot();
  };

  session = {
    title: input.title,
    origin: input.origin,
    docId: input.docId,
    ext,
    // Not "now": a document that opens and is edited immediately should get
    // its first snapshot one interval in, not two.
    lastSnapshotAt: Date.now(),
    exporting: false,
    lastExportMs: null,
    failures: 0,
    holdsLock: held,
    releaseLock: release,
    onVisibility,
    stopped: false,
    timer: window.setInterval(tick, TICK_MS),
  };

  document.addEventListener('visibilitychange', onVisibility);
  // No-op until this document has a row; from then on it restarts the
  // seven-day clock every time the document is opened.
  void markOpened(input.docId);
}

export function stopAutosaveSession(): void {
  const active = session;
  session = null;
  if (!active || active.stopped) return;
  active.stopped = true;
  window.clearInterval(active.timer);
  document.removeEventListener('visibilitychange', active.onVisibility);
  active.releaseLock?.();
}

/** The history row this session writes to. Known from the start, row or not. */
export function getAutosaveDocId(): string | null {
  return session?.docId ?? null;
}

/** Test seam: inspect whether a session is running. */
export function isAutosaveSessionActive(): boolean {
  return session !== null;
}
