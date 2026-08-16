import { readFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { buildDocx, ooxmlText, zipEntryText } from './lib/ooxml';
import { expect, test } from './lib/l0';
import { settleEditor } from './lib/visual';

declare function post(type: string, payload?: Record<string, unknown>): Promise<any>;

/**
 * The remaining ways a document reaches the editor (matrix section C):
 *   - main site `?file=<url>` (also `?src=`), i.e. links from other pages;
 *   - embed API `document:open-url`;
 *   - static landing pages' `?open=local` hand-off through IndexedDB.
 * The document is served by a throwaway HTTP server on another origin so the
 * fetch is a real cross-origin request (the service worker ignores it, and
 * page.route is not involved -- see the corpus harness lesson).
 */
let server: Server;
let docUrl = '';
const DOC = buildDocx('opened from a URL');

test.beforeAll(async () => {
  server = createServer((req, res) => {
    if (req.url?.startsWith('/url-open.docx')) {
      res.writeHead(200, {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(Buffer.from(DOC));
      return;
    }
    res.writeHead(404);
    res.end();
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  docUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/url-open.docx`;
});
test.afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

test.describe('entry paths (real editor)', () => {
  test.describe.configure({ timeout: 150_000 });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true });
    });
  });

  test('main site ?file=<url> opens the document and Ctrl+S saves it under its URL name', async ({ page }) => {
    await page.goto(`/?file=${encodeURIComponent(docUrl)}`);
    await settleEditor(page);
    const sdk = page.frameLocator('iframe[name="frameEditor"]').locator('#editor_sdk');
    await sdk.waitFor({ state: 'visible', timeout: 30_000 });
    await sdk.click({ position: { x: 300, y: 200 } });
    const downloadPromise = page.waitForEvent('download', { timeout: 60_000 });
    await page.keyboard.press('Control+s');
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('url-open.docx');
    const bytes = new Uint8Array(readFileSync(await download.path()));
    expect(ooxmlText(zipEntryText(bytes, 'word/document.xml') || '')).toContain('opened from a URL');
  });

  test('embed document:open-url fetches, opens and round-trips the document', async ({ page }) => {
    await page.goto('/embed-demo.html');
    await expect(page.locator('#status')).toHaveText('ready', { timeout: 60_000 });
    const result = await page.evaluate(async (url) => {
      const opened = await post('document:open-url', { url, readonly: false });
      const saved = await post('document:save', {});
      const out = new Uint8Array(await saved.file.arrayBuffer());
      return { opened, name: saved.file.name as string, magic: Array.from(out.slice(0, 2)) };
    }, docUrl);
    expect(result.opened.readonly).toBe(false);
    expect(result.name).toBe('url-open.docx');
    expect(result.magic).toEqual([0x50, 0x4b]);
  });

  test('?open=local consumes the file a static landing page stashed in IndexedDB', async ({ page }) => {
    // Same DB/store/key names as public/open-local.js and lib/pending-open.ts.
    await page.goto('/zh-CN/');
    await page.evaluate(async (b64) => {
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const file = new File([bytes], '落地页交接.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      await new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('document-handoff', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('files');
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('files', 'readwrite');
          tx.objectStore('files').put(file, 'pending');
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      });
    }, Buffer.from(DOC).toString('base64'));
    await page.goto('/?locale=zh-CN&open=local');
    await settleEditor(page);
    const sdk = page.frameLocator('iframe[name="frameEditor"]').locator('#editor_sdk');
    await sdk.waitFor({ state: 'visible', timeout: 30_000 });
    await sdk.click({ position: { x: 300, y: 200 } });
    const downloadPromise = page.waitForEvent('download', { timeout: 60_000 });
    await page.keyboard.press('Control+s');
    expect((await downloadPromise).suggestedFilename()).toBe('落地页交接.docx');
  });
});
