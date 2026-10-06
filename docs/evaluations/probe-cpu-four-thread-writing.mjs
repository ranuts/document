import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
const file = process.env.CPU_WRITING_MODEL_FILE;
const port = Number(process.env.CPU_WRITING_PORT || 5194);
const profile = process.env.CPU_WRITING_PROFILE || '.scratch/ai-csp/cpu-qwen17-profile';
const reportPath = process.env.CPU_WRITING_REPORT || 'docs/evaluations/2026-10-03-cpu-qwen17-writing.json';
const origin = 'http://127.0.0.1:' + port;
const cases=[{id:'formal-zh',task:'rewrite',source:'嘿，Alex 会在 2026-10-08 付 1,250 EUR 哦！',instruction:'改写为正式书面中文，去掉口语表达，保留事实。'},{id:'formal-en',task:'rewrite',source:'Hey, Alex is gonna pay 1,250 EUR on 2026-10-08, okay?',instruction:'Rewrite in formal English. Remove colloquial language, preserving the facts.'},{id:'negation-summary',task:'summarize',source:'Alex proposed a payment of 1,250 EUR on 2026-10-08. The payment has NOT been approved.',instruction:'Keep the payment amount, proposed date and the fact that approval has not been granted.'}];

if (file) cases.push(
  { id: 'formal-negative', task: 'rewrite', source: "Alex hasn't approved the -1,250 EUR adjustment due on 2026-10-08.", instruction: 'Rewrite in formal English. Preserve the negative amount, date and lack of approval.' },
  { id: 'translate-en', task: 'translate', targetLanguage: 'en', source: 'Alex 尚未批准 2026-10-08 的 1,250 EUR 付款。', instruction: 'Translate into English, preserving the name, date, amount and lack of approval.' },
);
const context = await chromium.launchPersistentContext(profile, { serviceWorkers: 'block', viewport: { width: 1280, height: 900 } });
await context.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined, configurable: true }));
if (port === 5193) await context.route(origin + '/**', async route => {
  const response = await route.fetch();
  await route.fulfill({ response, headers: { ...response.headers(), 'cross-origin-opener-policy': 'same-origin', 'cross-origin-embedder-policy': 'require-corp' } });
});
const page = context.pages()[0] || await context.newPage();
const report = { experiment: process.env.CPU_WRITING_EXPERIMENT, date: new Date().toISOString(), scope: (process.env.CPU_WRITING_EXPERIMENT ? 'Experimental transformed model input and restored output; existing production validation and native writing path. ' : '') + 'Actual browser CPU selected-text writing with current production prompt, schema and fact guards; one loaded model reused for three distinct tasks. Candidate loaded through existing local GGUF file control. WebGPU disabled and Service Workers blocked for diagnostic response/runtime capture. No model default change, broad quality benchmark or mobile claim.', port, file, status: 'running', results: [], errors: [], leakage: [] };
page.on('pageerror', error => report.errors.push(error.message));
context.on('request', request => { if (cases.some(sample => (request.postData() || '').includes(sample.source) || decodeURI(request.url()).includes(sample.source))) report.leakage.push(request.url()); });
const save = () => fs.writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
try {
  await page.goto(origin + '/favicon.ico');
  report.cacheReset = await page.evaluate(async () => {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map(registration => registration.unregister()));
    let removed = 0;
    for (const name of await caches.keys()) {
      const cache = await caches.open(name);
      for (const request of await cache.keys()) {
        if (/\/assets\/(?:agent-plugin-|esm-)/.test(new URL(request.url).pathname)) {
          await cache.delete(request); removed++;
        }
      }
    }
    return { registrations: registrations.length, removed };
  });
  await page.goto('about:blank');
  await page.goto(origin + '/editor?new=docx&agent=1&locale=en');
  const body = page.frameLocator('#app iframe').locator('body');
  await body.locator('.agent-sidebar-entry').click({ timeout: 90000 });
  if (file) {
    await page.locator('.agent-panel-load-stop').click({ timeout: 30000 });
    await page.locator('.agent-panel-settings-toggle').click();
    await page.locator('.agent-panel-provider').evaluate(el => { el.value = 'wllama'; el.dispatchEvent(new Event('change', { bubbles: true })); });
    await page.locator('.agent-panel-gguf-files').setInputFiles(file);
    await page.locator('.agent-panel-gguf-load').click();
  }
  await page.waitForFunction(() => document.querySelector('.agent-panel-note')?.textContent?.includes('Model loaded'), null, { timeout: 240000 });
  if (file) await page.locator('.agent-panel-settings-toggle').click();
  const engine = await page.locator('.agent-model-status').textContent();
  if (!engine?.includes(file ? 'Qwen3-1.7B' : '0.6B')) throw Error('Unexpected CPU model: ' + engine);
  for (const sample of cases) {
    const selected = await body.evaluate((_el, source) => {
      const api = window.editor ?? window.Asc.editor;
      api.asc_EditSelectAll(); api.pluginMethod_PasteText(source); api.asc_EditSelectAll();
      return api.pluginMethod_GetSelectedText();
    }, sample.source);
    if (selected.replace(/\r\n$/, '') !== sample.source) throw Error('Source selection mismatch');
    const rawStart = await page.evaluate(() => (window.__writingRaw || []).length);
    const errorStart = await page.locator('.cui-msg-error').count();
    await page.locator('.agent-writing-task').selectOption(sample.task);
    if (sample.targetLanguage) await page.locator('.agent-writing-language').selectOption(sample.targetLanguage);
    const input = page.locator('.cui-input'); await input.fill(sample.instruction);
    const began = Date.now(); await input.press('Enter');
    await page.waitForFunction(() => !document.querySelector('.cui-input')?.disabled, null, { timeout: 240000 });
    const diagnostics = await page.evaluate(start => ({ raw: (window.__writingRaw || []).slice(start), runtime: window.__cpuRuntime, isolated: crossOriginIsolated }), rawStart);
    if (diagnostics.raw.length !== 1 || diagnostics.runtime?.threads !== 4 || !diagnostics.runtime?.multithread || !diagnostics.isolated) throw Error('Missing actual four-thread response evidence: ' + JSON.stringify(diagnostics));
    if (process.env.CPU_WRITING_EXPERIMENT && !diagnostics.raw[0]?.slots?.length) throw Error('Experimental input transformation did not execute');
    const after = await body.evaluate(() => { const api = window.editor ?? window.Asc.editor; api.asc_EditSelectAll(); return api.pluginMethod_GetSelectedText(); });
    const row = { ...sample, selected, engine, output: after, documentUnchanged: after === selected, responseMs: Date.now() - began, errors: (await page.locator('.cui-msg-error').allTextContents()).slice(errorStart), previewCount: await page.locator('.agent-plan-preview').count(), ...diagnostics };
    report.results.push(row); console.log(JSON.stringify(row)); await save();
  }
  report.status = 'completed';
} catch (error) { report.status = 'failed'; report.error = String(error); process.exitCode = 1; }
finally { await save(); await context.close(); }
