import { webkit } from '@playwright/test';
import fs from 'node:fs/promises';
const b = await webkit.launch(),
  c = await b.newContext(),
  p = await c.newPage(),
  r = { events: [] };
let phase = 'home';
p.on('pageerror', (e) => r.events.push({ type: 'pageerror', phase, message: e.message, stack: e.stack }));
p.on('requestfailed', (q) => {
  if (q.url().includes('spell'))
    r.events.push({ type: 'failed', phase, url: q.url(), failure: q.failure(), headers: q.headers() });
});
p.on('response', async (q) => {
  if (q.url().includes('spell'))
    r.events.push({ type: 'response', phase, url: q.url(), status: q.status(), headers: await q.allHeaders() });
});
try {
  await p.goto('http://127.0.0.1:5193/');
  phase = 'import';
  const f = p.waitForEvent('filechooser');
  await p.locator('#hero-open').click();
  await (await f).setFiles('.scratch/webkit-embedded-font-native-saved.docx');
  const ready = () =>
    p.waitForFunction(
      () =>
        document.querySelector('#app iframe')?.contentWindow?.Asc?.editor?.isLoadFullApi &&
        new URL(location.href).searchParams.has('saved'),
      null,
      { timeout: 90000 },
    );
  await ready();
  await p.waitForTimeout(3000);
  for (let i = 1; i <= 2; i++) {
    phase = 'reload' + i;
    await p.reload();
    await ready();
    await p.waitForTimeout(5000);
  }
} catch (e) {
  r.error = String(e);
} finally {
  await c.close();
  await b.close();
  await fs.writeFile('.scratch/webkit-spell-reload-probe.json', JSON.stringify(r, null, 2));
  console.log(JSON.stringify(r));
}
