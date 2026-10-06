import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
const context=await chromium.launchPersistentContext('.scratch/ai-csp/gpu-profile',{args:['--enable-unsafe-webgpu','--use-angle=metal'],serviceWorkers:'block',viewport:{width:1280,height:900}});
await context.addInitScript(()=>{localStorage.setItem('agent-local-model-id','Qwen3-1.7B-q4f16_1-MLC');localStorage.setItem('ran-theme','system');});
const page=context.pages()[0]??await context.newPage();
const report={scope:'Actual production IM with cached GPU Qwen 1.7B. Keyboard navigation, native smooth scroll during real streaming, Stop and new conversation; narrow/light/dark layout simulations in isolated Chromium.',errors:[]};
page.on('pageerror',e=>report.errors.push(e.message));
const state=()=>page.evaluate(()=>{const jump=document.querySelector('.cui-scroll-bottom'),messages=document.querySelector('.cui-messages'),active=document.activeElement;return {hidden:jump.hidden,display:getComputedStyle(jump).display,focused:active?.className,scrollTop:messages.scrollTop,remaining:messages.scrollHeight-messages.scrollTop-messages.clientHeight,replyLength:document.querySelector('.cui-msg-agent')?.getAttribute('data-source')?.length??0,running:document.querySelector('.cui-input').disabled};});
try {
 await page.emulateMedia({colorScheme:'light'});
 await page.goto('http://127.0.0.1:5193/editor?new=docx&agent=1&locale=en');
 await page.frameLocator('#app iframe').locator('.agent-sidebar-entry').click({timeout:60000});
 await page.waitForFunction(()=>document.querySelector('.agent-panel-note')?.textContent?.includes('Model loaded'),{},{timeout:180000});
 report.engine=await page.locator('.agent-model-status').textContent();
 await page.locator('.cui-input').focus();await page.keyboard.press('Shift+Tab');report.empty=await state();
 if(!report.empty.hidden||report.empty.display!=='none'||report.empty.focused.includes('cui-scroll-bottom'))throw Error('Hidden control still keyboard reachable');
 await page.locator('.cui-input').fill('Write a detailed essay with 20 paragraphs about the history of mathematics. Each paragraph should have four sentences.');
 await page.locator('.cui-input').press('Enter');
 await page.waitForFunction(()=>{const m=document.querySelector('.cui-messages');return document.querySelector('.cui-input')?.disabled&&m.scrollHeight>m.clientHeight+250;},{},{timeout:90000});
 await page.locator('.cui-messages').evaluate(e=>e.scrollTo({top:0,behavior:'instant'}));
 await page.waitForFunction(()=>!document.querySelector('.cui-scroll-bottom').hidden,{},{timeout:5000});
 report.readingBefore=await state();
 await page.waitForFunction(length=>(document.querySelector('.cui-msg-agent')?.getAttribute('data-source')?.length??0)>length+40,report.readingBefore.replyLength,{timeout:30000});
 report.readingAfter=await state();
 if(report.readingAfter.scrollTop!==0||report.readingAfter.hidden)throw Error('Streaming displaced reader');
 await page.locator('.cui-scroll-bottom').focus();await page.keyboard.press('Enter');
 await page.waitForFunction(()=>document.querySelector('.cui-scroll-bottom').hidden,{},{timeout:10000});
 report.afterJump=await state();
 if(report.afterJump.focused!=='cui-messages'||report.afterJump.remaining>=60)throw Error('Smooth jump focus or bottom state failed');
 await page.locator('.cui-send-stop').click();
 await page.waitForFunction(()=>!document.querySelector('.cui-input')?.disabled,{},{timeout:30000});
 await page.locator('.cui-input').focus();await page.keyboard.press('Shift+Tab');report.completed=await state();
 if(!report.completed.hidden||report.completed.focused.includes('cui-scroll-bottom'))throw Error('Completed hidden control keyboard reachable');
 report.layouts=[];
 for(const [width,height,colorScheme] of [[1280,900,'light'],[390,844,'light'],[390,420,'dark']]){
  await page.setViewportSize({width,height});await page.emulateMedia({colorScheme});
  await page.locator('.cui-input').focus();
  const layout=await page.evaluate(()=>{const panel=document.querySelector('.agent-panel'),send=document.querySelector('.cui-send'),r=send.getBoundingClientRect();return {theme:document.documentElement.getAttribute('data-ran-theme'),panelWidth:panel.clientWidth,scrollWidth:panel.scrollWidth,sendBottom:r.bottom,viewportHeight:innerHeight,sendReachable:send.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))};});
  report.layouts.push({width,height,colorScheme,...layout});
  if(layout.scrollWidth>layout.panelWidth||layout.sendBottom>height||!layout.sendReachable)throw Error('Layout blocked composer');
  await page.screenshot({path:'.scratch/ai-csp/im-scroll-focus-'+width+'-'+height+'-'+colorScheme+'.png'});
 }
 await page.locator('.cui-messages').evaluate(e=>e.scrollTo({top:0,behavior:'instant'}));
 await page.waitForFunction(()=>!document.querySelector('.cui-scroll-bottom').hidden,{},{timeout:5000});
 await page.locator('.agent-panel-clear').click();
 await page.waitForFunction(()=>document.querySelector('.cui-scroll-bottom').hidden,{},{timeout:5000});
 report.newConversation=await state();report.visibleErrors=await page.locator('.cui-msg-error').allTextContents();
 report.previewCount=await page.locator('.agent-plan-preview').count();
 report.passed=report.newConversation.hidden&&!report.errors.length&&!report.visibleErrors.length&&report.previewCount===0;
} catch(e){report.passed=false;report.error=String(e);report.lastState=await state().catch(()=>null);}
finally {await fs.writeFile('docs/evaluations/2026-10-03-im-hidden-scroll-fixed.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));await context.close();}
