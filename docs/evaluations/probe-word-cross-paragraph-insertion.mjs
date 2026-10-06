import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const cases = [{ id: 'cross-paragraph', text: 'Replacement 四季 日本 ä', source: 'First paragraph 四季\nSecond paragraph 日本' }];
const context = await chromium.launchPersistentContext('.scratch/ai-csp/gpu-profile', {
  serviceWorkers: 'block',
  viewport: { width: 1280, height: 900 },
  args: ['--enable-unsafe-webgpu', '--use-angle=metal'],
});
await context.addInitScript(() => {
  localStorage.setItem('agent-panel-provider', 'webllm');
  localStorage.setItem('agent-local-model-id', 'Qwen3-1.7B-q4f16_1-MLC');
  window.__wordInputs = [];
  const Original = window.Worker;
  window.Worker = class extends Original {
    postMessage(m, ...rest) {
      if (m?.kind === 'chatCompletionNonStreaming') window.__wordInputs.push(structuredClone(m.content));
      return super.postMessage(m, ...rest);
    }
  };
});
const page = context.pages()[0] ?? (await context.newPage());
const report = { probeSHA256: sha(await fs.readFile(new URL(import.meta.url))), cases, rows: [], errors: [] };
page.on('pageerror', (e) => report.errors.push(e.message));
const body = () => page.frameLocator('#app iframe').locator('body');
const snapshot = () =>
  body().evaluate(() => (window.editor ?? window.Asc.editor).WordControl.m_oLogicDocument.GetText());
try {
  for (const c of cases) {
    await page.goto('http://127.0.0.1:5193/editor?new=docx&agent=1&locale=en');
    await page.frameLocator('#app iframe').locator('.agent-sidebar-entry').click({ timeout: 60000 });
    await page.waitForFunction(
      () => document.querySelector('.agent-panel-note')?.textContent?.includes('Model loaded'),
      {},
      { timeout: 180000 },
    );
    const selected = await body().evaluate((_, source) => { const api = window.editor ?? window.Asc.editor; const [first, second] = source.split('\n'); api.pluginMethod_PasteText(first); api.WordControl.m_oLogicDocument.AddNewParagraph(); api.pluginMethod_PasteText(second); const paragraphs = api.WordControl.m_oLogicDocument.GetAllParagraphs({OnlyMainDocument:true,All:true}); if (paragraphs.length !== 2) throw Error('Expected two native paragraphs: ' + paragraphs.length); api.asc_EditSelectAll(); return api.pluginMethod_GetSelectedText(); }, c.source);
    const row = {
      selected,
      id: c.id,
      text: c.text,
      engine: await page.locator('.agent-model-status').textContent(),
      before: await snapshot(),
    };
    await page.locator('.agent-writing-task').selectOption('tools');
    await page.locator('.cui-input').fill('Insert exactly this plain text at the cursor: ' + c.text);
    await page.locator('.cui-input').press('Enter');
    await page.waitForFunction(() => !document.querySelector('.cui-input')?.disabled, {}, { timeout: 120000 });
    row.after = await snapshot();
    row.inputs = await page.evaluate(() => window.__wordInputs);
    row.errors = await page.locator('.cui-msg-error').allTextContents();
    row.previews = await page.locator('.agent-plan-preview').count();
    row.literalExact = row.after.replace(/\r\n/g, '\n').replace(/\r/g, '\n') === c.text + '\n';
    await body().evaluate(() => (window.editor ?? window.Asc.editor).Undo());
    await page.waitForTimeout(300);
    row.undo = await snapshot();
    await body().evaluate(() => (window.editor ?? window.Asc.editor).Redo());
    await page.waitForTimeout(300);
    row.redo = await snapshot();
    row.undoExact = row.undo === row.before;
    row.redoExact = row.redo === row.after;
    report.rows.push(row);
    console.log(c.id, row.literalExact, row.errors);
  }
  report.status = 'completed';
} catch (e) {
  report.status = 'failed';
  report.error = String(e);
  process.exitCode = 1;
} finally {
  await fs.writeFile('docs/evaluations/2026-10-04-word-cross-paragraph-insertion.json', JSON.stringify(report, null, 2) + '\n');
  await context.close();
}
