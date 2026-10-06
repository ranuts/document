import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import http from 'node:http';
import { createHash } from 'node:crypto';
const shipped = await fs.readFile('dist/sw.js', 'utf8');
const vendor = shipped.match(/const VENDOR_VERSION = '([^']+)'/)[1];
const hostPort = Number(process.env.VENDOR_CSP_HOST_PORT || 5193);
const reportPath = process.env.VENDOR_CSP_REPORT || 'docs/evaluations/2026-10-03-vendor-csp-offline-policy.json';
const trailingEntry = process.env.ISOLATION_TRAILING_ENTRY === '1';
const served = [];
let refuseNetwork = false;
const server = http.createServer((request, response) => {
  if (refuseNetwork) {
    request.socket.destroy();
    return;
  }
  const upstream = http.request(
    {
      hostname: '127.0.0.1',
      port: hostPort,
      path: request.url,
      method: request.method,
      headers: { ...request.headers, 'accept-encoding': 'identity', host: '127.0.0.1:' + hostPort },
    },
    (incoming) => {
      const headers = incoming.headers;
      if (refuseNetwork) {
        incoming.destroy();
        response.destroy();
        return;
      }
      const servedRow = {
        path: request.url,
        coep: headers['cross-origin-embedder-policy'],
        coop: headers['cross-origin-opener-policy'],
        status: incoming.statusCode,
      };
      served.push(servedRow);
      if (
        process.env.VENDOR_CSP_BASELINE !== '1' &&
        /^\/web-apps\/apps\/[^/]+\/main\/index\.html(?:\?|$)/.test(request.url) &&
        incoming.statusCode === 200
      ) {
        const chunks = [];
        incoming.on('data', (chunk) => chunks.push(chunk));
        incoming.on('end', () => {
          let body = Buffer.concat(chunks);
          let html = body.toString('utf8');
          if (process.env.VENDOR_CSP_STATIC_STYLE === '1') {
            const originalHtml = html;
            html = html.replace(/media="print" onload="this.media='all'"/g, 'media="all"');
            servedRow.stylesheetHandlerRemoved = html !== originalHtml;
            body = Buffer.from(html);
          }
          const hashes = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
            .filter((m) => !/\bsrc\s*=/i.test(m[1]) && m[2].trim())
            .map((m) => `'sha256-${createHash('sha256').update(m[2]).digest('base64')}'`);
          const policy = `default-src 'self'; script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval' ${hashes.join(' ')}; script-src-attr 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data: blob:; worker-src 'self' blob:; frame-src 'self' blob:; connect-src 'self' https: http: blob:; object-src 'none'; base-uri 'self'`;
          headers['content-security-policy'] = policy;
          delete headers['transfer-encoding'];
          headers['content-length'] = String(body.length);
          servedRow.candidatePolicy = policy;
          response.writeHead(incoming.statusCode, headers);
          response.end(body);
        });
      } else {
        response.writeHead(incoming.statusCode, headers);
        incoming.pipe(response);
      }
    },
  );
  response.on('close', () => upstream.destroy());
  upstream.on('error', (error) => {
    if (response.destroyed) return;
    response.writeHead(502);
    response.end(String(error));
  });
  request.pipe(upstream);
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = 'http://127.0.0.1:' + server.address().port;
const browser = await chromium.launch();
let context, page;
const report = {
  experiment: {
    baseline: process.env.VENDOR_CSP_BASELINE === '1',
    staticStylesheet: process.env.VENDOR_CSP_STATIC_STYLE === '1',
    geometryOnly: process.env.VENDOR_CSP_GEOMETRY === '1',
    type: process.env.VENDOR_CSP_TYPE ?? 'all',
    viewport: { width: 1280, height: 900 },
  },
  hostPort,
  trailingEntry,
  browserVersion: browser.version(),
  scope:
    'Independent fresh Chromium context per document type, actual configured static host isolation headers preserved, response-local candidate CSP added only to native entry HTML, real app Worker registration, native edit/Undo/Redo/Save/reopen and same-context offline navigation; no IM dispatch, AI inference or physical-device coverage.',
  vendor,
  cold: [],
  offline: [],
  errors: [],
};
const ready = async () => {
  await page.waitForFunction(
    () => {
      const frame = document.querySelector('#app iframe');
      const api = frame?.contentWindow?.editor ?? frame?.contentWindow?.Asc?.editor;
      return api?.isDocumentLoadComplete && api?.isLoadFullApi;
    },
    {},
    { timeout: 120000 },
  );
  return page.evaluate(() => {
    const frame = document.querySelector('#app iframe');
    const api = frame.contentWindow.editor ?? frame.contentWindow.Asc.editor;
    return {
      isolated: crossOriginIsolated,
      iframeIsolated: frame.contentWindow.crossOriginIsolated,
      fullApi: api.isLoadFullApi,
      loaded: api.isDocumentLoadComplete,
      controller: navigator.serviceWorker.controller?.scriptURL,
    };
  });
};
try {
  for (const type of process.env.VENDOR_CSP_TYPE ? [process.env.VENDOR_CSP_TYPE] : ['docx', 'xlsx', 'pptx']) {
    refuseNetwork = false;
    context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await context.addInitScript(() => {
      window.__vendorViolations = [];
      document.addEventListener('securitypolicyviolation', (e) =>
        window.__vendorViolations.push({ directive: e.effectiveDirective, blocked: e.blockedURI }),
      );
      Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true });
    });
    page = await context.newPage();
    let documentResponses = [];
    let foreignRequests = 0;
    await context.route('https://controlled-script.example/probe.js', async (route) => {
      foreignRequests++;
      await route.fulfill({
        contentType: 'application/javascript',
        headers: { 'access-control-allow-origin': '*', 'cross-origin-resource-policy': 'cross-origin' },
        body: 'window.__offlineForeign=true;',
      });
    });
    page.on('response', (response) => {
      if (response.request().resourceType() === 'document' && response.url().includes('/main/index.html'))
        documentResponses.push({
          url: response.url(),
          fromServiceWorker: response.fromServiceWorker(),
          policy: response.headers()['content-security-policy'] ?? null,
        });
    });
    page.on('pageerror', (error) => report.errors.push(error.message));
    await page.goto(origin + '/editor?new=' + type + '&locale=en');
    const row = { type, ...(await ready()) };
    if (!row.isolated || !row.iframeIsolated || !row.controller.endsWith('?isolation=1'))
      throw Error('Upgrade did not isolate ' + type);
    const marker = 'VENDOR_CSP_' + type;
    const body = page.frameLocator('#app iframe').locator('body');
    await body.evaluate(
      (_el, { type, marker }) => {
        const api = window.editor ?? window.Asc.editor;
        if (type === 'xlsx') api.asc_findCell('B2');
        api.pluginMethod_PasteText(marker);
      },
      { type, marker },
    );
    await body.locator('#slot-btn-dt-save button').waitFor({ state: 'visible' });
    await page.waitForFunction(
      () => !document.querySelector('#app iframe').contentDocument.querySelector('#slot-btn-dt-save button').disabled,
    );
    const snapshot = async () =>
      body.evaluate((_el, type) => {
        const api = window.editor ?? window.Asc.editor;
        if (type === 'docx') return api.WordControl.m_oLogicDocument.GetText();
        if (type === 'xlsx') return api.wb.getWorksheet().model.getRange3(1, 1, 1, 1).getValue();
        return api.WordControl.m_oLogicDocument.Slides.map((s) =>
          s.cSld.spTree.map((shape) => shape.getText?.() ?? ''),
        );
      }, type);
    row.edited = await snapshot();
    await body.evaluate((_el, type) => {
      const api = window.editor ?? window.Asc.editor;
      if (type === 'xlsx') api.asc_Undo();
      else api.Undo();
    }, type);
    await page.waitForTimeout(250);
    row.undone = await snapshot();
    if (JSON.stringify(row.undone).includes(marker)) throw Error('Native Undo did not remove marker');
    await body.evaluate((_el, type) => {
      const api = window.editor ?? window.Asc.editor;
      if (type === 'xlsx') api.asc_Redo();
      else api.Redo();
    }, type);
    await page.waitForTimeout(250);
    row.redone = await snapshot();
    if (JSON.stringify(row.redone) !== JSON.stringify(row.edited)) throw Error('Native Redo mismatch');
    if (!JSON.stringify(row.edited).includes(marker)) throw Error('Native marker insertion failed ' + type);
    if (process.env.VENDOR_CSP_GEOMETRY === '1') {
      row.saveGeometry = await body.evaluate(() => {
        const b = document.querySelector('#slot-btn-dt-save button');
        const r = b.getBoundingClientRect();
        return {
          button: { x: r.x, y: r.y, width: r.width, height: r.height },
          hits: document
            .elementsFromPoint(r.x + r.width / 2, r.y + r.height / 2)
            .slice(0, 6)
            .map((e) => ({ tag: e.tagName, id: e.id, class: e.className })),
          violations: window.__vendorViolations,
          stylesheets: [...document.querySelectorAll('link[rel=stylesheet]')].map((e) => ({
            href: e.href,
            media: e.media,
            onload: e.getAttribute('onload'),
          })),
        };
      });
      await page.screenshot({
        path:
          '.scratch/ai-csp/vendor-save-' +
          (process.env.VENDOR_CSP_BASELINE === '1' ? 'baseline' : 'candidate') +
          '.png',
      });
      report.cold.push(row);
      await context.close();
      continue;
    }
    const downloadPromise = page.waitForEvent('download', { timeout: 120000 });
    downloadPromise.catch(() => {});
    await page.frameLocator('#app iframe').locator('#slot-btn-dt-save button').click();
    const download = await downloadPromise;
    const artifact = '.scratch/ai-csp/vendor-csp-native.' + type;
    await download.saveAs(artifact);
    row.nativeSave = { bytes: (await fs.stat(artifact)).size, failure: await download.failure() };
    if (!row.nativeSave.bytes || row.nativeSave.failure) throw Error('Native save failed');
    await page.goto(origin + '/');
    const chooser = page.waitForEvent('filechooser');
    await page.locator('#hero-open').click();
    await (await chooser).setFiles(artifact);
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
    documentResponses = [];
    await page.goto(origin + (trailingEntry ? '/editor/' : '/editor') + '?new=' + type + '&locale=en');
    await context.setOffline(false);
    await context.setOffline(true);
    const offline = {
      type,
      ...(await ready()),
      ...(await page.evaluate(async () => {
        let rejected = false;
        try {
          await fetch('/__uncached_' + Date.now());
        } catch {
          rejected = true;
        }
        return { online: navigator.onLine, networkRejected: rejected };
      })),
    };
    offline.vendorResponses = documentResponses;
    offline.controls = await body.evaluate(async () => {
      window.__offlineInline = false;
      window.__offlineEvent = false;
      window.__offlineForeign = false;
      const violations = [];
      const listen = (e) => violations.push({ directive: e.effectiveDirective, blocked: e.blockedURI });
      document.addEventListener('securitypolicyviolation', listen);
      const script = document.createElement('script');
      script.textContent = 'window.__offlineInline=true';
      document.head.append(script);
      const button = document.createElement('button');
      button.setAttribute('onclick', 'window.__offlineEvent=true');
      document.body.append(button);
      button.click();
      button.remove();
      const foreign = document.createElement('script');
      foreign.src = 'https://controlled-script.example/probe.js';
      await new Promise((resolve) => {
        foreign.onload = resolve;
        foreign.onerror = resolve;
        document.head.append(foreign);
      });
      await new Promise((resolve) => setTimeout(resolve, 100));
      document.removeEventListener('securitypolicyviolation', listen);
      const save = document.querySelector('#slot-btn-dt-save button');
      const r = save.getBoundingClientRect();
      return {
        inline: window.__offlineInline,
        event: window.__offlineEvent,
        foreign: window.__offlineForeign,
        evalValue: window.eval('1+1'),
        violations,
        save: {
          y: r.y,
          hit: document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest('button') === save,
        },
        stylesheets: [...document.querySelectorAll('link[rel=stylesheet]')].map((e) => ({
          href: e.href,
          media: e.media,
          onload: e.getAttribute('onload'),
        })),
      };
    });
    offline.foreignRequests = foreignRequests;
    const actualFramePath = new URL(
      await page
        .frameLocator('#app iframe')
        .locator('body')
        .evaluate(() => location.href),
    ).pathname;
    const actual = offline.vendorResponses.find((x) => new URL(x.url).pathname === actualFramePath);
    const expected = served.find(
      (x) => x.candidatePolicy && new URL(origin + x.path).pathname === new URL(actual?.url ?? origin).pathname,
    )?.candidatePolicy;
    if (!actual?.fromServiceWorker || !expected || actual.policy !== expected)
      throw Error('Effective offline iframe CSP mismatch');
    if (
      offline.controls.inline ||
      offline.controls.event ||
      offline.controls.foreign ||
      offline.foreignRequests ||
      offline.controls.evalValue !== 2 ||
      !offline.controls.save.hit
    )
      throw Error('Offline script/style control mismatch');
    if (
      !offline.controls.violations.some((x) => x.directive === 'script-src-attr') ||
      !offline.controls.violations.some(
        (x) => x.directive === 'script-src-elem' && x.blocked === 'https://controlled-script.example/probe.js',
      )
    )
      throw Error('Offline controls lack policy evidence');
    offline.canonicalPath = new URL(page.url()).pathname;
    if (trailingEntry && offline.canonicalPath !== '/editor') throw Error('Trailing editor entry did not canonicalize');
    offline.upstreamResponses = served.length - offlineNetworkStart;
    report.offline.push(offline);
    if (
      offline.upstreamResponses !== 0 ||
      offline.online ||
      !offline.networkRejected ||
      !offline.isolated ||
      !offline.iframeIsolated
    )
      throw Error('Offline isolation failed');
    await context.close();
  }
  report.passed =
    process.env.VENDOR_CSP_GEOMETRY === '1'
      ? !report.errors.length
      : report.cold.length === 3 && report.offline.length === 3 && !report.errors.length;
  if (!report.passed) process.exitCode = 1;
} catch (error) {
  report.error = String(error);
  report.passed = false;
  process.exitCode = 1;
} finally {
  report.candidateEntries = served.filter((item) => item.candidatePolicy);
  report.spellNetworkRequests = served.filter((item) => item.path.includes('/sdkjs/common/spell/'));
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
  console.log(
    JSON.stringify({
      passed: report.passed,
      error: report.error,
      cold: report.cold.length,
      offline: report.offline.length,
    }),
  );
  await context?.close();
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
