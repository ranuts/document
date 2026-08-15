import { readFileSync } from 'node:fs';
import { test } from '@playwright/test';
declare function post(type: string, payload?: Record<string, unknown>): Promise<any>;
const REAL = '/private/tmp/claude-501/-Users-ranzhouhang-Desktop-document/021a5801-9d05-4965-a971-2d6044ad3af4/scratchpad/real.xlsx';
const NAMES = ['schedule.xlsx', '公司工作作息时间.xlsx'];
for (const name of NAMES) {
  test(`debug real open ${name}`, async ({ page }) => {
    test.setTimeout(200_000);
    const logs: string[] = [];
    page.on('console', (m) => { if (m.type() === 'error') logs.push(m.text().slice(0, 300)); });
    await page.addInitScript(() => {
      const top = window.top as any;
      top.__dbg ??= [];
      window.addEventListener('unhandledrejection', (e: any) => top.__dbg.push('rej: ' + String(e.reason?.message || e.reason).slice(0, 300)));
      const timer = setInterval(() => {
        const api = (window as any).Asc?.editor;
        if (api && typeof api.asc_registerCallback === 'function' && !(api as any).__dbgHooked) {
          (api as any).__dbgHooked = true;
          api.asc_registerCallback('asc_onError', (id: unknown, level: unknown) => top.__dbg.push(`asc_onError ${id} ${level}`));
          clearInterval(timer);
        }
      }, 100);
    });
    const bytes = readFileSync(REAL);
    await page.route('**/__corpus__/doc', (route) => route.fulfill({ status: 200, contentType: 'application/octet-stream', body: bytes }));
    await page.goto('/embed-demo.html');
    await page.locator('#status').filter({ hasText: 'ready' }).waitFor({ timeout: 60_000 });
    const r = await page.evaluate(async (fileName) => {
      const buf = await (await fetch('/__corpus__/doc')).arrayBuffer();
      await post('document:open-buffer', { fileName, buffer: buf, readonly: false }).catch((e) => (window as any).__dbg.push('post rejected: ' + e));
      const t = Date.now();
      const visit = (win: Window): any => { try { const a = (win as any).Asc?.editor; if (a && 'isDocumentLoadComplete' in a) return a; } catch {} for (let i = 0; i < win.frames.length; i++) { const f = visit(win.frames[i]); if (f) return f; } return null; };
      while (Date.now() - t < 120_000) { const api = visit(window); if (api?.isDocumentLoadComplete) return { loaded: true, ms: Date.now() - t }; await new Promise((r) => setTimeout(r, 500)); }
      return { loaded: false };
    }, name);
    const dbg = await page.evaluate(() => (window as any).__dbg);
    console.log(`RESULT ${name}: ${JSON.stringify(r)} dbg=${JSON.stringify(dbg)} errs=${JSON.stringify(logs)}`);
  });
}
