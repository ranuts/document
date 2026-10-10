import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
const context=await chromium.launchPersistentContext('.scratch/ai-offline/profile',{serviceWorkers:'block',viewport:{width:1280,height:900}});
await context.addInitScript(()=>{Object.defineProperty(navigator,'gpu',{value:undefined,configurable:true});localStorage.setItem('ran-theme','system');});
const page=context.pages()[0]??await context.newPage();
const prompt='Write a detailed essay with 20 paragraphs about the history of mathematics.';
const report={scope:'Actual production CPU Qwen 0.6B pending generation interrupted before visible text using visible Stop; plain status, restore request without resending, preserve new draft, and next real inference. Desktop Chromium; no native document mutation or physical mobile coverage.',errors:[]};
page.on('pageerror',e=>report.errors.push(e.message));
try{
 await page.emulateMedia({colorScheme:'light'});
 await page.goto('http://127.0.0.1:5193/editor?new=docx&agent=1&locale=en');
 await page.frameLocator('#app iframe').locator('.agent-sidebar-entry').click({timeout:60000});
 await page.waitForFunction(()=>document.querySelector('.agent-panel-note')?.textContent?.includes('Model loaded'),{},{timeout:180000});
 await page.locator('.agent-panel-clear').click();
 await page.locator('.cui-input').fill(prompt);await page.locator('.cui-input').press('Enter');
 await page.waitForFunction(()=>document.querySelector('.cui-input').disabled&&document.querySelector('.cui-send-stop'),{},{timeout:10000});
 await page.waitForTimeout(500);
 await page.locator('.cui-send-stop').click();
 await page.waitForFunction(()=>!document.querySelector('.cui-input').disabled,{},{timeout:30000});
 report.stopped=await page.evaluate(()=>{const row=document.querySelector('.cui-msg-status'),bubble=row?.querySelector('.cui-bubble'),style=bubble&&getComputedStyle(bubble);return {status:row?.textContent,statusCount:document.querySelectorAll('.cui-msg-status').length,errorCount:document.querySelectorAll('.cui-msg-error').length,statusApplyCount:row?.querySelectorAll('.cui-apply').length,partial:document.querySelector('.cui-msg-agent')?.getAttribute('data-source'),borderWidth:style?.borderTopWidth,background:style?.backgroundColor,inputEnabled:!document.querySelector('.cui-input').disabled,userCount:document.querySelectorAll('.cui-msg-user').length};});
 if(!report.stopped.status?.startsWith('Stopped.')||report.stopped.statusCount!==1||report.stopped.errorCount||report.stopped.statusApplyCount||!report.stopped.inputEnabled||report.stopped.borderWidth!=='0px')throw Error('Stop still rendered as error or insertable answer');
 await page.locator('.cui-msg-status .cui-restore').click();
 report.restored={draft:await page.locator('.cui-input').inputValue(),userCount:await page.locator('.cui-msg-user').count(),running:await page.locator('.cui-input').isDisabled()};
 if(report.restored.draft!==prompt||report.restored.userCount!==report.stopped.userCount||report.restored.running)throw Error('Restore sent a request or lost original draft');
 await page.locator('.cui-input').fill('My new draft');report.newDraftProtected=await page.locator('.cui-msg-status .cui-restore').isDisabled();
 if(!report.newDraftProtected)throw Error('Restore could overwrite a new draft');
 await page.screenshot({path:'.scratch/ai-csp/im-stop-neutral-status-cpu-light.png'});
 await page.setViewportSize({width:390,height:844});await page.emulateMedia({colorScheme:'dark'});
 await page.screenshot({path:'.scratch/ai-csp/im-stop-neutral-status-cpu-dark.png'});
 await page.waitForFunction(()=>document.querySelector('.agent-model-status')?.textContent?.includes('CPU')&&!document.querySelector('.agent-panel-load')?.hasAttribute('disabled')&&document.querySelector('.agent-panel-note')?.textContent?.includes('Model loaded'),{},{timeout:180000});
 report.engineBeforeNext=await page.locator('.agent-model-status').textContent();
 await page.locator('.cui-input').fill('Please reply with only hello.');await page.locator('.cui-input').press('Enter');
 await page.waitForFunction(()=>!document.querySelector('.cui-input').disabled,{},{timeout:90000});
 report.nextReply=await page.locator('.cui-msg-agent').last().getAttribute('data-source');
 report.visibleErrors=await page.locator('.cui-msg-error').allTextContents();report.previewCount=await page.locator('.agent-plan-preview').count();
 report.passed=!!report.nextReply?.trim()&&!report.visibleErrors.length&&!report.errors.length&&report.previewCount===0;
}catch(e){report.passed=false;report.error=String(e);report.note=await page.locator('.agent-panel-note').textContent().catch(()=>null);report.visibleErrors=await page.locator('.cui-msg-error').allTextContents().catch(()=>[]);report.draft=await page.locator('.cui-input').inputValue().catch(()=>null);}
finally{await fs.writeFile('docs/evaluations/2026-10-03-im-stop-neutral-status-cpu.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));await context.close();}
