import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
const origin = 'http://127.0.0.1:5193';
const iframe = '/web-apps/apps/documenteditor/main/index.html';
const worker = '/sdkjs/isolation-probe-worker.js';
const policy = { 'cross-origin-opener-policy': 'same-origin', 'cross-origin-embedder-policy': 'require-corp' };
const source = await fs.readFile('docs/evaluations/sw-isolation-query-candidate.txt', 'utf8');
await context.route('**/sw.js?isolation=1', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: source + '\nself.addEventListener("message", e => { if(e.data === "ISOLATION_DIAGNOSTIC") e.ports[0].postMessage({isolated:self.crossOriginIsolated,kind:typeof self.crossOriginIsolated}); });', headers: policy }));
await context.route('**/__isolation_response_probe', route => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><iframe src="' + iframe + '"></iframe>', headers: policy }));
const report = { browserVersion: browser.version(), scope: 'Candidate worker with explicit isolation script URL, under isolated script hosting; old cached synthetic iframe/Worker bodies served without changing their stored metadata. Not first-upgrade or native-editor verification.' };
try {
  await page.goto(origin + '/__isolation_response_probe');
  await page.evaluate(async () => { await navigator.serviceWorker.register('/sw.js?isolation=1'); await navigator.serviceWorker.ready; });
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  report.workerGlobal = await page.evaluate(() => new Promise(resolve => {
    const channel = new MessageChannel(); channel.port1.onmessage = e => resolve(e.data);
    navigator.serviceWorker.controller.postMessage('ISOLATION_DIAGNOSTIC', [channel.port2]);
  }));
  report.seed = await page.evaluate(async ({ iframe, worker }) => {
    const name = (await caches.keys()).find(n => n.startsWith('document-editor-runtime-'));
    const cache = await caches.open(name);
    await cache.put(iframe, new Response('<p>CACHED_FRAME_BYTES</p>', { headers: { 'content-type': 'text/html' } }));
    await cache.put(worker, new Response('postMessage({isolated:crossOriginIsolated});', { headers: { 'content-type': 'application/javascript' } }));
    return { name };
  }, { iframe, worker });
  await page.reload();
  const inspect = async worker => {
    const result = await new Promise(resolve => {
      const w = new Worker(worker);
      const timer = setTimeout(() => { w.terminate(); resolve({ timeout: true }); }, 5000);
      w.onmessage = e => { clearTimeout(timer); w.terminate(); resolve(e.data); };
      w.onerror = () => { clearTimeout(timer); w.terminate(); resolve({ error: true }); };
    });
    const response = await fetch(worker);
    let networkRejected = false; try { await fetch('/__uncached_' + Date.now()); } catch { networkRejected = true; }
    return { online: navigator.onLine, networkRejected, isolated: crossOriginIsolated, frameText: document.querySelector('iframe').contentDocument?.body?.textContent, worker: result, policy: response.headers.get('cross-origin-embedder-policy') };
  };
  report.result = await page.evaluate(inspect, worker);
  await context.unroute('**/__isolation_response_probe');
  await context.setOffline(true);
  await page.reload();
  await context.setOffline(false);
  await context.setOffline(true);
  report.offline = await page.evaluate(inspect, worker);
  report.stored = await page.evaluate(async ({ name, iframe, worker }) => {
    const cache = await caches.open(name);
    return Promise.all([iframe, worker].map(async path => { const response = await cache.match(path); return { path, policy: response.headers.get('cross-origin-embedder-policy'), body: await response.text() }; }));
  }, { name: report.seed.name, iframe, worker });
  report.passed = Boolean(report.result.isolated && report.result.frameText === 'CACHED_FRAME_BYTES' && report.result.worker.isolated && report.result.policy === 'require-corp' && report.stored.every(r => r.policy === null && r.body === (r.path === iframe ? '<p>CACHED_FRAME_BYTES</p>' : 'postMessage({isolated:crossOriginIsolated});')) && report.offline.isolated && report.offline.frameText === 'CACHED_FRAME_BYTES' && report.offline.worker.isolated && !report.offline.online && report.offline.networkRejected);
} catch (error) { report.error = String(error); report.passed = false; }
finally {
  await fs.writeFile('docs/evaluations/2026-10-03-sw-isolation-response.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
  await context.close(); await browser.close();
}
