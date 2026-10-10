import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
const context = await chromium.launchPersistentContext('.scratch/ai-offline/profile', { viewport: { width: 1280, height: 900 } });
await context.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined, configurable: true }));
await context.route(/^http:\/\/127\.0\.0\.1:5193\//, async route => {
  const response = await route.fetch();
  await route.fulfill({ response, headers: { ...response.headers(), 'cross-origin-opener-policy': 'same-origin', 'cross-origin-embedder-policy': 'require-corp' } });
});
const page = context.pages()[0] ?? await context.newPage();
const report = { scope: 'Cached CPU model, isolated same-origin response hosting via Playwright, actual production Worker registration and response delivery, actual native Wllama thread diagnostics and online/offline inference. Diagnostic bundle instrumentation only. Not model quality, cold model download, or physical-device coverage.', results: [], errors: [] };
page.on('pageerror', error => report.errors.push(error.message));
try {
  await page.goto('http://127.0.0.1:5193/');
  report.cacheReset = await page.evaluate(async () => {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map(r => r.unregister()));
    let removed = 0;
    for (const name of await caches.keys()) {
      const cache = await caches.open(name);
      for (const request of await cache.keys()) if (/\/assets\/(?:agent-plugin|esm)-/.test(new URL(request.url).pathname)) { await cache.delete(request); removed++; }
    }
    return { registrations: registrations.length, removed };
  });
  await page.goto('about:blank');
  for (const offline of [false, true]) {
    if (offline) {
      await context.unroute(/^http:\/\/127\.0\.0\.1:5193\//);
      await context.route('**/*', route => route.abort('internetdisconnected'));
      await context.setOffline(true);
    }
    await page.goto('http://127.0.0.1:5193/editor?new=docx&agent=1&locale=en');
    if (offline) { await context.setOffline(false); await context.setOffline(true); }
    await page.frameLocator('#app iframe').locator('.agent-sidebar-entry').click({ timeout: 60000 });
    await page.waitForFunction(() => document.querySelector('.agent-panel-note')?.textContent?.includes('Model loaded'), {}, { timeout: 240000 });
    const engine = await page.locator('.agent-model-status').textContent();
    if (!engine?.includes('CPU')) throw Error('Wrong backend');
    const documentText = () => page.frameLocator('#app iframe').locator('body').evaluate(() => window.editor.WordControl.m_oLogicDocument.GetText());
    const before = await documentText();
    await page.locator('.agent-writing-task').selectOption('chat');
    const beforeReplyCount = await page.locator('.cui-msg-agent').count();
    const started = Date.now();
    await page.locator('.cui-input').fill('Reply with exactly ' + (offline ? 'OFFLINE' : 'HELLO') + '.');
    await page.locator('.cui-input').press('Enter');
    await page.waitForFunction(() => !document.querySelector('.cui-input').disabled, {}, { timeout: 240000 });
    const row = { offline, engine, responseMs: Date.now() - started, ...await page.evaluate(async () => {
      let networkRejected = false; try { await fetch('/__uncached_cpu_' + Date.now()); } catch { networkRejected = true; }
      return { runtime: window.__cpuRuntime, isolated: crossOriginIsolated, iframeIsolated: document.querySelector('#app iframe').contentWindow.crossOriginIsolated, controller: navigator.serviceWorker.controller?.scriptURL, online: navigator.onLine, networkRejected };
    }), replies: await page.locator('.cui-msg-agent').evaluateAll(rows => rows.map(row => row.getAttribute('data-source') ?? row.textContent)), errors: await page.locator('.cui-msg-error').allTextContents(), previewCount: await page.locator('.agent-plan-preview').count(), documentUnchanged: await documentText() === before };
    row.newReplies = row.replies.slice(beforeReplyCount);
    report.results.push(row);
    console.log(JSON.stringify(row));
    if (row.runtime?.threads !== 4 || !row.runtime.multithread || !row.runtime.isolated || !row.isolated || !row.iframeIsolated || !row.controller?.endsWith('/sw.js?isolation=1') || !row.documentUnchanged || row.errors.length || row.previewCount) throw Error('Runtime invariant failed');
    if (offline && (row.online || !row.networkRejected)) throw Error('Not offline');
    if (!row.newReplies.join(' ').includes(offline ? 'OFFLINE' : 'HELLO')) throw Error('Expected inference response absent');
  }
  report.passed = report.results.length === 2 && !report.errors.length;
} catch (error) { report.error = String(error); report.passed = false; process.exitCode = 1; }
finally {
  await fs.writeFile('docs/evaluations/2026-10-03-cpu-isolated-sw.json', JSON.stringify(report, null, 2) + '\n');
  await context.close();
}
