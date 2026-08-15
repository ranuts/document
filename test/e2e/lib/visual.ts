import type { Page } from '@playwright/test';

/**
 * Baseline-free visual helpers (L3). See visual-roundtrip.spec.ts for the
 * idea: compare the editor's rendering of a document with the rendering of
 * the same document after a save round trip, no stored PNGs involved.
 */

/** Resolve once every SDK instance reports full readiness, then let late paints settle. */
export async function settleEditor(page: Page, settleMs = 2500, timeout = 90_000): Promise<void> {
  await page.waitForFunction(
    () => {
      const visit = (win: Window): boolean => {
        try {
          const api = (
            win as unknown as { Asc?: { editor?: { isDocumentLoadComplete?: boolean; isLoadFullApi?: boolean } } }
          ).Asc?.editor;
          if (api && api.isDocumentLoadComplete && api.isLoadFullApi) return true;
        } catch {
          /* cross-origin */
        }
        for (let i = 0; i < win.frames.length; i++) if (visit(win.frames[i])) return true;
        return false;
      };
      return visit(window);
    },
    undefined,
    { timeout },
  );
  await page.waitForTimeout(settleMs);
}

export type PixelDiff = { w: number; h: number; sizeSame: boolean; differingPct: number; nonWhitePct: number };

/** Per-pixel diff of two PNG buffers, computed in-page on a canvas (no Node image deps). */
export async function pixelDiff(page: Page, a: Buffer, b: Buffer): Promise<PixelDiff> {
  return page.evaluate(
    async ({ a, b }) => {
      const load = (src: string) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = src;
        });
      const [ia, ib] = await Promise.all([load('data:image/png;base64,' + a), load('data:image/png;base64,' + b)]);
      const w = Math.min(ia.width, ib.width);
      const h = Math.min(ia.height, ib.height);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(ia, 0, 0);
      const da = ctx.getImageData(0, 0, w, h).data;
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(ib, 0, 0);
      const db = ctx.getImageData(0, 0, w, h).data;
      let differing = 0;
      let nonWhite = 0;
      for (let i = 0; i < da.length; i += 4) {
        if (da[i] < 250 || da[i + 1] < 250 || da[i + 2] < 250) nonWhite++;
        const d = Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]);
        if (d > 48) differing++;
      }
      const total = w * h || 1;
      return {
        w,
        h,
        sizeSame: ia.width === ib.width && ia.height === ib.height,
        differingPct: (differing / total) * 100,
        nonWhitePct: (nonWhite / total) * 100,
      };
    },
    { a: a.toString('base64'), b: b.toString('base64') },
  );
}
