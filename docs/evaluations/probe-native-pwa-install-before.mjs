import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const origin='http://127.0.0.1:5193/';
const report={scope:'Native Chromium PWA install and standalone launch in a fresh owned profile; no model inference or physical offline certification.',steps:[],errors:[]};
report.probeSHA256=crypto.createHash('sha256').update(await fs.readFile(new URL(import.meta.url))).digest('hex');
const profile=await fs.mkdtemp('.scratch/native-pwa-');
let context,cdp,installed=false;
try {
 context=await chromium.launchPersistentContext(profile,{headless:false,serviceWorkers:'allow'});
 cdp=await context.browser().newBrowserCDPSession();
 report.browser=await cdp.send('Browser.getVersion');
 const page=context.pages()[0];
 await page.goto(origin);
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
 report.steps.push({phase:'seed',controller:await page.evaluate(()=>navigator.serviceWorker.controller?.scriptURL),caches:await page.evaluate(()=>caches.keys())});
 report.install=await cdp.send('PWA.install',{manifestId:origin,installUrlOrBundleUrl:origin}); installed=true;
 report.osState=await cdp.send('PWA.getOsAppState',{manifestId:origin});
 const launched=await cdp.send('PWA.launch',{manifestId:origin});
 report.launch=launched;
 await page.waitForTimeout(1500);
 for(const p of context.pages()) report.steps.push({phase:'launch',url:p.url(),state:await p.evaluate(()=>({standalone:matchMedia('(display-mode: standalone)').matches,controller:navigator.serviceWorker.controller?.scriptURL,online:navigator.onLine,title:document.title})).catch(e=>({error:String(e)}))});
 report.status='completed';
} catch(e){report.status='failed';report.errors.push(String(e));process.exitCode=1;}
finally {
 if(installed&&cdp){try{await cdp.send('PWA.uninstall',{manifestId:origin});report.uninstalled=true;}catch(e){report.errors.push('uninstall: '+String(e));process.exitCode=1;}}
 if(context){await context.close();report.contextClosed=true;}
 await fs.writeFile('docs/evaluations/2026-10-05-native-pwa-install.json',JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report,null,2));
}
