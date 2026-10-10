import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const sha=v=>crypto.createHash('sha256').update(v).digest('hex');
const files=(await fs.readdir('dist/assets')).filter(n=>/^agent-plugin-.*\.js$/.test(n));
if(files.length!==1)throw Error('Ambiguous plugin');
const report={scope:'Actual IM local CPU stream/Stop, opt-in history saving, actual exported data and page reload with explicit restore. Native restore-request draft and explicit factual follow-up with delegated SDK capture; no diagnostic history insertion. Not natural-fault, quality, offline/PWA or physical-device certification.',probeSHA256:sha(await fs.readFile(new URL(import.meta.url))),plugin:files[0],pluginSHA256:sha(await fs.readFile('dist/assets/'+files[0])),errors:[]};
const context=await chromium.launchPersistentContext('.scratch/ai-offline/profile',{serviceWorkers:'block',viewport:{width:1280,height:900}});
await context.addInitScript(()=>{Object.defineProperty(navigator,'gpu',{value:undefined,configurable:true});localStorage.setItem('agent-panel-provider','wllama');localStorage.removeItem('agent-panel-gguf-url');});
try{
 const page=context.pages()[0]??await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto('http://127.0.0.1:5193/editor?new=docx&agent=1&locale=zh-CN');
 await page.frameLocator('#app iframe').locator('.agent-sidebar-entry').click({timeout:90000});
 await page.locator('.agent-panel-settings-toggle').click();
 await page.locator('.agent-panel-provider').evaluate(el=>{el.value='wllama';el.dispatchEvent(new Event('change',{bubbles:true}));});
 await page.locator('.agent-panel-gguf-files').setInputFiles('.scratch/node_modules/ai-models/qwen2.5-0.5b-instruct-q4_k_m.gguf');
 await page.locator('.agent-panel-gguf-load').click();
 await page.waitForFunction(()=>document.querySelector('.agent-panel-note')?.textContent?.includes('模型已加载'),null,{timeout:180000});
 await page.locator('.agent-panel-settings-toggle').click();
 await page.waitForFunction(()=>document.querySelector('.agent-panel-note')?.textContent?.includes('模型已加载'),null,{timeout:180000});
 report.engine=await page.locator('.agent-model-status').textContent();if(!report.engine.includes('CPU'))throw Error('Not CPU');
 await page.locator('.agent-panel-settings-toggle').click();
 await page.locator('.agent-history-save').check();
 await page.waitForFunction(()=>document.querySelector('.agent-history-save')?.checked&&!document.querySelector('.agent-history-export')?.disabled);
 await page.locator('.agent-panel-settings-toggle').click();
 await page.locator('.agent-panel-clear').click();
 await page.locator('.agent-panel-settings-toggle').click();await page.locator('.agent-generation-options summary').click();
 await page.locator('[name="maxTokens"]').fill('1024');await page.locator('[name="maxTokens"]').dispatchEvent('change');
 await page.locator('.agent-panel-settings-toggle').click();
 report.documentBefore=await page.frameLocator('#app iframe').locator('body').evaluate(()=> (window.editor??window.Asc.editor).WordControl.m_oLogicDocument.GetText());
 await page.evaluate(async()=>{
  const {Wllama}=await import('/assets/client-D5_UYdz1.js');
  const load=Wllama.prototype.loadModel,complete=Wllama.prototype.createChatCompletion,exit=Wllama.prototype.exit;
  window.__draftProbe={loads:0,generations:0,exits:0,sdk:[]};
  Wllama.prototype.loadModel=async function(...args){window.__draftProbe.loads++;return load.apply(this,args);};
  Wllama.prototype.exit=function(...args){window.__draftProbe.exits++;return exit.apply(this,args);};
  Wllama.prototype.createChatCompletion=async function(...args){
   window.__draftProbe.generations++;
   const record={request:structuredClone(Object.fromEntries(Object.entries(args[0]).filter(([key])=>key!=='abortSignal'))),chunks:[],returned:false};
   window.__draftProbe.sdk.push(record);
   const result=await complete.apply(this,args);
   if(!result?.[Symbol.asyncIterator]){record.response=structuredClone(result);record.returned=true;return result;}
   return (async function*(){try{for await(const chunk of result){record.chunks.push(structuredClone(chunk));yield chunk;}record.returned=true;}catch(error){record.error={name:error.name,message:error.message};throw error;}})();
  };
 });
 await page.locator('.cui-input').fill('请写一个较长的原创中文故事，详细描述一位工匠修理旧钟的过程，至少六百字。不要操作文档。');
 await page.locator('.cui-input').press('Enter');
 await page.waitForFunction(()=>document.querySelector('.cui-input')?.disabled&&(document.querySelector('.cui-msg-agent')?.textContent?.length??0)>=40,null,{timeout:120000});
 report.partialText=await page.locator('.cui-msg-agent').last().textContent();
 await page.locator('.cui-send-stop').click();
 await page.waitForFunction(()=>!document.querySelector('.cui-input').disabled&&document.querySelector('.agent-panel-note')?.textContent?.includes('模型已加载'),null,{timeout:180000});
 report.interruptedVisible=await page.locator('.cui-msg-agent').last().getAttribute('data-source');
 report.activeId=await page.locator('.agent-session-select').inputValue();
 report.beforeReload=await page.locator('.cui-msg-agent').last().getAttribute('data-source');
 await page.locator('.agent-panel-settings-toggle').click();
 const downloadPromise=page.waitForEvent('download');await page.locator('.agent-history-export').click();
 const download=await downloadPromise;report.exported=JSON.parse(await fs.readFile(await download.path(),'utf8'));
 await page.reload();
 await page.frameLocator('#app iframe').locator('.agent-sidebar-entry').click({timeout:90000});
 await page.locator('.agent-panel-settings-toggle').click();
 await page.locator('.agent-history-restore').click();
 await page.waitForFunction(id=>document.querySelector('.agent-session-select')?.value===id&&document.querySelectorAll('.cui-msg-agent').length>0,report.activeId,{timeout:30000});
 report.afterReload=await page.locator('.cui-msg-agent').last().getAttribute('data-source');
 report.restoredRows=await page.locator('.cui-msg').allTextContents();
 report.savingAfterReload=await page.locator('.agent-history-save').isChecked();
 if(report.beforeReload!==report.interruptedVisible||report.afterReload!==report.interruptedVisible)throw Error('Visible partial not preserved');

 await page.locator('.agent-panel-settings-toggle').click();
 await page.locator('.cui-restore').last().click();
 report.restoredDraft=await page.locator('.cui-input').inputValue();
 if(report.restoredDraft!==report.exported.sessions.find(s=>s.id===report.activeId).messages[0].content)throw Error('Restore request mismatch');
 await page.locator('.agent-panel-settings-toggle').click();
 await page.locator('.agent-panel-gguf-files').setInputFiles('.scratch/node_modules/ai-models/qwen2.5-0.5b-instruct-q4_k_m.gguf');
 await page.locator('.agent-panel-gguf-load').click();
 await page.waitForFunction(()=>document.querySelector('.agent-panel-note')?.textContent?.includes('模型已加载'),null,{timeout:180000});
 await page.locator('.agent-panel-settings-toggle').click();
 await page.evaluate(async()=>{
  const {Wllama}=await import('/assets/client-D5_UYdz1.js');const complete=Wllama.prototype.createChatCompletion;
  window.__restoredRequests=[];
  Wllama.prototype.createChatCompletion=async function(...args){
   const record={request:structuredClone(Object.fromEntries(Object.entries(args[0]).filter(([key])=>key!=='abortSignal'))),chunks:[],returned:false};
   window.__restoredRequests.push(record);const result=await complete.apply(this,args);
   if(!result?.[Symbol.asyncIterator]){record.response=structuredClone(result);record.returned=true;return result;}
   return(async function*(){try{for await(const chunk of result){record.chunks.push(structuredClone(chunk));yield chunk;}record.returned=true;}catch(error){record.error={name:error.name,message:error.message};throw error;}})();
  };
 });
 report.requestsBeforeSend=await page.evaluate(()=>window.__restoredRequests.length);
 report.followup='前一个请求要求修理什么物品？只回复物品名称，不要操作文档。';
 await page.locator('.cui-input').fill(report.followup);await page.locator('.cui-input').press('Enter');
 await page.waitForFunction(()=>!document.querySelector('.cui-input')?.disabled,null,{timeout:120000});
 report.restoredRequests=await page.evaluate(()=>window.__restoredRequests);
 report.followupReply=await page.locator('.cui-msg-agent').last().getAttribute('data-source');
 report.guidance=await page.locator('.cui-msg-error').allTextContents();report.previewCount=await page.locator('.agent-plan-preview').count();
 report.documentAfter=await page.frameLocator('#app iframe').locator('body').evaluate(()=> (window.editor??window.Asc.editor).WordControl.m_oLogicDocument.GetText());
 if(report.errors.length||report.guidance.length||report.previewCount||report.documentBefore!==report.documentAfter)throw Error('Incomplete measurement or recovery');
 report.passed=true;
}catch(error){report.passed=false;report.error=String(error);process.exitCode=1;}
finally{await context.close();report.contextClosed=true;await fs.writeFile('docs/evaluations/2026-10-05-stop-history-restored-context.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));}
