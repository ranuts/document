/**
 * 11. One unload prompt, and the right one.
 *
 * The vendor sets `window.onbeforeunload` inside the editor frame whenever the
 * document is editable, so a same-origin frame plus the app's own guard means
 * two handlers for one navigation. Chromium refuses the second ("Blocked
 * attempt to show multiple 'beforeunload' confirmation panels") and logs it as
 * an error, which is the visible symptom; the real problem is which of the two
 * is telling the truth.
 *
 * The vendor's answer comes from the SDK's own "document modified" bookkeeping,
 * and serverless save semantics (guard 5) route Save/Ctrl+S to asc_DownloadAs
 * instead of the SDK's save path -- so that bookkeeping never learns the
 * document was saved. Its prompt therefore keeps firing after the user has the
 * file on disk, which is the way to teach someone to dismiss the prompt without
 * reading it.
 *
 * The app's guard (lib/unsaved-guard.ts) tracks the same thing from the outside
 * and is cleared by an actual export, so the frame's copy is dropped and the
 * host window is left as the single source of the warning.
 */
export function installSingleUnloadPrompt(win: Window): boolean {
  const target = win as Window & { __ooUnloadPromptPatched?: boolean };
  if (target.__ooUnloadPromptPatched) return true;

  try {
    // A property, not an assignment: the vendor sets this from its own document
    // lifecycle, which lands at times this guard's polling does not line up
    // with. Swallowing the assignment covers every one of them.
    Object.defineProperty(win, 'onbeforeunload', {
      configurable: true,
      get: () => null,
      set: () => {
        /* the host window owns the unsaved-changes prompt */
      },
    });
    target.__ooUnloadPromptPatched = true;
  } catch {
    // Some engines refuse to redefine the handler property; the duplicate
    // prompt is cosmetic next to losing the guard entirely, so carry on.
    return false;
  }
  return true;
}
