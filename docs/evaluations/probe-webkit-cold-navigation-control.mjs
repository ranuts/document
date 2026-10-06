import {webkit} from '@playwright/test';
import fs from 'node:fs/promises';
const report={scope:'Fresh WebKit process navigation with persisted app cache, actual failed uncached control; no model inference.',phases:[]};
for(const proxy of [false,true]){
 const c=await webkit.launchPersistentContext(process.env.NAV_CONTROL_PROFILE??'.scratch/ai-csp/webkit-offline-profile',{offline:true,...(proxy?{proxy:{server:'http://127.0.0.1:9'}}:{})});await c.setOffline(true);const p=await c.newPage();
 for(const route of ['/editor?new=docx&agent=1&locale=en','/index.html','/editor?new=docx&agent=1&locale=en']){
  const row={proxy,route};try{await p.goto('http://127.0.0.1:5193'+route,{waitUntil:'domcontentloaded',timeout:20000});row.state=await p.evaluate(async()=>({controller:navigator.serviceWorker.controller?.scriptURL,registrations:(await navigator.serviceWorker.getRegistrations()).map(r=>r.scope),cacheNames:await caches.keys(),online:navigator.onLine}));row.title=await p.title();row.status='loaded';}catch(e){row.error=String(e);row.status='failed';}report.phases.push(row);console.log(proxy,route,row.status);
 }
 await c.close();
}
await fs.writeFile(process.env.NAV_CONTROL_REPORT??'docs/evaluations/2026-10-03-webkit-cold-navigation-control.json',JSON.stringify(report,null,2)+'\n');
