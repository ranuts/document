import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
const origin = 'http://127.0.0.1:5193';
const report = {
  scope:
    'Actual cached default CPU inference and CSP-respecting eval/data-module controls on the SDK main blob Worker. Current production HTML meta CSP, no injected policy or Worker bytes. Desktop Chromium; no physical-device/all-pthread/security-gate claim.',
  status: 'running',
  errors: [],
};
const c = await chromium.launchPersistentContext('.scratch/ai-offline/profile', {
  viewport: { width: 1280, height: 900 },
});
await c.addInitScript(() => {
  Object.defineProperty(navigator, 'gpu', { value: undefined, configurable: true });
  if (location.origin === 'http://127.0.0.1:5193') localStorage.setItem('agent-panel-provider', 'wllama');
  window.__workerCode = [];
  const original = URL.createObjectURL.bind(URL);
  URL.createObjectURL = (...args) => {
    const url = original(...args);
    const blob = args[0];
    if (blob instanceof Blob && blob.type.includes('javascript'))
      blob.text().then((code) =>
        window.__workerCode.push({
          url,
          length: code.length,
          mainLlama: code.includes('// Start the main llama.cpp') && code.includes('function wModuleInit'),
        }),
      );
    return url;
  };
});
const p = c.pages()[0] ?? (await c.newPage());
p.on('pageerror', (e) => report.errors.push(e.message));
async function workerControl(c, p, targetId, expression) {
  const session = await c.newCDPSession(p);
  const { sessionId } = await session.send('Target.attachToTarget', { targetId, flatten: false });
  try {
    return await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error('Worker eval control timeout')), 10000);
      const listener = (event) => {
        if (event.sessionId !== sessionId) return;
        const message = JSON.parse(event.message);
        if (message.id !== 1) return;
        clearTimeout(timer);
        session.off('Target.receivedMessageFromTarget', listener);
        if (message.error) reject(Error(JSON.stringify(message.error)));
        else resolve(message.result?.result?.value);
      };
      session.on('Target.receivedMessageFromTarget', listener);
      session
        .send('Target.sendMessageToTarget', {
          sessionId,
          message: JSON.stringify({
            id: 1,
            method: 'Runtime.evaluate',
            params: {
              expression,
              awaitPromise: true,
              returnByValue: true,
              allowUnsafeEvalBlockedByCSP: false,
            },
          }),
        })
        .catch(reject);
    });
  } finally {
    await session.send('Target.detachFromTarget', { sessionId });
    await session.detach();
  }
}

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
  report.shell = await p.evaluate(() => ({
    isolated: crossOriginIsolated,
    csp: document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content,
    code: window.__workerCode,
  }));
  const session = await c.newCDPSession(p);
  const { targetInfos } = await session.send('Target.getTargets');
  await session.detach();
  report.targets = targetInfos
    .filter((t) => t.type === 'worker' && t.url.startsWith('blob:' + origin + '/'))
    .map((t) => ({ targetId: t.targetId, url: t.url, title: t.title }));
  const source = report.shell.code.find((row) => row.mainLlama);
  const main = report.targets.find((t) => t.url === source?.url);
  if (!main) throw Error('Actual SDK main blob Worker not identified');
  report.mainWorker = main;
  report.evalControl = await workerControl(
    c,
    p,
    main.targetId,
    '(()=>{try{return {blocked:false,value:eval("1+1")}}catch(e){return {blocked:true,name:e.name,message:e.message}}})()',
  );
  report.moduleControl = await workerControl(
    c,
    p,
    main.targetId,
    'import("data:text/javascript,export default 42").then(m=>({blocked:false,value:m.default}),e=>({blocked:true,name:e.name,message:e.message}))',
  );
  if (!report.evalControl?.blocked || report.evalControl.name !== 'EvalError' || !report.moduleControl?.blocked)
    throw Error('CPU main Worker executable-code restrictions missing');
  await p.locator('.cui-input').fill('Please reply with only hello.');
  await p.locator('.cui-input').press('Enter');
  await p.waitForFunction(() => !document.querySelector('.cui-input')?.disabled, null, { timeout: 120000 });
  report.reply = await p.locator('.cui-msg-agent').last().getAttribute('data-source');
  report.visibleErrors = await p.locator('.cui-msg-error').allTextContents();
  if (!report.reply?.trim() || report.visibleErrors.length || report.errors.length)
    throw Error('Native CPU inference failed');
  await c.route(origin + '/__worker_csp_control__.html', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/html',
      headers: { 'cross-origin-opener-policy': 'same-origin', 'cross-origin-embedder-policy': 'require-corp' },
      body: '<!doctype html><title>Plain Worker control</title>',
    }),
  );
  const plain = await c.newPage();
  await plain.goto(origin + '/__worker_csp_control__.html');
  report.baselineMeta = await plain.evaluate(
    () => document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content ?? null,
  );
  const created = plain.waitForEvent('worker');
  const url = await plain.evaluate(() => {
    const url = URL.createObjectURL(new Blob(['self.onmessage=()=>{};'], { type: 'text/javascript' }));
    window.__baselineWorker = new Worker(url, { type: 'module' });
    return url;
  });
  const baselineWorker = await created;
  await baselineWorker.evaluate(() => typeof onmessage);
  const baselineSession = await c.newCDPSession(plain);
  const baselineTargets = await baselineSession.send('Target.getTargets');
  await baselineSession.detach();
  const baselineTarget = baselineTargets.targetInfos.find((t) => t.type === 'worker' && t.url === url);
  if (!baselineTarget) throw Error('Missing plain Worker control');
  report.baselineEval = await workerControl(
    c,
    plain,
    baselineTarget.targetId,
    '(()=>{try{return {blocked:false,value:eval("1+1")}}catch(e){return {blocked:true,name:e.name,message:e.message}}})()',
  );
  report.baselineModule = await workerControl(
    c,
    plain,
    baselineTarget.targetId,
    'import("data:text/javascript,export default 42").then(m=>({blocked:false,value:m.default}),e=>({blocked:true,name:e.name,message:e.message}))',
  );
  if (report.baselineMeta !== null || report.baselineEval?.value !== 2 || report.baselineModule?.value !== 42)
    throw Error('Positive controls did not execute');
  report.status = 'completed';
} catch (e) {
  report.status = 'failed';
  report.error = String(e);
  process.exitCode = 1;
} finally {
  await c.close();
  await fs.writeFile('docs/evaluations/2026-10-03-cpu-worker-csp.json', JSON.stringify(report, null, 2) + '\n');
  console.log(
    JSON.stringify({
      status: report.status,
      error: report.error,
      reply: report.reply,
      targets: report.targets?.length,
      evalControl: report.evalControl,
      moduleControl: report.moduleControl,
    }),
  );
}
