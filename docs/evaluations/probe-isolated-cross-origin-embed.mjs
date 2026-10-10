import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import http from 'node:http';
import { execFileSync } from 'node:child_process';
const built = await fs.readFile('dist/sw.js', 'utf8');
const vendor = built.match(/const VENDOR_VERSION = '([^']+)'/)[1];
const old = execFileSync('git', ['show', '2a675a7:public/sw.js'], { encoding: 'utf8' }).replaceAll('SW_VERSION_PLACEHOLDER', 'embed-old-control').replaceAll('VENDOR_VERSION_PLACEHOLDER', vendor);
let isolated = false;
const server = http.createServer((request, response) => {
  const policy = isolated ? { 'cross-origin-opener-policy': 'same-origin', 'cross-origin-embedder-policy': 'require-corp' } : {};
  if (request.url === '/sw.js' && !isolated) { response.writeHead(200, { 'content-type': 'application/javascript', 'cache-control': 'no-cache' }); response.end(old); return; }
  const upstream = http.request({ hostname: '127.0.0.1', port: 5193, path: request.url, headers: { ...request.headers, host: '127.0.0.1:5193' } }, incoming => { response.writeHead(incoming.statusCode, { ...incoming.headers, ...policy }); incoming.pipe(response); });
  upstream.on('error', () => { if (!response.destroyed) { response.writeHead(502); response.end(); } });
  request.pipe(upstream);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = 'http://127.0.0.1:' + server.address().port;
const fixtureBase64 = (await fs.readFile('.scratch/ai-csp/isolated-cold-native.docx')).toString('base64');
const parent = http.createServer((_request, response) => { response.writeHead(200, { 'content-type': 'text/html' }); response.end('<!doctype html><script>window.embedMessages=[];window.addEventListener("message",e=>{window.embedMessages.push({type:e.data?.type,payload:e.data?.payload});if(e.data?.type==="document:ready")document.querySelector("#embedded").contentWindow.postMessage({id:"embed-test",type:"document:open-buffer",payload:{fileName:"probe.docx",base64:' + JSON.stringify(fixtureBase64) + '}},' + JSON.stringify(origin) + ');});</script><iframe id="embedded" style="width:1400px;height:900px" src="' + origin + '/editor?locale=en&embed=1"></iframe>'); });
await new Promise(resolve => parent.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch(); const context = await browser.newContext(); const page = await context.newPage();
const report = { scope: 'Actual cross-origin nonisolated parent embedding isolated-policy editor after warming old nonisolated vendor caches. Native startup only; diagnostic, no production change.', errors: [], failed: [] };
page.on('requestfailed', request => report.failed.push({url:request.url(),error:request.failure()?.errorText}));
page.on('pageerror', error => report.errors.push(error.message));
try {
  await page.goto(origin + '/editor?new=docx&locale=en');
  await page.waitForFunction(() => { const frame = document.querySelector('#app iframe'); const api = frame?.contentWindow?.editor ?? frame?.contentWindow?.Asc?.editor; return api?.isLoadFullApi && api?.isDocumentLoadComplete; }, {}, { timeout: 120000 });
  report.warm = await page.evaluate(async () => { const name = (await caches.keys()).find(n => n.startsWith('document-editor-runtime-')); const response = await (await caches.open(name)).match('/web-apps/apps/documenteditor/main/index.html'); return { isolated: crossOriginIsolated, policy: response?.headers.get('cross-origin-embedder-policy'), controller: navigator.serviceWorker.controller?.scriptURL }; });
  await page.goto('http://127.0.0.1:' + parent.address().port + '/');
  await page.frameLocator('#embedded').locator('body').evaluate(() => new Promise((resolve, reject) => {
    const began = Date.now(); const timer = setInterval(() => {
      const frame = document.querySelector('#app iframe'); const api = frame?.contentWindow?.editor ?? frame?.contentWindow?.Asc?.editor;
      if (api?.isLoadFullApi && api?.isDocumentLoadComplete) { clearInterval(timer); resolve(true); }
      else if (Date.now() - began > 60000) { clearInterval(timer); reject(Error('Nonisolated embed control did not load')); }
    }, 100);
  }));
  report.controlMessages = await page.evaluate(() => window.embedMessages);
  report.controlLoaded = true;
  isolated = true;
  await page.goto('http://127.0.0.1:' + parent.address().port + '/');
  const child = page.frameLocator('#embedded').locator('body');
  await child.waitFor();
  await page.waitForTimeout(20000);
  report.embedded = await child.evaluate(() => { const frame = document.querySelector('#app iframe'); let api, error; try { api = frame?.contentWindow?.editor ?? frame?.contentWindow?.Asc?.editor; } catch (e) { error = String(e); } return { isolated: crossOriginIsolated, framePresent: !!frame, fullApi: !!api?.isLoadFullApi, loaded: !!api?.isDocumentLoadComplete, controller: navigator.serviceWorker.controller?.scriptURL, frameError: error }; });
  report.isolatedMessages = await page.evaluate(() => window.embedMessages);
  report.parentIsolated = await page.evaluate(() => crossOriginIsolated);
  report.compatible = report.embedded.fullApi && report.embedded.loaded;
  report.cacheRepair = await child.evaluate(async () => {
    const cache = await caches.open((await caches.keys()).find(name => name.startsWith('document-editor-runtime-')));
    const records = [];
    for (const request of await cache.keys()) {
      if (new URL(request.url).pathname !== '/web-apps/apps/documenteditor/main/index.html') continue;
      const response = await cache.match(request), before = new Uint8Array(await response.clone().arrayBuffer());
      const headers = new Headers(response.headers);
      headers.set('cross-origin-opener-policy', 'same-origin'); headers.set('cross-origin-embedder-policy', 'require-corp');
      await cache.put(request, new Response(response.body, { status: response.status, statusText: response.statusText, headers }));
      const after = new Uint8Array(await (await cache.match(request)).arrayBuffer());
      const unchanged = before.length === after.length && before.every((value, index) => value === after[index]);
      records.push({ bytes: before.length, unchanged });
      if (!unchanged) throw Error('Iframe bytes changed');
    }
    return records;
  });
  await page.reload();
  await page.frameLocator('#embedded').locator('body').evaluate(() => new Promise((resolve, reject) => {
    const began = Date.now(); const timer = setInterval(() => {
      const frame = document.querySelector('#app iframe'); const api = frame?.contentWindow?.editor ?? frame?.contentWindow?.Asc?.editor;
      if (api?.isLoadFullApi && api?.isDocumentLoadComplete) { clearInterval(timer); resolve(true); }
      else if (Date.now() - began > 60000) { clearInterval(timer); reject(Error('Repaired embed did not load')); }
    }, 100);
  }));
  report.repairedCompatible = true;

} catch (error) { report.error = String(error); report.compatible = false; }
finally { await fs.writeFile('docs/evaluations/2026-10-03-isolated-cross-origin-embed.json', JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report)); await context.close(); await browser.close(); await Promise.all([new Promise(resolve => server.close(resolve)), new Promise(resolve => parent.close(resolve))]); }
