import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
const c = await chromium.launch({});
const context = await c.newContext({ serviceWorkers: 'block' });
await context.addInitScript(() => {
  if (window === window.top) return;
  window.__functionCalls = { count: 0, sites: [] };
  const original = Function;
  const observe = (args) => {
    window.__functionCalls.count++;
    const stack = new Error().stack?.split('\n').slice(2, 9).join('\n');
    let row = window.__functionCalls.sites.find((r) => r.stack === stack);
    if (row) row.count++;
    else if (window.__functionCalls.sites.length < 40)
      window.__functionCalls.sites.push({ stack, count: 1, bodyLength: String(args.at(-1) ?? '').length });
  };
  window.Function = new Proxy(original, {
    apply(target, thisArg, args) {
      observe(args);
      return Reflect.apply(target, thisArg, args);
    },
    construct(target, args, newTarget) {
      observe(args);
      return Reflect.construct(target, args, newTarget);
    },
  });
});
const report = {
  scope:
    'Actual fresh native editor startup under current host policies, observer-only Function proxy in vendor frames; no body text captured, no CSP weakening, no native Save or AI inference claim.',
  rows: [],
  passed: true,
};
try {
  for (const type of ['docx', 'xlsx', 'pptx']) {
    const p = await context.newPage();
    const errors = [];
    p.on('pageerror', (e) => errors.push(e.message));
    const row = { type, status: 'running', errors };
    try {
      await p.goto('http://127.0.0.1:5193/editor?new=' + type + '&locale=en');
      await p.waitForFunction(
        () => {
          const w = document.querySelector('#app iframe')?.contentWindow;
          const a = w?.editor ?? w?.Asc?.editor;
          return a?.isDocumentLoadComplete && a?.isLoadFullApi && !a.isLongAction?.();
        },
        null,
        { timeout: 90000 },
      );
      row.functions = await p
        .frameLocator('#app iframe')
        .locator('body')
        .evaluate(() => window.__functionCalls);
      row.status = 'completed';
      if (errors.length) throw Error('Unexpected startup errors');
    } catch (e) {
      row.status = 'failed';
      row.error = String(e);
      report.passed = false;
    } finally {
      report.rows.push(row);
      await p.close();
      console.log(type, row.status, row.functions?.count);
    }
  }
} finally {
  await c.close();
  await fs.writeFile(
    'docs/evaluations/2026-10-03-vendor-function-dependencies.json',
    JSON.stringify(report, null, 2) + '\n',
  );
  if (!report.passed) process.exitCode = 1;
}
