import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
const r={scope:'warmed desktop Chromium, browser offline emulation',errors:[],failures:[]};let c;
try {
 c=await chromium.launchPersistentContext('.scratch/default-cpu-process-profile-20261005',{channel:'chromium',serviceWorkers:'allow',viewport:{width:1280,height:900}});
 for(const p of c.pages())await p.close();await c.setOffline(true);r.offline=true;
 const p=await c.newPage();p.on('pageerror',e=>r.errors.push(e.message));p.on('requestfailed',q=>r.failures.push({url:q.url(),error:q.failure()?.errorText}));
 const response=await p.goto('http://127.0.0.1:5193/');r.homeFromSW=response.fromServiceWorker();
 const chooser=p.waitForEvent('filechooser');await p.locator('#hero-open').click();await(await chooser).setFiles('.scratch/2026-10-07-offline-ppt-chain.pptx');
 await p.waitForFunction(()=>{const a=document.querySelector('#app iframe')?.contentWindow?.Asc?.editor;return a?.isDocumentLoadComplete&&a?.isLoadFullApi;},null,{timeout:90000});
 r.text=await p.evaluate(()=>document.querySelector('#app iframe').contentWindow.Asc.editor.WordControl.m_oLogicDocument.Slides.map(s=>s.cSld.spTree.map(sh=>sh.getText?.()??'')));
 r.scripts=await p.evaluate(()=>Array.from(document.scripts,s=>s.src));r.passed=r.homeFromSW&&JSON.stringify(r.text)===JSON.stringify([['\r\n','\r\n','OFFLINE_PPT_20261007\r\n']])&&!r.errors.length;
}catch(e){r.error=String(e);r.passed=false;}finally{if(c)await c.close();r.closed=true;await fs.writeFile('.scratch/2026-10-07-offline-ppt-reopen.json',JSON.stringify(r,null,2));console.log(JSON.stringify(r));}if(!r.passed)process.exitCode=1;
