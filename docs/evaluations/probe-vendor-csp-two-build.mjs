import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createHash } from 'node:crypto';
const lab = process.env.TWO_BUILD_ROOT || '/private/tmp/document-two-build-csp';
const manifest = JSON.parse(await fs.readFile(path.join(lab, 'build-manifest.json'), 'utf8'));
const roots = { baseline: path.join(lab, 'baseline'), candidate: path.join(lab, 'candidate') };
for (const name of Object.keys(roots)) {
  const sw = await fs.readFile(path.join(roots[name], 'sw.js'));
  if (createHash('sha256').update(sw).digest('hex') !== manifest[name].swSha256) throw Error('SW artifact hash mismatch');
  for (const entry of manifest[name].entries) {
    const body = await fs.readFile(path.join(roots[name], entry.path));
    if (createHash('sha256').update(body).digest('hex') !== entry.sha256) throw Error('Native artifact hash mismatch');
  }
}
const vendor = manifest.baseline.vendor;
const candidateVendor = manifest.candidate.vendor;
const oldCore = manifest.baseline.core;
if (vendor === candidateVendor || oldCore === manifest.candidate.core) throw Error('Build versions must differ');
let candidate = false;
let refuseNetwork = false;
const trailingEntry = false;
const served = [];
const pending = new Set();
const reportPath = process.env.TWO_BUILD_REPORT || 'docs/evaluations/2026-10-03-vendor-csp-two-build.json';
const mime = { '.html':'text/html', '.js':'application/javascript', '.mjs':'application/javascript', '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png', '.woff2':'font/woff2', '.woff':'font/woff', '.wasm':'application/wasm', '.ico':'image/x-icon' };
const server = http.createServer(async (request, response) => {
  if (refuseNetwork) { request.socket.destroy(); return; }
  const requestKey = request.url + ':' + Date.now();
  pending.add(requestKey);
  response.on('close', () => pending.delete(requestKey));
  try {
    const selected = candidate ? 'candidate' : 'baseline';
    const root = roots[selected];
    let pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (pathname === '/') pathname = '/index.html';
    if (pathname === '/editor' || pathname === '/history') pathname += '.html';
    const file = path.resolve(root, '.' + pathname);
    if (!file.startsWith(root + path.sep)) { response.writeHead(403); response.end(); return; }
    if (candidate && pathname === '/index.html' && process.env.TWO_BUILD_CACHE_DIAGNOSTIC === '1' && context) {
      for (const worker of context.serviceWorkers()) await worker.evaluate(() => {
        if (self.__lateCacheProbe) return;
        self.__lateCacheProbe = true;
        self.__latePuts = {};
        self.__lateWaits = {};
        let sequence = 0;
        const realPut = Cache.prototype.put;
        Cache.prototype.put = function(request,response) {
          const id = ++sequence;
          self.__latePuts[id] = {time:Date.now(),url:typeof request === 'string' ? request : request.url};
          const promise=realPut.call(this,request,response);
          promise.then(() => {self.__latePuts[id].settled=true;},error => {self.__latePuts[id].error=String(error);});
          return promise;
        };
        const realWait = ExtendableEvent.prototype.waitUntil;
        ExtendableEvent.prototype.waitUntil = function(promise) {
          const id = ++sequence;
          self.__lateWaits[id] = {time:Date.now(),type:this.type,url:this.request?.url};
          Promise.resolve(promise).then(() => {self.__lateWaits[id].settled=true;},error => {self.__lateWaits[id].error=String(error);});
          return realWait.call(this,promise);
        };
      });
    }
    const stat = await fs.stat(file);
    if (!stat.isFile()) { response.writeHead(404); response.end(); return; }
    const headers = { 'content-type':mime[path.extname(file)] || 'application/octet-stream', 'content-length':String(stat.size), 'cross-origin-opener-policy':'same-origin', 'cross-origin-embedder-policy':'require-corp', 'cache-control':'no-cache' };
    if (pathname === '/sdkjs/common/wasm/x2t/x2t.wasm.br') headers['content-encoding'] = 'br';
    const entry = manifest[selected].entries.find(x => '/' + x.path === pathname);
    if (entry?.policy) headers['content-security-policy'] = entry.policy;
    if (/^\/assets\/webllm\.worker-[A-Za-z0-9_-]+\.js$/.test(pathname)) headers['content-security-policy'] = "default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self' https: http: blob:; worker-src 'self' blob:";
    served.push({ path:request.url, artifact:selected, coep:headers['cross-origin-embedder-policy'], coop:headers['cross-origin-opener-policy'], status:200, candidatePolicy:selected === 'candidate' ? entry?.policy : undefined });
    response.writeHead(200, headers);
    const stream = createReadStream(file);
    response.on('close', () => stream.destroy());
    stream.on('error', () => response.destroy());
    stream.pipe(response);
  } catch { if (!response.headersSent) response.writeHead(404); response.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = 'http://127.0.0.1:' + server.address().port;
const browser = await chromium.launch();
let context, page;
const report = {
  experiment: {
    baseline: false,
    staticStylesheet: true,
    policyBakedIntoArtifacts: true,
    skipOldCheckpoint: process.env.TWO_BUILD_SKIP_OLD_CHECKPOINT === '1',
    manualDiagnostic: process.env.TWO_BUILD_MANUAL_DIAGNOSTIC === '1',
    routingDisabled: process.env.TWO_BUILD_NO_ROUTE === '1',
    cacheInstrumentation: process.env.TWO_BUILD_CACHE_DIAGNOSTIC === '1',
    stopOldDiagnostic: process.env.TWO_BUILD_STOP_OLD_DIAGNOSTIC === '1',
    controllerTimeoutMs: Number(process.env.TWO_BUILD_CONTROLLER_TIMEOUT || 120000),
    geometryOnly: process.env.VENDOR_CSP_GEOMETRY === '1',
    type: process.env.VENDOR_CSP_TYPE ?? 'all',
    viewport: { width: 1280, height: 900 },
  },
  builds: manifest,
  probeSha256: createHash("sha256").update(await fs.readFile(new URL(import.meta.url))).digest("hex"),
  trailingEntry,
  browserVersion: browser.version(),
  scope:
    'Two independent pnpm builds from a pinned source archive; baseline unchanged and candidate with three native entry static-style/CSP changes before build, full build-generated vendor stamps; artifact bytes served unmodified on one local origin; native editing and cached same-context offline checks, not deployed edge, AI inference, embeds or physical devices.',
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
const controllerVersion = () => page.evaluate(async () => {
  const controller = navigator.serviceWorker.controller;
  if (!controller) return null;
  return await new Promise(resolve => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => { channel.port1.close(); resolve(null); }, 1000);
    channel.port1.onmessage = event => { clearTimeout(timer); channel.port1.close(); resolve(event.data); };
    controller.postMessage({type:'VERSION'}, [channel.port2]);
  });
});
const nativeSnapshot = type => page.frameLocator('#app iframe').locator('body').evaluate((_el, type) => {
  const api = window.editor ?? window.Asc.editor;
  if (type === 'docx') return api.WordControl.m_oLogicDocument.GetText();
  if (type === 'xlsx') return api.wb.getWorksheet().model.getRange3(1,1,1,1).getValue();
  return api.WordControl.m_oLogicDocument.Slides.map(s => s.cSld.spTree.map(shape => shape.getText?.() ?? ''));
}, type);
try {
  for (const type of process.env.VENDOR_CSP_TYPE ? [process.env.VENDOR_CSP_TYPE] : ['docx', 'xlsx', 'pptx']) {
    refuseNetwork = false;
    candidate = false;
    context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await context.addInitScript(() => {
      window.__vendorViolations = [];
      window.__swLifecycle = [];
      const RealChannel = window.MessageChannel;
      window.MessageChannel = class extends RealChannel {
        constructor() {
          super();
          this.port1.addEventListener('message', event => {
            if (event.data?.type === 'CLIENT_COUNT') window.__swLifecycle.push({time:Date.now(), type:'CLIENT_COUNT', data:event.data});
          });
          this.port1.start();
        }
      };
      const realPost = ServiceWorker.prototype.postMessage;
      ServiceWorker.prototype.postMessage = function(message, ...rest) {
        if (message?.type === 'SKIP_WAITING') window.__swLifecycle.push({time:Date.now(), type:'SKIP_WAITING', scriptURL:this.scriptURL});
        return realPost.call(this, message, ...rest);
      };
      window.addEventListener('load', () => window.__swLifecycle.push({time:Date.now(), type:'load', updater:typeof window.__createSwUpdater}));
      document.addEventListener('securitypolicyviolation', (e) =>
        window.__vendorViolations.push({ directive: e.effectiveDirective, blocked: e.blockedURI }),
      );
      Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true });
    });
    page = await context.newPage();
    page.setDefaultTimeout(30000);
    if (process.env.TWO_BUILD_MANUAL_DIAGNOSTIC === '1') context.on('serviceworker', async worker => {
      try {
        await worker.evaluate(() => {
          self.__pendingEvents = {};
          self.__pendingPuts = {};
          let sequence = 0;
          const realWait = ExtendableEvent.prototype.waitUntil;
          ExtendableEvent.prototype.waitUntil = function(promise) {
            const id = ++sequence;
            self.__pendingEvents[id] = {time:Date.now(), type:this.type, url:this.request?.url};
            Promise.resolve(promise).then(() => delete self.__pendingEvents[id], error => { self.__pendingEvents[id].error=String(error); });
            return realWait.call(this,promise);
          };
          const realPut = Cache.prototype.put;
          Cache.prototype.put = function(request,response) {
            const id = ++sequence;
            self.__pendingPuts[id] = {time:Date.now(),url:typeof request === 'string' ? request : request.url, length:response.headers.get('content-length')};
            const promise = realPut.call(this,request,response);
            promise.then(() => delete self.__pendingPuts[id], error => {self.__pendingPuts[id].error=String(error);});
            return promise;
          };
        });
      } catch(error) { report.instrumentationErrors ??= []; report.instrumentationErrors.push(String(error)); }
    });
    const cdp = await context.newCDPSession(page);
    report.workerEvents ??= [];
    cdp.on('ServiceWorker.workerVersionUpdated', event => report.workerEvents.push(event));
    await cdp.send('ServiceWorker.enable');
    let documentResponses = [];
    let foreignRequests = 0;
    if (process.env.TWO_BUILD_NO_ROUTE !== '1') await context.route('https://controlled-script.example/probe.js', async (route) => {
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
    const baseline = { type, ...(await ready()) };
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
    const oldVersionDeadline = Date.now() + 30000;
    let initialVersion;
    do {
      initialVersion = await controllerVersion();
      if (initialVersion?.vendorVersion === vendor) break;
      await page.waitForTimeout(100);
    } while (Date.now() < oldVersionDeadline);
    if (initialVersion?.vendorVersion !== vendor) throw Error('Baseline controller not established');
    let oldArtifact;
    let dirtyBefore;
    if (process.env.TWO_BUILD_SKIP_OLD_CHECKPOINT !== '1') {
    const dirtyMarker = 'OLD_UNSAVED_' + type;
    await page.frameLocator('#app iframe').locator('body').evaluate((_el, {type, dirtyMarker}) => {
      const api = window.editor ?? window.Asc.editor;
      if (type === 'xlsx') api.asc_findCell('B2');
      api.pluginMethod_PasteText(dirtyMarker);
    }, {type, dirtyMarker});
    await page.waitForFunction(() => {
      const b = document.querySelector('#app iframe').contentDocument.querySelector('#slot-btn-dt-save button');
      return b && !b.disabled;
    });
    dirtyBefore = await nativeSnapshot(type);
    if (!JSON.stringify(dirtyBefore).includes(dirtyMarker)) throw Error('Old dirty marker missing');
    candidate = true;
    await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
    const waitingDeadline = Date.now() + 120000;
    let waitingState;
    do {
      waitingState = await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).waiting?.state ?? null);
      if (waitingState === 'installed') break;
      await page.waitForTimeout(100);
    } while (Date.now() < waitingDeadline);
    if (waitingState !== 'installed') throw Error('Candidate did not wait beside dirty editor');
    if (process.env.TWO_BUILD_MANUAL_DIAGNOSTIC === '1') {
      for (const worker of context.serviceWorkers()) {
        await worker.evaluate(() => {
          self.__receivedSwitches = [];
          self.__fetchStates = {};
          let fetchSequence = 0;
          self.addEventListener('fetch', event => {
            const id = ++fetchSequence;
            self.__fetchStates[id] = {time:Date.now(),url:event.request.url, handled:false};
            event.handled.then(() => self.__fetchStates[id].handled=true, error => {self.__fetchStates[id].handled=true;self.__fetchStates[id].error=String(error);});
          });
          self.addEventListener('message', event => {
            if (event.data?.type === 'SKIP_WAITING') self.__receivedSwitches.push({time:Date.now(), type:event.data.type});
          });
        });
      }
    }
    const dirtyVersion = await controllerVersion();
    const dirtyAfter = await nativeSnapshot(type);
    if (dirtyVersion?.vendorVersion !== vendor || JSON.stringify(dirtyBefore) !== JSON.stringify(dirtyAfter))
      throw Error('Dirty editor controller/content changed during candidate installation');
    const oldDownloadPending = page.waitForEvent('download', {timeout:120000});
    oldDownloadPending.catch(() => {});
    await page.frameLocator('#app iframe').locator('#slot-btn-dt-save button').click();
    const oldDownload = await oldDownloadPending;
    oldArtifact = '.scratch/ai-csp/two-build-old.' + type;
    await oldDownload.saveAs(oldArtifact);
    if (await oldDownload.failure()) throw Error('Old dirty native save failed');
    baseline.dirtyCheckpoint = {initialVersion, waitingState, dirtyVersion, dirtyBefore, dirtyAfter,
      oldSavedBytes:(await fs.stat(oldArtifact)).size, oldSavedSha256:createHash('sha256').update(await fs.readFile(oldArtifact)).digest('hex')};
    console.log('stage', 'old-dirty-retained-and-saved', type);
    } else {
      candidate = true;
      baseline.diagnosticOldCheckpointSkipped = true;
    }
    report.upgrade.push(baseline);
    await page.goto(origin + '/');
    baseline.landingUrl = page.url();
    baseline.controllerObservations = [];
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      await registration.update();
    });
    const controllerDeadline = Date.now() + Number(process.env.TWO_BUILD_CONTROLLER_TIMEOUT || 120000);
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
      const state = await page.evaluate(async () => {
        const registration = await navigator.serviceWorker.getRegistration();
        const ask = (worker, type) => new Promise(resolve => {
          if (!worker) return resolve(null);
          const channel = new MessageChannel();
          const timer = setTimeout(() => { channel.port1.close(); resolve(null); }, 1000);
          channel.port1.onmessage = event => { clearTimeout(timer); channel.port1.close(); resolve(event.data); };
          worker.postMessage({type}, [channel.port2]);
        });
        const [waitingVersion, clients] = await Promise.all([ask(registration?.waiting, 'VERSION'), ask(navigator.serviceWorker.controller, 'CLIENT_COUNT')]);
        return {url:location.href, readyState:document.readyState, controller:navigator.serviceWorker.controller?.scriptURL, active:registration?.active?.scriptURL, waiting:registration?.waiting?.scriptURL, waitingState:registration?.waiting?.state, installing:registration?.installing?.state, waitingVersion, clients};
      });
      if (!baseline.controllerObservations.length || Date.now() - baseline.controllerObservations.at(-1).time > 1000)
        baseline.controllerObservations.push({time:Date.now(), observedVersion, ...state});
      if (observedVersion?.vendorVersion === candidateVendor) break;
      await page.waitForTimeout(100);
    }
    baseline.landingLifecycle = await page.evaluate(() => window.__swLifecycle);
    baseline.diagnosticRoutingDisabled = process.env.TWO_BUILD_NO_ROUTE === '1';
    if (observedVersion?.vendorVersion !== candidateVendor) {
      baseline.pendingServerRequests = [...pending];
      baseline.workerSnapshots = await Promise.all(context.serviceWorkers().map(async worker => {
        try {
          return await Promise.race([worker.evaluate(async () => ({url:self.location.href, clients:(await self.clients.matchAll({includeUncontrolled:true})).map(c => ({url:c.url,type:c.type})), active:self.registration.active?.state, waiting:self.registration.waiting?.state, receivedSwitches:self.__receivedSwitches, pendingEvents:self.__pendingEvents, pendingPuts:self.__pendingPuts, fetchStates:self.__fetchStates, latePuts:self.__latePuts, lateWaits:self.__lateWaits, vendorVersion:VENDOR_VERSION, cacheVersion:CACHE_VERSION, skipImplementation:String(self.skipWaiting)})), new Promise(resolve => setTimeout(() => resolve({timeout:true,url:worker.url()}),3000))]);
        } catch(error) { return {url:worker.url(),error:String(error)}; }
      }));
      if (process.env.TWO_BUILD_MANUAL_DIAGNOSTIC === '1') {
        await page.waitForTimeout(3000);
        baseline.quietVersion = await controllerVersion();
        baseline.manualPromotion = await page.evaluate(async () => {
          const registration = await navigator.serviceWorker.getRegistration();
          return typeof window.__createSwUpdater === 'function' ? await window.__createSwUpdater(navigator).maybePromote(registration) : 'updater-missing';
        });
        await page.waitForTimeout(1000);
        baseline.manualVersion = await controllerVersion();
        let waitingWorker;
        for (const worker of context.serviceWorkers()) {
          const version = await worker.evaluate(() => ({vendorVersion:VENDOR_VERSION,cacheVersion:CACHE_VERSION}));
          if (version.vendorVersion === candidateVendor) { waitingWorker = worker; baseline.directTargetVersion = version; break; }
        }
        if (!waitingWorker) throw Error('Diagnostic candidate Worker target missing');
        baseline.directSkipResult = await Promise.race([waitingWorker.evaluate(async () => {await self.skipWaiting(); return 'resolved';}), new Promise(resolve => setTimeout(() => resolve('diagnostic-timeout'),3000))]);
        await page.waitForTimeout(3000);
        baseline.directVersion = await controllerVersion();
        if (process.env.TWO_BUILD_STOP_OLD_DIAGNOSTIC === '1') {
          const oldVersionId = report.workerEvents.flatMap(event => event.versions).findLast(v => v.status === 'activated' && v.controlledClients?.length)?.versionId;
          baseline.stoppedOldVersionId = oldVersionId;
          if (!oldVersionId) throw Error('Old CDP version target missing');
          await cdp.send('ServiceWorker.stopWorker', {versionId:oldVersionId});
          await page.waitForTimeout(3000);
          baseline.afterOldStopVersion = await controllerVersion();
        }
        await fs.writeFile(reportPath, JSON.stringify(report,null,2)+'\n');
      }
      throw Error('Candidate controlling version did not arrive');
    }
    baseline.newControllerVersion = observedVersion;
    console.log('stage', 'candidate-controller-verified', observedVersion.vendorVersion);
    baseline.newCaches = await page.evaluate(() => caches.keys());
    baseline.oldRuntimeRetained = baseline.newCaches.includes('document-editor-runtime-' + vendor);
    if (!baseline.newCaches.includes('document-editor-runtime-' + candidateVendor))
      throw Error('Candidate runtime cache missing');
    if (oldArtifact) {
    const oldChooser = page.waitForEvent('filechooser');
    await page.locator('#hero-open').click();
    await (await oldChooser).setFiles(oldArtifact);
    baseline.oldSavedReopened = await ready();
    baseline.oldSavedReopenedText = await nativeSnapshot(type);
    if (JSON.stringify(baseline.oldSavedReopenedText) !== JSON.stringify(dirtyBefore))
      throw Error('Old artifact changed after candidate reopen');
    }
    documentResponses = [];
    await page.goto(origin + '/editor?new=' + type + '&locale=en');
    const row = { type, ...(await ready()) };
    if (!row.isolated || !row.iframeIsolated || !row.controller.endsWith('?isolation=1'))
      throw Error('Upgrade did not isolate ' + type);
    const framePath = new URL(
      await page
        .frameLocator('#app iframe')
        .locator('body')
        .evaluate(() => location.href),
    ).pathname;
    row.vendorResponse = documentResponses.findLast((x) => new URL(x.url).pathname === framePath);
    const expectedPolicy = served.find(
      (x) => x.candidatePolicy && new URL(origin + x.path).pathname === framePath,
    )?.candidatePolicy;
    if (!expectedPolicy || !row.vendorResponse?.fromServiceWorker || row.vendorResponse.policy !== expectedPolicy)
      throw Error('Effective candidate iframe policy missing before native action');
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
    const artifact = '.scratch/ai-csp/two-build-candidate.' + type;
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
  report.completeMigrationPassed = report.passed && !report.experiment.skipOldCheckpoint && !report.experiment.manualDiagnostic;
  if (!report.passed) process.exitCode = 1;
} catch (error) {
  report.error = String(error);
  report.passed = false;
  report.completeMigrationPassed = false;
  process.exitCode = 1;
} finally {
  report.artifactRequests = served.filter(x => /^\/(?:sw\.js|sw-register\.js|index\.html|editor(?:\.html)?)(?:\?|$)/.test(x.path) || x.path === '/');
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
