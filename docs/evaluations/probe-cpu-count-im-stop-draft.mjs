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
 await page.locator('.agent-panel-clear').click();await page.evaluate(()=>{window.__actions=[];});
 await page.locator('.cui-input').fill(text);await page.locator('.cui-input').press('Enter');
 await page.waitForFunction(()=>!document.querySelector('.cui-input')?.disabled,{},{timeout:120000});
 return {actions:await page.evaluate(()=>window.__actions),replies:await page.locator('.cui-msg-agent').allTextContents(),errors:await page.locator('.cui-msg-error').allTextContents(),previews:await page.locator('.agent-plan-preview').count()};
};
try{
 const cdp=await context.newCDPSession(page);await cdp.send('Network.enable');await cdp.send('Network.setBypassServiceWorker',{bypass:true});
 await page.goto('http://127.0.0.1:5193/editor?new=docx&agent=1&locale=en');
 await page.frameLocator('#app iframe').locator('.agent-sidebar-entry').click({timeout:60000});
 await page.waitForFunction(()=>document.querySelector('.agent-panel-note')?.textContent?.includes('Model loaded'),{},{timeout:180000});
 report.engine=await page.locator('.agent-model-status').textContent();
 await settings('Answer briefly.');
 await page.locator('[name="maxTokens"]').count();
 await page.locator('.agent-panel-clear').click();await page.evaluate(()=>{window.__actions=[];});
 await page.locator('.cui-input').fill('Write a long numbered list of twenty interesting facts about trees.');
 await page.locator('.cui-input').press('Enter');
 await page.waitForFunction(()=>[...document.querySelectorAll('.cui-msg-agent')].some(e=>e.textContent.trim().length>0),{},{timeout:120000});
 report.beforeStop=await page.locator('.cui-msg-agent').allTextContents();
 const start=Date.now();await page.locator('.cui-send-stop').click();
 await page.waitForFunction(()=>!document.querySelector('.cui-input')?.disabled,{},{timeout:15000});
 report.stopLatencyMs=Date.now()-start;
 report.stopped={actions:await page.evaluate(()=>window.__actions),replies:await page.locator('.cui-msg-agent').allTextContents(),errors:await page.locator('.cui-msg-error').allTextContents()};
 const draft='Say hello in one short sentence.';
 await page.locator('.cui-input').fill(draft);await page.locator('.cui-input').press('Enter');
 report.draftWhilePreparing=await page.locator('.cui-input').inputValue();
 if(report.draftWhilePreparing!==draft)throw Error('Draft lost while preparing');
 await page.waitForTimeout(1000);report.afterWait=await page.locator('.cui-msg-agent').allTextContents();
 report.uiAfterStop=await page.locator('body').innerText();
 await page.waitForFunction(()=>document.querySelector('.agent-panel-note')?.textContent?.includes('Model loaded'),{},{timeout:180000});
 report.draftAfterReady=await page.locator('.cui-input').inputValue();
 if(report.draftAfterReady!==draft)throw Error('Draft lost after reload');
 await page.evaluate(()=>{window.__actions=[];});await page.locator('.cui-input').press('Enter');
 await page.waitForFunction(()=>!document.querySelector('.cui-input')?.disabled,{},{timeout:120000});
 report.recovery={actions:await page.evaluate(()=>window.__actions),replies:await page.locator('.cui-msg-agent').allTextContents(),errors:await page.locator('.cui-msg-error').allTextContents()};
 if(!report.recovery.actions.includes('completion')||report.recovery.errors.length)throw Error('IM Stop recovery failed');
 report.resources=await page.evaluate(()=>performance.getEntriesByType('resource').map(e=>e.name));report.status='completed';
}catch(e){report.status='failed';report.error=String(e);report.ui=await page.locator('body').innerText().catch(()=>null);process.exitCode=1;}
finally{await context.close();report.bundleUnchanged=sha(await fs.readFile('dist/assets/'+plugin))===report.pluginSHA256;await fs.writeFile('docs/evaluations/2026-10-04-cpu-count-im-stop-draft.json',JSON.stringify(report,null,2)+'\n');}
console.log(report.status,report.error??'');
