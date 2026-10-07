import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
const artifact = JSON.parse(await fs.readFile('docs/evaluations/2026-10-07-qwen25-7b-artifact.json','utf8'));
const modelPaths = artifact.files.map(item=>'.scratch/node_modules/ai-models/'+item.file);
const verifiedShards=[];
for(const [index,item] of artifact.files.entries()){
 const file=modelPaths[index];const bytes=(await fs.stat(file)).size;const hash=createHash('sha256');
 for await(const chunk of createReadStream(file))hash.update(chunk);
 const sha256=hash.digest('hex');if(bytes!==item.bytes||sha256!==item.sha256)throw Error('Pinned official shard identity mismatch; no load');
 verifiedShards.push({file:item.file,bytes,sha256});
}
const prompts = JSON.parse(await fs.readFile('docs/evaluations/2026-10-07-qwen3-instruct2507-seven-language-cases.json', 'utf8')).filter(x=>['zh-CN-summarize','es-rewrite','ja-translate','de-rewrite'].includes(x.id));
const report = {
  runtime: '9a0e3aa',
  build: 'core1791345713/vendorb6864850e7b3',
  protocol: '2026-10-07-qwen25-7b-screen-protocol.md',
  model: 'Qwen2.5-7B-Instruct-Q4_K_M official two shards',
  verifiedShards,
  cases: [],
};
const browser = await chromium.launch({ channel: 'chromium' });
report.browserVersion = browser.version();
try {
  for (const prompt of prompts)
    for (const variant of ['candidate']) {
      const row = { prompt, variant, errors: [], console: [], crashed: false };
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
        page.on('crash', () => {
          row.crashed = true;
        });
        page.on('console', (message) => {
          if (['error', 'warning'].includes(message.type()) && row.console.length < 100)
            row.console.push({ type: message.type(), text: message.text().slice(0, 2000) });
        });
        await page.goto('http://127.0.0.1:5193/editor?new=docx&agent=1&locale=zh-CN');
        await page.waitForFunction(
          () => {
            const e = document.querySelector('#app iframe')?.contentWindow.editor;
            return e?.isDocumentLoadComplete && e?.isLoadFullApi;
          },
          null,
          { timeout: 90000 },
        );
        await page.evaluate(async()=>{
          const {Wllama}=await import('/assets/client-D5_UYdz1.js');const original=Wllama.prototype.loadModel;window.__loads=[];
          Wllama.prototype.loadModel=async function(files,options){const probe={requested:{n_threads:options.n_threads,n_ctx:options.n_ctx,n_gpu_layers:options.n_gpu_layers,reasoning:options.reasoning}};window.__loads.push(probe);const result=await original.call(this,files,options);probe.actualThreads=this.getNumThreads();probe.multithread=this.isMultithread();return result;};
        });
        await page.evaluate(() => window.__toggleAgentPanel());
        await page.locator('.agent-panel').waitFor();
        await page.locator('.agent-panel-settings-toggle').click();
        await page
          .locator('.agent-panel-gguf-files')
          .setInputFiles(modelPaths);
        await page.locator('.agent-panel-gguf-load').click();
        await page.waitForFunction(
          () => document.querySelector('.agent-panel-note')?.textContent?.includes('模型已加载'),
          null,
          { timeout: 180000 },
        );
        row.loads = await page.evaluate(()=>window.__loads);
        row.modelNote = await page.locator('.agent-panel-note').textContent();
        row.modelStatus = await page.locator('.agent-model-status').textContent();
        await page.locator('.agent-panel-settings-toggle').click();
        await page.evaluate((text) => {
          const api = document.querySelector('#app iframe').contentWindow.Asc.editor;
          api.pluginMethod_InputText(text);
        }, prompt.source);
        await page.waitForFunction(source =>
          document.querySelector('#app iframe').contentWindow.Asc.editor.WordControl.m_oLogicDocument.GetText() === source + '\r\n',
          prompt.source, { timeout: 90000 });
        await page.evaluate(() => document.querySelector('#app iframe').contentWindow.Asc.editor.asc_EditSelectAll());
        row.selected = await page.evaluate(() =>
          document.querySelector('#app iframe').contentWindow.Asc.editor.pluginMethod_GetSelectedText(),
        );
        if (row.selected !== prompt.source + '\r\n') throw Error('Native source selection mismatch; no inference allowed');
        await page.locator('.agent-writing-task').selectOption(prompt.task);
        if(prompt.task==='translate') await page.locator('.agent-writing-language').selectOption(prompt.targetLanguage);
        row.documentBefore = await page.evaluate(() =>
          document.querySelector('#app iframe').contentWindow.Asc.editor.WordControl.m_oLogicDocument.GetText(),
        );
        await page.evaluate(
          async () => {
            const { Wllama } = await import('/assets/client-D5_UYdz1.js');
            const adjust = (request) => {
              return ({...request, seed:42, temperature:0.7, top_p:0.8, top_k:20});
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

        );
        await page.locator('.cui-input').fill(prompt.instruction);
        const start = Date.now();
        await page.locator('.cui-input').focus();
        await page.locator('.cui-input').press('Enter');
        await page.locator('.cui-msg-user').filter({ hasText: prompt.instruction }).last().waitFor({ timeout: 10000 });
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
        row.sdk = await page.evaluate(() => window.__streamProbe);
        row.counts = await page.evaluate(() => window.__counts);
        if (row.sdk.length !== 1 || row.sdk[0].request.temperature !== 0.7) throw Error('Unexpected bounded CPU request');
        if (JSON.stringify(row.counts.at(-1)) !== JSON.stringify(row.sdk[0].request))
          throw Error('Count/completion mismatch');
        row.finished = true;
      } catch (e) {
        row.error = String(e);
        const page = context.pages()[0];
        if (page && !page.isClosed()) {
          row.failureSnapshot = await page.evaluate(()=>({loads:window.__loads,sdk:window.__streamProbe,counts:window.__counts,documentText:document.querySelector('#app iframe')?.contentWindow?.Asc?.editor?.WordControl?.m_oLogicDocument?.GetText?.(),chatErrors:[...document.querySelectorAll('.cui-msg-error')].map(e=>e.textContent)})).catch(e=>({error:String(e)}));
          row.failureNote = await page
            .locator('.agent-panel-note')
            .textContent()
            .catch(() => null);
          row.failureStatus = await page
            .locator('.agent-model-status')
            .textContent()
            .catch(() => null);
        }
      } finally {
        await context.close();
        row.contextClosed = true;
        await fs.writeFile('.scratch/2026-10-07-qwen25-7b-screen-native.json', JSON.stringify(report, null, 2));
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
      if (!row.modelStatus) throw Error('Initial model setup failed; stop duplicate loading attempts');
    }
} finally {
  await browser.close();
  report.browserClosed = true;
  await fs.writeFile('.scratch/2026-10-07-qwen25-7b-screen-native.json', JSON.stringify(report, null, 2));
}

if (report.cases.some((row) => !row.finished || row.error || !row.contextClosed)) process.exitCode = 1;
