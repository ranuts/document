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
    scope:
      'Current preview isolation headers, warm Chromium GPU model. Real Excel IM B2 write with seeded 3x3 neighbors including a two-step dependent formula chain, native Undo/Redo, Save and actual file chooser reopen. No header injection; no complete workbook or physical device certification.',
    results: [],
    errors: [],
  };
page.on('pageerror', (e) => report.errors.push(e.message));
report.console = [];
report.dialogs = [];
page.on('console', (message) => {
  if (['error', 'warning'].includes(message.type())) report.console.push({ type: message.type(), text: message.text() });
});
page.on('dialog', async (dialog) => {
  report.dialogs.push({ type: dialog.type(), message: dialog.message() });
  await dialog.dismiss();
});
await page.addInitScript(() => {
  window.__saveEvents = [];
  window.addEventListener('message', (event) => {
    const data = event.data;
    if (data && typeof data === 'object') window.__saveEvents.push({ type: data.type, event: data.event, keys: Object.keys(data) });
  });
});
const body = () => page.frameLocator('#app iframe').locator('body');
const snapshot = (type) =>
  body().evaluate((_el, type) => {
    const a = window.editor ?? window.Asc.editor;
    if (type === 'docx') return a.WordControl.m_oLogicDocument.GetText();
    if (type === 'xlsx') {
      const sheet = a.wb.getWorksheet().model;
      return Array.from({ length: 3 }, (_, r) => Array.from({ length: 3 }, (_, c) => {
        const cell = sheet.getRange3(r, c, r, c);
        return { value: cell.getValue(), formula: cell.getFormula() };
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
  for (const type of ['xlsx']) {
    await page.goto('http://127.0.0.1:5193/editor?new=' + type + '&agent=1&locale=en');
    await page.frameLocator('#app iframe').locator('.agent-sidebar-entry').click({ timeout: 60000 });
    await page.waitForFunction(
      () => document.querySelector('.agent-panel-note')?.textContent?.includes('Model loaded'),
      {},
      { timeout: 180000 },
    );
    for (const [address, value] of Object.entries({
      A1: '邻居 四季', B1: '17', C1: '=B1*2',
      A2: '日本 ä', B2: '5', C2: '=B2*3',
      A3: '91', B3: '=A3+1', C3: '=C2+1',
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
    report.results.push(row);
    if (!row.isolated || !row.iframeIsolated || !row.engine.includes('WebGPU'))
      throw Error('Isolation or GPU unavailable');
    await page.locator('.agent-writing-task').selectOption('tools');
    const prompt =
      type === 'docx'
        ? 'Insert the exact text IM_WORD_四季_日本_ä_2026 at the cursor.'
        : type === 'xlsx'
          ? 'Set cell B2 to the numeric value 7.'
          : 'Add a new text box on the current slide with the exact text IM_PPT_四季_日本_ä_2026.';
    await page.locator('.cui-input').fill(prompt);
    await page.locator('.cui-input').press('Enter');
    await page.waitForFunction(() => !document.querySelector('.cui-input').disabled, {}, { timeout: 120000 });
    row.after = await snapshot(type);
    const expectedAfter = structuredClone(row.before);
    expectedAfter[1][1].value = '7';
    expectedAfter[1][2].value = '21';
    expectedAfter[2][2].value = '22';
    row.expectedAfter = expectedAfter;
    row.dependenciesExact = JSON.stringify(row.after) === JSON.stringify(expectedAfter);
    if (!row.dependenciesExact) throw Error('Dependent formula result or surrounding cell mismatch');
    row.visibleErrors = await page.locator('.cui-msg-error').allTextContents();
    row.previewCount = await page.locator('.agent-plan-preview').count();
    if (row.visibleErrors.length || row.previewCount) throw Error('IM edit failed');
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
    row.saveButtonBefore = await body().locator('#slot-btn-dt-save button').evaluate((el) => ({
      disabled: el.disabled, title: el.title, text: el.textContent, html: el.outerHTML,
    }));
    console.log(type + ' native Save');
    const downloadPromise = page.waitForEvent('download', { timeout: 120000 });
    await body().locator('#slot-btn-dt-save button').click();
    await page.waitForTimeout(1000);
    row.saveUI = await body().evaluate(() => ({
      dialogs: Array.from(document.querySelectorAll('.modal, [role=dialog]')).filter((el) => el.getBoundingClientRect().width).map((el) => el.innerText),
      active: document.activeElement?.outerHTML,
    }));
    row.parentSaveUI = await page.locator('body').innerText();
    await page.screenshot({ path: '.scratch/ai-csp/excel-dependent-formulas-im.png' });
    const download = await downloadPromise;
    const artifactPath = '.scratch/ai-csp/excel-dependent-formulas-im-saved.' + type;
    await download.saveAs(artifactPath);
    row.nativeSave = {
      artifactPath,
      sha256: sha(await fs.readFile(artifactPath)),
      bytes: (await fs.stat(artifactPath)).size,
      failure: await download.failure(),
    };
    if (!row.nativeSave.bytes || row.nativeSave.failure) throw Error('Native Save failed');
    await page.goto('http://127.0.0.1:5193/');
    const chooser = page.waitForEvent('filechooser');
    await page.locator('#hero-open').click();
    await (await chooser).setFiles(artifactPath);
    await page.waitForFunction(
      () => {
        const a =
          document.querySelector('#app iframe')?.contentWindow?.editor ??
          document.querySelector('#app iframe')?.contentWindow?.Asc?.editor;
        return a?.isDocumentLoadComplete && a?.isLoadFullApi;
      },
      {},
      { timeout: 120000 },
    );
    row.reopened = await snapshot(type);
    row.reopenExact = JSON.stringify(row.reopened) === JSON.stringify(row.after);
    if (!row.reopenExact) throw Error('Saved document reopened differently');
    console.log(JSON.stringify(row));
  }
  report.passed = report.results.length === 1 && !report.errors.length;
} catch (e) {
  report.passed = false;
  report.error = String(e);
  report.visibleErrors = await page
    .locator('.cui-msg-error')
    .allTextContents()
    .catch(() => []);
} finally {
  report.saveEvents = await page.evaluate(() => window.__saveEvents).catch(() => []);
  await fs.writeFile(
    'docs/evaluations/2026-10-04-excel-dependent-formulas-im.json',
    JSON.stringify(report, null, 2) + '\n',
  );
  await context.close();
  if (!report.passed) process.exitCode = 1;
}
