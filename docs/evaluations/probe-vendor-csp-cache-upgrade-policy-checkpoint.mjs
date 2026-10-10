import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import http from 'node:http';
import { createHash } from 'node:crypto';
const shipped = await fs.readFile('dist/sw.js', 'utf8');
const oldCore = shipped.match(/const CACHE_VERSION = '([^']+)'/)[1];
const fixedEntries = await Promise.all(
  ['documenteditor', 'spreadsheeteditor', 'presentationeditor'].map(async (name) =>
    (await fs.readFile(`dist/web-apps/apps/${name}/main/index.html`, 'utf8')).replace(
      /media="print" onload="this.media='all'"/g,
      'media="all"',
    ),
  ),
);
const candidateVendor = createHash('sha256').update(fixedEntries.join('\n')).digest('hex').slice(0, 12);
let candidate = false;
const vendor = shipped.match(/const VENDOR_VERSION = '([^']+)'/)[1];
const hostPort = Number(process.env.VENDOR_CSP_HOST_PORT || 5193);
const reportPath =
  process.env.VENDOR_CSP_REPORT || 'docs/evaluations/2026-10-03-vendor-csp-cache-upgrade-policy-checkpoint.json';
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
      headers: {
        ...Object.fromEntries(
          Object.entries(request.headers).filter(
            ([key]) => !candidate || !['if-none-match', 'if-modified-since'].includes(key),
          ),
        ),
        'accept-encoding': 'identity',
        host: '127.0.0.1:' + hostPort,
      },
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
        candidate &&
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
          delete headers.etag;
          delete headers['last-modified'];
          delete headers['transfer-encoding'];
          headers['content-length'] = String(body.length);
          servedRow.candidatePolicy = policy;
          response.writeHead(incoming.statusCode, headers);
          response.end(body);
        });
      } else if (candidate && /^\/sw\.js(?:\?|$)/.test(request.url) && incoming.statusCode === 200) {
        const chunks = [];
        incoming.on('data', (chunk) => chunks.push(chunk));
        incoming.on('end', () => {
          let source = Buffer.concat(chunks)
            .toString('utf8')
            .replaceAll(vendor, candidateVendor)
            .replaceAll(oldCore, oldCore + '-vendor-csp-probe');
          delete headers['transfer-encoding'];
          delete headers.etag;
          delete headers['last-modified'];
          if (process.env.VENDOR_CSP_REVALIDATE === '1')
            source =
              "const addAllFresh=(cache,assets)=>cache.addAll(assets.map(asset=>new Request(new URL(asset,self.location.origin),{cache:'no-cache'})));\n" +
              source.replaceAll('cache.addAll(', 'addAllFresh(cache,');
          headers['content-length'] = String(Buffer.byteLength(source));
          response.writeHead(200, headers);
          response.end(source);
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
    'Controlled two-version proxy simulation using unchanged SW algorithm and synthetic candidate content stamp; independent fresh Chromium context per document type, actual configured static host isolation headers preserved, response-local candidate CSP added only to native entry HTML, real app Worker registration, native edit/Undo/Redo/Save/reopen and same-context offline navigation; no IM dispatch, AI inference or physical-device coverage.',
  vendor,
  candidateVendor,
  oldCore,
  upgrade: [],
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
    candidate = false;
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
    console.log('stage', 'old-native-ready-start', type);
    const baseline = { type, ...(await ready()) };
    console.log('stage', 'old-native-ready', type);
    baseline.oldEntries = await page.evaluate(async () => {
      const rows = [];
      for (const name of await caches.keys()) {
        const cache = await caches.open(name);
        for (const request of await cache.keys()) {
          if (/\/web-apps\/apps\/[^/]+\/main\/index\.html$/.test(new URL(request.url).pathname)) {
            const response = await cache.match(request);
            rows.push({
              name,
              url: request.url,
              policy: response.headers.get('content-security-policy'),
              asyncStyle: (await response.text()).includes('media="print" onload="this.media='),
            });
          }
        }
      }
      return rows;
    });
    if (!baseline.oldEntries.length || baseline.oldEntries.some((x) => x.policy || !x.asyncStyle))
      throw Error('Missing actual old candidate-free cache');
    console.log('stage', 'old-cache-recorded', type, baseline.oldEntries.length);
    report.pendingBaseline = baseline;
    candidate = true;
    console.log('stage', 'landing-before-update');
    await page.goto(origin + '/');
    console.log('stage', 'update-request', page.url());
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      await Promise.race([
        registration.update(),
        new Promise((_, reject) => setTimeout(() => reject(Error('Diagnostic registration.update deadline')), 30000)),
      ]);
    });
    console.log('stage', 'update-resolved');
    const controllerDeadline = Date.now() + 120000;
    let observedVersion;
    while (Date.now() < controllerDeadline) {
      observedVersion = await page.evaluate(
        async () =>
          await new Promise((resolve) => {
            const controller = navigator.serviceWorker.controller;
            if (!controller) {
              resolve(null);
              return;
            }
            const channel = new MessageChannel();
            const timeout = setTimeout(() => {
              channel.port1.close();
              resolve(null);
            }, 1000);
            channel.port1.onmessage = (e) => {
              clearTimeout(timeout);
              channel.port1.close();
              resolve(e.data);
            };
            controller.postMessage({ type: 'VERSION' }, [channel.port2]);
          }),
      );
      if (observedVersion?.vendorVersion === candidateVendor) break;
      await page.waitForTimeout(100);
    }
    if (observedVersion?.vendorVersion !== candidateVendor) throw Error('Candidate controlling version did not arrive');
    baseline.newControllerVersion = observedVersion;
    console.log('stage', 'candidate-controller-verified', observedVersion.vendorVersion);
    baseline.newCaches = await page.evaluate(() => caches.keys());
    baseline.oldRuntimeRetained = baseline.newCaches.includes('document-editor-runtime-' + vendor);
    if (!baseline.newCaches.includes('document-editor-runtime-' + candidateVendor))
      throw Error('Candidate runtime cache missing');
    report.upgrade.push(baseline);
    documentResponses = [];
    await page.goto(origin + '/editor?new=' + type + '&locale=en');
    console.log('stage', 'candidate-native-ready-start');
    const row = { type, ...(await ready()) };
    console.log('stage', 'candidate-native-ready');
    if (!row.isolated || !row.iframeIsolated || !row.controller.endsWith('?isolation=1'))
      throw Error('Upgrade did not isolate ' + type);
    row.responses = documentResponses;
    row.currentVersion = await page.evaluate(async () => {
      return await new Promise((resolve) => {
        const channel = new MessageChannel();
        setTimeout(() => resolve(null), 1000);
        channel.port1.onmessage = (e) => resolve(e.data);
        navigator.serviceWorker.controller?.postMessage({ type: 'VERSION' }, [channel.port2]);
      });
    });
    row.candidateCachedEntries = await page.evaluate(async (name) => {
      const cache = await caches.open(name);
      const rows = [];
      for (const request of await cache.keys()) {
        if (new URL(request.url).pathname.endsWith('/main/index.html')) {
          const response = await cache.match(request);
          rows.push({
            url: request.url,
            policy: response.headers.get('content-security-policy'),
            asyncStyle: (await response.text()).includes('media="print" onload='),
          });
        }
      }
      return rows;
    }, 'document-editor-runtime-' + candidateVendor);
    report.revalidatedPrecache = process.env.VENDOR_CSP_REVALIDATE === '1';
    row.controls = await page
      .frameLocator('#app iframe')
      .locator('body')
      .evaluate(async () => {
        window.__upgradeInline = false;
        const script = document.createElement('script');
        script.textContent = 'window.__upgradeInline=true';
        document.head.append(script);
        await new Promise((resolve) => setTimeout(resolve, 50));
        return {
          inlineExecuted: window.__upgradeInline,
          iframeUrl: location.href,
          controller: navigator.serviceWorker.controller?.scriptURL,
          stylesheets: [...document.querySelectorAll('link[rel=stylesheet]')].map((e) => ({
            href: e.href,
            media: e.media,
            onload: e.getAttribute('onload'),
          })),
        };
      });
    report.checkpoints = [row];
    report.scope =
      'Controlled synthetic vendor/core version transition using real SW algorithm; early effective iframe response and inline-script controls only, no native mutation/Save/offline/IM or deployed build claim.';
    console.log('checkpoint', JSON.stringify(row));
    const actual = row.responses.findLast((x) => new URL(x.url).pathname === new URL(row.controls.iframeUrl).pathname);
    const expected = served.find(
      (x) => x.candidatePolicy && new URL(origin + x.path).pathname === new URL(row.controls.iframeUrl).pathname,
    )?.candidatePolicy;
    report.passed =
      !!actual?.fromServiceWorker && !!expected && actual.policy === expected && !row.controls.inlineExecuted;
    if (!report.passed) throw Error('Effective post-upgrade iframe policy checkpoint failed');
    await context.close();
  }
} catch (error) {
  report.error = String(error);
  report.passed = false;
  process.exitCode = 1;
} finally {
  report.candidateEntries = served.filter((x) => x.candidatePolicy);
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
  await context?.close();
  await browser.close();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}
