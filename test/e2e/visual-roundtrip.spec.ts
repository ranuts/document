import { buildDocx, buildPptx, toBase64 } from './lib/ooxml';
import { expect, test } from './lib/l0';
import { pixelDiff, settleEditor } from './lib/visual';

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
        await settleEditor(page);
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

      const diff = await pixelDiff(page, shotA, shotB);

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
