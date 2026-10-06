import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
const browser = await chromium.launch();
const report = {
  scope:
    'Actual native startup with response-local candidate CSP; legacy unsafe-eval retained. Synthetic script controls only, no edit/Save/offline or deployed-policy claim.',
  rows: [],
  passed: true,
};
try {
  for (const mode of ['baseline', 'candidate'])
    for (const type of ['docx', 'xlsx', 'pptx']) {
      const context = await browser.newContext({ serviceWorkers: 'block' });
      let requests = 0,
        policy;
      await context.route('https://controlled-script.example/probe.js', async (route) => {
        requests++;
        await route.fulfill({
          contentType: 'application/javascript',
          headers: { 'access-control-allow-origin': '*', 'cross-origin-resource-policy': 'cross-origin' },
          body: 'window.__foreignScriptExecuted=true;',
        });
      });
      if (mode === 'candidate')
        await context.route('**/web-apps/apps/*/main/index.html?**', async (route) => {
          const response = await route.fetch();
          const body = await response.text();
          const hashes = [...body.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
            .filter((m) => !/\bsrc\s*=/i.test(m[1]) && m[2].trim())
            .map((m) => `'sha256-${createHash('sha256').update(m[2]).digest('base64')}'`);
          policy = `default-src 'self'; script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval' ${hashes.join(' ')}; script-src-attr 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data: blob:; worker-src 'self' blob:; frame-src 'self' blob:; connect-src 'self' https: http: blob:; object-src 'none'; base-uri 'self'`;
          await route.fulfill({ response, headers: { ...response.headers(), 'content-security-policy': policy } });
        });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      const row = { mode, type, errors, status: 'running' };
      try {
        await page.goto(`http://127.0.0.1:5193/editor?new=${type}&locale=en`);
        await page.waitForFunction(
          () => {
            const w = document.querySelector('#app iframe')?.contentWindow;
            const a = w?.editor ?? w?.Asc?.editor;
            return a?.isDocumentLoadComplete && a?.isLoadFullApi && !a.isLongAction?.();
          },
          null,
          { timeout: 90000 },
        );
        row.controls = await page
          .frameLocator('#app iframe')
          .locator('body')
          .evaluate(async () => {
            window.__foreignScriptExecuted = false;
            window.__inlineScriptExecuted = false;
            window.__eventExecuted = false;
            const violations = [];
            const listen = (e) => violations.push({ directive: e.effectiveDirective, blocked: e.blockedURI });
            document.addEventListener('securitypolicyviolation', listen);
            const inline = document.createElement('script');
            inline.textContent = 'window.__inlineScriptExecuted=true';
            document.head.append(inline);
            const button = document.createElement('button');
            button.setAttribute('onclick', 'window.__eventExecuted=true');
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
            return {
              foreign: window.__foreignScriptExecuted,
              inline: window.__inlineScriptExecuted,
              event: window.__eventExecuted,
              evalValue: window.eval('1+1'),
              violations,
            };
          });
        const allowed = mode === 'baseline';
        if (
          errors.length ||
          row.controls.foreign !== allowed ||
          row.controls.inline !== allowed ||
          row.controls.event !== allowed ||
          row.controls.evalValue !== 2 ||
          requests !== (allowed ? 1 : 0)
        )
          throw Error('Script boundary controls did not match');
        row.status = 'completed';
      } catch (e) {
        row.status = 'failed';
        row.error = String(e);
        report.passed = false;
      }
      row.policy = policy ?? null;
      row.foreignRequests = requests;
      report.rows.push(row);
      console.log(mode, type, row.status);
      await context.close();
    }
} finally {
  await browser.close();
  await fs.writeFile(
    'docs/evaluations/2026-10-03-vendor-script-boundaries.json',
    JSON.stringify(report, null, 2) + '\n',
  );
  if (!report.passed) process.exitCode = 1;
}
