import { webkit } from '@playwright/test';
import fs from 'node:fs/promises';
import http from 'node:http';
import { createHash } from 'node:crypto';
const artifact = '.scratch/webkit-embedded-font-native-saved.docx';
const input = await fs.readFile(artifact);
const report = { input: { artifact, bytes: input.length, sha256: createHash('sha256').update(input).digest('hex') }, runs: [] };
const nativeReady = page => page.waitForFunction(() => {
  const api = document.querySelector('#app iframe')?.contentWindow?.Asc?.editor;
  return api?.isDocumentLoadComplete && api?.isLoadFullApi;
}, null, { timeout: 90000 });
const text = page => page.evaluate(() => document.querySelector('#app iframe').contentWindow.Asc.editor.WordControl.m_oLogicDocument.GetText());
const state = page => page.evaluate(async () => ({ href: location.href, controller: navigator.serviceWorker.controller?.scriptURL ?? null, caches: await caches.keys(), registrations: (await navigator.serviceWorker.getRegistrations()).map(r => ({ active: r.active?.state, installing: r.installing?.state, waiting: r.waiting?.state })) }));
for (let index = 0; index < 2; index++) {
  const run = { index, errors: [], failures: [], serverRequests: [] }; report.runs.push(run);
  const proxy = http.createServer((req, res) => {
    run.serverRequests.push(req.url);
    const upstream = http.request({ hostname: '127.0.0.1', port: 5193, path: req.url, method: req.method, headers: req.headers }, response => { res.writeHead(response.statusCode, response.headers); response.pipe(res); });
    upstream.on('error', error => { if (!res.headersSent) res.writeHead(502); res.end(); });
    req.pipe(upstream);
  });
  await new Promise(resolve => proxy.listen(5194, '127.0.0.1', resolve));
  const browser = await webkit.launch(); const context = await browser.newContext();
  run.version = browser.version();
  context.on('page', p => p.on('pageerror', error => run.errors.push(error.message)));
  context.on('requestfailed', req => run.failures.push({ url: req.url(), error: req.failure()?.errorText }));
  try {
    let page = await context.newPage(); await page.goto('http://127.0.0.1:5194/');
    const chooser = page.waitForEvent('filechooser'); await page.locator('#hero-open').click(); await (await chooser).setFiles(artifact);
    await nativeReady(page); run.onlineText = await text(page);
    if (run.onlineText !== 'WEBKIT_WORD_20261005\r\n') throw Error('online native text mismatch');
    await page.waitForFunction(() => navigator.serviceWorker.controller, null, { timeout: 15000 });
    run.onlineState = await state(page);
    if (!run.onlineState.caches.length || !run.onlineState.registrations.some(r => r.active === 'activated')) throw Error('worker/cache not ready');
    await page.close(); proxy.closeAllConnections(); await new Promise(resolve => proxy.close(resolve)); run.originClosed = true;
    page = await context.newPage(); const response = await page.goto('http://127.0.0.1:5194/');
    run.reopenShellFromSW = response.fromServiceWorker();
    const reopen = page.waitForEvent('filechooser'); await page.locator('#hero-open').click(); await (await reopen).setFiles(artifact);
    await nativeReady(page); run.reopenText = await text(page); run.reopenState = await state(page);
    if (run.reopenText !== 'WEBKIT_WORD_20261005\r\n' || !run.reopenShellFromSW) throw Error('origin-unavailable reopen mismatch');
    if (run.errors.length) throw Error('page errors');
    run.passed = true;
  } catch (error) { run.error = String(error); }
  finally { proxy.closeAllConnections(); if (proxy.listening) await new Promise(resolve => proxy.close(resolve)); await context.close(); await browser.close(); run.closed = true; }
}
await fs.writeFile('.scratch/local-navigation-native.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report.runs.map(({ serverRequests, ...rest }) => rest), null, 2));
if (report.runs.some(run => !run.passed || !run.closed)) process.exitCode = 1;
