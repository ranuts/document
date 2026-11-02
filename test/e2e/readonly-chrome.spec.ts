import { buildDocx, buildPptx, buildXlsx, toBase64 } from './lib/ooxml';
import { expect, test } from './lib/l0';

/**
 * #298: readonly locked the document but left the toolbar looking live, so
 * every button seemed to work and did nothing. The editor must show the lock --
 * the toolbar masked -- while the viewing tools (search, zoom) stay usable, and
 * the mask must come and go with runtime toggles, which are the reason readonly
 * is a restriction rather than a view-mode mount.
 */
const PDF =
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
  '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\nxref\n0 4\n0000000000 65535 f \n' +
  '0000000009 00000 n \n0000000052 00000 n \n0000000101 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n160\n%%EOF';

const DOCS = [
  { name: 'chrome.docx', zoomIn: '#btn-zoom-up', b64: () => toBase64(buildDocx('readonly docx')) },
  { name: 'chrome.xlsx', zoomIn: '#status-btn-zoomup', b64: () => toBase64(buildXlsx({ rows: [['readonly', 1]] })) },
  { name: 'chrome.pptx', zoomIn: '#btn-zoom-up', b64: () => toBase64(buildPptx('readonly pptx')) },
  { name: 'chrome.pdf', zoomIn: '#btn-zoom-up', b64: () => toBase64(new TextEncoder().encode(PDF)) },
] as const;

type Chrome = { masked: boolean; search: boolean; zoomIn: boolean } | null;

test.describe('readonly shows in the editor chrome (real editor)', () => {
  test.describe.configure({ timeout: 120_000 });

  test.beforeEach(async ({ page }) => {
    await page.goto('/embed-demo.html');
    await expect(page.locator('#status')).toHaveText('ready', { timeout: 60_000 });
  });

  for (const doc of DOCS) {
    test(`${doc.name}: toolbar is masked while readonly, viewing tools stay usable`, async ({ page }) => {
      const chrome = (): Promise<Chrome> =>
        page.evaluate((zoomIn) => {
          const win = window.__ooFrames.find((w) => !!w.document.querySelector('#toolbar .toolbar'));
          if (!win) return null;
          const usable = (selector: string): boolean => {
            const el = win.document.querySelector<HTMLElement>(selector);
            return (
              !!el && el.offsetParent !== null && !el.classList.contains('disabled') && !el.hasAttribute('disabled')
            );
          };
          return {
            masked: !!win.document.querySelector('#toolbar .toolbar-mask'),
            search: usable('#left-btn-searchbar'),
            zoomIn: usable(zoomIn),
          };
        }, doc.zoomIn);

      await page.evaluate(
        async ({ name, b64 }) => {
          const bin = atob(b64);
          const bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          await post('document:open-buffer', { fileName: name, buffer: bytes.buffer, readonly: true });
        },
        { name: doc.name, b64: doc.b64() },
      );
      await expect.poll(chrome, { timeout: 30_000 }).toEqual({ masked: true, search: true, zoomIn: true });

      await page.evaluate(() => post('document:set-readonly', { readonly: false }));
      await expect.poll(chrome, { timeout: 10_000 }).toEqual({ masked: false, search: true, zoomIn: true });

      await page.evaluate(() => post('document:set-readonly', { readonly: true }));
      await expect.poll(chrome, { timeout: 10_000 }).toEqual({ masked: true, search: true, zoomIn: true });
    });
  }
});
