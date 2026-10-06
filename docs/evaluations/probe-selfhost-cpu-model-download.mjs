import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {createServer} from 'node:http';
import {createReadStream} from 'node:fs';
const artifact='/private/tmp/document-selfhost-qwen3-06b.gguf';
const size=(await fs.stat(artifact)).size;
const served=[];
const modelServer=createServer((req,res)=>{
 const entry={method:req.method,url:req.url,range:req.headers.range??null,requestBytes:0,responseBytes:0};served.push(entry);
 req.on('data',b=>entry.requestBytes+=b.length);
 res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Expose-Headers','Content-Length, Content-Range, Accept-Ranges');res.setHeader('Accept-Ranges','bytes');res.setHeader('Content-Type','application/octet-stream');
 if(req.url!='/model.gguf'){res.writeHead(404);res.end();return;}
 const match=/^bytes=(\d+)-(\d*)$/.exec(req.headers.range??'');
 const start=match?Number(match[1]):0;const end=match&&match[2]?Math.min(Number(match[2]),size-1):size-1;
 res.setHeader('Content-Length',end-start+1);
 if(match)res.setHeader('Content-Range',`bytes ${start}-${end}/${size}`);
 res.writeHead(match?206:200);
 if(req.method==='HEAD'){res.end();return;}
 const stream=createReadStream(artifact,{start,end});stream.on('data',b=>entry.responseBytes+=b.length);stream.pipe(res);res.on('close',()=>stream.destroy());
});
await new Promise(resolve=>modelServer.listen(0,'127.0.0.1',resolve));
const modelUrl=`http://127.0.0.1:${modelServer.address().port}/model.gguf`;

const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const currentPlugin=(await fs.readdir('dist/assets')).filter(n=>/^agent-plugin-.*\.js$/.test(n));
if(currentPlugin.length!==1)throw Error('Ambiguous current plugin');
const cases = [{id:'configured-chat',text:'Privacy probe marker: LOCAL_ONLY_7f39e2_中文. Reply briefly.'}];
let context = await chromium.launchPersistentContext('.scratch/ai-offline/profile', {
  serviceWorkers: 'allow',
  viewport: { width: 1280, height: 900 },
  args: ['--enable-unsafe-webgpu', '--use-angle=metal'],
});
await context.addInitScript(() => {
  localStorage.setItem('agent-panel-provider', 'wllama');
  window.__failedGpuLoads=0;window.__gpuTerminations=0;
  localStorage.setItem('agent-local-model-id', 'Qwen3-1.7B-q4f16_1-MLC');
  window.__wordInputs = [];
  const Original = window.Worker;
  window.Worker = class extends Original {
    postMessage(m, ...rest) {
      if(m?.kind==='reload') {
        this.__injectedGpuReload=true;window.__failedGpuLoads++;
        queueMicrotask(()=>this.dispatchEvent(new ErrorEvent('error',{message:'Injected GPU initialization failure'})));
        return;
      }
      if (m?.kind === 'chatCompletionStreamInit') window.__wordInputs.push(structuredClone(m.content));
      return super.postMessage(m, ...rest);
    }
    terminate(){if(this.__injectedGpuReload)window.__gpuTerminations++;return super.terminate();}
  };
});
let page = context.pages()[0] ?? (await context.newPage());
const networkRequests=[]; const offlineRequests=[]; let offlinePhase=false; page.on('request', request=>{if(offlinePhase)offlineRequests.push({url:request.url(),method:request.method(),hasBody:request.postData()!==null});});
page.on('request',request=>networkRequests.push({url:request.url(),method:request.method(),body:request.postData()}));
const report = { modelUrl, artifactBytes:size, served, networkRequests, marker:'LOCAL_ONLY_7f39e2_中文', currentPlugin:currentPlugin[0], scope:"Actual current built native Word CPU chat with synthetic marker; Playwright page request URL/method/body capture across loading and inference. Not all-process privacy or CSP certification.", offlineRequests, probeSHA256: sha(await fs.readFile(new URL(import.meta.url))), cases, rows: [], errors: [] };
page.on('pageerror', (e) => report.errors.push(e.message));
const body = () => page.frameLocator('#app iframe').locator('body');
const snapshot = () =>
  body().evaluate(() => (window.editor ?? window.Asc.editor).WordControl.m_oLogicDocument.GetText());
try {
  for (const c of cases) {
    await page.goto('http://127.0.0.1:5193/'); await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
    await page.goto('http://127.0.0.1:5193/editor?new=docx&agent=1&locale=en');
    await page.frameLocator('#app iframe').locator('.agent-sidebar-entry').click({ timeout: 60000 });
    await page.locator('.agent-panel-settings-toggle').click();
    await page.locator('.agent-panel-provider').evaluate(el=>{el.value='wllama';el.dispatchEvent(new Event('change'));});
    await page.locator('.agent-panel-gguf-url').evaluate((el,url)=>{el.value=url;},modelUrl);
    await page.locator('.agent-panel-gguf-url').dispatchEvent('change');
    await page.locator('.agent-panel-gguf-load').click();
    await page.locator('.agent-panel-settings-toggle').click();
    await page.waitForFunction(
      () => document.querySelector('.agent-panel-note')?.textContent?.includes('Model loaded'),
      {},
      { timeout: 180000 },
    );
    report.seedResources=await page.evaluate(()=>performance.getEntriesByType('resource').map(e=>e.name));if(!report.seedResources.some(n=>n.endsWith('/assets/'+currentPlugin[0])))throw Error('Seed did not load current plugin');
    report.seedState=await page.evaluate(()=>({controller:navigator.serviceWorker.controller?.scriptURL,isolated:crossOriginIsolated})); report.seedEngine=await page.locator('.agent-model-status').textContent();
    const row = { selectedProvider:await page.locator('.agent-panel-provider').evaluate(el=>el.value), gpuPresent:await page.evaluate(()=>!!navigator.gpu), failedGpuLoads:await page.evaluate(()=>window.__failedGpuLoads), gpuTerminations:await page.evaluate(()=>window.__gpuTerminations),
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
    row.modelWorkers=page.workers().map(w=>w.url());
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
  await fs.writeFile('docs/evaluations/2026-10-04-selfhost-cpu-model-download.json', JSON.stringify(report, null, 2) + '\n');
  await context.close();
  await new Promise(resolve=>modelServer.close(resolve));
}
