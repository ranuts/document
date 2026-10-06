import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

// Throwaway prompt experiment: route-local instrumentation, never shipped source.
const origin = 'http://127.0.0.1:5193';
const modelId = 'qwen2.5-3b-instruct-q4_k_m.gguf';
const reportPath = 'docs/evaluations/2026-10-05-conditional-status-transfer.json';
const variants = (process.env.WRITING_EXAMPLES_VARIANTS || 'production,status-explicit').split(',');
const repetitions = Number(process.env.WRITING_EXAMPLES_REPETITIONS || 1);
const cases = JSON.parse(await fs.readFile('docs/evaluations/2026-10-05-conditional-status-transfer-cases.json', 'utf8'));
cases.splice(0, cases.length, ...cases.filter((c) => c.task === 'summarize'));
const assets = await fs.readdir('dist/assets');
const plugin = assets.filter((name) => /^agent-plugin-.*\.js$/.test(name));
if (plugin.length !== 1) throw Error('Ambiguous plugin');
const pluginOriginal = await fs.readFile(path.join('dist/assets', plugin[0]), 'utf8');
const writingMarker = 'if(n.throwIfAborted(),a.toolCalls.length';
const samplingMarker = 'temperature:0,response_format:';
if (pluginOriginal.split(writingMarker).length !== 2 || pluginOriginal.split(samplingMarker).length !== 2)
  throw Error('Markers changed');
const pluginDiagnostic = pluginOriginal
  .replace(
    writingMarker,
    '(window.__writingRaw??=[]).push({text:a.text,stopReason:a.stopReason,usage:a.usage});' + writingMarker,
  )
  .replace(samplingMarker, 'temperature:(window.__writingVariant===`sampled`?0.7:0),response_format:');
const sha = (source) => crypto.createHash('sha256').update(source).digest('hex');
const context = await chromium.launchPersistentContext('.scratch/ai-offline/profile', {
  serviceWorkers: 'block',
  viewport: { width: 1280, height: 900 },
});
await context.addInitScript((modelId) => {
  window.__writingInputs = [];
  Object.defineProperty(navigator,'gpu',{value:undefined,configurable:true});
  Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true });
  if (location.origin === 'http://127.0.0.1:5193') localStorage.setItem('agent-panel-provider', 'wllama');

}, modelId);
await context.route(origin + '/**', async (route) => {
  const response = await route.fetch();
  const headers = {
    ...response.headers(),
    'cross-origin-opener-policy': 'same-origin',
    'cross-origin-embedder-policy': 'require-corp',
  };
  delete headers['content-length'];
  const pathname = new URL(route.request().url()).pathname;
  const body = pathname === '/assets/' + plugin[0] ? pluginDiagnostic : undefined;
  await route.fulfill({ response, headers, ...(body === undefined ? {} : { body }) });
});
const page = context.pages()[0] || (await context.newPage());
const report = {
  date: new Date().toISOString(),
  scope: 'Actual native Word IM writing summaries with browser CPU Qwen2.5 3B verified local GGUF. Three preregistered unused conditional/negation fixtures, production versus frozen explicit-status system suffix, same guards. Native count and completion receive the same candidate request; raw SDK request/completion captures only; no generation substitution, no preview, no product defaults change.',
  modelId,
  status: 'running',
  probeSHA256: sha(await fs.readFile(new URL(import.meta.url))),
  variants,
  repetitions,
  cases,
  bundleHashes: {
    plugin: sha(pluginOriginal),
    diagnosticPlugin: sha(pluginDiagnostic),
  },
  results: [],
  errors: [],
  externalRequests: [],
};
page.on('pageerror', (error) => report.errors.push(error.message));
context.on('request', (request) => {
  if (new URL(request.url()).protocol.startsWith('http') && new URL(request.url()).origin !== origin)
    report.externalRequests.push({
      url: request.url(),
      method: request.method(),
      bodyBytes: request.postDataBuffer()?.length ?? 0,
    });
});
const save = () => fs.writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
const body = () => page.frameLocator('#app iframe').locator('body');
const selectedText = () =>
  body().evaluate(() => {
    const api = window.editor ?? window.Asc.editor;
    api.asc_EditSelectAll();
    return api.pluginMethod_GetSelectedText();
  });
try {
  await page.goto(origin + '/');
  report.cacheReset = await page.evaluate(async () => {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
    let removed = 0;
    for (const name of await caches.keys()) {
      const cache = await caches.open(name);
      for (const request of await cache.keys())
        if (/\/assets\/(?:agent-plugin-|esm-)/.test(new URL(request.url).pathname)) {
          await cache.delete(request);
          removed++;
        }
    }
    return { registrations: registrations.length, removed };
  });
  await page.goto('about:blank');
  await page.goto(origin + '/editor?new=docx&agent=1&locale=en');
  await body().locator('.agent-sidebar-entry').click({ timeout: 90000 });
  await page.waitForFunction(
    () => document.querySelector('.agent-panel-note')?.textContent?.includes('Model loaded'),
    null,
    { timeout: 600000 },
  );
  await page.evaluate(async(suffix)=>{
    const {Wllama}=await import('/assets/client-D5_UYdz1.js');
    const adjust=(request)=>window.__writingVariant==='status-explicit' ? {...request,messages:request.messages.map((message)=>message.role==='system'?{...message,content:message.content+'\n'+suffix}:message)} : request;
    const count=Wllama.prototype.countChatTokens;
    Wllama.prototype.countChatTokens=function(request){return count.call(this,adjust(request));};
    const original=Wllama.prototype.createChatCompletion;
    Wllama.prototype.createChatCompletion=async function(request){
      request=adjust(request);
      const recorded=Object.fromEntries(Object.entries(request).filter(([key])=>key!=='abortSignal'));
      window.__writingInputs.push({request:structuredClone(recorded)});
      return original.call(this,request);
    };
  }, "When summarizing, retain the proposer or requester and the team responsible for acting. Keep the prerequisite and the current state as separate facts: a conditional approval requirement does not convey that approval is still absent. Explicitly retain each stated not-yet-approved, not-completed, not-sent or not-started status. Preserve what the approval or certificate applies to. Combine these facts into one shorter sentence in the source language; remove only the unrelated topic. Do not infer that a condition has been met or an action has occurred.");
  await page.locator('.agent-panel-settings-toggle').click();
  await page.locator('.agent-generation-options').evaluate(el=>el.open=true);
  for(const [name,value] of [['temperature','0'],['topP','0.8'],['maxTokens','512']])
    await page.locator(`.agent-generation-options [name="${name}"]`).evaluate((el,value)=>{el.value=value;el.dispatchEvent(new Event('change',{bubbles:true}));},value);
  await page.locator('.agent-panel-provider').evaluate(el=>{el.value='wllama';el.dispatchEvent(new Event('change',{bubbles:true}));});
  await page.locator('.agent-panel-gguf-files').setInputFiles('.scratch/node_modules/ai-models/qwen2.5-3b-instruct-q4_k_m.gguf');
  await page.locator('.agent-panel-gguf-load').click();
  await page.waitForFunction(()=>document.querySelector('.agent-model-status')?.textContent?.includes('qwen2.5-3b')&&document.querySelector('.agent-panel-note')?.textContent?.includes('Model loaded'),null,{timeout:600000});
  await page.locator('.agent-panel-settings-toggle').click();
  report.engine=await page.locator('.agent-model-status').textContent();
  if(!report.engine.includes('CPU')||!report.engine.includes(modelId))throw Error('Wrong CPU model');
  for (let repetition = 0; repetition < repetitions; repetition++)
    for (const sample of cases)
      for (const variant of repetition % 2 === 0 ? variants : [...variants].reverse()) {
        await body().evaluate((_el, source) => {
          const api = window.editor ?? window.Asc.editor;
          api.asc_EditSelectAll();
          api.pluginMethod_PasteText(source);
        }, sample.source);
        // Native paste can wait for language fonts; do not select a stale document.
        await page.waitForFunction(
          (source) => {
            const frame = document.querySelector('#app iframe');
            const api = frame?.contentWindow?.editor ?? frame?.contentWindow?.Asc?.editor;
            return api?.WordControl?.m_oLogicDocument?.GetText().trim() === source;
          },
          sample.source,
          { timeout: 60000 },
        );
        const selected = await selectedText();
        if (selected.replace(/\r\n$/, '') !== sample.source) throw Error('Fixture mismatch');
        const start = await page.evaluate((variant) => {
          window.__writingVariant = variant;
          return { raw: (window.__writingRaw || []).length, inputs: (window.__writingInputs || []).length };
        }, variant);
        const errorStart = await page.locator('.cui-msg-error').count();
        await page.locator('.agent-writing-task').selectOption(sample.task);
        if (sample.task === 'translate') await page.locator('.agent-writing-language').selectOption(sample.targetLanguage);
        const input = page.locator('.cui-input');
        await input.fill(sample.instruction);
        const began = Date.now();
        await input.press('Enter');
        await page.waitForFunction(() => !document.querySelector('.cui-input')?.disabled, null, { timeout: 180000 });
        const diagnostics = await page.evaluate(
          (start) => ({
            raw: (window.__writingRaw || []).slice(start.raw),
            inputs: (window.__writingInputs || []).slice(start.inputs),
            isolated: crossOriginIsolated,
          }),
          start,
        );
        if (diagnostics.raw.length !== 1 || diagnostics.inputs.length !== 1 || !diagnostics.isolated)
          throw Error('Missing native inference');
        const actual = diagnostics.inputs[0].request ?? diagnostics.inputs[0];
        if (actual.temperature !== 0 || !actual.response_format?.json_schema?.schema)
          throw Error('Sampling/schema mismatch');
        const after = await selectedText();
        const row = {
          ...sample,
          repetition,
          variant,
          selected,
          output: after,
          documentUnchanged: after === selected,
          responseMs: Date.now() - began,
          errors: (await page.locator('.cui-msg-error').allTextContents()).slice(errorStart),
          previewCount: await page.locator('.agent-plan-preview').count(),
          ...diagnostics,
        };
        if (row.previewCount) throw Error('Unexpected preview');
        if (!row.documentUnchanged) {
          await body().evaluate(() => (window.editor ?? window.Asc.editor).Undo());
          row.undoText = await selectedText();
          row.undoExact = row.undoText === selected;
          await body().evaluate(() => (window.editor ?? window.Asc.editor).Redo());
          row.redoText = await selectedText();
          row.redoExact = row.redoText === after;
          if (!row.undoExact || !row.redoExact) throw Error('Native writing Undo/Redo mismatch');
        }
        report.results.push(row);
        console.log(
          JSON.stringify({
            id: row.id,
            repetition,
            variant,
            raw: row.raw[0].text,
            output: row.output,
            errors: row.errors,
            responseMs: row.responseMs,
            undoExact: row.undoExact,
            redoExact: row.redoExact,
          }),
        );
        await save();
      }
  report.status = 'completed';
} catch (error) {
  report.status = 'failed';
  report.error = String(error);
  process.exitCode = 1;
} finally {
  report.bundleBytesUnchanged = (await fs.readFile(path.join('dist/assets', plugin[0]), 'utf8')) === pluginOriginal;
  await save();
  await context.unrouteAll({ behavior: 'wait' });
  await context.close();
}
