import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const cases = JSON.parse(await fs.readFile('docs/evaluations/2026-10-04-ppt-long-text-cases.json', 'utf8'));
const context = await chromium.launchPersistentContext('.scratch/ai-csp/gpu-profile', {
  serviceWorkers: 'block',
  viewport: { width: 1440, height: 1000 },
  args: ['--enable-unsafe-webgpu', '--use-angle=metal'],
});
await context.addInitScript(() => {
  localStorage.setItem('agent-panel-provider', 'webllm');
  localStorage.setItem('agent-local-model-id', 'Qwen3-1.7B-q4f16_1-MLC');
});
const page = context.pages()[0] ?? (await context.newPage());
const report = {
  probeSHA256: sha(await fs.readFile(new URL(import.meta.url))),
  cases,
  scope:
    'Actual default GPU IM add-slide-text literal planning and native PPT layout, two predeclared new synthetic examples; warm profile/network, no physical-device or all-format acceptance.',
  rows: [],
  errors: [],
};
page.on('pageerror', (e) => report.errors.push(e.message));
const snapshot = () =>
  page
    .frameLocator('#app iframe')
    .locator('body')
    .evaluate(() => {
      const logic = (window.editor ?? window.Asc.editor).WordControl.m_oLogicDocument;
      return {
        width: logic.GetWidthMM(),
        height: logic.GetHeightMM(),
        shapes: logic.Slides[0].cSld.spTree.map((s) => ({
          text: s.getText?.(),
          x: s.x,
          y: s.y,
          width: s.extX,
          height: s.extY,
          contentHeight: s.getDocContent?.()?.GetSummaryHeight?.(),
        })),
      };
    });
try {
  for (const c of cases) {
    await page.goto('http://127.0.0.1:5193/editor?new=pptx&agent=1&locale=en');
    await page.frameLocator('#app iframe').locator('.agent-sidebar-entry').click({ timeout: 60000 });
    await page.waitForFunction(
      () => document.querySelector('.agent-panel-note')?.textContent?.includes('Model loaded'),
      {},
      { timeout: 180000 },
    );
    const row = {
      id: c.id,
      text: c.text,
      engine: await page.locator('.agent-model-status').textContent(),
      before: await snapshot(),
    };
    await page.locator('.agent-writing-task').selectOption('tools');
    await page
      .locator('.cui-input')
      .fill(
        'Add a new text box on the current slide with this exact plain text, preserving line breaks: ' +
          JSON.stringify(c.text),
      );
    await page.locator('.cui-input').press('Enter');
    await page.waitForFunction(() => !document.querySelector('.cui-input')?.disabled, {}, { timeout: 120000 });
    row.after = await snapshot();
    row.visibleErrors = await page.locator('.cui-msg-error').allTextContents();
    row.previews = await page.locator('.agent-plan-preview').count();
    row.applied = row.after.shapes.length === row.before.shapes.length + 1;
    if (row.applied) {
      const added = row.after.shapes.at(-1);
      row.literalExact = added.text?.replace(/\r\n/g, '\n') === c.text + '\n';
      row.boxInside =
        added.x >= 0 &&
        added.y >= 0 &&
        added.x + added.width <= row.after.width + 0.001 &&
        added.y + added.height <= row.after.height + 0.001;
      row.contentHeightFits = added.contentHeight <= added.height;
      await page
        .frameLocator('#app iframe')
        .locator('body')
        .evaluate(() => (window.editor ?? window.Asc.editor).Undo());
      await page.waitForTimeout(300);
      row.undo = await snapshot();
      await page
        .frameLocator('#app iframe')
        .locator('body')
        .evaluate(() => (window.editor ?? window.Asc.editor).Redo());
      await page.waitForTimeout(300);
      row.redo = await snapshot();
      row.undoExact = JSON.stringify(row.undo) === JSON.stringify(row.before);
      row.redoExact = JSON.stringify(row.redo) === JSON.stringify(row.after);
    } else row.documentUnchanged = JSON.stringify(row.before) === JSON.stringify(row.after);
    await page.locator('.agent-panel-close').click();
    await page.waitForTimeout(1000);
    row.screenshotPath = '.scratch/ai-csp/ppt-long-text-' + c.id + '.png';
    await page.screenshot({ path: row.screenshotPath });
    row.screenshotSHA256 = sha(await fs.readFile(row.screenshotPath));
    report.rows.push(row);
    console.log(c.id, row.applied, row.visibleErrors);
  }
  report.status = 'completed';
} catch (e) {
  report.status = 'failed';
  report.error = String(e);
  process.exitCode = 1;
} finally {
  await fs.writeFile('docs/evaluations/2026-10-04-ppt-long-text-im.json', JSON.stringify(report, null, 2) + '\n');
  await context.close();
}
