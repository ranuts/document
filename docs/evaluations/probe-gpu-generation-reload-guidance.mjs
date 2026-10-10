import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';

const sha = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const report = {
  scope:
    'Controlled uncaught exception inside a real loaded GPU Worker during streaming; not physical device loss or OOM. Warm profile, network available, native Word chat only.',
  probeSHA256: sha(await fs.readFile(new URL(import.meta.url))),
  status: 'running',
  errors: [],
  workerEvents: [],
};
const context = await chromium.launchPersistentContext('.scratch/ai-csp/gpu-profile', {
  serviceWorkers: 'block',
  viewport: { width: 1280, height: 900 },
  args: ['--enable-unsafe-webgpu', '--use-angle=metal'],
});
await context.addInitScript(() => {
  localStorage.setItem('agent-panel-provider', 'webllm');
  localStorage.setItem('agent-local-model-id', 'Qwen3-1.7B-q4f16_1-MLC');
  window.__generationProbe = { constructed: 0, terminated: 0, cpu: 0, requests: [] };
  const Original = window.Worker;
  window.Worker = class extends Original {
    constructor(url, options) {
      super(url, options);
      this.target = String(url).includes('webllm.worker');
      if (String(url).startsWith('blob:')) window.__generationProbe.cpu++;
      if (this.target) {
        window.__generationProbe.constructed++;
        window.__generationProbe.worker = this;
      }
    }
    postMessage(message, ...rest) {
      if (this.target && String(message?.kind).startsWith('chatCompletion'))
        window.__generationProbe.requests.push(message.kind);
      return super.postMessage(message, ...rest);
    }
    terminate() {
      if (this.target) window.__generationProbe.terminated++;
      super.terminate();
    }
  };
});
await context.route('**/assets/webllm.worker-*.js', async (route) => {
  const response = await route.fetch();
  const original = await response.text();
  report.workerSHA256 = sha(original);
  const injected =
    original +
    '\nself.addEventListener("message",event=>{if(event.data?.kind==="local-test-crash")throw new Error("Controlled generation Worker failure");});';
  report.injectedWorkerSHA256 = sha(injected);
  await route.fulfill({ response, body: injected });
});
const page = context.pages()[0] ?? (await context.newPage());
page.on('pageerror', (error) => report.errors.push(error.message));
page.on('worker', (worker) => {
  report.workerEvents.push({ event: 'created', url: worker.url() });
  worker.on('close', () => report.workerEvents.push({ event: 'closed', url: worker.url() }));
});
const state = () =>
  page.evaluate(() => ({
    constructed: window.__generationProbe.constructed,
    terminated: window.__generationProbe.terminated,
    cpu: window.__generationProbe.cpu,
    requests: [...window.__generationProbe.requests],
  }));
try {
  await page.goto('http://127.0.0.1:5193/editor?new=docx&agent=1&locale=en');
  await page.frameLocator('#app iframe').locator('.agent-sidebar-entry').click({ timeout: 60000 });
  await page.waitForFunction(
    () => document.querySelector('.agent-panel-note')?.textContent?.includes('Model loaded'),
    {},
    { timeout: 180000 },
  );
  report.engine = await page.locator('.agent-model-status').textContent();
  if (!report.engine.includes('WebGPU')) throw Error('GPU not loaded');
  const body = page.frameLocator('#app iframe').locator('body');
  const text = () => body.evaluate(() => (window.editor ?? window.Asc.editor).WordControl.m_oLogicDocument.GetText());
  report.before = await text();
  await page.locator('.agent-writing-task').selectOption('chat');
  await page.locator('.cui-input').fill('Write a detailed 1000 word essay about astronomy.');
  await page.locator('.cui-input').press('Enter');
  await page.waitForFunction(
    () =>
      document.querySelector('.cui-msg-agent')?.textContent?.length > 80 &&
      document.querySelector('.cui-input')?.disabled,
    {},
    { timeout: 60000 },
  );
  report.beforeFailure = await state();
  await page.evaluate(() => window.__generationProbe.worker.postMessage({ kind: 'local-test-crash' }));
  await page.waitForFunction(
    () => !document.querySelector('.cui-input')?.disabled && document.querySelector('.cui-msg-error'),
    {},
    { timeout: 20000 },
  );
  report.afterFailure = await state();
  report.visibleErrors = await page.locator('.cui-msg-error').allTextContents();
  if (
    report.visibleErrors.length !== 1 ||
    !report.visibleErrors[0].includes('Reload the model in settings, then try your request again.')
  )
    throw Error('Reload guidance missing');
  await page.waitForTimeout(1000);
  report.afterWait = await state();
  report.after = await text();
  if (
    report.after !== report.before ||
    report.afterWait.cpu ||
    report.afterWait.constructed !== report.beforeFailure.constructed ||
    report.afterWait.terminated < 1 ||
    report.afterWait.requests.length !== report.beforeFailure.requests.length
  )
    throw Error('Failure preservation/no replay invariant failed');
  if (report.visibleErrors.some((text) => text.includes('Controlled generation')))
    throw Error('Internal exception exposed');
  await page.locator('.agent-panel-settings-toggle').click();
  await page.locator('.agent-panel-load').click();
  await page.waitForFunction(
    () => document.querySelector('.agent-panel-note')?.textContent?.includes('Model loaded'),
    {},
    { timeout: 180000 },
  );
  const count = await page.locator('.cui-msg-agent').count();
  await page.locator('.cui-input').fill('Please reply with only hello.');
  await page.locator('.cui-input').press('Enter');
  await page.waitForFunction(() => !document.querySelector('.cui-input')?.disabled, {}, { timeout: 60000 });
  report.reply = await page.locator('.cui-msg-agent').nth(count).getAttribute('data-source');
  report.afterRetry = await state();
  report.retryDocument = await text();
  if (
    !/hello/i.test(report.reply ?? '') ||
    report.retryDocument !== report.before ||
    report.afterRetry.cpu ||
    report.afterRetry.constructed !== report.beforeFailure.constructed + 1
  )
    throw Error('Explicit GPU reload/retry failed');
  report.status = 'passed';
} catch (error) {
  report.status = 'failed';
  report.error = String(error);
  process.exitCode = 1;
} finally {
  await fs.writeFile(
    'docs/evaluations/2026-10-04-gpu-generation-reload-guidance.json',
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(report.status, report.error ?? '');
  await context.close();
}
