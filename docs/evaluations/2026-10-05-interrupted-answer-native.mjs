import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const b = await chromium.launch({ channel: 'chromium' });
const c = await b.newContext({ serviceWorkers: 'block' });
const p = await c.newPage();
const r = { version: b.version(), errors: [] };
p.on('pageerror', (e) => r.errors.push(e.message));
await c.addInitScript(() => localStorage.setItem('agent-panel-provider', 'wllama'));
const ready = () =>
  p.waitForFunction(
    () => {
      const e = document.querySelector('#app iframe')?.contentWindow.editor;
      return e?.isDocumentLoadComplete && e?.isLoadFullApi;
    },
    null,
    { timeout: 90000 },
  );
const doc = () =>
  p.evaluate(() => document.querySelector('#app iframe').contentWindow.editor.WordControl.m_oLogicDocument.GetText());
try {
  await p.goto('http://127.0.0.1:5193/editor?new=docx&agent=1&locale=zh-CN');
  await ready();
  await p.evaluate(() => window.__toggleAgentPanel());
  await p.locator('.agent-panel-settings-toggle').click();
  await p.locator('.agent-history-save').check();
  await p
    .locator('.agent-panel-gguf-files')
    .setInputFiles('.scratch/node_modules/ai-models/Qwen_Qwen3-0.6B-Q4_K_M.gguf');
  await p.locator('.agent-panel-gguf-load').click();
  await p.waitForFunction(() => document.querySelector('.agent-panel-note')?.textContent.includes('模型已加载'), null, {
    timeout: 180000,
  });
  r.model = await p.locator('.agent-model-status').textContent();
  await p.locator('.agent-panel-settings-toggle').click();
  r.before = await doc();
  r.request = '写一篇约600字的关于海边灯塔的短篇故事。';
  await p.locator('.cui-input').fill(r.request);
  await p.locator('.cui-input').press('Enter');
  await p.waitForFunction(
    () => document.querySelector('.cui-streaming')?.getAttribute('data-source')?.length > 25,
    null,
    { timeout: 180000 },
  );
  await p.locator('.cui-send-stop').click();
  await p.waitForFunction(() => !document.querySelector('.cui-input').disabled, null, { timeout: 180000 });
  const partial = p.locator('[data-interrupted]').first();
  await partial.waitFor();
  r.partial = await partial.getAttribute('data-source');
  r.applyCount = await partial.locator('.cui-apply').count();
  r.copyCount = await partial.locator('.cui-copy').count();
  assert.equal(r.applyCount, 0);
  assert.equal(r.copyCount, 1);
  r.afterStop = await doc();
  assert.equal(r.afterStop, r.before);
  await p.locator('.cui-restore').first().click();
  assert.equal(await p.locator('.cui-input').inputValue(), r.request);
  r.requestRestored = true;
  await p.evaluate(() => {
    window.__writeCalls = [];
    const e = document.querySelector('#app iframe').contentWindow.editor;
    for (const name of ['pluginMethod_PasteHtml', 'pluginMethod_InputText']) {
      const original = e[name];
      e[name] = function (...args) {
        window.__writeCalls.push(name);
        return original.apply(this, args);
      };
    }
  });
  await p.locator('.cui-input').fill('写到当前的文档上');
  await p.locator('.cui-input').press('Enter');
  await p.waitForFunction(() => !document.querySelector('.cui-input').disabled);
  r.directWriteMessages = await p.locator('.cui-messages').innerText();
  r.writeCalls = await p.evaluate(() => window.__writeCalls);
  assert.deepEqual(r.writeCalls, []);
  assert.ok((await p.locator('.cui-msg-error').count()) > 0);
  assert.equal(await doc(), r.before);
  await p.reload();
  await ready();
  await p.evaluate(() => window.__toggleAgentPanel());
  await p.locator('.agent-panel-settings-toggle').click();
  await p.locator('.agent-history-restore').click();
  const restored = p.locator('[data-interrupted]').first();
  await restored.waitFor({ timeout: 30000 });
  r.restoredPartial = await restored.getAttribute('data-source');
  assert.equal(r.restoredPartial, r.partial);
  assert.equal(await restored.locator('.cui-apply').count(), 0);
  assert.equal(await restored.locator('.cui-copy').count(), 1);
  r.afterReload = await doc();
  assert.equal(r.afterReload, r.before);
  r.previewCount = await p.locator('.agent-plan-preview').count();
  assert.equal(r.previewCount, 0);
  assert.deepEqual(r.errors, []);
  r.pass = true;
} catch (e) {
  r.error = String(e);
  r.chat = await p
    .locator('.cui-messages')
    .innerText()
    .catch(() => null);
} finally {
  await c.close();
  r.contextClosed = true;
  await b.close();
  r.browserClosed = true;
  await fs.writeFile('.scratch/interrupted-answer-native.json', JSON.stringify(r, null, 2));
}
if (!r.pass) process.exitCode = 1;
