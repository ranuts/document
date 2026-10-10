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
 const previousSession=await page.locator('.agent-session-select').inputValue();
 await page.evaluate(value=>{window.__previousSession=value;},previousSession);
 await page.locator('.agent-panel-clear').click();await page.evaluate(()=>{window.__actions=[];});
 await page.evaluate(() => {
 window.__stopObservation = [];
 const observer = new MutationObserver(() => {
  if (!document.querySelector('.cui-activity')) return;
  observer.disconnect();
  const button = document.querySelector('.cui-send-stop');
  window.__stopObservation.push({ activity: document.querySelector('.cui-activity')?.textContent, button: !!button });
  if (window.__interruption === 'stop') button?.click();
  else if (window.__interruption === 'new') document.querySelector('.agent-panel-clear')?.click();
  else if (window.__interruption === 'switch') {
    const sessions = document.querySelector('.agent-session-select');
    sessions.value = window.__previousSession;
    sessions.dispatchEvent(new Event('change'));
  } else if (window.__interruption === 'sheet') {
    const frame = document.querySelector('#app iframe');
    const api = frame.contentWindow.editor ?? frame.contentWindow.Asc.editor;
    window.__stopObservation[0].sheetBefore=api.asc_getActiveWorksheetIndex();
    api.asc_showWorksheet(1);
    window.__stopObservation[0].sheetAfter=api.asc_getActiveWorksheetIndex();
  }
 });
 observer.observe(document.querySelector('.cui-messages'), { childList: true, subtree: true });
 });
 await page.locator('.cui-input').fill(text);await page.locator('.cui-input').press('Enter');
 await page.waitForFunction(()=>!document.querySelector('.cui-input')?.disabled,{},{timeout:120000});
 await page.waitForTimeout(150);
 return {statuses:await page.locator('.cui-msg-status').allTextContents(),actions:await page.evaluate(()=>window.__actions),replies:await page.locator('.cui-msg-agent').allTextContents(),errors:await page.locator('.cui-msg-error').allTextContents(),previews:await page.locator('.agent-plan-preview').count()};
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
 await body().evaluate(()=>{const api=window.editor??window.Asc.editor;api.asc_addWorksheet('Sequence target sentinel');});
 await body().evaluate(()=>new Promise((resolve,reject)=>{const api=window.editor??window.Asc.editor;const start=Date.now();const poll=()=>{if(api.asc_getWorksheetsCount()===2)resolve();else if(Date.now()-start>10000)reject(new Error('Worksheet creation timed out'));else setTimeout(poll,20);};poll();}));
 await body().evaluate(()=>{const api=window.editor??window.Asc.editor;api.asc_showWorksheet(1);api.asc_findCell('B2');api.pluginMethod_PasteText('SECOND');});
 await page.waitForTimeout(200);
 await body().evaluate(()=>{(window.editor??window.Asc.editor).asc_showWorksheet(0);});
 const snapshot=()=>body().evaluate(()=>{const api=window.editor??window.Asc.editor;return Array.from({length:api.asc_getWorksheetsCount()},(_,index)=>{const m=api.wbModel.getWorksheet(index);return [0,1,2,3].map(r=>[0,1,2].map(c=>m.getRange3(r,c,r,c).getValue()));});});
 report.before=await snapshot();report.cases=[];
 for(const interruption of ['sheet','none']){
 await body().evaluate(()=>{(window.editor??window.Asc.editor).asc_showWorksheet(0);});
 const request='读取 A1:B4 的内容，然后将 B2 设置为 99。';
 await page.evaluate(value=>{window.__interruption=value;},interruption);
 const result=await send(request);result.request=request;result.interruption=interruption;result.stopObservation=await page.evaluate(()=>window.__stopObservation);result.after=await snapshot();result.messages=await page.locator('body').innerText();result.activity=await page.locator('.cui-activity').allTextContents();report.cases.push(result);
 }
 report.status='completed';
 report.resources=await page.evaluate(()=>performance.getEntriesByType('resource').map(e=>e.name));report.status='completed';
}catch(e){report.status='failed';report.error=String(e);report.ui=await page.locator('body').innerText().catch(()=>null);process.exitCode=1;}
finally{await context.close();report.bundleUnchanged=sha(await fs.readFile('dist/assets/'+plugin))===report.pluginSHA256;await fs.writeFile('docs/evaluations/2026-10-04-cpu-count-im-sequence-worksheet-switch.json',JSON.stringify(report,null,2)+'\n');}
console.log(report.status,report.error??'');
