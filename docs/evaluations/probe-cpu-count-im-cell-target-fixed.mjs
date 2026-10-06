import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const plugin=(await fs.readdir('dist/assets')).find(n=>/^agent-plugin-.*\.js$/.test(n));
const report={status:'running',scope:'Actual built IM CPU fallback, action observation only; no request rewriting or editor writes',plugin,pluginSHA256:sha(await fs.readFile('dist/assets/'+plugin)),errors:[],console:[]};
const context=await chromium.launchPersistentContext('.scratch/ai-offline/profile',{serviceWorkers:'block'});
await context.addInitScript(()=>{
 Object.defineProperty(navigator,'gpu',{value:undefined,configurable:true});
 localStorage.setItem('agent-local-model-id','Qwen3-1.7B-q4f16_1-MLC');
 window.__actions=[];const Original=Worker;window.Worker=class extends Original{postMessage(message,...rest){if(message?.verb==='wllama.action')window.__actions.push(message.args[0]);return super.postMessage(message,...rest);}};
});
const page=context.pages()[0]??await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>report.console.push({type:m.type(),text:m.text()}));
const settings=async prompt=>{
 await page.locator('.agent-panel-settings-toggle').click();
 const summary=page.locator('.agent-generation-options summary');if(await page.locator('.agent-generation-options').getAttribute('open')===null)await summary.click();
 for(const [name,value] of Object.entries({systemPrompt:prompt,temperature:'0',maxTokens:'64'})){await page.locator('[name="'+name+'"]').fill(value);await page.locator('[name="'+name+'"]').dispatchEvent('change');}
 await page.locator('.agent-panel-settings-toggle').click();
};
const send=async text=>{
 await page.locator('.agent-panel-clear').click();await page.evaluate(()=>{window.__actions=[];});
 await page.locator('.cui-input').fill(text);await page.locator('.cui-input').press('Enter');
 await page.waitForFunction(()=>!document.querySelector('.cui-input')?.disabled,{},{timeout:120000});
 return {actions:await page.evaluate(()=>window.__actions),replies:await page.locator('.cui-msg-agent').allTextContents(),errors:await page.locator('.cui-msg-error').allTextContents(),previews:await page.locator('.agent-plan-preview').count()};
};
try{
 const cdp=await context.newCDPSession(page);await cdp.send('Network.enable');await cdp.send('Network.setBypassServiceWorker',{bypass:true});
 await page.goto('http://127.0.0.1:5193/editor?new=xlsx&agent=1&locale=en');
 await page.frameLocator('#app iframe').locator('.agent-sidebar-entry').click({timeout:60000});
 await page.waitForFunction(()=>document.querySelector('.agent-panel-note')?.textContent?.includes('Model loaded'),{},{timeout:180000});
 report.engine=await page.locator('.agent-model-status').textContent();
 await settings('Answer briefly.');await page.locator('.agent-writing-task').selectOption('tools');
 const body=()=>page.frameLocator('#app iframe').locator('body');
 for(const [cell,value] of [['A1','Name'],['B1','Value'],['A2','Cora'],['B2','30'],['A3','Davi'],['B3','10'],['A4','Mira'],['B4','20'],['C1','OUTSIDE']]){await body().evaluate((_el,{cell,value})=>{const a=window.editor??window.Asc.editor;a.asc_findCell(cell);a.pluginMethod_PasteText(value);},{cell,value});await page.waitForTimeout(100);}
 const snapshot=()=>body().evaluate(()=>{const m=(window.editor??window.Asc.editor).wb.getWorksheet().model;return [0,1,2,3].map(r=>[0,1,2].map(c=>m.getRange3(r,c,r,c).getValue()));});
 report.before=await snapshot();report.cases=[];
 for(const request of ['读取 A1:B2 和 A3:B4 的内容。','Read A1:B2 and A3:B4. Do not change any cells.','读取 A1:B4 的内容，然后将 B2 设置为 99。']){
 const result=await send(request);result.request=request;result.after=await snapshot();result.messages=await page.locator('body').innerText();report.cases.push(result);
 }
 await body().evaluate(()=>{(window.editor??window.Asc.editor).asc_Undo();});await page.waitForTimeout(300);report.undo=await snapshot();
 await body().evaluate(()=>{(window.editor??window.Asc.editor).asc_Redo();});await page.waitForTimeout(300);report.redo=await snapshot();
 report.status='completed';
 report.resources=await page.evaluate(()=>performance.getEntriesByType('resource').map(e=>e.name));report.status='completed';
}catch(e){report.status='failed';report.error=String(e);report.ui=await page.locator('body').innerText().catch(()=>null);process.exitCode=1;}
finally{await context.close();report.bundleUnchanged=sha(await fs.readFile('dist/assets/'+plugin))===report.pluginSHA256;await fs.writeFile('docs/evaluations/2026-10-04-cpu-count-im-cell-target-fixed.json',JSON.stringify(report,null,2)+'\n');}
console.log(report.status,report.error??'');
