import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const source = JSON.parse(await fs.readFile('docs/evaluations/2026-10-04-unicode-im-three-editors.json', 'utf8'));
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
const page = await context.newPage();
const report = {
  probeSHA256: sha(await fs.readFile(new URL(import.meta.url))),
  scope:
    'Reopened saved short Unicode IM samples, current desktop Chromium native editor screenshots, no AI inference or physical-device acceptance.',
  rows: [],
  errors: [],
};
page.on('pageerror', (e) => report.errors.push(e.message));
try {
  for (const sample of source.results) {
    const bytes = await fs.readFile(sample.nativeSave.artifactPath);
    if (sha(bytes) !== sample.nativeSave.sha256) throw Error('Artifact hash changed');
    await page.goto('http://127.0.0.1:5193/?locale=en');
    const chooser = page.waitForEvent('filechooser');
    await page.locator('#hero-open').click();
    await (await chooser).setFiles(sample.nativeSave.artifactPath);
    await page.waitForFunction(
      () => {
        const frame = document.querySelector('#app iframe')?.contentWindow;
        const a = frame?.editor ?? frame?.Asc?.editor;
        return a?.isDocumentLoadComplete && a?.isLoadFullApi;
      },
      {},
      { timeout: 120000 },
    );
    await page.waitForTimeout(1500);
    const layout = await page
      .frameLocator('#app iframe')
      .locator('body')
      .evaluate((_el, type) => {
        const api = window.editor ?? window.Asc.editor;
        if (type !== 'pptx') return { type, nativeReady: api.isDocumentLoadComplete };
        const logic = api.WordControl.m_oLogicDocument;
        return {
          type,
          slideWidth: logic.GetWidthMM(),
          slideHeight: logic.GetHeightMM(),
          shapes: logic.Slides[0].cSld.spTree.map((s) => ({
            text: s.getText?.(),
            x: s.x,
            y: s.y,
            width: s.extX,
            height: s.extY,
            contentHeight: s.getDocContent?.()?.GetSummaryHeight?.(),
          })),
        };
      }, sample.type);
    const screenshotPath = '.scratch/ai-csp/unicode-reopen-render-' + sample.type + '.png';
    await page.screenshot({ path: screenshotPath });
    report.rows.push({
      type: sample.type,
      artifactSHA256: sha(bytes),
      screenshotPath,
      screenshotSHA256: sha(await fs.readFile(screenshotPath)),
      layout,
    });
  }
  report.status = report.errors.length ? 'page-errors' : 'captured';
} catch (e) {
  report.status = 'failed';
  report.error = String(e);
  process.exitCode = 1;
} finally {
  await fs.writeFile('docs/evaluations/2026-10-04-unicode-saved-render.json', JSON.stringify(report, null, 2) + '\n');
  console.log(report.status, report.error ?? '');
  await context.close();
  await browser.close();
}
