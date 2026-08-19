import { awaitFontSystem, type FontSystemWindow } from '../font-system';

/**
 * 3. Guard the vendor build's AscCommon.fetchFonts: the open-document
 * conversion awaits it (x2t_helper _convertDocument), and it walks the font
 * system with no readiness check of its own --
 * `AscFonts.g_font_infos.forEach(...)` and, per entry,
 * `AscCommon.g_font_loader.fontFiles[index].Id`. Whichever of the two is not
 * populated yet throws a TypeError that x2t_helper rewraps as "Document
 * conversion failed: ...", i.e. a -82 open error on a perfectly good file.
 * awaitFontSystem turns that race into an ordered dependency: the conversion
 * waits for the font system instead of walking a half-built one, and only a
 * wait that runs out of budget degrades to a fontless import. GitHub #144.
 */
export function installFetchFontsGuard(win: Window): boolean {
  const ooWin = win as unknown as FontSystemWindow & { __ooFetchFontsGuarded?: boolean };
  if (ooWin.AscCommon && typeof ooWin.AscCommon.fetchFonts === 'function' && !ooWin.__ooFetchFontsGuarded) {
    const origFetchFonts = ooWin.AscCommon.fetchFonts;
    ooWin.AscCommon.fetchFonts = function (cb: (fonts: unknown[]) => void) {
      awaitFontSystem(ooWin, origFetchFonts, cb);
    };
    ooWin.__ooFetchFontsGuarded = true;
    console.log('[OO] AscCommon.fetchFonts now waits for the font system before converting');
  }
  return Boolean(ooWin.__ooFetchFontsGuarded);
}
