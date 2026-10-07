import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
const r={scope:'warmed desktop Chromium, browser offline emulation',errors:[],failures:[]};let c;
try {
 c=await chromium.launchPersistentContext('.scratch/default-cpu-process-profile-20261005',{channel:'chromium',serviceWorkers:'allow',viewport:{width:1280,height:900}});
 for(const p of c.pages())await p.close();await c.setOffline(true);r.offline=true;
 const p=await c.newPage();p.on('pageerror',e=>r.errors.push(e.message));p.on('requestfailed',q=>r.failures.push({url:q.url(),error:q.failure()?.errorText}));
 const response=await p.goto('http://127.0.0.1:5193/');r.homeFromSW=response.fromServiceWorker();
 await p.goto('http://127.0.0.1:5193/editor?new=pptx&agent=1&locale=en');
 await p.waitForFunction(()=>{const a=document.querySelector('#app iframe')?.contentWindow?.Asc?.editor;return a?.isDocumentLoadComplete&&a?.isLoadFullApi;},null,{timeout:90000});
 const snapshot=()=>p.evaluate(()=>document.querySelector('#app iframe').contentWindow.Asc.editor.WordControl.m_oLogicDocument.Slides.map(s=>s.cSld.spTree.map(sh=>sh.getText?.()??'')));
 r.before=await snapshot();
 await p.frameLocator('#app iframe').locator('.agent-sidebar-entry').click();
 await p.waitForFunction(()=>/Model loaded/.test(document.querySelector('.agent-panel-note')?.textContent??''),null,{timeout:180000});
 r.engine=await p.locator('.agent-model-status').textContent();
 await p.locator('.agent-writing-task').selectOption('tools');
 await p.locator('.cui-input').fill('Add a new text box on the current slide with the exact text OFFLINE_PPT_20261007.');await p.locator('.cui-input').press('Enter');
 await p.waitForFunction(()=>!document.querySelector('.cui-input').disabled,null,{timeout:180000});
 r.after=await snapshot();r.chatErrors=await p.locator('.cui-msg-error').allTextContents();
 if(!JSON.stringify(r.after).includes('OFFLINE_PPT_20261007')||r.chatErrors.length)throw Error('Edit failed');
 await p.evaluate(()=>document.querySelector('#app iframe').contentWindow.Asc.editor.Undo());r.undo=await snapshot();
 await p.evaluate(()=>document.querySelector('#app iframe').contentWindow.Asc.editor.Redo());r.redo=await snapshot();
 if(JSON.stringify(r.before)!==JSON.stringify(r.undo)||JSON.stringify(r.after)!==JSON.stringify(r.redo))throw Error('History mismatch');
 await p.evaluate(()=>window.showSaveFilePicker=undefined);const download=p.waitForEvent('download',{timeout:90000});download.catch(()=>{});
 await p.evaluate(()=>document.querySelector('#app iframe').contentDocument.querySelector('#slot-btn-dt-save button').click());await(await download).saveAs('.scratch/2026-10-07-offline-ppt-chain.pptx');r.saved=true;
 r.passed=r.homeFromSW&&!r.errors.length;

}catch(e){r.error=String(e);r.passed=false;}finally{if(c)await c.close();r.closed=true;await fs.writeFile('.scratch/2026-10-07-offline-ppt-chain.json',JSON.stringify(r,null,2));console.log(JSON.stringify(r));}if(!r.passed)process.exitCode=1;
