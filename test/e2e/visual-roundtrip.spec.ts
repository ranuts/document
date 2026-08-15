import { buildDocx, buildPptx, toBase64 } from './lib/ooxml';
import { expect, test } from './lib/l0';

declare const XLSX: any;
declare function post(type: string, payload?: Record<string, unknown>): Promise<any>;

/**
 * Baseline-free visual check (L3, matrix section C): the editor's rendering
 * of a document and of that document after a save round trip must be
 * (near-)identical. This needs no committed PNGs and no per-platform
 * baselines, and it is exactly the detector for the "font garble after
 * save" class of bug (v7's PPTX Calibri incident). Both opens are readonly
 * so no caret/selection differs; the diff is computed in-page on a canvas.
 */
const CASES = [
  {
    label: 'docx',
    name: 'visual.docx',
    make: () =>
      toBase64(buildDocx('Visual round trip 视觉往返 — The quick brown fox jumps over the lazy dog 0123456789')),
  },
  { label: 'pptx', name: 'visual.pptx', make: () => toBase64(buildPptx('Visual 视觉 Round Trip')) },
  { label: 'xlsx', name: 'visual.xlsx', make: () => '' },
] as const;

test.describe('visual round trip (real editor)', () => {
  test.describe.configure({ timeout: 180_000 });

  for (const c of CASES) {
    test(`${c.label}: rendering after a save round trip matches the original`, async ({ page }) => {
      await page.goto('/embed-demo.html');
      await expect(page.locator('#status')).toHaveText('ready', { timeout: 60_000 });

      const sdk = page.frameLocator('iframe').frameLocator('iframe[name="frameEditor"]').locator('#editor_sdk');
      const settle = async () => {
        await sdk.waitFor({ state: 'visible', timeout: 60_000 });
        await page.waitForFunction(
          () => {
            const visit = (win: Window): boolean => {
              try {
                const api = (win as any).Asc?.editor;
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
          { timeout: 90_000 },
        );
        // Fonts/thumbnails keep painting for a moment after load-complete.
        await page.waitForTimeout(2500);
      };

      // Pass 1: open the original (edit mode so save is allowed), save.
      const savedB64 = await page.evaluate(
        async ({ name, b64 }) => {
          let bytes: Uint8Array;
          if (name.endsWith('.xlsx')) {
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(
              wb,
              XLSX.utils.aoa_to_sheet([
                ['Visual', '视觉', 123.45],
                ['round', 'trip', 67890],
              ]),
              'V',
            );
            bytes = new Uint8Array(XLSX.write(wb, { bookType: 'xlsx', type: 'array' }));
          } else {
            const bin = atob(b64);
            bytes = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          }
          (window as any).__orig = bytes;
          await post('document:open-buffer', { fileName: name, buffer: bytes.buffer, readonly: false });
          const saved = await post('document:save', {});
          const out = new Uint8Array(await saved.file.arrayBuffer());
          let s = '';
          for (let i = 0; i < out.length; i += 0x8000)
            s += String.fromCharCode.apply(null, Array.from(out.subarray(i, i + 0x8000)));
          return btoa(s);
        },
        { name: c.name, b64: c.make() },
      );

      // Pass 2: reopen the ORIGINAL readonly and shoot; pass 3: reopen the
      // SAVED bytes readonly and shoot. Same viewport, same zoom, no caret.
      await page.evaluate(async (name) => {
        const bytes = (window as any).__orig as Uint8Array;
        await post('document:open-buffer', { fileName: name, buffer: bytes.buffer, readonly: true });
      }, c.name);
      await settle();
      const shotA = await sdk.screenshot();

      await page.evaluate(
        async ({ name, b64 }) => {
          const bin = atob(b64);
          const bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          await post('document:open-buffer', { fileName: name, buffer: bytes.buffer, readonly: true });
        },
        { name: c.name, b64: savedB64 },
      );
      await settle();
      const shotB = await sdk.screenshot();

      const diff = await page.evaluate(
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
          const total = w * h;
          return {
            w,
            h,
            sizeSame: ia.width === ib.width && ia.height === ib.height,
            differingPct: (differing / total) * 100,
            nonWhitePct: (nonWhite / total) * 100,
          };
        },
        { a: shotA.toString('base64'), b: shotB.toString('base64') },
      );

      test.info().annotations.push({
        type: 'visual-diff',
        description: `${c.label}: ${diff.differingPct.toFixed(3)}% differing, ${diff.nonWhitePct.toFixed(1)}% non-white, ${diff.w}x${diff.h}`,
      });
      console.log(
        `VISUAL ${c.label}: differing=${diff.differingPct.toFixed(3)}% nonWhite=${diff.nonWhitePct.toFixed(1)}%`,
      );
      expect(diff.sizeSame).toBe(true);
      // The page must actually contain rendered content (guards against a
      // blank-vs-blank "match"), and the round trip must not move pixels.
      expect(diff.nonWhitePct).toBeGreaterThan(0.5);
      expect(diff.differingPct, `visual diff ${diff.differingPct.toFixed(3)}% of ${diff.w}x${diff.h}`).toBeLessThan(
        0.5,
      );
    });
  }
});
