import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const currentPlugin=(await fs.readdir('dist/assets')).filter(n=>/^agent-plugin-.*\.js$/.test(n));
if(currentPlugin.length!==1)throw Error('Ambiguous current plugin');
const cases = [{id:'configured-chat',text:'Reply with a brief greeting.'}];
let context = await chromium.launchPersistentContext('.scratch/ai-csp/gpu-profile', {
  serviceWorkers: 'allow',
  viewport: { width: 1280, height: 900 },
  args: ['--enable-unsafe-webgpu', '--use-angle=metal'],
});
await context.addInitScript(() => {
  localStorage.setItem('agent-panel-provider', 'webllm');
  localStorage.setItem('agent-local-model-id', 'Qwen3-1.7B-q4f16_1-MLC');
  window.__wordInputs = [];
  const Original = window.Worker;
  window.Worker = class extends Original {
    postMessage(m, ...rest) {
      if (m?.kind === 'chatCompletionStreamInit') window.__wordInputs.push(structuredClone(m.content));
      return super.postMessage(m, ...rest);
    }
  };
});
let page = context.pages()[0] ?? (await context.newPage());
const offlineRequests=[]; let offlinePhase=false; page.on('request', request=>{if(offlinePhase)offlineRequests.push({url:request.url(),method:request.method(),hasBody:request.postData()!==null});});
const report = { currentPlugin:currentPlugin[0], scope:"Current dist bundle verified at online seed and offline restart; cached model and app, actual WebGPU stream, not cold empty cache or physical network isolation.", offlineRequests, probeSHA256: sha(await fs.readFile(new URL(import.meta.url))), cases, rows: [], errors: [] };
page.on('pageerror', (e) => report.errors.push(e.message));
const body = () => page.frameLocator('#app iframe').locator('body');
const snapshot = () =>
  body().evaluate(() => (window.editor ?? window.Asc.editor).WordControl.m_oLogicDocument.GetText());
try {
  for (const c of cases) {
    await page.goto('http://127.0.0.1:5193/'); await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
    await page.goto('http://127.0.0.1:5193/editor?new=docx&agent=1&locale=en');
    await page.frameLocator('#app iframe').locator('.agent-sidebar-entry').click({ timeout: 60000 });
    await page.waitForFunction(
      () => document.querySelector('.agent-panel-note')?.textContent?.includes('Model loaded'),
      {},
      { timeout: 180000 },
    );
    report.seedResources=await page.evaluate(()=>performance.getEntriesByType('resource').map(e=>e.name));if(!report.seedResources.some(n=>n.endsWith('/assets/'+currentPlugin[0])))throw Error('Seed did not load current plugin');
    report.seedState=await page.evaluate(()=>({controller:navigator.serviceWorker.controller?.scriptURL,isolated:crossOriginIsolated})); report.seedEngine=await page.locator('.agent-model-status').textContent();
    await context.close(); report.closedSeedContext=true;
    context=await chromium.launchPersistentContext('.scratch/ai-csp/gpu-profile',{serviceWorkers:'allow',viewport:{width:1280,height:900},args:['--enable-unsafe-webgpu','--use-angle=metal']});
    await context.addInitScript(() => {
  localStorage.setItem('agent-panel-provider', 'webllm');
  localStorage.setItem('agent-local-model-id', 'Qwen3-1.7B-q4f16_1-MLC');
  window.__wordInputs = [];
  const Original = window.Worker;
  window.Worker = class extends Original {
    postMessage(m, ...rest) {
      if (m?.kind === 'chatCompletionStreamInit') window.__wordInputs.push(structuredClone(m.content));
      return super.postMessage(m, ...rest);
    }
  };
});

    await context.setOffline(true); offlinePhase=true;
    page=context.pages()[0]??await context.newPage(); page.on('pageerror',e=>report.errors.push(e.message));page.on('request',request=>offlineRequests.push({url:request.url(),method:request.method(),hasBody:request.postData()!==null}));
    await page.goto('http://127.0.0.1:5193/editor?new=docx&agent=1&locale=en',{timeout:120000}); await page.frameLocator('#app iframe').locator('.agent-sidebar-entry').click({timeout:120000}); await page.waitForFunction(()=>{const note=document.querySelector('.agent-panel-note')?.textContent;return note?.includes('Model loaded')||note?.includes('Model loading failed');},{},{timeout:180000}); if(!(await page.locator('.agent-panel-note').textContent())?.includes('Model loaded'))throw Error('Cold offline model loading failed');

    report.offlineResources=await page.evaluate(()=>performance.getEntriesByType('resource').map(e=>e.name));if(!report.offlineResources.some(n=>n.endsWith('/assets/'+currentPlugin[0])))throw Error('Offline did not load current plugin');
    const row = {
      coldState: await page.evaluate(()=>({controller:navigator.serviceWorker.controller?.scriptURL,isolated:crossOriginIsolated})), browserOnline: await page.evaluate(()=>navigator.onLine),
      id: c.id,
      text: c.text,
      engine: await page.locator('.agent-model-status').textContent(),
      before: await snapshot(),
    };
    await page.locator('.agent-panel-settings-toggle').click(); await page.locator('.agent-generation-options summary').click(); for (const [name,value] of Object.entries({systemPrompt:'You are concise. Answer in English.',temperature:'0.4',topP:'0.85',maxTokens:'96'})) { const input=page.locator('[name="'+name+'"]'); await input.fill(value); await input.dispatchEvent('change'); } row.settings=await page.locator('.agent-generation-status').textContent(); await page.locator('.agent-panel-settings-toggle').click();
    await page.locator('.cui-input').fill(c.text);
    await page.locator('.cui-input').press('Enter');
    await page.waitForFunction(() => !document.querySelector('.cui-input')?.disabled, {}, { timeout: 120000 });
    row.after = await snapshot();
    row.inputs = await page.evaluate(() => window.__wordInputs);
    row.errors = await page.locator('.cui-msg-error').allTextContents();
    row.previews = await page.locator('.agent-plan-preview').count();
    row.stats=await page.locator('.agent-generation-stats').textContent(); row.reply=await page.locator('.cui-msg-agent').last().textContent();
    await body().evaluate(() => (window.editor ?? window.Asc.editor).Undo());
    await page.waitForTimeout(300);
    row.undo = await snapshot();
    await body().evaluate(() => (window.editor ?? window.Asc.editor).Redo());
    await page.waitForTimeout(300);
    row.redo = await snapshot();
    row.undoExact = row.undo === row.before;
    row.redoExact = row.redo === row.after;
    report.rows.push(row);
    console.log(c.id, row.stats, row.errors);
  }
  report.status = 'completed';
} catch (e) {
  report.status = 'failed';
  report.error = String(e);
  process.exitCode = 1;
} finally {
  await fs.writeFile('docs/evaluations/2026-10-04-current-build-offline-restart-chat.json', JSON.stringify(report, null, 2) + '\n');
  await context.close();
}
