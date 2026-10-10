import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const origin = 'http://127.0.0.1:5193';
const modelId = process.env.WORKER_CSP_MODEL || 'Qwen3-1.7B-q4f16_1-MLC';
const reportPath =
  process.env.WORKER_CSP_REPORT ||
  'docs/evaluations/2026-10-03-gpu-worker-csp' + (process.env.WORKER_CSP_BASELINE === '1' ? '-baseline' : '') + '.json';
const sha = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const baseline = process.env.WORKER_CSP_BASELINE === '1';
const hostedPort = process.env.WORKER_CSP_HOST_PORT;
if (hostedPort && baseline) throw Error('Hosted probe cannot disable the actual policy');
const policy =
  "default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self' https: http: blob:; worker-src 'self' blob:";
const report = {
  scope:
    'Actual cached selected WebGPU initialization/chat under injected Worker response CSP, with normal-execution Worker eval and foreign module controls. No shipped policy, CPU/iframe, fresh download, offline or general security claim.',
  policy,
  modelId,
  hostedPort: hostedPort ?? null,
  workerResponses: [],
  baseline,
  foreignModuleRequests: 0,
  status: 'running',
  consoleErrors: [],
  errors: [],
};
const c = await chromium.launchPersistentContext('.scratch/ai-csp/gpu-profile', {
  serviceWorkers: 'block',
  args: ['--enable-unsafe-webgpu', '--use-angle=metal'],
  viewport: { width: 1280, height: 900 },
});
await c.addInitScript((modelId) => {
  if (location.origin === 'http://127.0.0.1:5193') localStorage.setItem('agent-local-model-id', modelId);
  window.__contextErrors = [];
  const Original = window.Worker;
  window.Worker = class extends Original {
    constructor(...args) {
      super(...args);
      this.addEventListener('message', (event) => {
        if (event.data?.kind === 'throw') window.__contextErrors.push(String(event.data.content).slice(0, 1600));
      });
    }
  };
}, modelId);
await c.route('https://worker-csp-probe.invalid/probe.js', async (route) => {
  report.foreignModuleRequests++;
  await route.fulfill({
    status: 200,
    headers: {
      'content-type': 'text/javascript',
      'access-control-allow-origin': '*',
      'cross-origin-resource-policy': 'cross-origin',
    },
    body: 'export default 42;',
  });
});
const controlsSource = `
setTimeout(async () => {
 const controls = {};
 try { controls.eval = {value:eval('1+1'),blocked:false}; } catch(e) { controls.eval={blocked:true,name:e.name,message:e.message}; }
 try { const m=await import('https://worker-csp-probe.invalid/probe.js');controls.foreign={value:m.default,blocked:false}; } catch(e) { controls.foreign={blocked:true,name:e.name,message:e.message}; }
 controls.isolated=crossOriginIsolated;
 controls.policyFingerprint=self.__localModelWorkerCsp??null;
 self.__workerCspControls=controls;
},0);
`;
await c.route(origin + '/**', async (route) => {
  const isWorker = /\/assets\/webllm\.worker-[^/]+\.js$/.test(new URL(route.request().url()).pathname);
  const response = await route.fetch(
    isWorker && hostedPort ? { url: 'http://127.0.0.1:' + hostedPort + new URL(route.request().url()).pathname } : {},
  );
  const deliveredPolicy = response.headers()['content-security-policy'];
  if (isWorker && hostedPort && deliveredPolicy !== policy) throw Error('Actual host CSP mismatch: ' + deliveredPolicy);
  const original = isWorker ? await response.text() : undefined;
  if (isWorker)
    report.workerResponses.push({
      url: route.request().url(),
      policy: baseline ? null : policy,
      upstreamPolicy: deliveredPolicy ?? null,
      originalSHA256: sha(original),
      diagnosticSHA256: sha(original + controlsSource),
    });
  const headers = { ...response.headers() };
  delete headers['content-length'];
  await route.fulfill({
    response,
    ...(isWorker ? { body: original + controlsSource } : {}),
    headers: {
      ...headers,
      ...(isWorker && !baseline && !hostedPort ? { 'content-security-policy': policy } : {}),
      'cross-origin-opener-policy': 'same-origin',
      'cross-origin-embedder-policy': 'require-corp',
    },
  });
});
const p = c.pages()[0] ?? (await c.newPage());
p.on('pageerror', (e) => report.errors.push(e.message));
p.on('console', (m) => {
  if (m.type() === 'error') report.consoleErrors.push(m.text().slice(0, 1600));
});
const body = () => p.frameLocator('#app iframe').locator('body');
try {
  await p.goto(origin + '/');
  await p.evaluate(async () => {
    await Promise.all((await navigator.serviceWorker.getRegistrations()).map((r) => r.unregister()));
  });
  await p.goto('about:blank');
  await p.goto(origin + '/editor?new=docx&agent=1&locale=en');
  await body().locator('.agent-sidebar-entry').click({ timeout: 90000 });
  await p.waitForFunction(
    () => document.querySelector('.agent-panel-note')?.textContent?.includes('Model loaded'),
    null,
    { timeout: 180000 },
  );
  report.engine = await p.locator('.agent-model-status').textContent();
  if (!report.engine.includes('WebGPU') || !report.engine.includes(modelId)) throw Error('Unexpected model');
  const worker = p.workers().find((w) => /webllm\.worker-/.test(w.url()));
  if (!worker || report.workerResponses.length !== 1) throw Error('Missing actual policy Worker');
  report.workerControls = await worker.evaluate(() => self.__workerCspControls);
  if (!report.workerControls) throw Error('Missing normal-execution controls');
  if (hostedPort && report.workerControls.policyFingerprint !== policy)
    throw Error('Worker body does not fingerprint its response policy');
  await p.locator('.agent-writing-task').selectOption('chat');
  await p.locator('.cui-input').fill('Please reply with only hello.');
  await p.locator('.cui-input').press('Enter');
  await p.waitForFunction(() => !document.querySelector('.cui-input')?.disabled, null, { timeout: 90000 });
  report.nextReply = await p.locator('.cui-msg-agent').last().getAttribute('data-source');
  report.errorCountAfterRecovery = await p.locator('.cui-msg-error').count();
  if (
    !report.nextReply?.trim() ||
    report.errorCountAfterRecovery ||
    report.workerControls.eval.blocked === baseline ||
    report.workerControls.foreign.blocked === baseline ||
    report.foreignModuleRequests !== (baseline ? 1 : 0)
  )
    throw Error('Inference or negative controls failed');
  report.status = 'completed';
} catch (e) {
  report.status = 'failed';
  report.error = String(e);
  process.exitCode = 1;
} finally {
  report.probeSHA256 = sha(await fs.readFile(new URL(import.meta.url)));
  if (report.workerResponses.length === 1) {
    const pathname = new URL(report.workerResponses[0].url).pathname;
    report.workerBytesUnchanged =
      sha(await fs.readFile('dist' + pathname)) === report.workerResponses[0].originalSHA256;
    if (!report.workerBytesUnchanged) {
      report.status = 'failed';
      process.exitCode = 1;
    }
  }
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
  await c.unrouteAll({ behavior: 'wait' });
  await c.close();
}
