import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import http from 'node:http';
const shipped = await fs.readFile('dist/sw.js', 'utf8');
const vendor = shipped.match(/const VENDOR_VERSION = '([^']+)'/)[1];
const hostPort = Number(process.env.ISOLATION_HOST_PORT || 5194);
const reportPath = process.env.ISOLATION_REPORT || 'docs/evaluations/2026-10-03-hosting-isolation-native.json';
const trailingEntry = process.env.ISOLATION_TRAILING_ENTRY === '1';
const served = [];
let refuseNetwork = false;
const server = http.createServer((request, response) => {
  if (refuseNetwork) { request.socket.destroy(); return; }
  const upstream = http.request({ hostname: '127.0.0.1', port: hostPort, path: request.url, method: request.method, headers: { ...request.headers, host: '127.0.0.1:' + hostPort } }, incoming => {
    const headers = incoming.headers;
    if (refuseNetwork) { incoming.destroy(); response.destroy(); return; }
    served.push({ path: request.url, coep: headers['cross-origin-embedder-policy'], coop: headers['cross-origin-opener-policy'], status: incoming.statusCode });
    response.writeHead(incoming.statusCode, headers); incoming.pipe(response);
  });
  response.on('close', () => upstream.destroy());
  upstream.on('error', error => { if (response.destroyed) return; response.writeHead(502); response.end(String(error)); });
  request.pipe(upstream);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = 'http://127.0.0.1:' + server.address().port;
const browser = await chromium.launch();
let context, page;
const report = { hostPort, trailingEntry, browserVersion: browser.version(), scope: 'Independent fresh Chromium context per document type, actual configured static host headers forwarded unchanged from first navigation, real app Worker registration, native edit/Save/reopen and offline restart; no AI inference or physical-device coverage.', vendor, cold: [], offline: [], errors: [] };
const ready = async () => {
  await page.waitForFunction(() => {
    const frame = document.querySelector('#app iframe');
    const api = frame?.contentWindow?.editor ?? frame?.contentWindow?.Asc?.editor;
    return api?.isDocumentLoadComplete && api?.isLoadFullApi;
  }, {}, { timeout: 120000 });
  return page.evaluate(() => {
    const frame = document.querySelector('#app iframe');
    const api = frame.contentWindow.editor ?? frame.contentWindow.Asc.editor;
    return { isolated: crossOriginIsolated, iframeIsolated: frame.contentWindow.crossOriginIsolated, fullApi: api.isLoadFullApi, loaded: api.isDocumentLoadComplete, controller: navigator.serviceWorker.controller?.scriptURL };
  });
};
try {
  for (const type of ['docx', 'xlsx', 'pptx']) {
    refuseNetwork = false;
    context = await browser.newContext();
    await context.addInitScript(() => { Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true }); });
    page = await context.newPage();
    page.on('pageerror', error => report.errors.push(error.message));
    await page.goto(origin + '/editor?new=' + type + '&locale=en');
    const row = { type, ...await ready() };
    if (!row.isolated || !row.iframeIsolated || !row.controller.endsWith('?isolation=1')) throw Error('Upgrade did not isolate ' + type);
    const marker = 'ISOLATED_COLD_' + type;
    const body = page.frameLocator('#app iframe').locator('body');
    await body.evaluate((_el, { type, marker }) => {
      const api = window.editor ?? window.Asc.editor;
      if (type === 'xlsx') api.asc_findCell('B2');
      api.pluginMethod_PasteText(marker);
    }, { type, marker });
    await body.locator('#slot-btn-dt-save button').waitFor({ state: 'visible' });
    await page.waitForFunction(() => !document.querySelector('#app iframe').contentDocument.querySelector('#slot-btn-dt-save button').disabled);
    const snapshot = async () => body.evaluate((_el, type) => {
      const api = window.editor ?? window.Asc.editor;
      if (type === 'docx') return api.WordControl.m_oLogicDocument.GetText();
      if (type === 'xlsx') return api.wb.getWorksheet().model.getRange3(1, 1, 1, 1).getValue();
      return api.WordControl.m_oLogicDocument.Slides.map(s => s.cSld.spTree.map(shape => shape.getText?.() ?? ''));
    }, type);
    row.edited = await snapshot();
    if (!JSON.stringify(row.edited).includes(marker)) throw Error('Native marker insertion failed ' + type);
    const downloadPromise = page.waitForEvent('download', { timeout: 120000 });
    downloadPromise.catch(() => {});
    await page.frameLocator('#app iframe').locator('#slot-btn-dt-save button').click();
    const download = await downloadPromise;
    const artifact = '.scratch/ai-csp/isolated-cold-native.' + type;
    await download.saveAs(artifact);
    row.nativeSave = { bytes: (await fs.stat(artifact)).size, failure: await download.failure() };
    if (!row.nativeSave.bytes || row.nativeSave.failure) throw Error('Native save failed');
    await page.goto(origin + '/');
    const chooser = page.waitForEvent('filechooser'); await page.locator('#hero-open').click(); await (await chooser).setFiles(artifact);
    row.reopened = await ready();
    row.reopenedText = await snapshot();
    row.reopenExact = JSON.stringify(row.reopenedText) === JSON.stringify(row.edited);
    if (!row.reopenExact) throw Error('Native save/reopen text mismatch');
    report.cold.push(row);
    console.log(JSON.stringify(row));
    refuseNetwork = true;
    server.closeAllConnections();
    const offlineNetworkStart = served.length;
    await context.setOffline(true);
    await page.goto(origin + (trailingEntry ? '/editor/' : '/editor') + '?new=' + type + '&locale=en');
    await context.setOffline(false); await context.setOffline(true);
    const offline = { type, ...await ready(), ...await page.evaluate(async () => { let rejected = false; try { await fetch('/__uncached_' + Date.now()); } catch { rejected = true; } return { online: navigator.onLine, networkRejected: rejected }; }) };
    offline.canonicalPath = new URL(page.url()).pathname;
    if (trailingEntry && offline.canonicalPath !== '/editor') throw Error('Trailing editor entry did not canonicalize');
    offline.upstreamResponses = served.length - offlineNetworkStart;
    report.offline.push(offline);
    if (offline.upstreamResponses !== 0 || offline.online || !offline.networkRejected || !offline.isolated || !offline.iframeIsolated) throw Error('Offline isolation failed');
    await context.close();
  }
  report.passed = report.cold.length === 3 && report.offline.length === 3 && !report.errors.length;
  if (!report.passed) process.exitCode = 1;
} catch (error) { report.error = String(error); report.passed = false; process.exitCode = 1; }
finally {
  report.spellNetworkRequests = served.filter(item => item.path.includes('/sdkjs/common/spell/'));
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
  await context?.close(); await browser.close(); await new Promise(resolve => server.close(resolve));
}
