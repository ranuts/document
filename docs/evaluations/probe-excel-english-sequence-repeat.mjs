import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const sha = (data) => crypto.createHash('sha256').update(data).digest('hex');
const probeSHA256 = sha(await fs.readFile(new URL(import.meta.url)));
const markers = { docx: 'IM_WORD_四季_日本_ä_2026', xlsx: 'IM_CELL_四季_日本_ä_2026', pptx: 'IM_PPT_四季_日本_ä_2026' };
const context = await chromium.launchPersistentContext('.scratch/ai-csp/gpu-profile', {
  args: ['--enable-unsafe-webgpu', '--use-angle=metal'],
  serviceWorkers: 'block',
  viewport: { width: 1280, height: 900 },
});
await context.addInitScript(() => {
  Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true });
  if (location.origin === 'http://127.0.0.1:5193')
    localStorage.setItem('agent-local-model-id', 'Qwen3-1.7B-q4f16_1-MLC');
});
const page = context.pages()[0] ?? (await context.newPage()),
  report = {
    probeSHA256,
    markers,
    sources: Object.fromEntries(await Promise.all(['lib/agent-plugin/document-tool-sequence.ts','lib/agent-plugin/office-tools.ts'].map(async path => [path, sha(await fs.readFile(path))]))),
    scope:
      'Current production preview, warm GPU model readiness. Real deterministic English IM read A1:C3 then text write B2, seeded neighbors and formulas, native Undo/Redo, Save and file chooser reopen. No model-output substitution; no general instruction-quality certification.',
    results: [],
    errors: [],
  };
page.on('pageerror', (e) => report.errors.push(e.message));
const body = () => page.frameLocator('#app iframe').locator('body');
const snapshot = (type) =>
  body().evaluate((_el, type) => {
    const a = window.editor ?? window.Asc.editor;
    if (type === 'docx') return a.WordControl.m_oLogicDocument.GetText();
    if (type === 'xlsx') {
      const sheet = a.wb.getWorksheet().model;
      return Array.from({ length: 3 }, (_, r) => Array.from({ length: 3 }, (_, c) => {
        const cell = sheet.getRange3(r, c, r, c);
        return { value: cell.getValue(), formula: cell.getFormula(), format: cell.getNumFormat().sFormat };
      }));
    }
    return a.WordControl.m_oLogicDocument.Slides.map((s) => s.cSld.spTree.map((sh) => sh.getText?.() ?? ''));
  }, type);
try {
  await page.goto('http://127.0.0.1:5193/');
  await page.evaluate(async () => {
    await Promise.all((await navigator.serviceWorker.getRegistrations()).map((r) => r.unregister()));
  });
  await page.goto('about:blank');
  for (const type of Array(6).fill('xlsx')) {
    await page.goto('http://127.0.0.1:5193/editor?new=' + type + '&agent=1&locale=en');
    await page.frameLocator('#app iframe').locator('.agent-sidebar-entry').click({ timeout: 60000 });
    await page.waitForFunction(
      () => document.querySelector('.agent-panel-note')?.textContent?.includes('Model loaded'),
      {},
      { timeout: 180000 },
    );
    for (const [address, value] of Object.entries({
      A1: '邻居 四季', B1: '17', C1: '=B1*2',
      A2: '日本 ä', B2: 'Original target', C2: 'Keep right',
      A3: '91', B3: '=A3+1', C3: 'Unchanged END',
    })) {
      await body().evaluate((_el, { address, value }) => {
        const a = window.editor ?? window.Asc.editor;
        a.asc_findCell(address);
        a.pluginMethod_PasteText(value);
      }, { address, value });
      await page.waitForTimeout(200);
    }
    const row = {
      type,
      engine: await page.locator('.agent-model-status').textContent(),
      isolated: await page.evaluate(() => crossOriginIsolated),
      iframeIsolated: await body().evaluate(() => crossOriginIsolated),
      before: await snapshot(type),
    };
    if (!row.isolated || !row.iframeIsolated || !row.engine.includes('WebGPU'))
      throw Error('Isolation or GPU unavailable');
    await page.locator('.agent-writing-task').selectOption('tools');
    const prompt = 'Read A1:C3, then set B2 to \"00123\".';
    await page.evaluate(() => { window.__errors = []; const NativeError = window.Error; window.Error = new Proxy(NativeError, {construct(target,args,newTarget) { const error = Reflect.construct(target,args,newTarget); window.__errors.push({message:error.message,stack:error.stack}); return error; }}); });
    await page.locator('.cui-input').fill(prompt);
    await page.locator('.cui-input').press('Enter');
    await page.waitForFunction(() => !document.querySelector('.cui-input').disabled, {}, { timeout: 120000 });
    report.results.push(row);
    row.rawErrors = await page.evaluate(() => window.__errors);
    row.prompt = prompt;
    row.after = await snapshot(type);
    row.activities = await page.locator('.cui-activity').allTextContents();
    row.readVisible = row.activities.some(text => text.includes('A1:C3') && text.includes('B2: \"Original target\"'));
    row.currentPlugin = await page.evaluate(() => performance.getEntriesByType('resource').map(entry => entry.name).find(name => /agent-plugin-.*\.js/.test(name)));
    row.reply = await page.locator('.cui-msg').allTextContents();
    row.success = row.after[1][1].value === '00123' && !row.after[1][1].formula;
    if (!row.success) { console.log(JSON.stringify(row)); continue; }
    row.neighborsExact = row.before.every((cells, r) => cells.every((cell, c) =>
      (r === 1 && c === 1) || JSON.stringify(cell) === JSON.stringify(row.after[r][c])));
    if (!row.neighborsExact) throw Error('A neighboring value or formula changed');
    row.visibleErrors = await page.locator('.cui-msg-error').allTextContents();
    row.previewCount = await page.locator('.agent-plan-preview').count();
    if (
      row.after[1][1].value !== '00123' ||
      row.visibleErrors.length ||
      row.previewCount
    )
      throw Error('IM edit failed');
    await body().evaluate((_el, type) => {
      const a = window.editor ?? window.Asc.editor;
      if (type === 'xlsx') a.asc_Undo();
      else a.Undo();
    }, type);
    await page.waitForTimeout(300);
    row.afterUndo = await snapshot(type);
    await body().evaluate((_el, type) => {
      const a = window.editor ?? window.Asc.editor;
      if (type === 'xlsx') a.asc_Redo();
      else a.Redo();
    }, type);
    await page.waitForTimeout(300);
    row.afterRedo = await snapshot(type);
    row.undoExact = JSON.stringify(row.afterUndo) === JSON.stringify(row.before);
    row.redoExact = JSON.stringify(row.afterRedo) === JSON.stringify(row.after);
    if (!row.undoExact || !row.redoExact) throw Error('Native history mismatch');
    console.log(JSON.stringify(row));
  }
  report.passed = report.results.length === 6 && report.results.every(row => row.success && row.readVisible) && !report.errors.length;
} catch (e) {
  report.passed = false;
  report.error = String(e);
  report.visibleErrors = await page
    .locator('.cui-msg-error')
    .allTextContents()
    .catch(() => []);
} finally {
  await fs.writeFile(
    '.scratch/excel-english-sequence-repeat.json',
    JSON.stringify(report, null, 2) + '\n',
  );
  await context.close();
  if (!report.passed) process.exitCode = 1;
}
