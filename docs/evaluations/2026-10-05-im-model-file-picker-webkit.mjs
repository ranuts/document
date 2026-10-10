import { webkit } from '@playwright/test';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const b = await webkit.launch();
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
  const input = p.locator('.agent-panel-gguf-files');
  assert.equal(await input.getAttribute('aria-label'), '选择模型文件');
  await input.focus();
  const chooserPromise = p.waitForEvent('filechooser');
  await p.keyboard.press('Enter');
  const chooser = await chooserPromise;
  await chooser.setFiles([
    {
      name: 'local-model-part-01.gguf',
      mimeType: 'application/octet-stream',
      buffer: Buffer.from('diagnostic file, not a model'),
    },
    {
      name: 'local-model-part-02.gguf',
      mimeType: 'application/octet-stream',
      buffer: Buffer.from('diagnostic second file'),
    },
  ]);
  assert.equal(
    await p.locator('.agent-panel-gguf-filenames').textContent(),
    'local-model-part-01.gguf, local-model-part-02.gguf',
  );
  r.keyboardPicker = true;
  r.nativeFileCount = await input.evaluate((el) => el.files.length);
  await p.screenshot({ path: '.scratch/file-picker-webkit-selected.png' });
  r.selectedOverflow = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  assert.equal(r.selectedOverflow, false);
  const url = p.locator('.agent-panel-gguf-url');
  await url.evaluate((el) => {
    el.value = 'https://example.com/model.gguf';
    el.dispatchEvent(new Event('change'));
  });
  assert.equal(await p.locator('.agent-panel-gguf-filenames').textContent(), '');
  assert.equal(await input.evaluate((el) => el.files.length), 0);
  r.urlClearsFiles = true;
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
} finally {
  await c.close();
  r.contextClosed = true;
  await b.close();
  r.browserClosed = true;
  await fs.writeFile('.scratch/file-picker-webkit-loaded.json', JSON.stringify(r, null, 2));
}
