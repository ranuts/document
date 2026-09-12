/**
 * The editor iframe that never loaded, because a Service Worker changed hands.
 *
 * Activating a worker terminates the outgoing one and fails every request it
 * still had in flight. One of those, on this route, is the vendored editor's
 * own iframe document -- and nothing retries it. The frame stays empty,
 * `onAppReady` never fires, and the reader is left on a blank page with no way
 * out but a manual reload. `lib/sw-update.ts` covers the case where the swap
 * arrives as a `controllerchange` this page can see; it cannot cover the one
 * where the page already started under the new controller and the casualty is
 * a request made afterwards.
 *
 * Caught in CI on `sw-silent-update.spec.ts`, where the trace is unambiguous:
 * every request 200 except the frame's own document, which ends at status -1,
 * no console error, a white screenshot, and no `onAppReady`.
 *
 * So: if the frame has not reported ready, ask for its document again. That is
 * all this does. It is a navigation of an empty frame -- there is no editor
 * state to lose, because the editor never started.
 */

/**
 * How long a frame may stay silent before its document is asked for again.
 *
 * Long enough that a slow load is not mistaken for a dead one: an aborted
 * navigation and one still in flight look the same from outside (the frame
 * keeps its about:blank document either way), so the only thing separating
 * them is time. A cold editor frame is up in a couple of seconds locally and
 * well inside ten on the slowest run measured, while settleEditor gives the
 * whole boot 90 s -- so a retry here still leaves room for the retried load.
 */
const SILENT_FRAME_MS = 25_000;

type WatchedFrame = HTMLIFrameElement & { __ooFrameRetried?: boolean };

let timer: ReturnType<typeof setTimeout> | null = null;
let ready = false;

/** The vendored editor's frame, whatever the placeholder was called. */
function editorFrame(): WatchedFrame | null {
  return document.querySelector<WatchedFrame>('iframe[name="frameEditor"], #iframe iframe, iframe[id^="iframe"]');
}

/**
 * Whether the frame is empty in the way an aborted navigation leaves it: the
 * document exists (same origin) and has nothing in it. A frame still loading
 * has a body too, so this is checked only after the silence window.
 */
function looksAbandoned(frame: WatchedFrame): boolean {
  try {
    const doc = frame.contentDocument;
    if (!doc) return false;
    if (doc.readyState === 'loading') return false;
    return !doc.body || doc.body.childElementCount === 0;
  } catch {
    // Cross-origin: not our frame, and not ours to retry.
    return false;
  }
}

/** Called from the editor's onAppReady: the frame answered, stand down. */
export function markEditorFrameReady(): void {
  ready = true;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}

/**
 * Start watching a freshly mounted editor. Re-navigates the frame once if it
 * has still said nothing after {@link SILENT_FRAME_MS}; a second silence is
 * left alone, because by then the problem is not a lost request.
 */
export function watchEditorFrame(): void {
  ready = false;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    if (ready) return;
    const frame = editorFrame();
    if (!frame || frame.__ooFrameRetried || !looksAbandoned(frame)) return;
    frame.__ooFrameRetried = true;
    console.warn('[OO] the editor frame never loaded; asking for its document again');
    // Re-assigning src is what re-requests it; the frame is empty, so nothing
    // is being interrupted.
    const { src } = frame;
    frame.src = 'about:blank';
    frame.src = src;
  }, SILENT_FRAME_MS);
}
