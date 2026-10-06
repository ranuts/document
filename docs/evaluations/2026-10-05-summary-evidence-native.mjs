import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
const prompts = JSON.parse(await fs.readFile('docs/evaluations/2026-10-05-summary-concise-cases.json', 'utf8'));
const report = {
  runtime: '5cd8f80',
  protocol: '2026-10-05-summary-evidence-protocol.md',
  model: 'Qwen_Qwen3-0.6B-Q4_K_M.gguf',
  cases: [],
};
const browser = await chromium.launch({ channel: 'chromium' });
report.browserVersion = browser.version();
try {
  for (const prompt of prompts)
    for (const variant of ['product', 'evidence']) {
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
                  { role: 'system', content: candidate.summarySystem },
                  {
                    role: 'user',
                    content: lines[0] + '\n' + JSON.stringify({ evidenceSpans: window.__extraction.spans }),
                  },
                ],
              };
            };
            const count = Wllama.prototype.countChatTokens;
            window.__counts = [];
            window.__extraction = null;
            Wllama.prototype.countChatTokens = async function (request) {
              if (variant === 'evidence' && !window.__extraction) {
                const lines = request.messages
                  .filter((m) => m.role === 'user')
                  .flatMap((m) => m.content.split('\n'))
                  .filter((line) => line.startsWith('{"task":'));
                if (lines.length !== 1) throw Error('Ambiguous extraction task');
                const task = JSON.parse(lines[0]);
                const stage = {
                  ...request,
                  stream: false,
                  messages: [
                    { role: 'system', content: candidate.extractSystem },
                    { role: 'user', content: JSON.stringify({ text: task.text, instruction: task.instruction }) },
                  ],
                  response_format: {
                    type: 'json_schema',
                    json_schema: {
                      name: 'source_spans',
                      strict: true,
                      schema: {
                        type: 'object',
                        additionalProperties: false,
                        required: ['spans'],
                        properties: {
                          spans: { type: 'array', minItems: 1, maxItems: 16, items: { type: 'string', minLength: 1 } },
                        },
                      },
                    },
                  },
                };
                const { abortSignal: _abortSignal, ...body } = stage;
                const probe = (window.__extraction = { request: JSON.parse(JSON.stringify(body)) });
                try {
                  probe.count = await count.call(this, stage);
                  if (probe.count.promptTokens + stage.max_tokens + 1 > probe.count.contextTokens)
                    throw Error('Extraction exceeds exact context');
                  probe.completion = await original.call(this, stage);
                  const choice = probe.completion.choices[0];
                  if (choice.finish_reason !== 'stop') throw Error('Extraction did not finish');
                  const parsed = JSON.parse(choice.message.content);
                  if (
                    Object.keys(parsed).length !== 1 ||
                    !Array.isArray(parsed.spans) ||
                    !parsed.spans.length ||
                    parsed.spans.length > 16 ||
                    parsed.spans.some((span) => typeof span !== 'string' || !span.trim() || !task.text.includes(span))
                  )
                    throw Error('Extraction quotations invalid');
                  probe.spans = parsed.spans;
                  probe.valid = true;
                } catch (e) {
                  probe.error = String(e);
                  throw e;
                }
              }
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
              await fs.readFile('docs/evaluations/2026-10-05-summary-evidence-candidate.json', 'utf8'),
            ),
          },
        );
        await page.locator('.cui-input').fill(prompt.instruction);
        const start = Date.now();
        await page.locator('.cui-input').press('Enter');
        await page.waitForFunction(() => !document.querySelector('.cui-input').disabled, null, { timeout: 240000 });
        row.durationMs = Date.now() - start;
        row.toolMessages = await page.locator('.cui-activity > div, .cui-activity summary > div').allTextContents();
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
        row.extraction = await page.evaluate(() => window.__extraction);
        row.sdk = await page.evaluate(() => window.__streamProbe);
        row.counts = await page.evaluate(() => window.__counts);
        if (row.sdk.length !== 1 || row.sdk[0].request.temperature !== 0) throw Error('Unexpected bounded CPU request');
        if (JSON.stringify(row.counts.at(-1)) !== JSON.stringify(row.sdk[0].request))
          throw Error('Count/completion mismatch');
        row.finished = true;
      } catch (e) {
        row.error = String(e);
      } finally {
        await context.close();
        row.contextClosed = true;
        await fs.writeFile('.scratch/summary-evidence-native.json', JSON.stringify(report, null, 2));
        console.log(
          JSON.stringify({
            variant: row.variant,
            source: row.prompt.source,
            body: row.documentAfter,
            errors: row.chatErrors,
            error: row.error,
            finished: row.finished,
            closed: row.contextClosed,
          }),
        );
      }
    }
} finally {
  await browser.close();
  report.browserClosed = true;
  await fs.writeFile('.scratch/summary-evidence-native.json', JSON.stringify(report, null, 2));
}

if (report.cases.some((row) => !row.finished || row.error || !row.contextClosed)) process.exitCode = 1;
