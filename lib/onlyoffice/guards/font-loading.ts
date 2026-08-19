/**
 * 8. Font-load acceleration. The SDK's CFontLoader works through fonts_loading
 * strictly one family at a time (LoadFontAsync for the faces of
 * fonts_loading[0], poll every 50ms until they land, shift, repeat), so a real
 * CJK deck's 30 families cost 30 serial round trips of multi-MB downloads --
 * minutes on a cold CDN path. Two coordinated patches, both
 * semantics-preserving:
 * 8a. IsNeedDefaultFonts -> false: the Word/Slide editors preload
 *    Arial/Symbol/Wingdings/Courier/Times (12 files, 3.2 MB) on every open
 *    "just in case"; the runtime path (LoadDocumentFonts2) already fetches any
 *    of them on first actual use.
 * 8b. after the vendor enqueues the document's fonts, kick off LoadFontAsync
 *    for every still-unloaded face of every queued family at once, so the
 *    browser downloads them in parallel and the serial poll finds each one
 *    already in flight or done.
 */
export function installFontLoadAcceleration(win: Window): boolean {
  const fontWin = win as unknown as {
    Asc?: {
      editor?: {
        IsNeedDefaultFonts?: () => boolean;
        FontLoader?: {
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
          LoadDocumentFonts?: (...args: unknown[]) => unknown;
          LoadDocumentFonts2?: (...args: unknown[]) => unknown;
        };
      };
    };
    __ooFontLoadAccelerated?: boolean;
  };
  const fontApi = fontWin.Asc?.editor;
  const loader = fontApi?.FontLoader;
  if (fontApi && loader && typeof loader.LoadDocumentFonts === 'function' && !fontWin.__ooFontLoadAccelerated) {
    fontApi.IsNeedDefaultFonts = () => false;

    const prefetchQueued = () => {
      const files = loader.fontFiles;
      const path = loader.fontFilesPath;
      if (!files || typeof path !== 'string') return;
      let started = 0;
      for (const info of loader.fonts_loading || []) {
        // NeedStyles 15 (all faces) is what the loader itself resolves
        // to when it later inspects the entry; mirror that superset so
        // no face the poll will wait for is left un-requested.
        const wantAll = info.NeedStyles === undefined || (info.NeedStyles & 15) === 15;
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
            // LoadFontAsync is idempotent per file: it returns early
            // once a fetch is in flight (Status !== -1).
            file.LoadFontAsync(path, null);
            started++;
          } catch {
            // leave that face to the vendor's serial path
          }
        }
      }
      if (started) console.log(`[OO] font prefetch: ${started} face(s) requested in parallel`);
    };

    for (const name of ['LoadDocumentFonts', 'LoadDocumentFonts2'] as const) {
      const orig = loader[name];
      if (typeof orig !== 'function') continue;
      loader[name] = function (this: typeof loader, ...args: unknown[]) {
        const out = orig.apply(this, args);
        // The vendor has now filled fonts_loading and started family #1;
        // request everything else too.
        try {
          prefetchQueued();
        } catch {
          // acceleration is best-effort
        }
        return out;
      };
    }
    fontWin.__ooFontLoadAccelerated = true;
    console.log('[OO] font-load acceleration installed (no default-font preload, parallel prefetch of queued faces)');
  }
  return Boolean(fontWin.__ooFontLoadAccelerated);
}
