import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { preview } from 'vite';
import {createReadStream} from 'node:fs';
const artifact='.scratch/node_modules/ai-models/qwen2.5-0.5b-instruct-q4_k_m.gguf';
const size=(await fs.stat(artifact)).size;
const served=[];
const server=await preview({preview:{port:0,host:'127.0.0.1',strictPort:true},plugins:[{name:'owned-probe-model',configurePreviewServer(server){server.middlewares.use((req,res,next)=>{
 if(req.url!='/offline-model.gguf')return next();
 served.push({method:req.method,url:req.url});res.setHeader('Content-Type','application/octet-stream');res.setHeader('Content-Length',size);
 if(req.method==='HEAD')return res.end();
 const stream=createReadStream(artifact);stream.pipe(res);res.on('close',()=>stream.destroy());
});}}]});
const origin=`http://127.0.0.1:${server.httpServer.address().port}/`;
const report={scope:'Native Chromium PWA install and standalone launch in a fresh owned profile; explicit native standalone preference, then owned serving origin shut down before browser process restart. Cached self-hosted CPU model inference and IM Word edit after origin shutdown, not physical full-network or model-quality certification.',steps:[],errors:[]};
report.origin=origin;report.served=served;report.artifactBytes=size;report.artifactSHA256=crypto.createHash('sha256').update(await fs.readFile(artifact)).digest('hex');
report.probeSHA256=crypto.createHash('sha256').update(await fs.readFile(new URL(import.meta.url))).digest('hex');
const profile=await fs.mkdtemp('.scratch/native-pwa-offline-im-');
let context,cdp,installed=false;
try {
 context=await chromium.launchPersistentContext(profile,{headless:false,serviceWorkers:'allow'});
 await context.addInitScript(()=>localStorage.setItem('agent-panel-provider','wllama'));
 cdp=await context.browser().newBrowserCDPSession();
 report.browser=await cdp.send('Browser.getVersion');
 const page=context.pages()[0];
 await page.goto(origin);
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
 report.steps.push({phase:'seed',controller:await page.evaluate(()=>navigator.serviceWorker.controller?.scriptURL),caches:await page.evaluate(()=>caches.keys())});
 await page.goto(origin+'editor?new=docx&agent=1&locale=en');
 await page.frameLocator('#app iframe').locator('body').evaluate(()=>{});
 await page.waitForFunction(()=>!!document.querySelector('#app iframe')?.contentWindow?.Asc?.editor?.WordControl?.m_oLogicDocument,null,{timeout:90000});
 report.seedWordText=await page.frameLocator('#app iframe').locator('body').evaluate(()=>window.Asc.editor.WordControl.m_oLogicDocument.GetText());
 console.log('seed CPU load');await loadCPU(page);console.log('seed ready');report.seedEngine=await page.locator('.agent-model-status').textContent();
 report.install=await cdp.send('PWA.install',{manifestId:origin,installUrlOrBundleUrl:origin}); installed=true;
 report.osState=await cdp.send('PWA.getOsAppState',{manifestId:origin});
 report.displaySetting=await cdp.send('PWA.changeAppUserSettings',{manifestId:origin,displayMode:'standalone'});
 const launched=await cdp.send('PWA.launch',{manifestId:origin});
 report.launch=launched;
 await page.waitForTimeout(1500);
 for(const p of context.pages()) report.steps.push({phase:'launch',url:p.url(),state:await p.evaluate(()=>({standalone:matchMedia('(display-mode: standalone)').matches,controller:navigator.serviceWorker?.controller?.scriptURL,online:navigator.onLine,title:document.title})).catch(e=>({error:String(e)}))});
 await context.close();report.seedContextClosed=true;
 await new Promise((resolve,reject)=>server.httpServer.close(e=>e?reject(e):resolve()));report.serverClosed=true;
 try{await fetch(origin);throw Error('Serving origin remains reachable');}catch(e){if(e.message==='Serving origin remains reachable')throw e;report.originFailure=String(e);}
 context=await chromium.launchPersistentContext(profile,{headless:false,serviceWorkers:'allow'});
 cdp=await context.browser().newBrowserCDPSession();
 report.offlineResponses=[];
 context.on('response',r=>report.offlineResponses.push({url:r.url(),status:r.status(),fromServiceWorker:r.fromServiceWorker()}));
 // Leave browser network status online: actual origin availability is controlled by server closure.
 report.offlineLaunch=await cdp.send('PWA.launch',{manifestId:origin});
 await context.pages()[0].waitForTimeout(2000);
 report.offlinePages=[];
 for(const p of context.pages()) report.offlinePages.push({url:p.url(),state:await p.evaluate(()=>({standalone:matchMedia('(display-mode: standalone)').matches,controller:navigator.serviceWorker?.controller?.scriptURL,online:navigator.onLine,title:document.title})).catch(e=>({error:String(e)}))});
 if(!report.steps.some(s=>s.phase==='launch'&&s.state?.standalone))throw Error('No native standalone window');
 if(!report.offlinePages.some(s=>s.url===origin&&s.state?.standalone&&s.state.online===true&&s.state.controller))throw Error('No offline standalone window after browser restart');
 const installedPage=context.pages().find(p=>p.url()===origin);
 const reload=await installedPage.reload();report.offlineReload={url:reload.url(),status:reload.status(),fromServiceWorker:reload.fromServiceWorker()};
 if(!report.offlineResponses.some(r=>r.url===origin&&r.status===200&&r.fromServiceWorker))throw Error('Offline navigation was not served by the service worker');
 report.offlineEditorLaunch=await cdp.send('PWA.launch',{manifestId:origin,url:origin+'editor?new=docx&agent=1&locale=en'});
 await installedPage.waitForTimeout(500);
 const editor=context.pages().find(p=>p.url().includes('/editor'));
 if(!editor)throw Error('No installed editor window');
 await editor.waitForFunction(()=>!!document.querySelector('#app iframe')?.contentWindow?.Asc?.editor?.WordControl?.m_oLogicDocument,null,{timeout:90000});
 report.offlineEditor={url:editor.url(),state:await editor.evaluate(()=>({standalone:matchMedia('(display-mode: standalone)').matches,controller:navigator.serviceWorker?.controller?.scriptURL,isolated:crossOriginIsolated})),text:await editor.frameLocator('#app iframe').locator('body').evaluate(()=>window.Asc.editor.WordControl.m_oLogicDocument.GetText())};
 if(!report.offlineEditor.state.standalone||report.offlineEditor.text!==report.seedWordText)throw Error('Installed offline editor failed');
 console.log('offline CPU load');await loadCPU(editor);console.log('offline ready');report.offlineEngine=await editor.locator('.agent-model-status').textContent();
 await editor.locator('.cui-input').fill('Reply briefly with a greeting in English.');await editor.locator('.cui-input').press('Enter');
 await editor.waitForFunction(()=>!document.querySelector('.cui-input')?.disabled,null,{timeout:120000});
 report.reply=await editor.locator('.cui-msg-agent').last().textContent();report.chatErrors=await editor.locator('.cui-msg-error').allTextContents();
 const body=editor.frameLocator('#app iframe').locator('body');
 await editor.locator('.agent-writing-task').selectOption('tools');
 await editor.locator('.cui-input').fill('Insert the exact text PWA_ORIGIN_DOWN_2026 at the cursor.');await editor.locator('.cui-input').press('Enter');
 await editor.waitForFunction(()=>!document.querySelector('.cui-input')?.disabled,null,{timeout:120000});
 report.editErrors=await editor.locator('.cui-msg-error').allTextContents();report.previews=await editor.locator('.agent-plan-preview').count();
 report.editText=await body.evaluate(()=>window.Asc.editor.WordControl.m_oLogicDocument.GetText());
 await body.evaluate(()=>window.Asc.editor.Undo());
 report.undoText=await body.evaluate(()=>window.Asc.editor.WordControl.m_oLogicDocument.GetText());
 await body.evaluate(()=>window.Asc.editor.Redo());
 report.redoText=await body.evaluate(()=>window.Asc.editor.WordControl.m_oLogicDocument.GetText());
 if(!report.editText.includes('PWA_ORIGIN_DOWN_2026')||report.undoText!==report.offlineEditor.text||report.redoText!==report.editText)throw Error('Offline native edit history mismatch');
 if(!report.reply||report.chatErrors.length||report.editErrors.length||report.previews)throw Error('IM inference/edit incomplete');
 report.status='completed';
} catch(e){report.status='failed';report.errors.push(String(e));process.exitCode=1;}
finally {
 if(installed&&cdp){try{await cdp.send('PWA.uninstall',{manifestId:origin});report.uninstalled=true;}catch(e){report.errors.push('uninstall: '+String(e));process.exitCode=1;}}
 if(context){await context.close();report.contextClosed=true;}
 if(server.httpServer.listening)await new Promise(resolve=>server.httpServer.close(resolve));
 await fs.writeFile('docs/evaluations/2026-10-05-native-pwa-offline-im.json',JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report,null,2));
}

async function loadCPU(page){
 await page.frameLocator('#app iframe').locator('.agent-sidebar-entry').click({timeout:90000});
 await page.locator('.agent-panel-settings-toggle').click();
 await page.locator('.agent-panel-gguf-url').evaluate((el,url)=>{el.value=url;},origin+'offline-model.gguf');
 await page.locator('.agent-panel-gguf-url').dispatchEvent('change');
 await page.locator('.agent-panel-gguf-load').click();
 await page.locator('.agent-panel-settings-toggle').click();
 await page.waitForFunction(()=>document.querySelector('.agent-panel-note')?.textContent?.includes('Model loaded'),null,{timeout:180000});
}
