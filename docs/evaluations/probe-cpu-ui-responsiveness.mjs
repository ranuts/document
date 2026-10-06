import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const sha=v=>crypto.createHash('sha256').update(v).digest('hex');
const files=(await fs.readdir('dist/assets')).filter(n=>/^agent-plugin-.*\.js$/.test(n));
if(files.length!==1)throw Error('Ambiguous plugin');
const report={scope:'Single warmed desktop Chromium actual CPU stream/Stop/reload with passive frame/timer/long-task observers. Not a device benchmark or broad responsiveness certificate.',probeSHA256:sha(await fs.readFile(new URL(import.meta.url))),plugin:files[0],pluginSHA256:sha(await fs.readFile('dist/assets/'+files[0])),errors:[]};
const context=await chromium.launchPersistentContext('.scratch/ai-offline/profile',{serviceWorkers:'block',viewport:{width:1280,height:900}});
await context.addInitScript(()=>Object.defineProperty(navigator,'gpu',{value:undefined,configurable:true}));
try{
 const page=context.pages()[0]??await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto('http://127.0.0.1:5193/editor?new=docx&agent=1&locale=zh-CN');
 await page.frameLocator('#app iframe').locator('.agent-sidebar-entry').click({timeout:90000});
 await page.waitForFunction(()=>document.querySelector('.agent-panel-note')?.textContent?.includes('模型已加载'),null,{timeout:180000});
 report.engine=await page.locator('.agent-model-status').textContent();if(!report.engine.includes('CPU'))throw Error('Not CPU');
 await page.locator('.agent-panel-clear').click();
 await page.locator('.agent-panel-settings-toggle').click();await page.locator('.agent-generation-options summary').click();
 await page.locator('[name="maxTokens"]').fill('1024');await page.locator('[name="maxTokens"]').dispatchEvent('change');
 await page.locator('.agent-panel-settings-toggle').click();
 report.documentBefore=await page.frameLocator('#app iframe').locator('body').evaluate(()=> (window.editor??window.Asc.editor).WordControl.m_oLogicDocument.GetText());
 await page.evaluate(()=>{
  const p=window.__uiPerf={phase:'idle',frames:{idle:[],inference:[],recovery:[]},timers:{idle:[],inference:[],recovery:[]},longTasks:[],isolated:crossOriginIsolated};
  let frameLast=performance.now(),timerLast=frameLast;
  window.__setPhase=phase=>{p.phase=phase;frameLast=timerLast=performance.now();p[phase+'Start']=performance.now();};
  const frame=()=>{const now=performance.now();p.frames[p.phase].push(now-frameLast);frameLast=now;requestAnimationFrame(frame);};requestAnimationFrame(frame);
  setInterval(()=>{const now=performance.now();p.timers[p.phase].push(now-timerLast);timerLast=now;},20);
  try{new PerformanceObserver(list=>{for(const e of list.getEntries())p.longTasks.push({startTime:e.startTime,duration:e.duration});}).observe({type:'longtask'});}catch{p.longTaskObserverUnsupported=true;}
  const input=document.querySelector('.cui-input');new MutationObserver(()=>{if(p.stopAt!==undefined&&!input.disabled&&p.unlockedAt===undefined)p.unlockedAt=performance.now();}).observe(input,{attributes:true,attributeFilter:['disabled']});
  document.querySelector('.cui-send').addEventListener('click',()=>{if(input.disabled){p.stopAt=performance.now();window.__setPhase('recovery');}},{capture:true});
  window.__setPhase('idle');
 });
 await page.waitForFunction(()=>performance.now()-window.__uiPerf.idleStart>=2000);
 await page.locator('.cui-input').fill('请写一个较长的原创中文故事，详细描述一位工匠修理旧钟的过程，至少六百字。不要操作文档。');
 await page.evaluate(()=>window.__setPhase('inference'));await page.locator('.cui-input').press('Enter');
 await page.waitForFunction(()=>document.querySelector('.cui-input')?.disabled&&(document.querySelector('.cui-msg-agent')?.textContent?.length??0)>=40,null,{timeout:120000});
 report.partialText=await page.locator('.cui-msg-agent').last().textContent();
 await page.locator('.cui-send-stop').click();
 await page.waitForFunction(()=>window.__uiPerf.unlockedAt!==undefined,null,{timeout:30000});
 await page.waitForFunction(()=>document.querySelector('.agent-panel-note')?.textContent?.includes('模型已加载'),null,{timeout:180000});
 report.measurement=await page.evaluate(()=>structuredClone(window.__uiPerf));
 report.guidance=await page.locator('.cui-msg-error').allTextContents();report.previewCount=await page.locator('.agent-plan-preview').count();
 report.documentAfter=await page.frameLocator('#app iframe').locator('body').evaluate(()=> (window.editor??window.Asc.editor).WordControl.m_oLogicDocument.GetText());
 if(report.errors.length||report.guidance.length||report.previewCount||report.documentBefore!==report.documentAfter||report.measurement.frames.inference.length<2)throw Error('Incomplete measurement or recovery');
 report.passed=true;
}catch(error){report.passed=false;report.error=String(error);process.exitCode=1;}
finally{await context.close();report.contextClosed=true;await fs.writeFile('docs/evaluations/2026-10-05-cpu-ui-responsiveness.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,error:report.error,engine:report.engine,frames:report.measurement&&Object.fromEntries(Object.entries(report.measurement.frames).map(([k,v])=>[k,v.length])),stopUnlockMs:report.measurement&&report.measurement.unlockedAt-report.measurement.stopAt}));}
