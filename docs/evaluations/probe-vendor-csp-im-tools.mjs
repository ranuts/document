import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
const context = await chromium.launchPersistentContext('.scratch/ai-csp/gpu-profile', {
  args: ['--enable-unsafe-webgpu', '--use-angle=metal'],
  serviceWorkers: 'block',
  viewport: { width: 1440, height: 960 },
});
await context.addInitScript(() => {
  if (location.origin !== 'http://127.0.0.1:5193') return;
  localStorage.setItem('agent-local-model-id', 'Qwen3-1.7B-q4f16_1-MLC');
  Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true });
});
const entries = [];
await context.route(/\/web-apps\/apps\/[^/]+\/main\/index\.html(?:\?.*)?$/, async (route) => {
  const response = await route.fetch();
  let body = await response.text();
  const original = body;
  body = body.replace(/media="print" onload="this.media='all'"/g, 'media="all"');
  const hashes = [...body.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter((m) => !/\bsrc\s*=/i.test(m[1]) && m[2].trim())
    .map((m) => `'sha256-${createHash('sha256').update(m[2]).digest('base64')}'`);
  const policy = `default-src 'self'; script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval' ${hashes.join(' ')}; script-src-attr 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data: blob:; worker-src 'self' blob:; frame-src 'self' blob:; connect-src 'self' https: http: blob:; object-src 'none'; base-uri 'self'`;
  entries.push({ url: route.request().url(), stylesheetHandlerRemoved: body !== original, policy });
  await route.fulfill({ response, body, headers: { ...response.headers(), 'content-security-policy': policy } });
});
const page = context.pages()[0] ?? (await context.newPage());
const responses = [];
page.on('response', (r) => {
  if (r.url().includes('/main/index.html'))
    responses.push({
      url: r.url(),
      fromServiceWorker: r.fromServiceWorker(),
      policy: r.headers()['content-security-policy'] ?? null,
    });
});
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const report = {
  scope:
    'Actual IM planning with cached Qwen3-1.7B Metal GPU, response-local vendor CSP and static stylesheet edit, native Undo/Redo/Save/reopen. Service workers blocked; no offline or deployed-policy claim.',
  rows: [],
  entries,
  responses,
  errors,
  passed: false,
};
const body = () => page.frameLocator('#app iframe').locator('body');
const ready = () =>
  page.waitForFunction(
    () => {
      const w = document.querySelector('#app iframe')?.contentWindow;
      const a = w?.editor ?? w?.Asc?.editor;
      return a?.isDocumentLoadComplete && a?.isLoadFullApi && !a.isLongAction?.();
    },
    null,
    { timeout: 120000 },
  );
const read = (kind) =>
  body().evaluate((_el, kind) => {
    const a = window.editor ?? window.Asc.editor;
    if (kind === 'docx') return a.WordControl.m_oLogicDocument.GetText();
    if (kind === 'xlsx') return a.wb.getWorksheet().model.getRange3(0, 0, 0, 0).getValue();
    return a.WordControl.m_oLogicDocument.Slides.length;
  }, kind);
try {
  await page.goto('http://127.0.0.1:5193/');
  report.removedRegistrations = await page.evaluate(async () => {
    const registrations = await navigator.serviceWorker.getRegistrations();
    return Promise.all(registrations.map(async (r) => ({ scope: r.scope, removed: await r.unregister() })));
  });
  await page.goto('about:blank');
  for (const [kind, prompt] of [
    ['docx', 'Insert exactly the text Hello tools at the current cursor.'],
    ['xlsx', 'Write the plain value Hello tools to cell A1.'],
    ['pptx', 'Add one new slide using the current layout.'],
  ]) {
    await page.goto(`http://127.0.0.1:5193/editor?new=${kind}&agent=1&locale=en`);
    await ready();
    await page.frameLocator('#app iframe').locator('.agent-sidebar-entry').click({ timeout: 60000 });
    await page.waitForFunction(
      () => document.querySelector('.agent-panel-note')?.textContent?.includes('Model loaded'),
      null,
      { timeout: 240000 },
    );
    const row = {
      kind,
      prompt,
      before: await read(kind),
      engine: await page.locator('.agent-model-status').textContent(),
    };
    report.rows.push(row);
    row.frameUrl = await body().evaluate(() => location.href);
    row.candidateEntry = entries.findLast((e) => new URL(e.url).pathname === new URL(row.frameUrl).pathname);
    if (!row.candidateEntry) throw Error('Missing actual vendor CSP interception');
    if (!row.engine.includes('WebGPU')) throw Error('Unexpected CPU fallback');
    await page.locator('.agent-writing-task').selectOption('tools');
    const input = page.locator('.cui-input');
    await input.fill(prompt);
    await input.press('Enter');
    await page.waitForFunction(() => !document.querySelector('.cui-input')?.disabled, null, { timeout: 150000 });
    row.after = await read(kind);
    row.visibleErrors = await page.locator('.cui-msg-error').allTextContents();
    row.feedback = await page.locator('.cui-activity').allTextContents();
    row.previewCount = await page.locator('.agent-plan-preview').count();
    if (
      row.visibleErrors.length ||
      row.previewCount ||
      (kind === 'pptx' ? row.after !== row.before + 1 : !row.after.includes('Hello tools'))
    )
      throw Error('IM operation failed');
    await body().evaluate((_el, kind) => {
      const a = window.editor ?? window.Asc.editor;
      if (kind === 'xlsx') a.asc_Undo();
      else a.Undo();
    }, kind);
    await page.waitForTimeout(300);
    row.afterUndo = await read(kind);
    if (row.afterUndo !== row.before) throw Error('Undo mismatch');
    await body().evaluate((_el, kind) => {
      const a = window.editor ?? window.Asc.editor;
      if (kind === 'xlsx') a.asc_Redo();
      else a.Redo();
    }, kind);
    await page.waitForTimeout(300);
    row.afterRedo = await read(kind);
    if (row.afterRedo !== row.after) throw Error('Redo mismatch');
    const downloadPromise = page.waitForEvent('download', { timeout: 120000 });
    downloadPromise.catch(() => {});
    await page.frameLocator('#app iframe').locator('#slot-btn-dt-save button').click();
    const download = await downloadPromise;
    const artifact = '.scratch/ai-csp/vendor-im-native.' + kind;
    await download.saveAs(artifact);
    row.nativeSave = { bytes: (await fs.stat(artifact)).size, failure: await download.failure() };
    if (!row.nativeSave.bytes || row.nativeSave.failure) throw Error('Native Save failed');
    await page.goto('http://127.0.0.1:5193/');
    const chooser = page.waitForEvent('filechooser');
    await page.locator('#hero-open').click();
    await (await chooser).setFiles(artifact);
    await ready();
    row.reopened = await read(kind);
    if (row.reopened !== row.after) throw Error('Reopen mismatch');
    row.status = 'completed';
    console.log(kind, row.status);
  }
  report.passed =
    report.rows.length === 3 &&
    !errors.length &&
    entries.length >= 6 &&
    responses.length >= 6 &&
    responses.every((x) => !x.fromServiceWorker && entries.some((e) => e.url === x.url && e.policy === x.policy)) &&
    entries.every((x) => x.stylesheetHandlerRemoved);
  if (!report.passed) throw Error('Incomplete integration evidence');
} catch (e) {
  report.error = String(e);
  process.exitCode = 1;
} finally {
  await fs.writeFile('docs/evaluations/2026-10-03-vendor-csp-im-tools.json', JSON.stringify(report, null, 2) + '\n');
  await context.close();
}
