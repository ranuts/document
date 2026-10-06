import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
const prompts = [
  {
    source:
      '会议记录：周宁已收到实验报告，但尚未批准上线。上线审批由许岚负责，预计周四完成。报告收件与上线审批是不同事项，目前没有上线批准结果。以上记录用于项目状态同步。',
    instruction: '压缩为一句中文摘要，保留收件人、审批人、尚未批准和预计完成时间，不要补充事实。',
  },
  {
    source:
      '项目状态：宋远建议周五交付样机，但该交付方案未获批准。只有韩岚确认预算后才能采购零件，目前预算仍待确认。采购条件尚未满足，周五交付不是已经确定的承诺。以上记录供项目组同步使用。',
    instruction: '压缩为一句中文摘要，保留建议性质、未批准状态、采购前提和预算待确认状态，不要补充事实。',
  },
];
const report = {
  runtime: 'cpu-structured-temperature',
  protocol: '2026-10-05-cpu-structured-temperature.md',
  model: 'Qwen_Qwen3-0.6B-Q4_K_M.gguf',
  cases: [],
};
const browser = await chromium.launch({ channel: 'chromium' });
report.browserVersion = browser.version();
try {
  for (const prompt of prompts)
    for (const variant of ['product']) {
      const row = { prompt, variant, errors: [] };
      report.cases.push(row);
      const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 900 } });
      await context.addInitScript(() => {
        if (window === top) {
          localStorage.setItem('agent-panel-provider', 'wllama');
          localStorage.removeItem('agent-panel-gguf-url');
        }
      });
      try {
        const page = await context.newPage();
        page.on('pageerror', (e) => row.errors.push(e.message));
        await page.goto('http://127.0.0.1:5193/editor?new=docx&agent=1&locale=zh-CN');
        await page.frameLocator('#app iframe').locator('.agent-sidebar-entry').click({ timeout: 90000 });
        await page.locator('.agent-panel-settings-toggle').click();
        await page
          .locator('.agent-panel-gguf-files')
          .setInputFiles('.scratch/node_modules/ai-models/Qwen_Qwen3-0.6B-Q4_K_M.gguf');
        await page.locator('.agent-panel-gguf-load').click();
        await page.waitForFunction(
          () => document.querySelector('.agent-panel-note')?.textContent?.includes('模型已加载'),
          null,
          { timeout: 180000 },
        );
        row.modelNote = await page.locator('.agent-panel-note').textContent();
        row.modelStatus = await page.locator('.agent-model-status').textContent();
        await page.locator('.agent-panel-settings-toggle').click();
        await page.evaluate((text) => {
          const api = document.querySelector('#app iframe').contentWindow.Asc.editor;
          api.pluginMethod_InputText(text);
          api.asc_EditSelectAll();
        }, prompt.source);
        row.selected = await page.evaluate(() =>
          document.querySelector('#app iframe').contentWindow.Asc.editor.pluginMethod_GetSelectedText(),
        );
        await page.locator('.agent-writing-task').selectOption('summarize');
        row.documentBefore = await page.evaluate(() =>
          document.querySelector('#app iframe').contentWindow.Asc.editor.WordControl.m_oLogicDocument.GetText(),
        );
        await page.evaluate(
          async ({ variant, candidate }) => {
            const { Wllama } = await import('/assets/client-D5_UYdz1.js');
            const adjust = (request) => {
              if (variant === 'product') return request;
              const users = request.messages.filter((m) => m.role === 'user');
              if (users.length !== 1) throw Error('Ambiguous user messages');
              const lines = users[0].content.split('\n').filter((line) => line.startsWith('{"task":'));
              if (lines.length !== 1) throw Error('Ambiguous task JSON');
              const task = JSON.parse(lines[0]);
              if (task.task !== 'summarize' || task.targetLanguage !== 'source') throw Error('Unexpected task');
              return {
                ...request,
                messages: [
                  { role: 'system', content: candidate.system },
                  { role: 'user', content: lines[0] },
                ],
              };
            };
            const count = Wllama.prototype.countChatTokens;
            window.__counts = [];
            Wllama.prototype.countChatTokens = function (request) {
              request = adjust(request);
              const { abortSignal: _abortSignal, ...body } = request;
              window.__counts.push(JSON.parse(JSON.stringify(body)));
              return count.call(this, request);
            };
            const original = Wllama.prototype.createChatCompletion;
            window.__streamProbe = [];
            Wllama.prototype.createChatCompletion = function (request) {
              const originalMessages = structuredClone(request.messages);
              request = adjust(request);
              const { abortSignal: _abortSignal, ...rest } = request;
              const probe = { originalMessages, request: JSON.parse(JSON.stringify(rest)), chunks: [] };
              window.__streamProbe.push(probe);
              return Promise.resolve(original.call(this, request)).then((result) => {
                if (!result?.[Symbol.asyncIterator]) {
                  probe.completion = result;
                  return result;
                }
                return (async function* () {
                  try {
                    for await (const chunk of result) {
                      probe.chunks.push(JSON.parse(JSON.stringify(chunk)));
                      yield chunk;
                    }
                    probe.done = true;
                  } catch (e) {
                    probe.error = String(e);
                    throw e;
                  }
                })();
              });
            };
          },
          {
            variant,
            candidate: JSON.parse(
              await fs.readFile('docs/evaluations/2026-10-05-summary-consistent-candidate.json', 'utf8'),
            ),
          },
        );
        await page.locator('.cui-input').fill(prompt.instruction);
        const start = Date.now();
        await page.locator('.cui-input').press('Enter');
        await page.waitForFunction(() => !document.querySelector('.cui-input').disabled, null, { timeout: 240000 });
        row.durationMs = Date.now() - start;
        row.toolMessages = await page.locator('.cui-msg-tool').allTextContents();
        row.previewCount = await page.locator('.agent-plan-preview').count();
        row.chatErrors = await page.locator('.cui-msg-error').allTextContents();
        row.documentAfter = await page.evaluate(() =>
          document.querySelector('#app iframe').contentWindow.Asc.editor.WordControl.m_oLogicDocument.GetText(),
        );
        row.documentUnchanged = row.documentBefore === row.documentAfter;
        if (!row.documentUnchanged) {
          await page.evaluate(() => document.querySelector('#app iframe').contentWindow.Asc.editor.Undo());
          row.afterUndo = await page.evaluate(() =>
            document.querySelector('#app iframe').contentWindow.Asc.editor.WordControl.m_oLogicDocument.GetText(),
          );
          await page.evaluate(() => document.querySelector('#app iframe').contentWindow.Asc.editor.Redo());
          row.afterRedo = await page.evaluate(() =>
            document.querySelector('#app iframe').contentWindow.Asc.editor.WordControl.m_oLogicDocument.GetText(),
          );
        }
        row.sdk = await page.evaluate(() => window.__streamProbe);
        row.counts = await page.evaluate(() => window.__counts);
        if (row.sdk.length !== 1 || row.sdk[0].request.temperature !== 0)
          throw Error('Structured CPU temperature not zero');
        if (JSON.stringify(row.counts.at(-1)) !== JSON.stringify(row.sdk[0].request))
          throw Error('Count/completion request mismatch');
        if (row.chatErrors.length || row.errors.length || row.previewCount) throw Error('Errors or preview UI');
        const beforeChat = row.documentAfter;
        await page.locator('.agent-writing-task').selectOption('chat');
        await page.locator('.cui-input').fill('只回答 OK。');
        await page.locator('.cui-input').press('Enter');
        await page.waitForFunction(() => !document.querySelector('.cui-input').disabled, null, { timeout: 240000 });
        row.afterChat = await page.evaluate(() =>
          document.querySelector('#app iframe').contentWindow.Asc.editor.WordControl.m_oLogicDocument.GetText(),
        );
        row.allSDK = await page.evaluate(() => window.__streamProbe);
        row.allCounts = await page.evaluate(() => window.__counts);
        const chatRequest = row.allSDK.at(-1).request;
        if (chatRequest.temperature !== 0.7 || chatRequest.response_format)
          throw Error('Chat settings changed by structured request');
        if (row.afterChat !== beforeChat) throw Error('Ordinary chat changed native document');
        if (JSON.stringify(row.allCounts.at(-1)) !== JSON.stringify(chatRequest))
          throw Error('Chat count/completion mismatch');
        row.finished = true;
      } catch (e) {
        row.error = String(e);
      } finally {
        await context.close();
        row.contextClosed = true;
        await fs.writeFile('.scratch/cpu-structured-temperature-native.json', JSON.stringify(report, null, 2));
        console.log(JSON.stringify(row));
      }
    }
} finally {
  await browser.close();
  report.browserClosed = true;
  await fs.writeFile('.scratch/cpu-structured-temperature-native.json', JSON.stringify(report, null, 2));
}

if (report.cases.some((row) => !row.finished || row.error || !row.contextClosed)) process.exitCode = 1;
