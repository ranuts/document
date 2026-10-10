import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
const cpu=process.env.LOAD_CPU==='1';
const context=await chromium.launchPersistentContext(cpu?'.scratch/ai-offline/profile':'.scratch/ai-csp/gpu-profile',{args:cpu?[]:['--enable-unsafe-webgpu','--use-angle=metal'],serviceWorkers:'block',viewport:{width:1280,height:900}});
await context.addInitScript(cpu=>{
 if(cpu)Object.defineProperty(navigator,'gpu',{value:undefined,configurable:true});else localStorage.setItem('agent-local-model-id','Qwen3-1.7B-q4f16_1-MLC');
 window.__progressProbe={hold:true,queue:[],held:0,terminated:0,samples:[]};
 const Original=window.Worker;
 window.Worker=class extends Original{
  constructor(url,options){super(url,options);this.__target=cpu?String(url).startsWith('blob:'):String(url).includes('webllm.worker');}
  postMessage(...args){if(this.__target&&window.__progressProbe.hold){window.__progressProbe.held++;window.__progressProbe.queue.push(()=>super.postMessage(...args));return;}super.postMessage(...args);}
  terminate(){if(this.__target)window.__progressProbe.terminated++;super.terminate();}
 };
 new MutationObserver(()=>{const p=document.querySelector('.agent-model-progress');if(p?.hasAttribute('value')){const value=p.value,samples=window.__progressProbe.samples;if(samples.length<50&&samples.at(-1)?.value!==value)samples.push({value,hidden:p.hidden});}}).observe(document,{subtree:true,childList:true,attributes:true,attributeFilter:['value','hidden']});
},cpu);
const page=context.pages()[0]??await context.newPage();
const report={cpu,scope:'Actual cached local engine Worker initialization held; loading progress and existing Stop exposed with settings collapsed; desktop and narrow viewport geometry, loading Stop then controlled late message release, explicit retry and real inference. Cached initialization does not prove first network-download progress or physical mobile behavior.',errors:[],layouts:[]};
page.on('pageerror',e=>report.errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:5193/editor?new=docx&agent=1&locale=en');
 await page.frameLocator('#app iframe').locator('.agent-sidebar-entry').click({timeout:60000});
 await page.waitForFunction(()=>window.__progressProbe.held>0,{},{timeout:60000});
 await page.locator('.cui-input').fill('My draft while loading');
 for(const [width,height] of [[1280,900],[390,844],[390,420],[320,320]]){
  await page.setViewportSize({width,height});
  const layout=await page.evaluate(()=>{const stop=document.querySelector('.agent-panel-load-stop'),progress=document.querySelector('.agent-model-progress'),row=document.querySelector('.agent-runtime-row'),r=stop.getBoundingClientRect(),pr=progress.getBoundingClientRect();return {status:document.querySelector('.agent-model-status').textContent,settings:document.querySelector('.agent-panel-settings-toggle').getAttribute('aria-expanded'),rowHidden:row.hidden,stopHidden:stop.hidden,stopReachable:stop.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)),stopBottom:r.bottom,progressHeight:pr.height,progressWidth:pr.width,progressLabel:progress.getAttribute('aria-label'),hasValue:progress.hasAttribute('value'),inputDisabled:document.querySelector('.cui-input').disabled,sendDisabled:document.querySelector('.cui-send').disabled,viewportHeight:innerHeight};});
  report.layouts.push({width,height,...layout});
  if(cpu&&layout.status.includes('100%'))throw Error('Completed file read incorrectly shown as complete initialization');
  if(layout.settings!=='false'||layout.rowHidden||layout.stopHidden||!layout.stopReachable||layout.stopBottom>height||layout.progressHeight<=0||layout.progressWidth<=0||!layout.progressLabel||layout.inputDisabled||!layout.sendDisabled)throw Error('Main loading controls unavailable');
  await page.screenshot({path:'.scratch/ai-csp/im-main-load-progress-'+(cpu?'cpu':'gpu')+'-'+width+'-'+height+'.png'});
 }
 await page.locator('.agent-panel-load-stop').click();
 report.stopped=await page.evaluate(()=>({rowHidden:document.querySelector('.agent-runtime-row').hidden,progressHidden:document.querySelector('.agent-model-progress').hidden,stopHidden:document.querySelector('.agent-panel-load-stop').hidden,draft:document.querySelector('.cui-input').value,focused:document.activeElement?.className,terminated:window.__progressProbe.terminated,note:document.querySelector('.agent-panel-note').textContent}));
 if(!report.stopped.rowHidden||!report.stopped.progressHidden||!report.stopped.stopHidden||report.stopped.draft!=='My draft while loading'||report.stopped.focused!=='cui-input'||report.stopped.terminated<1)throw Error('Stop failed to clear loading surface or preserve draft');
 await page.evaluate(()=>{window.__progressProbe.hold=false;for(const resume of window.__progressProbe.queue.splice(0))resume();});
 await page.waitForTimeout(800);
 if(await page.locator('.agent-model-progress').isVisible())throw Error('Late initialization revived progress');
 await page.setViewportSize({width:1280,height:900});
 await page.locator('.agent-panel-settings-toggle').click();await page.locator('.agent-panel-load').click();
 await page.locator('.agent-panel-settings-toggle').click();
 await page.waitForFunction(()=>document.querySelector('.agent-panel-note')?.textContent?.includes('Model loaded'),{},{timeout:180000});
 report.ready=await page.evaluate(()=>({engine:document.querySelector('.agent-model-status').textContent,progressHidden:document.querySelector('.agent-model-progress').hidden,stopHidden:document.querySelector('.agent-panel-load-stop').hidden,draft:document.querySelector('.cui-input').value,samples:window.__progressProbe.samples}));
 if(!report.ready.engine.includes(cpu?'CPU':'WebGPU')||!report.ready.progressHidden||!report.ready.stopHidden||report.ready.draft!=='My draft while loading')throw Error('Ready surface incorrect');
 await page.locator('.cui-input').fill('Please reply with only hello.');await page.locator('.cui-input').press('Enter');
 await page.waitForFunction(()=>!document.querySelector('.cui-input').disabled,{},{timeout:120000});
 report.reply=await page.locator('.cui-msg-agent').last().getAttribute('data-source');report.visibleErrors=await page.locator('.cui-msg-error').allTextContents();report.previewCount=await page.locator('.agent-plan-preview').count();
 report.passed=!!report.reply?.trim()&&!report.visibleErrors.length&&!report.errors.length&&report.previewCount===0;
}catch(e){report.passed=false;report.error=String(e);}
finally{await fs.writeFile('docs/evaluations/2026-10-03-im-main-load-progress-'+(cpu?'cpu':'gpu')+'.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));await context.close();}
