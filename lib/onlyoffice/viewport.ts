import { DOCUMENT_TYPE_MAP } from '@ranuts/shared/document-utils';
import { getSdkEditorApi, measureEditorElementWidth } from './sdk-api';

/**
 * Phone-sized viewports (GitHub #145). The vendor ships a separate mobile app
 * bundle, but only its desktop ("main") build carries this package's offline
 * x2t patch, so a phone gets the desktop UI -- whose fixed chrome (left rail
 * plus slide thumbnails, right rail, notes pane) eats about three quarters of
 * a 393 px viewport. What is left is a ~190 px strip, and "fit slide" then
 * computes a zoom in the low tens of percent: the reporter saw 31 %, a Pixel 5
 * viewport measures 12 %.
 */
export const COMPACT_VIEWPORT_MAX_WIDTH = 600;

export type ViewportMetrics = { width: number; height: number; coarsePointer: boolean };

export function readViewportMetrics(): ViewportMetrics {
  if (typeof window === 'undefined') return { width: 0, height: 0, coarsePointer: false };
  return {
    width: window.innerWidth,
    height: window.innerHeight,
    coarsePointer: typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches,
  };
}

/**
 * Width alone is not enough: a phone in landscape is ~850 px wide, which is
 * well over any phone breakpoint, yet its 393 px of height leaves the desktop
 * chrome just as little room (measured: 498 px of canvas, 23 % zoom for a
 * slide). So a touch device counts as compact whenever its *shorter* side is
 * phone-sized, while a mouse-driven window only counts when it is genuinely
 * narrow -- a short but wide desktop window keeps its panels.
 */
export function isCompactViewport(metrics: ViewportMetrics = readViewportMetrics()): boolean {
  const { width, height, coarsePointer } = metrics;
  if (width <= 0) return false;
  if (width <= COMPACT_VIEWPORT_MAX_WIDTH) return true;
  return coarsePointer && Math.min(width, height) <= COMPACT_VIEWPORT_MAX_WIDTH;
}

/**
 * Customization overrides for a phone: give the document the width the side
 * panels were spending, and start at fit-to-width instead of fit-to-slide.
 * The status bar stays -- it carries the zoom control and the slide counter,
 * and the main view scrolls through the slides, so nothing becomes
 * unreachable. Desktop viewports get none of this.
 */
export function compactViewportCustomization(): Record<string, unknown> {
  return {
    // Everything here is one-way: the vendor applies customization once, at
    // boot. So this may only carry settings with no runtime switch --
    // compactHeader has none, and the initial zoom is by definition a
    // start value.
    //
    // Everything reversible is deliberately NOT here and goes through
    // syncCompactLayout instead (the rulers, the notes pane, the slide
    // thumbnails) or through the media query in the injected frame stylesheet
    // (the right panel). Passing `layout: { rightMenu: false }` here looked
    // equivalent and was not: LayoutManager writes an inline `display: none`
    // that no media query can undo, so a document opened in a narrow window
    // lost its object-settings panel permanently, even after the window was
    // widened again (measured before this was moved out).
    compactHeader: true,
    // -2 = fit to width (-1 = fit to page). On a phone the document should use
    // the full width; the vendor's fit-to-page also budgets for the notes pane
    // and toolbars and lands far smaller.
    zoom: -2,
  };
}

// Compact state the layout is currently in, plus which pieces of chrome this
// module folded away. Only what we folded is ever unfolded again: restoring a
// panel the user closed by hand would be worse than leaving it alone.
let compactLayoutApplied: boolean | null = null;
let foldedByUs = { thumbnails: false, notes: false, rulers: false };

/** Forget the tracked layout state; a newly mounted editor starts over. */
export function resetCompactLayoutState(): void {
  compactLayoutApplied = null;
  foldedByUs = { thumbnails: false, notes: false, rulers: false };
}

// Torn down when the document it belongs to goes away.
let viewportFollowCleanup: (() => void) | null = null;

/** Stop following the viewport (the open document is being replaced). */
export function cleanupViewportFollow(): void {
  viewportFollowCleanup?.();
}

/**
 * Bring the editor's layout in line with the viewport it is currently in, and
 * keep it there.
 *
 * The mount-time customization can only describe the viewport the document was
 * opened in, and on a phone that is the wrong one half the time: a device held
 * in landscape is ~850 px wide, so it mounts with the full desktop chrome, and
 * rotating to portrait lands right back in the layout GitHub #145 reports
 * (measured after rotation: 191 px of canvas, 12 % zoom). Chrome that is pure
 * CSS -- the right panel -- follows a media query in the injected stylesheet
 * and needs nothing here; what needs code is the thumbnails panel, the SDK's
 * canvas geometry and the zoom.
 *
 * Only *crossings* act. Plain resizes are the vendor's business, and on mobile
 * they fire constantly as the URL bar slides in and out; re-collapsing panels
 * or refitting the zoom on each of those would fight the user.
 */
export function syncCompactLayout(documentType: string, options: { force?: boolean } = {}): void {
  const compact = isCompactViewport();
  if (!options.force && compact === compactLayoutApplied) return;
  const crossed = compact !== compactLayoutApplied;

  // Only a sync that actually reached the editor may be recorded as done. A
  // resize can land while the editor is being rebuilt (between destroyEditor
  // and the next onDocumentReady), and marking that no-op as applied would
  // make every later resize in the same direction return at the guard above,
  // leaving the layout stuck until the next document is opened.
  const api = getSdkEditorApi();
  if (!api) return;
  compactLayoutApplied = compact;
  const isSlide = DOCUMENT_TYPE_MAP[documentType] === 'slide';

  try {
    if (isSlide && typeof api.ShowThumbnails === 'function') {
      if (compact && !foldedByUs.thumbnails) {
        // A third of a phone viewport goes to slide thumbnails, and each of
        // them is its own canvas. Collapsing the panel is both the width and
        // the memory win; the left rail brings it back in one tap. Skip a
        // panel that is already closed -- it is then the user's to reopen.
        if (measureEditorElementWidth('#id_thumbnails') > 0) {
          api.ShowThumbnails(false);
          foldedByUs.thumbnails = true;
        }
      } else if (!compact && foldedByUs.thumbnails) {
        api.ShowThumbnails(true);
        foldedByUs.thumbnails = false;
      }
    }

    // The notes pane and the rulers cost rows a phone does not have. Both have
    // a getter, so we only fold what is actually open and only unfold what we
    // folded.
    if (isSlide && typeof api.asc_ShowNotes === 'function') {
      if (compact && !foldedByUs.notes && api.getIsNotesShow?.() !== false) {
        api.asc_ShowNotes(false);
        foldedByUs.notes = true;
      } else if (!compact && foldedByUs.notes) {
        api.asc_ShowNotes(true);
        foldedByUs.notes = false;
      }
    }
    if (typeof api.asc_SetViewRulers === 'function') {
      if (compact && !foldedByUs.rulers && api.asc_GetViewRulers?.() !== false) {
        api.asc_SetViewRulers(false);
        foldedByUs.rulers = true;
      } else if (!compact && foldedByUs.rulers) {
        api.asc_SetViewRulers(true);
        foldedByUs.rulers = false;
      }
    }

    if (!crossed) return;
    // The panels around the canvas just changed size, and the SDK sizes its
    // canvas in JS: without a nudge it keeps drawing at the old geometry.
    // WordControl covers word and slide, asc_Resize the spreadsheet.
    setTimeout(() => {
      const current = getSdkEditorApi();
      if (!current) return;
      if (typeof current.WordControl?.OnResize === 'function') current.WordControl.OnResize();
      else if (typeof current.asc_Resize === 'function') current.asc_Resize();
      // Refit only when the available width actually changed underneath the
      // document, i.e. on a crossing -- never on an ordinary resize.
      if (compact && typeof current.zoomFitToWidth === 'function') current.zoomFitToWidth();
    }, 100);
  } catch (error) {
    console.warn('[OO] compact layout sync failed:', error);
  }
}

/**
 * Follow the viewport for the lifetime of the open document: rotation and
 * window resizes re-run the sync above. Debounced, because mobile browsers
 * fire resize on every URL-bar animation frame.
 */
export function installViewportFollow(documentType: string): void {
  if (typeof window === 'undefined') return;
  if (viewportFollowCleanup) viewportFollowCleanup();
  let debounce = 0;
  const onViewportChange = () => {
    window.clearTimeout(debounce);
    debounce = window.setTimeout(() => syncCompactLayout(documentType), 200);
  };
  window.addEventListener('resize', onViewportChange);
  window.addEventListener('orientationchange', onViewportChange);
  viewportFollowCleanup = () => {
    window.clearTimeout(debounce);
    window.removeEventListener('resize', onViewportChange);
    window.removeEventListener('orientationchange', onViewportChange);
    viewportFollowCleanup = null;
  };
}
