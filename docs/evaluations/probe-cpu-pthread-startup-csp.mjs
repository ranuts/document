import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
const origin = 'http://127.0.0.1:5193';
const channel = 'cpu-pthread-csp-probe';
const diagnostic = `\n(()=>{if(self.name!=='em-pthread')return;const result={url:location.href,name:self.name};try{result.eval={blocked:false,value:eval('1+1')}}catch(e){result.eval={blocked:true,name:e.name,message:e.message}}import('data:text/javascript,export default 42').then(m=>{result.module={blocked:false,value:m.default}},e=>{result.module={blocked:true,name:e.name,message:e.message}}).then(()=>{const channel=new BroadcastChannel('${channel}');channel.postMessage(result);channel.close()});})();\n`;
const report = {
  scope:
    'Throwaway startup instrumentation appended to JavaScript Blobs, executes only in em-pthread contexts, captures normal-execution CSP controls before blocking native work. Actual CPU SDK/model/native thread pool and reply remain real. No product/on-disk changes or uninstrumented-thread execution claim.',
  status: 'running',
  errors: [],
};
const c = await chromium.launchPersistentContext('.scratch/ai-offline/profile', {
  viewport: { width: 1280, height: 900 },
});
await c.addInitScript(
  ({ diagnostic, channel }) => {
    Object.defineProperty(navigator, 'gpu', { value: undefined, configurable: true });
    if (location.origin === 'http://127.0.0.1:5193') localStorage.setItem('agent-panel-provider', 'wllama');
    window.__pthreadControls = [];
    window.__blobDiagnostics = [];
    window.__controlChannel = new BroadcastChannel(channel);
    window.__controlChannel.onmessage = (e) => window.__pthreadControls.push(e.data);
    const OriginalBlob = Blob;
    window.Blob = class extends OriginalBlob {
      constructor(parts = [], options) {
        const instrument = options?.type === 'text/javascript';
        super(instrument ? [...parts, diagnostic] : parts, options);
        if (instrument)
          window.__blobDiagnostics.push({
            parts: parts.length,
            originalCharacters: parts.filter((p) => typeof p === 'string').reduce((n, p) => n + p.length, 0),
          });
      }
    };
  },
  { diagnostic, channel },
);
const p = c.pages()[0] ?? (await c.newPage());
p.on('pageerror', (e) => report.errors.push(e.message));
try {
  await p.goto(origin + '/editor?new=docx&agent=1&locale=en');
  await p.frameLocator('#app iframe').locator('.agent-sidebar-entry').click({ timeout: 90000 });
  await p.waitForFunction(
    () => document.querySelector('.agent-panel-note')?.textContent?.includes('Model loaded'),
    null,
    { timeout: 180000 },
  );
  report.engine = await p.locator('.agent-model-status').textContent();
  if (!report.engine.includes('CPU') || !report.engine.includes('0.6B')) throw Error('Unexpected model');
  await p.waitForFunction(() => window.__pthreadControls.length >= 4, null, { timeout: 20000 });
  report.controls = await p.evaluate(() => window.__pthreadControls);
  report.blobs = await p.evaluate(() => window.__blobDiagnostics);
  report.shell = await p.evaluate(() => ({
    isolated: crossOriginIsolated,
    csp: document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content,
  }));
  const session = await c.newCDPSession(p);
  const { targetInfos } = await session.send('Target.getTargets');
  await session.detach();
  report.threads = targetInfos
    .filter((t) => t.type === 'worker' && t.title === 'em-pthread')
    .map((t) => ({ url: t.url, title: t.title }));
  if (
    report.controls.length !== 4 ||
    report.threads.length !== 4 ||
    new Set(report.controls.map((r) => r.url)).size !== 4 ||
    report.controls.some(
      (r) =>
        !report.threads.some((t) => t.url === r.url) ||
        !r.eval.blocked ||
        r.eval.name !== 'EvalError' ||
        !r.module.blocked,
    )
  )
    throw Error('Thread controls incomplete');
  await p.locator('.cui-input').fill('Please reply with only hello.');
  await p.locator('.cui-input').press('Enter');
  await p.waitForFunction(() => !document.querySelector('.cui-input')?.disabled, null, { timeout: 120000 });
  report.reply = await p.locator('.cui-msg-agent').last().getAttribute('data-source');
  report.visibleErrors = await p.locator('.cui-msg-error').allTextContents();
  if (!report.reply?.trim() || report.visibleErrors.length || report.errors.length)
    throw Error('Native CPU inference failed');
  await c.route(origin + '/__pthread_baseline__.html', (r) =>
    r.fulfill({
      status: 200,
      contentType: 'text/html',
      headers: { 'cross-origin-opener-policy': 'same-origin', 'cross-origin-embedder-policy': 'require-corp' },
      body: '<!doctype html><title>Plain startup control</title>',
    }),
  );
  const plain = await c.newPage();
  await plain.goto(origin + '/__pthread_baseline__.html');
  report.baselineMeta = await plain.evaluate(
    () => document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content ?? null,
  );
  await plain.evaluate(() => {
    window.__baselineWorker = new Worker(
      URL.createObjectURL(new Blob(['self.onmessage=()=>{};'], { type: 'text/javascript' })),
      { type: 'module', name: 'em-pthread' },
    );
  });
  await plain.waitForFunction(
    () => window.__pthreadControls.some((r) => r.eval.value === 2 && r.module.value === 42),
    null,
    { timeout: 10000 },
  );
  report.baseline = await plain.evaluate(() => window.__pthreadControls);
  if (report.baselineMeta !== null) throw Error('Baseline CSP present');
  report.status = 'completed';
} catch (e) {
  report.status = 'failed';
  report.error = String(e);
  process.exitCode = 1;
} finally {
  await c.close();
  await fs.writeFile(
    'docs/evaluations/2026-10-03-cpu-pthread-startup-csp.json',
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(
    JSON.stringify({
      status: report.status,
      error: report.error,
      reply: report.reply,
      controls: report.controls?.length,
    }),
  );
}
