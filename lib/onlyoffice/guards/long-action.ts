/**
 * 6. Long-action counter leak guard. Frame-editor entry points (edit chart /
 * edit OLE table) do sync_StartAction(BlockInteraction) -- which increments
 * IsLongActionCurrent -- and then, when the frame editor cannot open (no chart
 * under the selection, no Document Server frame editor in a serverless build),
 * throw before the matching sync_EndAction. isLongAction() is then stuck true
 * for the rest of the session and every asc_DownloadAs is silently dropped:
 * the document can never be saved again, with no error shown. Found by the
 * api-surface sweep, confirmed by single-method bisection on pptx. Reachable
 * from the UI (chart context menu / double-click), so wrap those entry points
 * and release the counter on the exception path.
 */
export function installLongActionLeakGuard(win: Window): boolean {
  const laWin = win as unknown as {
    Asc?: {
      editor?: {
        IsLongActionCurrent?: number;
        isLongAction?: () => boolean;
        sync_EndAction?: (type: number, id: number) => void;
        asc_editChartInFrameEditor?: (...args: unknown[]) => unknown;
        asc_editOleTableInFrameEditor?: (...args: unknown[]) => unknown;
        asc_runAutostartMacroses?: (...args: unknown[]) => unknown;
      };
      c_oAscAsyncActionType?: { BlockInteraction?: number };
    };
    __ooLongActionLeakGuarded?: boolean;
  };
  const laApi = laWin.Asc?.editor;
  if (laApi && !laWin.__ooLongActionLeakGuarded) {
    // Restore the counter to what it was before the entry and let the
    // app layer end its BlockInteraction overlay.
    const releaseTo = (api: NonNullable<typeof laApi>, before: number) => {
      if (typeof api.IsLongActionCurrent !== 'number' || api.IsLongActionCurrent <= before) return false;
      const block = laWin.Asc?.c_oAscAsyncActionType?.BlockInteraction;
      while (api.IsLongActionCurrent > before) {
        if (typeof block === 'number' && typeof api.sync_EndAction === 'function') {
          api.sync_EndAction(block, 0);
        } else {
          api.IsLongActionCurrent -= 1;
        }
      }
      return true;
    };
    const wrapEntry = (
      name: 'asc_editChartInFrameEditor' | 'asc_editOleTableInFrameEditor' | 'asc_runAutostartMacroses',
      // Entries that legitimately stay "long" until an async callback
      // must only be released on the exception path; synchronous ones
      // (autostart macros: no macros / no builder in this build) are
      // released whenever they return with the counter still raised.
      releaseOnReturn: boolean,
    ) => {
      const orig = laApi[name];
      if (typeof orig !== 'function') return;
      laApi[name] = function (this: NonNullable<typeof laApi>, ...args: unknown[]) {
        const before = typeof this.IsLongActionCurrent === 'number' ? this.IsLongActionCurrent : 0;
        try {
          const out = orig.apply(this, args);
          if (releaseOnReturn && releaseTo(this, before)) {
            console.warn(`[OO] ${name} returned with the long-action counter raised; restored`);
          }
          return out;
        } catch (error) {
          releaseTo(this, before);
          console.warn(`[OO] ${name} failed; long-action counter restored`, error);
          return undefined;
        }
      };
    };
    wrapEntry('asc_editChartInFrameEditor', false);
    wrapEntry('asc_editOleTableInFrameEditor', false);
    wrapEntry('asc_runAutostartMacroses', true);
    laWin.__ooLongActionLeakGuarded = true;
    console.log('[OO] long-action counter leak guard installed (frame-editor entry points)');
  }
  return Boolean(laWin.__ooLongActionLeakGuarded);
}
