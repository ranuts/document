import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
const context = await chromium.launch({ headless: true });
const browserContext = await context.newContext();
const page = await browserContext.newPage();
let updated = false;
const oldSource = (await fs.readFile('.scratch/ai-csp/sw-before-cache-ownership.js', 'utf8'))
  .replaceAll('SW_VERSION_PLACEHOLDER', 'ownership-old-control')
  .replaceAll(
    'VENDOR_VERSION_PLACEHOLDER',
    (await fs.readFile('dist/sw.js', 'utf8')).match(/const VENDOR_VERSION = '([^']+)'/)[1],
  );
await browserContext.route('**/sw.js', async (route) => {
  if (updated) await route.continue();
  else
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: oldSource,
      headers: { 'cache-control': 'no-cache' },
    });
});
const report = {
  scope:
    'Actual Chromium Service Worker update from previous source to current built worker; Cache API marker payloads representing provider/plugin caches. Markers are not model weights and no inference is tested.',
  errors: [],
};
page.on('pageerror', (e) => report.errors.push(e.message));
const version = () =>
  page.evaluate(async () => {
    const channel = new MessageChannel();
    return await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        channel.port1.close();
        reject(Error('Worker version deadline'));
      }, 3000);
      channel.port1.onmessage = (e) => {
        clearTimeout(timer);
        channel.port1.close();
        resolve(e.data);
      };
      navigator.serviceWorker.controller.postMessage({ type: 'VERSION' }, [channel.port2]);
    });
  });
const waitUntil = async (predicate) => {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await page.waitForTimeout(100);
  }
  throw Error('Cache upgrade condition deadline');
};
try {
  await page.goto('http://127.0.0.1:5193/manifest.json');
  await page.evaluate(async () => {
    await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
  });
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, {}, { timeout: 60000 });
  report.beforeVersion = await version();
  if (report.beforeVersion.cacheVersion !== 'ownership-old-control') throw Error('Old worker was not observed');
  const names = ['local-ai-wllama-models-v1', 'webllm-models', 'plugin-assets', 'document-editor-models'];
  await page.evaluate(async (names) => {
    for (const name of [...names, 'document-editor-core-retired', 'document-editor-runtime-retired']) {
      const cache = await caches.open(name);
      await cache.put(
        '/__model_cache_marker',
        new Response(name + ':\u0000model-marker-中文', { headers: { 'content-type': 'application/octet-stream' } }),
      );
    }
  }, names);
  updated = true;
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    await registration.update();
  });
  await waitUntil(async () => (await version()).cacheVersion !== 'ownership-old-control');
  report.afterVersion = await version();
  await waitUntil(() => page.evaluate(async () => !(await caches.keys()).includes('document-editor-core-retired')));
  await browserContext.setOffline(true);
  report.caches = await page.evaluate(async (names) => {
    const keys = await caches.keys(),
      contents = {};
    for (const name of names) {
      const response = await (await caches.open(name)).match('/__model_cache_marker');
      contents[name] = response ? Array.from(new Uint8Array(await response.arrayBuffer())) : null;
    }
    let networkRejected = false;
    try {
      await fetch('/__uncached_upgrade_probe_' + Date.now(), { cache: 'no-store' });
    } catch {
      networkRejected = true;
    }
    return { keys, contents, networkRejected, online: navigator.onLine };
  }, names);
  if (!report.caches.networkRejected || report.caches.online) throw Error('Offline control failed');
  for (const name of names) {
    const expected = Array.from(new TextEncoder().encode(name + ':\u0000model-marker-中文'));
    if (JSON.stringify(report.caches.contents[name]) !== JSON.stringify(expected))
      throw Error('Provider cache bytes were removed or changed');
  }
  if (report.caches.keys.includes('document-editor-runtime-retired')) throw Error('Retired app runtime cache survived');
  report.passed = !report.errors.length;
} catch (e) {
  report.passed = false;
  report.error = String(e);
} finally {
  await fs.writeFile(
    'docs/evaluations/2026-10-03-sw-model-cache-upgrade-async-poll-corrected.json',
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(JSON.stringify(report));
  await browserContext.close();
  await context.close();
}
