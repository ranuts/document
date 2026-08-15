import { expect, test } from './lib/l0';

declare function post(type: string, payload?: Record<string, unknown>): Promise<any>;

/**
 * A PDF must mount the pdf editor directly, never via web-apps/apps/common
 * (the "is it a form?" sniffing loader). That loader re-navigates with
 * `href.match(/common\/index.html/)`, which fails behind static hosts that
 * 308 `/index.html` to the directory URL (Cloudflare Pages): production PDFs
 * sat on a blank loader forever while every local run passed. Found by the
 * production smoke on 2026-08-15; lib/onlyoffice-editor.ts passes
 * document.isForm:false so api.js picks the pdf editor itself.
 */
test('a PDF mounts the pdf editor without passing through the common loader', async ({ page }) => {
  test.setTimeout(120_000);
  const visited = new Set<string>();
  page.on('framenavigated', (f) => visited.add(f.url()));

  await page.goto('/embed-demo.html');
  await expect(page.locator('#status')).toHaveText('ready', { timeout: 60_000 });
  await page.evaluate(async () => {
    const pdf =
      '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
      '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\nxref\n0 4\n0000000000 65535 f \n' +
      '0000000009 00000 n \n0000000052 00000 n \n0000000101 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n160\n%%EOF';
    await post('document:open-buffer', {
      fileName: 'route.pdf',
      buffer: new TextEncoder().encode(pdf).buffer,
      readonly: false,
    });
  });
  await expect.poll(() => page.frames().some((f) => f.url().includes('/pdfeditor/')), { timeout: 60_000 }).toBe(true);
  expect([...visited].filter((u) => u.includes('/web-apps/apps/common/'))).toEqual([]);
});
