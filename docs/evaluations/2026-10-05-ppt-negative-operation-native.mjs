import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
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
  await p.goto('http://127.0.0.1:5193/editor?new=pptx&agent=1&locale=zh-CN');
  await p.frameLocator('#app iframe').locator('#right-menu').waitFor({ timeout: 90000 });
  await p.evaluate(() => window.__toggleAgentPanel());
  await p.locator('.agent-panel').waitFor();
  await p.locator('.agent-panel-settings-toggle').click();
  const input = p.locator('.agent-panel-gguf-files');
  await input.setInputFiles('.scratch/node_modules/ai-models/Qwen_Qwen3-0.6B-Q4_K_M.gguf');
  await p.locator('.agent-panel-gguf-load').click();
  await p.waitForFunction(
    () => document.querySelector('.agent-panel-note')?.textContent?.includes('模型已加载'),
    null,
    { timeout: 180000 },
  );
  r.loadedNote = await p.locator('.agent-panel-note').textContent();
  r.loadedStatus = await p.locator('.agent-model-status').textContent();
  assert.equal(r.loadedStatus, 'CPU · Qwen_Qwen3-0.6B-Q4_K_M.gguf');
  r.loadedFilename = await p.locator('.agent-panel-gguf-filenames').textContent();
  assert.equal(r.loadedFilename, 'Qwen_Qwen3-0.6B-Q4_K_M.gguf');

  await p.locator('.agent-panel-settings-toggle').click();
  await p.locator('.agent-writing-task').selectOption('tools');
  const state = () =>
    p.evaluate(() => {
      const e = document.querySelector('#app iframe').contentWindow.editor;
      return { count: e.WordControl.m_oLogicDocument.Slides.length, page: e.getCurrentPage() };
    });
  r.before = await state();
  r.request = process.env.PROBE_REQUEST;
  await p.locator('.cui-input').fill(r.request);
  await p.locator('.cui-input').press('Enter');
  await p.waitForFunction(() => !document.querySelector('.cui-input').disabled, null, { timeout: 180000 });
  r.after = await state();
  r.chat = await p.locator('.cui-messages').innerText();
  r.noSlideMutation = r.before.count === r.after.count;
} finally {
  await c.close();
  r.contextClosed = true;
  await b.close();
  r.browserClosed = true;
  await fs.writeFile('.scratch/negative-ppt.json', JSON.stringify(r, null, 2));
}
