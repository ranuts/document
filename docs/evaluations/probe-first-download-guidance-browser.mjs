import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const report={probeSHA256:sha(await fs.readFile(new URL(import.meta.url))),scope:'Fresh Chromium context with no app/model storage; local app remains online, all external HTTP requests aborted, navigator.gpu unavailable. Not full offline app navigation.',status:'running',external:[],errors:[]};
const browser=await chromium.launch();const context=await browser.newContext({serviceWorkers:'block'});
await context.addInitScript(()=>{Object.defineProperty(navigator,'gpu',{value:undefined,configurable:true});localStorage.setItem('agent-panel-provider','webllm');});
await context.route('**/*',async route=>{const q=route.request();if(/^https?:/.test(q.url())&&new URL(q.url()).origin!=='http://127.0.0.1:5193'){report.external.push({url:q.url(),method:q.method(),bodyBytes:q.postDataBuffer()?.length??0});await route.abort('internetdisconnected');}else await route.continue();});
const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:5193/editor?new=docx&agent=1&locale=en');await page.frameLocator('#app iframe').locator('.agent-sidebar-entry').click({timeout:90000});
 await page.waitForFunction(()=>document.querySelector('.agent-panel-note')?.textContent?.includes('Model loading failed'),null,{timeout:90000});
 await page.locator('.agent-panel-settings-toggle').click();await page.waitForFunction(()=>!document.querySelector('.agent-panel-load').disabled);
 report.first=await page.evaluate(()=>({note:document.querySelector('.agent-panel-note').textContent,errors:[...document.querySelectorAll('.cui-msg-error')].map(e=>e.textContent),provider:document.querySelector('.agent-panel-provider').value,loadEnabled:!document.querySelector('.agent-panel-load').disabled,settings:document.querySelector('.agent-panel-settings').textContent}));
 const before=report.external.length;await page.locator('.agent-panel-load').click();await page.waitForFunction(()=>document.querySelectorAll('.cui-msg-error').length>=2 && !document.querySelector('.agent-panel-load').disabled,null,{timeout:90000});
 report.retry={newRequests:report.external.length-before,note:await page.locator('.agent-panel-note').textContent(),errors:await page.locator('.cui-msg-error').allTextContents()};report.status='completed';
}catch(e){report.status='failed';report.error=String(e);process.exitCode=1;}
finally{await browser.close();await fs.writeFile('docs/evaluations/2026-10-04-first-download-guidance-browser.json',JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({status:report.status,error:report.error}));
