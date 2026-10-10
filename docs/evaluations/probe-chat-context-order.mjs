import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const cases=[{id:'greeting-en',text:'Say hello in one short sentence.'},{id:'greeting-zh',text:'请用中文说一句简短的问候。'},{id:'arithmetic-en',text:'What is 7 plus 8? Reply with only the number.'},{id:'negation-zh',text:'只回答以下句子中谁没有付款：Mira 没有向 Oren 付款。'}];
const plugin=(await fs.readdir('dist/assets')).find(n=>/^agent-plugin-.*\.js$/.test(n));
const original=await fs.readFile('dist/assets/'+plugin);
const report={status:'running',cases,results:[],errors:[],plugin,pluginSHA256:sha(original),probeSHA256:sha(await fs.readFile(new URL(import.meta.url))),scope:'Known fresh diagnostic cases, one sample per variant, fixed current/request-first order. Only Worker user content order changes; actual GPU default model. No production adoption.'};
const context=await chromium.launchPersistentContext('.scratch/ai-csp/gpu-profile',{serviceWorkers:'block',args:['--enable-unsafe-webgpu','--use-angle=metal']});
await context.addInitScript(()=>{
 localStorage.setItem('agent-local-model-id','Qwen3-1.7B-q4f16_1-MLC');window.__requests=[];window.__variant='current';
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
const page=context.pages()[0]??await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:5193/editor?new=docx&agent=1&locale=en');
 await page.frameLocator('#app iframe').locator('.agent-sidebar-entry').click({timeout:60000});
 await page.waitForFunction(()=>document.querySelector('.agent-panel-note')?.textContent?.includes('Model loaded'),{},{timeout:180000});
 report.engine=await page.locator('.agent-model-status').textContent();report.modelId=await page.locator('.agent-model-status').getAttribute('title');
 await page.locator('.agent-panel-settings-toggle').click();await page.locator('.agent-generation-options summary').click();
 for(const [name,value] of Object.entries({temperature:'0',maxTokens:'96'})){await page.locator('[name="'+name+'"]').fill(value);await page.locator('[name="'+name+'"]').dispatchEvent('change');}
 await page.locator('.agent-panel-settings-toggle').click();
 for(const c of cases)for(const variant of ['current','request-first']){
  await page.locator('.agent-panel-clear').click();await page.evaluate(v=>{window.__variant=v;window.__requests=[];},variant);
  await page.locator('.cui-input').fill(c.text);await page.locator('.cui-input').press('Enter');
  await page.waitForFunction(()=>!document.querySelector('.cui-input')?.disabled,{},{timeout:120000});
  report.results.push({...c,variant,requests:await page.evaluate(()=>window.__requests),replies:await page.locator('.cui-msg-agent').allTextContents(),errors:await page.locator('.cui-msg-error').allTextContents(),previews:await page.locator('.agent-plan-preview').count()});
 }
 report.status='completed';
}catch(e){report.status='failed';report.error=String(e);process.exitCode=1;}
finally{await context.close();report.bundleUnchanged=sha(await fs.readFile('dist/assets/'+plugin))===report.pluginSHA256;await fs.writeFile('docs/evaluations/2026-10-04-chat-context-order.json',JSON.stringify(report,null,2)+'\n');}
console.log(report.status,report.error??'');
