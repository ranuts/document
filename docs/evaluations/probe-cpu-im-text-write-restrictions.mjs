import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const plugin=(await fs.readdir('dist/assets')).find(n=>/^agent-plugin-.*\.js$/.test(n));
const report={status:'running',scope:'Actual built IM read-then-quoted-text-write with native merged/protected fixtures and controlled font-delay Stop, selection navigation and sheet navigation. These navigation interruptions use native APIs while the editor mask is held; they do not simulate clicking disabled worksheet UI. Cached CPU model loaded, literal planning bypasses inference. No request rewriting or runtime replacement.',plugin,pluginSHA256:sha(await fs.readFile('dist/assets/'+plugin)),errors:[],console:[]};
const context=await chromium.launchPersistentContext('.scratch/ai-offline/profile',{serviceWorkers:'block'});
await context.addInitScript(()=>{
 Object.defineProperty(window,'showSaveFilePicker',{value:undefined,configurable:true});
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
  } else if (window.__interruption === 'selection') {
    const frame = document.querySelector('#app iframe');
    const api = frame.contentWindow.editor ?? frame.contentWindow.Asc.editor;
    const selection = () => { const c=api.wb.getWorksheet().model.selectionRange.activeCell; return {col:c.col,row:c.row}; };
    window.__stopObservation[0].selectionBefore=selection();
    api.asc_findCell('D1');
    window.__stopObservation[0].selectionAfter=selection();
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
 const snapshot=()=>body().evaluate(()=>{const m=(window.editor??window.Asc.editor).wb.getWorksheet().model;return [0,1,2,3].map(r=>[0,1,2].map(c=>m.getRange3(r,c,r,c).getValue()));});
 report.before=await snapshot();report.seedTextLength=report.before.slice(1).reduce((n,row)=>n+row[1].length,0);report.cases=[];
 await body().evaluate(()=>{window.__testTargetModel=(window.editor??window.Asc.editor).wb.getWorksheet().model;});
 for(const scenario of ['merged','stop','selectionStop','sheetStop','protected']){
 if(scenario==='sheetStop'){await body().evaluate(()=>{const a=window.editor??window.Asc.editor;a.asc_addWorksheet();a.asc_showWorksheet(1);a.asc_findCell('B2');a.pluginMethod_PasteText('SECOND');a.asc_setCellFormat('0%');window.__otherModel=a.wb.getWorksheet().model;a.asc_showWorksheet(0);});await page.waitForTimeout(100);}
 if(scenario==='merged')await body().evaluate(()=>{const a=window.editor??window.Asc.editor;a.wb.getWorksheet().model.getRange3(1,1,1,2).merge(window.Asc.c_oAscMergeOptions.Merge);});
 else if(scenario==='protected'){
 await body().evaluate(()=>{const a=window.editor??window.Asc.editor,p=a.asc_getProtectedSheet();p.setSheet(true);a.asc_setProtectedSheet(p);});
 await body().evaluate(()=>new Promise((resolve,reject)=>{const start=Date.now();const poll=()=>{const a=window.editor??window.Asc.editor;if(a.wb.getWorksheet().model.getSheetProtection())resolve();else if(Date.now()-start>15000)reject(Error('Protection timeout'));else setTimeout(poll,50);};poll();}));
 }
 const state=(capture=false)=>body().evaluate((_el,capture)=>{const a=window.editor??window.Asc.editor,h=window.AscCommon.History,m=window.__testTargetModel,r=m.getRange3(1,1,1,1);if(capture)window.__beforeHistoryPoints=[...h.Points];return{historyRefsRetained:h.Points.length===window.__beforeHistoryPoints.length&&window.__beforeHistoryPoints.every((point,index)=>h.Points[index]===point),backupDepth:h.StoredData.length,value:r.getValue(),format:r.getNumFormat().sFormat,index:h.Index,items:h.Points.map(p=>p.Items.length),selection:{row:m.selectionRange.activeCell.row,col:m.selectionRange.activeCell.col},other:window.__otherModel?{value:window.__otherModel.getRange3(1,1,1,1).getValue(),format:window.__otherModel.getRange3(1,1,1,1).getNumFormat().sFormat}:null,busy:a.isLongAction()};},capture);
 if(['stop','selectionStop','sheetStop'].includes(scenario))await body().evaluate(()=>{const a=window.editor??window.Asc.editor,v=a.wb.getWorksheet(),original=v._loadFonts;window.__fontHeld=false;window.__restoreFonts=()=>{if(v._loadFonts!==original)v._loadFonts=original;};v._loadFonts=function(fonts,cb){window.__fontHeld=true;window.__releaseFonts=()=>new Promise(resolve=>original.call(v,fonts,()=>{cb();resolve();}));};});
 const before=await state(true);
 const request='读取 A1:B4 的内容，然后将 B2 设置为 "00123"。';
 await page.evaluate(()=>{window.__interruption='none';});
 const sending=send(request);
 if(['stop','selectionStop','sheetStop'].includes(scenario)){await page.waitForFunction(()=>document.querySelector('#app iframe')?.contentWindow?.__fontHeld,{},{timeout:15000});if(scenario==='selectionStop')await body().evaluate(()=>{(window.editor??window.Asc.editor).asc_findCell('D1');});if(scenario==='sheetStop')await body().evaluate(()=>{(window.editor??window.Asc.editor).asc_showWorksheet(1);});await page.locator('.cui-send-stop').click();}
 const result=await sending;
 if(['stop','selectionStop','sheetStop'].includes(scenario))await body().evaluate(async()=>{await window.__releaseFonts();window.__restoreFonts();});result.scenario=scenario;result.before=before;result.after=await state();result.activity=await page.locator('.cui-activity').allTextContents();report.cases.push(result);
 if(scenario==='sheetStop')await body().evaluate(()=>{(window.editor??window.Asc.editor).asc_showWorksheet(0);});
 if(scenario==='merged'){await body().evaluate(()=>{(window.editor??window.Asc.editor).asc_Undo();});await page.waitForTimeout(100);}
 }
 report.status='completed';
 report.resources=await page.evaluate(()=>performance.getEntriesByType('resource').map(e=>e.name));report.status='completed';
}catch(e){report.status='failed';report.error=String(e);report.ui=await page.locator('body').innerText().catch(()=>null);process.exitCode=1;}
finally{await context.close();report.bundleUnchanged=sha(await fs.readFile('dist/assets/'+plugin))===report.pluginSHA256;await fs.writeFile('docs/evaluations/2026-10-04-cpu-im-text-write-restrictions.json',JSON.stringify(report,null,2)+'\n');}
console.log(report.status,report.error??'');
