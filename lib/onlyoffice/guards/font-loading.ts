/**
 * 15. Font-load acceleration + face narrowing.
 *
 * The SDK's CFontLoader works through fonts_loading strictly one family at a
 * time (LoadFontAsync for the faces of fonts_loading[0], poll every 50ms until
 * they land, shift, repeat), so a real CJK deck's 30 families cost 30 serial
 * round trips of multi-MB downloads -- minutes on a cold CDN path.
 *
 * Coordinated patches, all semantics-preserving on the happy path:
 * 15a. IsNeedDefaultFonts -> false: Word/Slide preload Arial/Symbol/Wingdings/
 *    Courier/Times (12 files, 3.2 MB) on every open "just in case"; the runtime
 *    path (LoadDocumentFonts2) already fetches any of them on first actual use.
 * 15b. After the vendor enqueues the document's fonts, kick off LoadFontAsync
 *    for every still-unloaded face of every queued family at once.
 * 15c. Clamp NeedStyles after CheckFontNeeds from Document_CreateFontMap
 *    (Style 0..3 → face bits) instead of the open path's perpetual 15. Known
 *    families keep map bits | Regular | Italic (Italic covers chrome /
 *    placeholders that never appear in CreateFontMap). Families on the load
 *    list but absent from the map keep the vendor request (usually 15). Paste
 *    goes through LoadDocumentFonts2 without CheckFontNeeds, so it stays
 *    unclamped. Conversion savings need fontSources() to honor the same bits.
 */

/** NeedStyles face bits used by AscFonts / CFontLoader. */
export const NEED_STYLE_R = 1;
export const NEED_STYLE_I = 2;
export const NEED_STYLE_B = 4;
export const NEED_STYLE_BI = 8;
export const NEED_STYLE_ALL = 15;

/** CreateFontMap Style (Bold?1:0)+(Italic?2:0) → NeedStyles face bit. */
export function styleFlagToNeedStyles(style: number): number {
  switch (style & 3) {
    case 1:
      return NEED_STYLE_B;
    case 2:
      return NEED_STYLE_I;
    case 3:
      return NEED_STYLE_BI;
    default:
      return NEED_STYLE_R;
  }
}

/**
 * Collapse Document_CreateFontMap() output into family → NeedStyles.
 * Always includes Regular so a family never lands with NeedStyles 0 (vendor
 * treats 0 as 15 via `x || 15` in the CFont constructor).
 */
export function needStylesByFamilyFromFontMap(fontMap: Record<string, unknown>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(fontMap)) {
    if (value && typeof value === 'object' && 'Name' in (value as object)) {
      const entry = value as { Name: unknown; Style?: unknown };
      const name = String(entry.Name ?? '');
      if (!name) continue;
      const style = typeof entry.Style === 'number' ? entry.Style : 0;
      out[name] = (out[name] ?? 0) | styleFlagToNeedStyles(style) | NEED_STYLE_R;
      continue;
    }
    // AscFormat.checkThemeFonts replaces +mj-lt placeholders with real family
    // names whose value is the number 1 (not a {Name,Style} entry).
    if (value === 1 || value === true) {
      if (!key || key.startsWith('+')) continue;
      out[key] = (out[key] ?? 0) | NEED_STYLE_R;
    }
  }
  return out;
}

export function clampNeedStylesForFamily(requested: number | undefined, known: number | undefined): number {
  if (known !== undefined) {
    // Always keep Regular. Also keep Italic: the word/slide chrome and some
    // theme placeholders render italic without a body run that CreateFontMap
    // would have seen; dropping it produced tip-level asc_onError -25 on open.
    return known | NEED_STYLE_R | NEED_STYLE_I;
  }
  // Fonts on the open list but absent from CreateFontMap are often style-sheet
  // / theme faces that Get_AllFontNames saw and CreateFontMap has not walked
  // yet. Keep the vendor request (usually 15) so a heading style that is bold
  // in the stylesheet but unused in body text still has its face.
  if (requested === undefined || requested === 0) return NEED_STYLE_ALL;
  return requested;
}

type FontLoader = {
  fonts_loading?: Array<{
    indexR: number;
    indexI: number;
    indexB: number;
    indexBI: number;
    needR?: boolean;
    needI?: boolean;
    needB?: boolean;
    needBI?: boolean;
    NeedStyles?: number;
  }>;
  fontFiles?: Array<{ CheckLoaded: () => boolean; LoadFontAsync: (path: string, cb: unknown) => unknown }>;
  fontFilesPath?: string;
  AddLoadFonts?: (name: string, styles?: number) => unknown;
  LoadDocumentFonts?: (...args: unknown[]) => unknown;
  LoadDocumentFonts2?: (...args: unknown[]) => unknown;
};

type LogicDocument = {
  Document_CreateFontMap?: () => Record<string, unknown>;
  Fonts?: unknown;
};

type EditorApi = {
  IsNeedDefaultFonts?: () => boolean;
  FontLoader?: FontLoader;
  WordControl?: {
    m_oLogicDocument?: LogicDocument;
    m_oDrawingDocument?: { CheckFontNeeds?: (...args: unknown[]) => unknown };
  };
};

type FontWindow = Window & {
  Asc?: { editor?: EditorApi };
  AscCommon?: { g_font_loader?: FontLoader };
  __ooFontLoadAccelerated?: boolean;
  __ooFontNeedStylesHooked?: boolean;
  __ooFontNeedStylesClamped?: boolean;
  __ooFontNeedStylesDebug?: unknown;
};

function collectOpenNeedStyles(api: EditorApi): Record<string, number> | null {
  try {
    const create = api.WordControl?.m_oLogicDocument?.Document_CreateFontMap;
    if (typeof create !== 'function') return null;
    const map = create.call(api.WordControl!.m_oLogicDocument);
    if (!map || typeof map !== 'object') return null;
    const needs = needStylesByFamilyFromFontMap(map);
    return Object.keys(needs).length > 0 ? needs : null;
  } catch {
    return null;
  }
}

function rewriteFontsNeedStyles(fonts: unknown, needs: Record<string, number>): void {
  if (!fonts || typeof fonts !== 'object') return;
  for (const key of Object.keys(fonts as object)) {
    const font = (fonts as Record<string, { name?: string; Name?: string; NeedStyles?: number }>)[key];
    if (!font || typeof font !== 'object') continue;
    const name = font.name ?? font.Name;
    if (typeof name !== 'string' || !name) continue;
    font.NeedStyles = clampNeedStylesForFamily(font.NeedStyles, needs[name]);
  }
}

/** Primary 15c hook: runs after Fonts is built, before LoadDocumentFonts reads it. */
function installNeedStylesClamp(fontWin: FontWindow, fontApi: EditorApi): boolean {
  if (fontWin.__ooFontNeedStylesHooked) return true;
  const drawing = fontApi.WordControl?.m_oDrawingDocument;
  if (!drawing || typeof drawing.CheckFontNeeds !== 'function') return false;
  const origCheck = drawing.CheckFontNeeds.bind(drawing);
  drawing.CheckFontNeeds = (...args: unknown[]) => {
    const out = origCheck(...args);
    try {
      const needs = collectOpenNeedStyles(fontApi);
      const fonts = fontApi.WordControl?.m_oLogicDocument?.Fonts;
      fontWin.__ooFontNeedStylesDebug = {
        via: 'CheckFontNeeds',
        hasMap: needs !== null,
        familyCount: needs ? Object.keys(needs).length : 0,
        sample: needs ? Object.entries(needs).slice(0, 8) : [],
        fontsType: fonts == null ? 'null' : Array.isArray(fonts) ? 'array' : typeof fonts,
      };
      if (needs && fonts) {
        rewriteFontsNeedStyles(fonts, needs);
        fontWin.__ooFontNeedStylesClamped = true;
      }
    } catch {
      // best-effort: open still works with NeedStyles 15
    }
    return out;
  };
  fontWin.__ooFontNeedStylesHooked = true;
  return true;
}

export function installFontLoadAcceleration(win: Window): boolean {
  const fontWin = win as FontWindow;
  const fontApi = fontWin.Asc?.editor;
  if (!fontApi) return false;

  // DrawingDocument appears after FontLoader; keep trying on each poll.
  installNeedStylesClamp(fontWin, fontApi);

  const loader = fontWin.AscCommon?.g_font_loader ?? fontApi.FontLoader;
  if (loader && typeof loader.LoadDocumentFonts === 'function' && !fontWin.__ooFontLoadAccelerated) {
    fontApi.IsNeedDefaultFonts = () => false;
    if (fontApi.FontLoader !== loader) fontApi.FontLoader = loader;

    const prefetchQueued = () => {
      const files = loader.fontFiles;
      const path = loader.fontFilesPath;
      if (!files || typeof path !== 'string') return;
      let started = 0;
      for (const info of loader.fonts_loading || []) {
        // NeedStyles 15 (all faces) is what the loader itself resolves to when
        // it later inspects the entry; mirror that superset so no face the poll
        // will wait for is left un-requested. After 15c clamping, NeedStyles is
        // usually a subset and need* flags from CheckFontLoadStyles drive this.
        const wantAll = info.NeedStyles === undefined || (info.NeedStyles & NEED_STYLE_ALL) === NEED_STYLE_ALL;
        const faces: Array<[boolean | undefined, number]> = [
          [wantAll || info.needR, info.indexR],
          [wantAll || info.needI, info.indexI],
          [wantAll || info.needB, info.indexB],
          [wantAll || info.needBI, info.indexBI],
        ];
        for (const [need, idx] of faces) {
          if (!need || idx < 0) continue;
          const file = files[idx];
          if (!file || file.CheckLoaded()) continue;
          try {
            // LoadFontAsync is idempotent per file: it returns early once a
            // fetch is in flight (Status !== -1).
            file.LoadFontAsync(path, null);
            started++;
          } catch {
            // leave that face to the vendor's serial path
          }
        }
      }
      if (started) console.log(`[OO] font prefetch: ${started} face(s) requested in parallel`);
    };

    const origLoad = loader.LoadDocumentFonts.bind(loader);
    loader.LoadDocumentFonts = (...args: unknown[]) => {
      // Belt: if CheckFontNeeds was missed (PDF / unusual path), clamp here too.
      try {
        const needs = collectOpenNeedStyles(fontApi);
        if (needs) {
          rewriteFontsNeedStyles(args[0] ?? fontApi.WordControl?.m_oLogicDocument?.Fonts, needs);
          fontWin.__ooFontNeedStylesClamped = true;
          fontWin.__ooFontNeedStylesDebug = {
            via: 'LoadDocumentFonts',
            hasMap: true,
            familyCount: Object.keys(needs).length,
            sample: Object.entries(needs).slice(0, 8),
          };
        }
      } catch {
        // best-effort
      }
      const out = origLoad(...args);
      try {
        prefetchQueued();
      } catch {
        // acceleration is best-effort
      }
      return out;
    };

    if (typeof loader.LoadDocumentFonts2 === 'function') {
      const origLoad2 = loader.LoadDocumentFonts2.bind(loader);
      loader.LoadDocumentFonts2 = (...args: unknown[]) => {
        const out = origLoad2(...args);
        try {
          prefetchQueued();
        } catch {
          // acceleration is best-effort
        }
        return out;
      };
    }

    fontWin.__ooFontLoadAccelerated = true;
    console.log(
      '[OO] font-load acceleration installed (no default-font preload, parallel prefetch, open NeedStyles clamp)',
    );
  }
  // Ready for the poll to stop only once both the loader wrap and the
  // CheckFontNeeds clamp are in place. Spreadsheet / PDF frames never grow a
  // word-style DrawingDocument.CheckFontNeeds -- treat the clamp as satisfied
  // there so the iframe poll does not spin forever.
  const path = String(fontWin.location?.pathname ?? '');
  const clampOptional = /spreadsheeteditor|pdfeditor|celleditor/i.test(path);
  const clampReady = Boolean(fontWin.__ooFontNeedStylesHooked) || clampOptional;
  return Boolean(fontWin.__ooFontLoadAccelerated && clampReady);
}
