import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
const b = await chromium.launch({ channel: 'chromium' });
const c = await b.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 900 } });
const p = await c.newPage();
const r = { browser: b.version(), errors: [], blockedExternal: [], views: [] };
p.on('pageerror', (e) => r.errors.push(e.message));
await c.route('**/*', (route) => {
  const u = new URL(route.request().url());
  if (['127.0.0.1', 'localhost'].includes(u.hostname) || ['blob:', 'data:'].includes(u.protocol))
    return route.continue();
  r.blockedExternal.push(u.origin + u.pathname);
  return route.abort();
});
await c.addInitScript(() => {
  localStorage.setItem('agent-panel-provider', 'wllama');
  localStorage.removeItem('agent-panel-gguf-url');
});
try {
  await p.goto('http://127.0.0.1:5193/editor?new=docx&agent=1&locale=zh-CN');
  await p.frameLocator('#app iframe').locator('#right-menu').waitFor({ timeout: 90000 });
  await p.evaluate(() => window.__toggleAgentPanel());
  await p.locator('.agent-panel').waitFor();
  for (const width of [1280, 390]) {
    await p.setViewportSize({ width, height: 900 });
    await p.screenshot({ path: '.scratch/im-current-' + width + '.png' });
    r.views.push(
      await p.evaluate(() => ({
        width: innerWidth,
        panel: document.querySelector('.agent-panel').getBoundingClientRect().toJSON(),
        overflow: document.documentElement.scrollWidth > innerWidth,
        text: document.querySelector('.agent-panel').innerText,
      })),
    );
  }
  await p.locator('.agent-panel-settings-toggle').click();
  await p.screenshot({ path: '.scratch/im-current-settings.png' });
  r.views.push(
    await p.evaluate(() => ({
      settings: true,
      width: innerWidth,
      text: document.querySelector('.agent-panel').innerText,
      scrollWidth: document.querySelector('.agent-panel-settings').scrollWidth,
      clientWidth: document.querySelector('.agent-panel-settings').clientWidth,
    })),
  );
} finally {
  await c.close();
  r.contextClosed = true;
  await b.close();
  r.browserClosed = true;
  await fs.writeFile('.scratch/im-current-audit.json', JSON.stringify(r, null, 2));
}
