/**
 * 9. Canvas context loss. Mobile Chrome discards 2D canvas backing stores
 * under memory pressure, and this vendor build listens for neither
 * `contextlost` nor `contextrestored` (grep: zero hits in sdkjs), so the
 * editor is left showing a blank white page with live scrollbars -- what
 * GitHub #145 reports after repeatedly changing the zoom of a presentation on
 * Android, where every zoom step reallocates canvases at the device pixel
 * ratio. The lever that actually repaints is WordControl.OnResize (verified: a
 * wiped canvas comes back to a full render; a plain window resize event does
 * not, the SDK skips it when the size is unchanged). Note: the `contextlost`
 * event must NOT be canceled. Per the HTML spec the UA restores the context
 * only when the event goes uncanceled, and it then fires `contextrestored`.
 */
export function installCanvasLossGuard(win: Window, doc: Document): boolean {
  const lossWin = win as unknown as {
    __ooCanvasLossGuarded?: boolean;
    Asc?: {
      editor?: { WordControl?: { OnResize?: () => void; OnScroll?: () => void }; asc_Resize?: () => void };
    };
  };
  if (!lossWin.__ooCanvasLossGuarded) {
    const repaintEditor = (): void => {
      const editorApi = lossWin.Asc?.editor;
      const control = editorApi?.WordControl;
      try {
        if (typeof control?.OnResize === 'function') control.OnResize();
        else if (typeof control?.OnScroll === 'function') control.OnScroll();
        // The spreadsheet editor has no WordControl at all, so without
        // this branch a discarded canvas stayed blank there.
        else if (typeof editorApi?.asc_Resize === 'function') editorApi.asc_Resize();
      } catch (error) {
        console.warn('[OO] repaint after canvas context loss failed:', error);
      }
    };
    // Capture phase: these events do not bubble, but capture still reaches
    // the document on the way down.
    doc.addEventListener(
      'contextlost',
      () => {
        console.warn('[OO] editor canvas context lost (memory pressure); waiting for restore');
        // Some restores arrive without a paint; nudge either way.
        win.setTimeout(repaintEditor, 500);
      },
      true,
    );
    for (const restored of ['contextrestored', 'webglcontextrestored']) {
      doc.addEventListener(
        restored,
        () => {
          console.log('[OO] editor canvas context restored; repainting');
          repaintEditor();
        },
        true,
      );
    }
    lossWin.__ooCanvasLossGuarded = true;
  }
  return Boolean(lossWin.__ooCanvasLossGuarded);
}
