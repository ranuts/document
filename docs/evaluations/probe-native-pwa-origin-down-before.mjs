import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { preview } from 'vite';
const server=await preview({preview:{port:0,host:'127.0.0.1',strictPort:true}});
const origin=`http://127.0.0.1:${server.httpServer.address().port}/`;
const report={scope:'Native Chromium PWA install and standalone launch in a fresh owned profile; explicit native standalone preference, then owned serving origin shut down before browser process restart. App shell and cached Word editor only, no model inference or physical network isolation certificate.',steps:[],errors:[]};
report.origin=origin;
report.probeSHA256=crypto.createHash('sha256').update(await fs.readFile(new URL(import.meta.url))).digest('hex');
const profile=await fs.mkdtemp('.scratch/native-pwa-origin-down-');
let context,cdp,installed=false;
try {
 context=await chromium.launchPersistentContext(profile,{headless:false,serviceWorkers:'allow'});
 cdp=await context.browser().newBrowserCDPSession();
 report.browser=await cdp.send('Browser.getVersion');
 const page=context.pages()[0];
 await page.goto(origin);
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
 report.steps.push({phase:'seed',controller:await page.evaluate(()=>navigator.serviceWorker.controller?.scriptURL),caches:await page.evaluate(()=>caches.keys())});
 await page.goto(origin+'editor?new=docx&locale=en');
 await page.frameLocator('#app iframe').locator('body').evaluate(()=>{});
 await page.waitForFunction(()=>!!document.querySelector('#app iframe')?.contentWindow?.Asc?.editor?.WordControl?.m_oLogicDocument,null,{timeout:90000});
 report.seedWordText=await page.frameLocator('#app iframe').locator('body').evaluate(()=>window.Asc.editor.WordControl.m_oLogicDocument.GetText());
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
 if(!report.offlineResponses.some(r=>r.url===origin&&r.status===200&&r.fromServiceWorker))throw Error('Offline navigation was not served by the service worker');
 report.offlineEditorLaunch=await cdp.send('PWA.launch',{manifestId:origin,url:origin+'editor?new=docx&locale=en'});
 const editor=await context.waitForEvent('page',{timeout:10000}).catch(()=>context.pages().find(p=>p.url().includes('/editor')));
 if(!editor)throw Error('No installed editor window');
 await editor.waitForFunction(()=>!!document.querySelector('#app iframe')?.contentWindow?.Asc?.editor?.WordControl?.m_oLogicDocument,null,{timeout:90000});
 report.offlineEditor={url:editor.url(),state:await editor.evaluate(()=>({standalone:matchMedia('(display-mode: standalone)').matches,controller:navigator.serviceWorker?.controller?.scriptURL,isolated:crossOriginIsolated})),text:await editor.frameLocator('#app iframe').locator('body').evaluate(()=>window.Asc.editor.WordControl.m_oLogicDocument.GetText())};
 if(!report.offlineEditor.state.standalone||report.offlineEditor.text!==report.seedWordText)throw Error('Installed offline editor failed');
 report.status='completed';
} catch(e){report.status='failed';report.errors.push(String(e));process.exitCode=1;}
finally {
 if(installed&&cdp){try{await cdp.send('PWA.uninstall',{manifestId:origin});report.uninstalled=true;}catch(e){report.errors.push('uninstall: '+String(e));process.exitCode=1;}}
 if(context){await context.close();report.contextClosed=true;}
 if(server.httpServer.listening)await new Promise(resolve=>server.httpServer.close(resolve));
 await fs.writeFile('docs/evaluations/2026-10-05-native-pwa-origin-down.json',JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report,null,2));
}
