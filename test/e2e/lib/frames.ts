/**
 * Finding the editor's frame, once instead of twenty times.
 *
 * Almost every spec that drives a real editor has to reach the window the SDK
 * actually runs in, which is not the page Playwright navigated: the app mounts
 * the vendored editor in an iframe, and the demo page wraps that in another
 * one. Twenty specs each carried their own copy of the walk, and each copy had
 * to get the same two things right -- recurse into child frames, and swallow
 * the cross-origin read rather than let it escape.
 *
 * `page.evaluate` ships only the function it is given, so a helper imported at
 * module scope is not there when the code runs (a lesson this suite has
 * learned more than once). The L0 fixture therefore installs this at document
 * start in every frame, and specs call `window.__ooFrames.find(...)` from
 * inside their own evaluate.
 *
 * The primitive is deliberately "find the window", not "return what the probe
 * found": `false` is a meaningful answer to some of these questions
 * (sw-warm asks whether the editor frame has a controller, and "no" is not
 * "keep looking"), and a truthiness-based walk would silently walk past it.
 */

/** Installed by the L0 fixture; see `attach()` in ./l0.ts. */
export const FRAME_HELPERS = (): void => {
  const scope = window as unknown as { __ooFrames?: unknown };
  if (scope.__ooFrames) return;

  const find = (match: (win: Window) => unknown): Window | null => {
    const visit = (win: Window): Window | null => {
      try {
        if (match(win)) return win;
      } catch {
        // A cross-origin frame is not ours to read, and is never the editor.
      }
      for (let i = 0; i < win.frames.length; i++) {
        const found = visit(win.frames[i]);
        if (found) return found;
      }
      return null;
    };
    return visit(window);
  };

  scope.__ooFrames = {
    find,
    /** The window an SDK instance lives in, ready or not. */
    editor: () => find((win) => Boolean((win as unknown as { Asc?: { editor?: unknown } }).Asc?.editor)),
    /** The same, but only once it reports a document fully loaded. */
    readyEditor: () =>
      find((win) => {
        const api = (
          win as unknown as { Asc?: { editor?: { isDocumentLoadComplete?: boolean; isLoadFullApi?: boolean } } }
        ).Asc?.editor;
        return Boolean(api?.isDocumentLoadComplete && api?.isLoadFullApi);
      }),
  };
};

declare global {
  interface Window {
    /**
     * Frame lookups, installed at document start by the L0 fixture. Available
     * inside any `page.evaluate` body.
     */
    __ooFrames: {
      /** First window (self first, then children, depth first) that matches. */
      find: (match: (win: Window) => unknown) => Window | null;
      /** The window an SDK instance lives in, ready or not. */
      editor: () => Window | null;
      /** The same, but only once it reports a document fully loaded. */
      readyEditor: () => Window | null;
    };
  }
}
