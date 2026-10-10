import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
const report = {
  scope: 'Native allocation failure copy and same-panel recovery plus small-model control; no writing-quality/full device acceptance',
  cases: [],
};
const browser = await chromium.launch({ channel: 'chromium' });
try {
  for (const [id, files, expectLoaded] of [
    [
      'allocation-failure',
      ['qwen2.5-7b-instruct-q4_k_m-00001-of-00002.gguf', 'qwen2.5-7b-instruct-q4_k_m-00002-of-00002.gguf'],
      false,
    ],
    ['small-model', ['Qwen_Qwen3-0.6B-Q4_K_M.gguf'], true],
  ]) {
    const row = { id, errors: [], console: [] };
    report.cases.push(row);
    const context = await browser.newContext({ serviceWorkers: 'block' });
    await context.addInitScript(() => {
      localStorage.setItem('agent-panel-provider', 'wllama');
      localStorage.removeItem('agent-panel-gguf-url');
    });
    try {
      const page = await context.newPage();
      page.on('pageerror', (e) => row.errors.push(e.message));
      page.on('console', (m) => {
        if (m.type() === 'error') row.console.push(m.text());
      });
      await page.goto('http://127.0.0.1:5193/editor?new=docx&agent=1&locale=zh-CN');
      await page.waitForFunction(
        () => {
          const a = document.querySelector('#app iframe')?.contentWindow?.Asc?.editor;
          return a?.isDocumentLoadComplete && a?.isLoadFullApi;
        },
        null,
        { timeout: 90000 },
      );
      await page.evaluate(async () => {
        const { Wllama } = await import('/assets/client-D5_UYdz1.js');
        window.__probe = { loads: 0, counts: [], completions: 0, exits: 0 };
        const load = Wllama.prototype.loadModel;
        Wllama.prototype.loadModel = async function (...args) {
          window.__probe.loads++;
          const result = await load.apply(this, args);
          const c = this.getLoadedContextInfo();
          window.__probe.context = { n_vocab: c.n_vocab, n_ctx: c.n_ctx, actualThreads: this.getNumThreads() };
          return result;
        };
        const count = Wllama.prototype.countChatTokens;
        Wllama.prototype.countChatTokens = async function (request) {
          const p = { messages: request.messages };
          window.__probe.counts.push(p);
          try {
            const result = await count.call(this, request);
            p.result = result;
            return result;
          } catch (e) {
            p.error = String(e);
            throw e;
          }
        };
        const complete = Wllama.prototype.createChatCompletion;
        Wllama.prototype.createChatCompletion = function (...args) {
          window.__probe.completions++;
          return complete.apply(this, args);
        };
        const exit = Wllama.prototype.exit;
        Wllama.prototype.exit = function (...args) {
          window.__probe.exits++;
          return exit.apply(this, args);
        };
      });
      await page.evaluate(() => window.__toggleAgentPanel());
      await page.locator('.agent-panel-settings-toggle').click();
      await page
        .locator('.agent-panel-gguf-files')
        .setInputFiles(files.map((f) => '.scratch/node_modules/ai-models/' + f));
      await page.locator('.agent-panel-gguf-load').click();
      await page.waitForFunction(
        () => !document.querySelector('.agent-panel-gguf-load').hasAttribute('disabled'),
        null,
        { timeout: 180000 },
      );
      row.note = await page.locator('.agent-panel-note').textContent();
      row.status = await page.locator('.agent-model-status').textContent();
      row.chatErrors = await page.locator('.cui-msg-error').allTextContents();
      row.startupProbe = await page.evaluate(() => window.__probe);
      row.loaded = row.note.includes('模型已加载');
      if (row.loaded !== expectLoaded) throw Error('Native startup readiness outcome mismatch');
      if (expectLoaded) {
        await page.locator('.agent-panel-settings-toggle').click();
        await page.locator('.cui-input').fill('Say hello in English.');
        await page.locator('.cui-input').press('Enter');
        await page.waitForFunction(() => !document.querySelector('.cui-input').disabled, null, { timeout: 180000 });
        row.replies = await page.locator('.cui-msg-agent').allTextContents();
        row.chatErrors = await page.locator('.cui-msg-error').allTextContents();
        row.afterChatProbe = await page.evaluate(() => window.__probe);
        if (!row.replies.length || row.chatErrors.length || row.afterChatProbe.completions !== 1)
          throw Error('Small-model chat unavailable');
      } else if (
        row.startupProbe.loads !== 1 ||
        row.startupProbe.exits !== 1 ||
        row.startupProbe.completions !== 0 ||
        !row.startupProbe.counts[0]?.error
      )
        throw Error('Failure cleanup/preflight mismatch');
      if (!expectLoaded) {
        if (row.note !== '模型加载失败。请重试或选择其他模型。') throw Error('Generic failure copy mismatch');
        await page.locator('.agent-panel-gguf-files').setInputFiles('.scratch/node_modules/ai-models/Qwen_Qwen3-0.6B-Q4_K_M.gguf');
        await page.locator('.agent-panel-gguf-load').click();
        await page.waitForFunction(() => !document.querySelector('.agent-panel-gguf-load').hasAttribute('disabled'), null, {timeout:180000});
        row.recoveryNote=await page.locator('.agent-panel-note').textContent();
        row.recoveryProbe=await page.evaluate(()=>window.__probe);
        if (!row.recoveryNote.includes('模型已加载') || row.recoveryProbe.loads!==2 || row.recoveryProbe.completions!==0) throw Error('Same-panel model recovery failed');
        await page.locator('.agent-panel-settings-toggle').click();
        await page.locator('.cui-input').fill('Say hello in English.');await page.locator('.cui-input').press('Enter');
        await page.waitForFunction(()=>!document.querySelector('.cui-input').disabled,null,{timeout:180000});
        row.recoveryReplies=await page.locator('.cui-msg-agent').allTextContents();row.recoveryErrors=await page.locator('.cui-msg-error').allTextContents();row.afterRecoveryChatProbe=await page.evaluate(()=>window.__probe);
        if(!row.recoveryReplies.length || row.afterRecoveryChatProbe.completions!==1 || row.recoveryErrors.length>row.chatErrors.length) throw Error('Same-panel recovery chat failed');
      }
      row.passed = !row.errors.length;
    } catch (e) {
      row.error = String(e);
      row.passed = false;
    } finally {
      await context.close();
      row.closed = true;
      await fs.writeFile('.scratch/2026-10-07-neutral-load-error-native.json', JSON.stringify(report, null, 2));
    }
  }
} finally {
  await browser.close();
  report.closed = true;
  await fs.writeFile('.scratch/2026-10-07-neutral-load-error-native.json', JSON.stringify(report, null, 2));
}
if (report.cases.some((x) => !x.passed)) process.exitCode = 1;
