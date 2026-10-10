import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const origin = 'http://127.0.0.1:5193';
const profile = '.scratch/ai-csp/gpu-profile';
const policy =
  "default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self' https: http: blob:; worker-src 'self' blob:";
const assets = await fs.readdir('dist/assets');
const worker = assets.find((n) => /^webllm.worker-.*\.js$/.test(n));
const expectedSHA256 = crypto
  .createHash('sha256')
  .update(await fs.readFile('dist/assets/' + worker))
  .digest('hex');
const report = {
  scope:
    'Existing cached-model desktop Chromium profile warms current production shell and then closes all browser processes. New process starts offline with dead proxy; actual native default GPU inference, cached Worker CSP/body and explicit CDP CSP-respecting eval control. Not physical reboot, Safari, eviction or broad writing quality.',
  worker,
  expectedSHA256,
  status: 'running',
  errors: [],
};
const launch = (offline) =>
  chromium.launchPersistentContext(profile, {
    offline,
    viewport: { width: 1280, height: 900 },
    args: ['--enable-unsafe-webgpu', '--use-angle=metal', ...(offline ? ['--proxy-bypass-list=<-loopback>'] : [])],
    ...(offline ? { proxy: { server: 'http://127.0.0.1:9' } } : {}),
  });
async function setup(c) {
  await c.addInitScript(() => {
    if (location.origin === 'http://127.0.0.1:5193')
      localStorage.setItem('agent-local-model-id', 'Qwen3-1.7B-q4f16_1-MLC');
  });
  for (const p of c.pages()) await p.close();
  const p = await c.newPage();
  p.on('pageerror', (e) => report.errors.push(e.message));
  return p;
}
async function ready(p) {
  await p.frameLocator('#app iframe').locator('.agent-sidebar-entry').click({ timeout: 90000 });
  await p.waitForFunction(
    () => document.querySelector('.agent-panel-note')?.textContent?.includes('Model loaded'),
    null,
    { timeout: 180000 },
  );
}
async function cachesSnapshot(p) {
  return p.evaluate(async () => {
    const out = [];
    for (const name of await caches.keys()) {
      const c = await caches.open(name);
      for (const request of await c.keys())
        if (/\/assets\/webllm\.worker-[^/]+\.js$/.test(new URL(request.url).pathname)) {
          const response = await c.match(request);
          const bytes = await response.arrayBuffer();
          const digest = await crypto.subtle.digest('SHA-256', bytes);
          out.push({
            cache: name,
            url: request.url,
            csp: response.headers.get('content-security-policy'),
            sha256: Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join(''),
          });
        }
    }
    return out;
  });
}
async function evalControl(c, p, url) {
  const session = await c.newCDPSession(p);
  const targets = await session.send('Target.getTargets');
  const target = targets.targetInfos.find((t) => t.type === 'worker' && t.url === url);
  if (!target) throw Error('Missing actual native Worker target');
  const { sessionId } = await session.send('Target.attachToTarget', { targetId: target.targetId, flatten: false });
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
              expression:
                '(()=>{try{return {blocked:false,value:eval("1+1")}}catch(e){return {blocked:true,name:e.name,message:e.message}}})()',
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
let c;
try {
  c = await launch(false);
  let p = await setup(c);
  await c.route(origin + '/__cache_probe__.html', (r) =>
    r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Cache inspection</title>' }),
  );
  await p.goto(origin + '/__cache_probe__.html');
  report.before = await cachesSnapshot(p);
  await p.goto(origin + '/editor?new=docx&agent=1&locale=en');
  await ready(p);
  await p.evaluate(() => navigator.serviceWorker.ready);
  await p.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 90000 });
  report.warm = await cachesSnapshot(p);
  if (!report.warm.some((r) => r.url.endsWith('/assets/' + worker) && r.csp === policy && r.sha256 === expectedSHA256))
    throw Error('Current Worker CSP/body absent from warm cache');
  await c.close();
  c = undefined;
  c = await launch(true);
  await c.setOffline(true);
  p = await setup(c);
  await p.goto(origin + '/editor?new=docx&agent=1&locale=en');
  report.network = await p.evaluate(async () => {
    let rejected = false;
    try {
      await fetch('/__uncached_worker_csp_control_' + Date.now(), { cache: 'no-store' });
    } catch {
      rejected = true;
    }
    return { rejected, online: navigator.onLine, controller: navigator.serviceWorker.controller?.scriptURL };
  });
  if (
    !report.network.rejected ||
    !report.network.controller ||
    new URL(report.network.controller).origin !== origin ||
    new URL(report.network.controller).pathname !== '/sw.js' ||
    !['', '?isolation=1'].includes(new URL(report.network.controller).search)
  )
    throw Error('Invalid offline control');
  await ready(p);
  report.engine = await p.locator('.agent-model-status').textContent();
  if (!report.engine.includes('WebGPU') || !report.engine.includes('1.7B')) throw Error('Unexpected engine');
  const actual = p.workers().find((w) => w.url().endsWith('/assets/' + worker));
  if (!actual) throw Error('Wrong Worker URL');
  report.actualWorker = actual.url();
  report.fingerprint = await actual.evaluate(() => self.__localModelWorkerCsp);
  report.evalControl = await evalControl(c, p, actual.url());
  report.cold = await cachesSnapshot(p);
  if (
    report.fingerprint !== policy ||
    !report.evalControl?.blocked ||
    report.evalControl.name !== 'EvalError' ||
    !report.cold.some((r) => r.url === actual.url() && r.csp === policy && r.sha256 === expectedSHA256)
  )
    throw Error('Cold Worker policy mismatch');
  await p.locator('.cui-input').fill('Please reply with only hello.');
  await p.locator('.cui-input').press('Enter');
  await p.waitForFunction(() => !document.querySelector('.cui-input')?.disabled, null, { timeout: 90000 });
  report.reply = await p.locator('.cui-msg-agent').last().getAttribute('data-source');
  report.visibleErrors = await p.locator('.cui-msg-error').allTextContents();
  if (!report.reply?.trim() || report.visibleErrors.length || report.errors.length)
    throw Error('Offline inference failed');
  report.status = 'completed';
} catch (e) {
  report.status = 'failed';
  report.error = String(e);
  process.exitCode = 1;
} finally {
  if (c) await c.close();
  await fs.writeFile('docs/evaluations/2026-10-03-worker-csp-offline.json', JSON.stringify(report, null, 2) + '\n');
  console.log(
    JSON.stringify({
      status: report.status,
      error: report.error,
      reply: report.reply,
      beforeCount: report.before?.length,
      warmCount: report.warm?.length,
      evalControl: report.evalControl,
    }),
  );
}
