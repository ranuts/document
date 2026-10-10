import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
const context=await chromium.launchPersistentContext('.scratch/ai-offline/profile',{serviceWorkers:'block',viewport:{width:1280,height:900}});
await context.addInitScript(()=>{
 Object.defineProperty(navigator,'gpu',{value:undefined,configurable:true});
 window.__readyProbe={hold:false,held:0,constructed:0,terminated:0,reinitHeld:0,queue:[]};
 const Original=window.Worker;
 window.Worker=class extends Original {
  constructor(url,options){super(url,options);this.__target=String(url).startsWith('blob:');if(this.__target)this.__instance=++window.__readyProbe.constructed;}
  postMessage(...args){if(this.__target&&this.__instance>1&&window.__readyProbe.hold){window.__readyProbe.held++;window.__readyProbe.reinitHeld++;window.__readyProbe.queue.push(()=>super.postMessage(...args));return;}super.postMessage(...args);}
  terminate(){if(this.__target)window.__readyProbe.terminated++;super.terminate();}
 };
});
const page=context.pages()[0]??await context.newPage();
const report={scope:'Actual cached CPU Qwen 0.6B Stop, controlled hold of native Worker reinitialization messages, editable draft with disabled model-dependent Send/Enter, native-direct exemption, resume real initialization, manual next inference. No download stall, partial response, or physical mobile claim.',errors:[]};
page.on('pageerror',e=>report.errors.push(e.message));
const state=()=>page.evaluate(()=>({draft:document.querySelector('.cui-input').value,inputDisabled:document.querySelector('.cui-input').disabled,sendDisabled:document.querySelector('.cui-send').disabled,userCount:document.querySelectorAll('.cui-msg-user').length,status:document.querySelector('.agent-model-status').textContent,settingsExpanded:document.querySelector('.agent-panel-settings-toggle').getAttribute('aria-expanded'),held:window.__readyProbe.held,reinitHeld:window.__readyProbe.reinitHeld,constructed:window.__readyProbe.constructed,terminated:window.__readyProbe.terminated}));
try{
 await page.goto('http://127.0.0.1:5193/editor?new=docx&agent=1&locale=en');
 await page.frameLocator('#app iframe').locator('.agent-sidebar-entry').click({timeout:60000});
 await page.waitForFunction(()=>document.querySelector('.agent-panel-note')?.textContent?.includes('Model loaded'),{},{timeout:180000});
 await page.locator('.agent-panel-clear').click();
 await page.evaluate(()=>{window.__readyProbe.hold=true;});
 await page.locator('.cui-input').fill('Write a detailed essay with twenty paragraphs about mathematics.');
 await page.locator('.cui-input').press('Enter');
 await page.waitForFunction(()=>document.querySelector('.cui-input').disabled,{},{timeout:10000});
 await page.waitForTimeout(500);
 await page.locator('.cui-send-stop').click();
 await page.waitForFunction(()=>window.__readyProbe.reinitHeld>0&&!document.querySelector('.cui-input').disabled,{},{timeout:30000});
 await page.locator('.cui-input').fill('Please reply with only hello.');
 report.loading=await state();
 if(report.loading.inputDisabled||!report.loading.sendDisabled||report.loading.reinitHeld<1||report.loading.constructed<2||report.loading.terminated<1||report.loading.settingsExpanded!=='false')throw Error('Loading availability incorrect');
 await page.locator('.cui-input').press('Enter');report.afterEnter=await state();
 if(report.afterEnter.draft!==report.loading.draft||report.afterEnter.userCount!==report.loading.userCount||report.afterEnter.settingsExpanded!=='false')throw Error('Blocked Enter changed draft, history or settings');
 await page.locator('.cui-input').fill('写到当前的文档上');report.directAvailability=await state();
 if(report.directAvailability.sendDisabled)throw Error('Native direct request unnecessarily disabled');
 await page.locator('.cui-input').fill(report.loading.draft);
 await page.screenshot({path:'.scratch/ai-csp/im-loading-send-readiness.png'});
 await page.evaluate(()=>{window.__readyProbe.hold=false;for(const resume of window.__readyProbe.queue.splice(0))resume();});
 await page.waitForFunction(()=>document.querySelector('.agent-model-status').textContent.includes('CPU')&&!document.querySelector('.cui-send').disabled,{},{timeout:180000});
 report.ready=await state();
 if(report.ready.draft!==report.loading.draft||report.ready.userCount!==report.loading.userCount||report.ready.inputDisabled||report.ready.sendDisabled)throw Error('Ready transition changed draft or replayed request');
 await page.locator('.cui-send').click();
 await page.waitForFunction(()=>!document.querySelector('.cui-input').disabled,{},{timeout:120000});
 report.reply=await page.locator('.cui-msg-agent').last().getAttribute('data-source');
 report.visibleErrors=await page.locator('.cui-msg-error').allTextContents();report.previewCount=await page.locator('.agent-plan-preview').count();
 report.passed=!!report.reply?.trim()&&!report.visibleErrors.length&&!report.errors.length&&report.previewCount===0;
}catch(e){report.passed=false;report.error=String(e);report.lastState=await state().catch(()=>null);}
finally{await fs.writeFile('docs/evaluations/2026-10-03-im-loading-send-readiness.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));await context.close();}
