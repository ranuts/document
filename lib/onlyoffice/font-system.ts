/**
 * The font-system dependency the vendor never declared (GitHub #144). The open
 * conversion awaits `AscCommon.fetchFonts`, which walks a font system that is
 * initialised in parallel with the document load; losing that race is a
 * TypeError that fails the open with -82. Ordering the two is what removes it.
 */

/**
 * The parts of an editor frame the vendor's `AscCommon.fetchFonts` walks
 * before the open conversion can proceed.
 */
export type FontSystemWindow = {
  AscCommon?: {
    fetchFonts?: (cb: (fonts: unknown[]) => void) => unknown;
    g_font_loader?: { fontFiles?: unknown };
  };
  AscFonts?: { g_font_infos?: unknown };
};

/**
 * Both halves of the font system have to be up before the vendor's
 * `fetchFonts` is safe to run: it iterates `AscFonts.g_font_infos` and, for
 * every face that needs styles, dereferences
 * `AscCommon.g_font_loader.fontFiles[index].Id`. They are populated by
 * different steps of the editor boot, so "g_font_infos exists" is not enough
 * -- an entry read out of an empty `fontFiles` is `undefined` and `.Id`
 * throws, which surfaces to the user as a -82 open error.
 */
export function isFontSystemReady(win: FontSystemWindow): boolean {
  const infos = win.AscFonts?.g_font_infos;
  if (!Array.isArray(infos)) return false;
  // Nothing to look up: the loop body never runs, so an empty catalog is safe.
  if (infos.length === 0) return true;
  const files = win.AscCommon?.g_font_loader?.fontFiles;
  return Array.isArray(files) && files.length > 0;
}

// How long the open conversion waits for the font system before giving up on
// it. Measured on production, the font system is ready about a second BEFORE
// the x2t module is (fonts at ~3.2 s, x2t at ~4.2 s), so the normal path waits
// zero; the cap only bounds the case where a font system never comes up, which
// then degrades to the fontless import that shipped in #146 instead of hanging
// the open.
export const FONT_SYSTEM_WAIT_MS = 5_000;
const FONT_SYSTEM_POLL_MS = 50;
// Milliseconds the last conversion spent waiting for fonts. Zero on the normal
// path; asserted by the E2E suite so a systematic wait (an environment where
// fonts always lose the race) shows up as a failing test rather than as a
// silent few seconds added to every open.
export const FONT_WAIT_PROBE = '__ooFontWaitMs';

/**
 * The dependency the vendor never declared. `fetchFonts` is awaited by the
 * open conversion (x2t_helper `_convertDocument`, shared with the export
 * path), but the font system it walks is initialised in parallel with the
 * document load -- so whether it is ready when the conversion asks is a race
 * decided by cache warmth, network and CPU, and losing it is a TypeError that
 * fails the whole open with -82 (GitHub #144).
 *
 * Ordering the two is what removes the race rather than papering over it: hold
 * the callback until the font system is up, then hand over to the vendor's own
 * implementation. A browser cannot make the catalog load synchronous, but the
 * conversion can wait for it, which buys the same guarantee. Two things keep
 * the wait from becoming a new failure mode: it is capped, and the fallback is
 * exactly what the code did before (report no fonts -- imports survive
 * without them). Individual font files that fail to download are the vendor's
 * business; its own fetchFonts already swallows those.
 */
export function awaitFontSystem(
  win: FontSystemWindow,
  original: (cb: (fonts: unknown[]) => void) => unknown,
  cb: (fonts: unknown[]) => void,
  options: { timeoutMs?: number; intervalMs?: number } = {},
): void {
  const { timeoutMs = FONT_SYSTEM_WAIT_MS, intervalMs = FONT_SYSTEM_POLL_MS } = options;
  const record = (waited: number): void => {
    (win as Record<string, unknown>)[FONT_WAIT_PROBE] = waited;
  };
  if (isFontSystemReady(win)) {
    record(0);
    original.call(win.AscCommon, cb);
    return;
  }
  let waited = 0;
  const timer = setInterval(() => {
    waited += intervalMs;
    // Reading the frame is itself a realm access: if it throws, keep the
    // failure out of the timer and stop polling rather than leaving an
    // interval running forever.
    let ready: boolean;
    try {
      ready = isFontSystemReady(win);
    } catch (error) {
      clearInterval(timer);
      console.warn('[OO] font wait could not read the editor frame:', error);
      return;
    }
    if (!ready && waited < timeoutMs) return;
    clearInterval(timer);
    // The frame this callback belongs to may have been torn down while we
    // waited (the user opened another document, or the open failed and was
    // retried). Handing over to a dead realm throws, and it would throw inside
    // a timer, i.e. as an uncaught error in the host page.
    try {
      record(waited);
      if (ready) {
        console.log(`[OO] open conversion waited ${waited} ms for the font system`);
        original.call(win.AscCommon, cb);
      } else {
        console.warn(`[OO] font system still not ready after ${timeoutMs} ms; importing without fonts`);
        cb([]);
      }
    } catch (error) {
      console.warn('[OO] font wait could not hand the conversion over:', error);
      // The vendor's fetchFonts throws synchronously when it walks a font
      // system that is up but incomplete (an index into a half-filled
      // g_font_loader.fontFiles is undefined, and it dereferences .Id). On the
      // ready path above that throw is useful: it happens inside the caller's
      // promise executor, which rejects the open -- a -82 the failure guard
      // then retries. In here there is no executor to catch it, and the
      // conversion is awaiting a callback that would now never come, i.e. the
      // permanent spinner installOpenFailureGuard exists to prevent. So answer
      // it the way a timed-out wait is answered: a fontless import.
      if (ready) {
        try {
          cb([]);
        } catch {
          // The frame really is gone; nothing is waiting on the callback.
        }
      }
    }
  }, intervalMs);
}
