import { chromium, webkit } from '@playwright/test';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const rows = [];
for (const [engine, launcher] of [
  ['chromium', chromium],
  ['webkit', webkit],
])
  for (const locale of ['zh-CN', 'en']) {
    if (process.env.PROBE_ENGINE && (engine !== process.env.PROBE_ENGINE || locale !== process.env.PROBE_LOCALE))
      continue;
    const b = await launcher.launch(engine === 'chromium' ? { channel: 'chromium' } : {});
    const c = await b.newContext({ serviceWorkers: 'block' });
    const p = await c.newPage();
    const r = { engine, locale, version: b.version(), errors: [] };
    rows.push(r);
    p.on('pageerror', (e) => r.errors.push(e.message));
    await c.addInitScript(() => localStorage.setItem('agent-panel-provider', 'wllama'));
    const text = () =>
      p.evaluate(() =>
        document.querySelector('#app iframe').contentWindow.editor.WordControl.m_oLogicDocument.GetText(),
      );
    const send = async (request) => {
      await p.locator('.cui-input').fill(request);
      await p.locator('.cui-input').focus();
      await p.evaluate(() => {
        window.__keys = [];
        document.addEventListener(
          'keydown',
          (e) =>
            window.__keys.push({ key: e.key, code: e.keyCode, composing: e.isComposing, target: e.target.className }),
          { once: true, capture: true },
        );
      });
      await p.locator('.cui-input').press('Enter');
      r.lastKeys = await p.evaluate(() => window.__keys);
      await p.locator('.cui-msg-user').filter({ hasText: request }).last().waitFor({ timeout: 10000 });
      await p.waitForFunction(() => !document.querySelector('.cui-input').disabled);
    };
    try {
      await p.goto(`http://127.0.0.1:5193/editor?new=docx&agent=1&locale=${locale}`);
      await p.waitForFunction(
        () => {
          const e = document.querySelector('#app iframe')?.contentWindow.editor;
          return e?.isDocumentLoadComplete && e?.isLoadFullApi;
        },
        null,
        { timeout: 90000 },
      );
      await p.evaluate(() => window.__toggleAgentPanel());
      await p.locator('.agent-panel').waitFor();
      r.before = await text();
      await p.evaluate(() => {
        window.__actions = [];
        const e = document.querySelector('#app iframe').contentWindow.editor;
        for (const n of ['pluginMethod_PasteHtml', 'pluginMethod_InputText', 'put_PrAlign']) {
          const f = e[n];
          e[n] = function (...args) {
            window.__actions.push(n);
            return f.apply(this, args);
          };
        }
      });
      await send('write the previous answer into the document');
      r.missingAnswer = await p.locator('.cui-msg-error').last().innerText();
      assert.ok(
        r.missingAnswer.includes(
          locale === 'zh-CN'
            ? '请先生成一条完整回答，再写入文档。'
            : 'Generate a complete answer before writing it to the document.',
        ),
      );
      assert.equal(await text(), r.before);
      assert.deepEqual(await p.evaluate(() => window.__actions), []);
      await p.evaluate(() =>
        document.querySelector('#app iframe').contentWindow.editor.pluginMethod_InputText('GUIDANCE_SELECTION'),
      );
      await p.waitForFunction(() =>
        document
          .querySelector('#app iframe')
          .contentWindow.editor.WordControl.m_oLogicDocument.GetText()
          .includes('GUIDANCE_SELECTION'),
      );
      await p.evaluate(() => {
        const e = document.querySelector('#app iframe').contentWindow.editor;
        e.asc_EditSelectAll();
        window.__actions = [];
      });
      r.selected = await p.evaluate(() =>
        document.querySelector('#app iframe').contentWindow.editor.pluginMethod_GetSelectedText(),
      );
      assert.ok(r.selected.includes('GUIDANCE_SELECTION'));
      r.beforeAlignment = await text();
      await send('align current paragraph center');
      r.conflict = await p.locator('.cui-msg-error').last().innerText();
      assert.ok(
        r.conflict.includes(
          locale === 'zh-CN'
            ? '请取消选区后对齐当前段落，或明确要求对齐选区。'
            : 'Clear the selection to align the current paragraph, or ask to align the selection.',
        ),
      );
      assert.equal(await text(), r.beforeAlignment);
      r.actions = await p.evaluate(() => window.__actions);
      assert.deepEqual(r.actions, []);
      assert.deepEqual(r.errors, []);
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
      r.sendDisabled = await p
        .locator('.cui-send')
        .isDisabled()
        .catch(() => null);
    } finally {
      await c.close();
      r.contextClosed = true;
      await b.close();
      r.browserClosed = true;
      await fs.writeFile('.scratch/action-guidance-native-verified.json', JSON.stringify(rows, null, 2));
    }
  }
if (rows.some((r) => !r.pass)) process.exitCode = 1;
