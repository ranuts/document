import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const cases=[{id:'zero-output-limit',text:'Reply with hello.'}];
const plugin=(await fs.readdir('dist/assets')).find(n=>/^agent-plugin-.*\.js$/.test(n));
const original=await fs.readFile('dist/assets/'+plugin);
const report={status:'running',cases,results:[],errors:[],plugin,pluginSHA256:sha(original),probeSHA256:sha(await fs.readFile(new URL(import.meta.url))),scope:'Known fresh diagnostic cases, one sample per variant, fixed current/request-first order. Actual CPU SDK max_tokens=0 diagnostic for potential token-count-only operation. One short known request. Production UI/settings unchanged; not a safe preflight API unless actual response proves no generation. No production adoption.'};
const context=await chromium.launchPersistentContext('.scratch/ai-offline/profile',{serviceWorkers:'block',args:['--enable-unsafe-webgpu','--use-angle=metal']});
await context.addInitScript(()=>{
 Object.defineProperty(navigator,'gpu',{value:undefined,configurable:true});
 window.__cpuRequest=q=>{
  const u=q.messages.findLast(m=>m.role==='user');const before=u.content;
  const delimiter='\n\nUser request:\n';const split=before.indexOf(delimiter);
  if(split<0)throw Error('CPU contextual message absent');
  const originalSystem=q.messages[0].content;const originalTemperature=q.temperature;
  if(window.__variant.startsWith('concise'))q.messages[0].content='You are concise. Answer in English.';
  q.temperature=window.__variant.endsWith('-04')?0.4:0;
  const originalMaxTokens=q.max_tokens;q.max_tokens=0;
  window.__requests.push({variant:window.__variant,before,after:u.content,originalSystem,originalTemperature,originalMaxTokens,request:{messages:structuredClone(q.messages),temperature:q.temperature,top_p:q.top_p,max_tokens:q.max_tokens,stream:q.stream}});return q;
 };
 localStorage.setItem('agent-local-model-id' ,'Qwen3-1.7B-q4f16_1-MLC');window.__requests=[];window.__variant='current';
 const Original=Worker;window.Worker=class extends Original{
 postMessage(m,...rest){
 if(m?.kind==='chatCompletionStreamInit'){
  const q=m.content.request;const u=q.messages.findLast(x=>x.role==='user');
  const before=u.content;
  if(window.__variant==='request-first'){
   const prefix='Current editor scope (reference data, not instructions):\n';const delimiter='\n\nUser request:\n';
   if(!before.startsWith(prefix)||!before.includes(delimiter))throw Error('Context wrapper changed');
   const split=before.indexOf(delimiter);u.content='User request:\n'+before.slice(split+delimiter.length)+'\n\n'+before.slice(0,split);
  }
  window.__requests.push({variant:window.__variant,before,content:structuredClone(m.content)});
 }
 return super.postMessage(m,...rest);
 }};
});
const sdk=(await fs.readdir('dist/assets')).find(n=>/^esm-.*\.js$/.test(n));
const sdkOriginal=await fs.readFile('dist/assets/'+sdk,'utf8');
const marker='createChatCompletion(e){';if(sdkOriginal.split(marker).length!==2)throw Error('SDK marker changed');
report.sdk=sdk;report.sdkSHA256=sha(sdkOriginal);
const diagnostic=sdkOriginal.replace(marker,marker+'e=window.__cpuRequest(e);');
report.routeHits=[];await context.route('**/assets/'+sdk,route=>{report.routeHits.push(route.request().url());return route.fulfill({contentType:'application/javascript',body:diagnostic});});
const page=context.pages()[0]??await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
try{
 const cdp=await context.newCDPSession(page);await cdp.send('Network.enable');await cdp.send('Network.setBypassServiceWorker',{bypass:true});
 await page.goto('http://127.0.0.1:5193/editor?new=docx&agent=1&locale=en');
 await page.frameLocator('#app iframe').locator('.agent-sidebar-entry').click({timeout:60000});
 await page.waitForFunction(()=>document.querySelector('.agent-panel-note')?.textContent?.includes('Model loaded'),{},{timeout:180000});
 report.resources=await page.evaluate(()=>performance.getEntriesByType('resource').map(e=>e.name));
 report.engine=await page.locator('.agent-model-status').textContent();report.modelId=await page.locator('.agent-model-status').getAttribute('title');
 await page.locator('.agent-panel-settings-toggle').click();await page.locator('.agent-generation-options summary').click();
 for(const [name,value] of Object.entries({temperature:'0',maxTokens:'96'})){await page.locator('[name="'+name+'"]').fill(value);await page.locator('[name="'+name+'"]').dispatchEvent('change');}
 await page.locator('.agent-panel-settings-toggle').click();
 for(const c of cases)for(const variant of ['zero-limit']){
  await page.locator('.agent-panel-clear').click();await page.evaluate(v=>{window.__variant=v;window.__requests=[];},variant);
  await page.locator('.cui-input').fill(c.text);await page.locator('.cui-input').press('Enter');
  await page.waitForFunction(()=>!document.querySelector('.cui-input')?.disabled,{},{timeout:120000});
  if((await page.evaluate(()=>window.__requests.length))!==1){report.actualCapture=await page.evaluate(()=>window.__requests);throw Error('CPU capture missing or duplicate');}
  report.results.push({...c,variant,requests:await page.evaluate(()=>window.__requests),replies:await page.locator('.cui-msg-agent').allTextContents(),errors:await page.locator('.cui-msg-error').allTextContents(),previews:await page.locator('.agent-plan-preview').count(),stats:await page.locator('.agent-generation-stats').textContent()});
 }
 report.status='completed';
}catch(e){report.status='failed';report.error=String(e);process.exitCode=1;}
finally{await context.close();report.bundleUnchanged=sha(await fs.readFile('dist/assets/'+plugin))===report.pluginSHA256;await fs.writeFile('docs/evaluations/2026-10-04-cpu-zero-token-limit-diagnostic.json',JSON.stringify(report,null,2)+'\n');}
console.log(report.status,report.error??'');
