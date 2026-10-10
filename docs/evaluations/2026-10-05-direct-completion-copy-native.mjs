import { chromium, webkit } from '@playwright/test';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const rows = [];
for (const [engine, launcher] of [
  ['chromium', chromium],
  ['webkit', webkit],
]) {
  const b = await launcher.launch(engine === 'chromium' ? { channel: 'chromium' } : {});
  const c = await b.newContext({ serviceWorkers: 'block' });
  const p = await c.newPage();
  const r = { engine, version: b.version(), errors: [] };
  rows.push(r);
  p.on('pageerror', (e) => r.errors.push(e.message));
  await c.addInitScript(() => localStorage.setItem('agent-panel-provider', 'wllama'));
  try {
    await p.goto('http://127.0.0.1:5193/editor?new=pptx&agent=1&locale=zh-CN');
    await p.waitForFunction(
      () =>
        document.querySelector('#app iframe')?.contentWindow.editor?.WordControl?.m_oLogicDocument?.Slides?.length ===
          1 &&
        document.querySelector('#app iframe').contentWindow.editor.isDocumentLoadComplete &&
        document.querySelector('#app iframe').contentWindow.editor.isLoadFullApi,
      null,
      { timeout: 90000 },
    );
    await p.evaluate(() => window.__toggleAgentPanel());
    await p.locator('.agent-panel').waitFor();
    const count = () =>
      p.evaluate(
        () => document.querySelector('#app iframe').contentWindow.editor.WordControl.m_oLogicDocument.Slides.length,
      );
    r.before = await count();
    await p.locator('.cui-input').fill('新增幻灯片');
    await p.locator('.cui-input').press('Enter');
    await p.waitForFunction(
      () => document.querySelector('#app iframe').contentWindow.editor.WordControl.m_oLogicDocument.Slides.length === 2,
      null,
      { timeout: 30000 },
    );
    await p.waitForFunction(() => !document.querySelector('.cui-input').disabled);
    r.after = await count();
    r.status = await p.locator('.cui-activity > div').allTextContents();
    assert.ok(r.status.includes('已完成，可以撤销。'));
    await p.evaluate(() => document.querySelector('#app iframe').contentWindow.editor.Undo());
    r.undo = await count();
    assert.equal(r.undo, 1);
    await p.evaluate(() => document.querySelector('#app iframe').contentWindow.editor.Redo());
    r.redo = await count();
    assert.equal(r.redo, 2);
    assert.deepEqual(r.errors, []);
    r.previewCount = await p.locator('.agent-plan-preview').count();
    assert.equal(r.previewCount, 0);
    r.pass = true;
  } catch (e) {
    r.error = String(e);
    r.chat = await p
      .locator('.cui-messages')
      .innerText()
      .catch(() => null);
    r.input = await p
      .locator('.cui-input')
      .inputValue()
      .catch(() => null);
    r.editorState = await p
      .evaluate(() => {
        const e = document.querySelector('#app iframe')?.contentWindow.editor;
        return { ready: e?.isDocumentLoadComplete, api: e?.isLoadFullApi };
      })
      .catch(() => null);
  } finally {
    await c.close();
    r.contextClosed = true;
    await b.close();
    r.browserClosed = true;
    await fs.writeFile('.scratch/direct-copy-native.json', JSON.stringify(rows, null, 2));
  }
}
if (rows.some((r) => !r.pass)) process.exitCode = 1;
