import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const origin='http://127.0.0.1:5193';
const hash=(value)=>crypto.createHash('sha256').update(value).digest('hex');
const plugin=(await fs.readdir('dist/assets')).filter(n=>/^agent-plugin-.*\.js$/.test(n));
if(plugin.length!==1)throw Error('Ambiguous plugin');
const bundle=await fs.readFile('dist/assets/'+plugin[0]);
const report={scope:'Current native Word IM with real CPU model, one controlled SDK exit delay, actual exit/reload/inference. Not physical teardown-fault, model-quality, offline or PWA certification.',probeSHA256:hash(await fs.readFile(new URL(import.meta.url))),plugin:plugin[0],pluginSHA256:hash(bundle),errors:[]};
const context=await chromium.launchPersistentContext('.scratch/ai-offline/profile',{serviceWorkers:'block',viewport:{width:1280,height:900}});
await context.addInitScript(()=>{
 Object.defineProperty(navigator,'gpu',{value:undefined,configurable:true});
 if(location.origin==='http://127.0.0.1:5193')localStorage.setItem('agent-panel-provider','wllama');
});
try{
 const page=context.pages()[0]??await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto(origin+'/editor?new=docx&agent=1&locale=zh-CN');
 await page.frameLocator('#app iframe').locator('.agent-sidebar-entry').click({timeout:90000});
 await page.waitForFunction(()=>document.querySelector('.agent-panel-note')?.textContent?.includes('模型已加载'),null,{timeout:180000});
 report.engine=await page.locator('.agent-model-status').textContent();
 if(!report.engine.includes('CPU'))throw Error('Not CPU');
 await page.locator('.agent-panel-clear').click();
 report.documentBefore=await page.frameLocator('#app iframe').locator('body').evaluate(()=> (window.editor??window.Asc.editor).WordControl.m_oLogicDocument.GetText());
 await page.evaluate(async()=>{
  const {Wllama}=await import('/assets/client-D5_UYdz1.js');
  const exit=Wllama.prototype.exit,load=Wllama.prototype.loadModelFromUrl;
  if(typeof exit!=='function'||typeof load!=='function')throw Error('SDK hooks missing');
  window.__handover={exits:0,exitFinished:0,loads:0};
  let first=true;
  Wllama.prototype.exit=async function(...args){
   window.__handover.exits++;
   if(first){first=false;await new Promise(resolve=>{window.__releaseExit=resolve;});}
   const result=await exit.apply(this,args);window.__handover.exitFinished++;return result;
  };
  Wllama.prototype.loadModelFromUrl=async function(...args){window.__handover.loads++;return load.apply(this,args);};
 });
 await page.locator('.agent-panel-settings-toggle').click();
 await page.locator('.agent-panel-gguf-url').evaluate(el=>el.dispatchEvent(new Event('change',{bubbles:true})));
 await page.waitForFunction(()=>typeof window.__releaseExit==='function');
 await page.locator('.agent-panel-gguf-load').click();
 report.waiting=await page.evaluate(()=>({note:document.querySelector('.agent-panel-note').textContent,status:document.querySelector('.agent-model-status').textContent,progressVisible:!document.querySelector('.agent-model-progress').hidden,stopVisible:!document.querySelector('.agent-panel-gguf-stop').hidden,loadDisabled:document.querySelector('.agent-panel-gguf-load').hasAttribute('disabled'),...window.__handover}));
 if(!report.waiting.progressVisible||!report.waiting.stopVisible||!report.waiting.loadDisabled||!report.waiting.status.includes('正在准备 AI')||report.waiting.loads!==0)throw Error('Waiting UI mismatch');
 await page.locator('.agent-panel-gguf-stop').click();
 report.stopped=await page.evaluate(()=>({note:document.querySelector('.agent-panel-note').textContent,progressHidden:document.querySelector('.agent-model-progress').hidden,loadDisabled:document.querySelector('.agent-panel-gguf-load').hasAttribute('disabled')}));
 if(report.stopped.note!=='已停止。'||!report.stopped.progressHidden||report.stopped.loadDisabled)throw Error('Stop mismatch');
 await page.evaluate(()=>window.__releaseExit());
 await page.waitForFunction(()=>window.__handover.exitFinished===1);
 report.afterExit=await page.evaluate(()=>({...window.__handover,note:document.querySelector('.agent-panel-note').textContent}));
 if(report.afterExit.loads!==0||report.afterExit.note!=='已停止。')throw Error('Cancelled replacement restarted');
 await page.locator('.agent-panel-gguf-load').click();
 await page.waitForFunction(()=>document.querySelector('.agent-panel-note')?.textContent?.includes('模型已加载'),null,{timeout:180000});
 await page.locator('.agent-panel-settings-toggle').click();
 await page.locator('.cui-input').fill('你好');await page.locator('.cui-input').press('Enter');
 await page.waitForFunction(()=>!document.querySelector('.cui-input')?.disabled,null,{timeout:90000});
 report.recovered=await page.evaluate(()=>({...window.__handover,answers:document.querySelectorAll('.cui-msg-agent').length,guidance:[...document.querySelectorAll('.cui-msg-error')].map(el=>el.textContent),previewCount:document.querySelectorAll('.agent-plan-preview').length}));
 report.documentAfter=await page.frameLocator('#app iframe').locator('body').evaluate(()=> (window.editor??window.Asc.editor).WordControl.m_oLogicDocument.GetText());
 if(report.recovered.loads!==1||report.recovered.answers!==1||report.recovered.guidance.length||report.recovered.previewCount||report.errors.length||report.documentBefore!==report.documentAfter)throw Error('Recovery mismatch');
 report.passed=true;
}catch(error){report.passed=false;report.error=String(error);process.exitCode=1;}
finally{
 await context.close();report.contextClosed=true;report.bundleBytesUnchanged=hash(await fs.readFile('dist/assets/'+plugin[0]))===report.pluginSHA256;
 await fs.writeFile('docs/evaluations/2026-10-05-runtime-handover-ui.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}
