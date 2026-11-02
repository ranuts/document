import { buildDocx, buildPptx, buildXlsx, toBase64 } from './lib/ooxml';
import { expect, test } from './lib/l0';

/**
 * #298: readonly locked the document but left the toolbar looking live, so
 * every button seemed to work and did nothing. A readonly document keeps only
 * the File and View tabs, opens on View, drops the editing controls outside
 * the tabs (paste), and keeps the viewing tools (search, zoom) usable. The
 * whole state must come and go with runtime toggles, which are the reason
 * readonly is a restriction rather than a view-mode mount.
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

type Chrome = { tabs: string[]; active: string; paste: boolean; search: boolean; zoomIn: boolean } | null;

const READONLY = { tabs: ['file', 'view'], active: 'view', paste: false, search: true, zoomIn: true };

test.describe('readonly shows in the editor chrome (real editor)', () => {
  test.describe.configure({ timeout: 120_000 });

  test.beforeEach(async ({ page }) => {
    await page.goto('/embed-demo.html');
    await expect(page.locator('#status')).toHaveText('ready', { timeout: 60_000 });
  });

  for (const doc of DOCS) {
    test(`${doc.name}: only File and View remain while readonly, and editing comes back`, async ({ page }) => {
      const chrome = (): Promise<Chrome> =>
        page.evaluate((zoomIn) => {
          const win = window.__ooFrames.find((w) => !!w.document.querySelector('#toolbar .tabs'));
          if (!win) return null;
          const shown = (el: HTMLElement | null): boolean => !!el && el.offsetParent !== null;
          const usable = (selector: string): boolean => {
            const el = win.document.querySelector<HTMLElement>(selector);
            return shown(el) && !el!.classList.contains('disabled') && !el!.hasAttribute('disabled');
          };
          const tabs = [...win.document.querySelectorAll<HTMLElement>('#toolbar .tabs .ribtab > a[data-tab]')];
          return {
            tabs: tabs.filter((a) => shown(a.parentElement)).map((a) => a.dataset.tab!),
            active: win.document.querySelector<HTMLElement>('#toolbar .tabs .ribtab.active > a')?.dataset.tab ?? '',
            paste: shown(win.document.querySelector<HTMLElement>('#slot-btn-paste')),
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
      await expect.poll(chrome, { timeout: 30_000 }).toEqual(READONLY);

      await page.evaluate(() => post('document:set-readonly', { readonly: false }));
      await expect.poll(chrome, { timeout: 10_000 }).toEqual(
        expect.objectContaining({
          tabs: expect.arrayContaining(['file', 'home', 'view']),
          active: 'home',
          paste: true,
        }),
      );

      await page.evaluate(() => post('document:set-readonly', { readonly: true }));
      await expect.poll(chrome, { timeout: 10_000 }).toEqual(READONLY);
    });
  }
});
