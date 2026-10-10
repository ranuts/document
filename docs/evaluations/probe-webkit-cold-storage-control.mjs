import {webkit,chromium} from '@playwright/test';
import fs from 'node:fs/promises';
const isChromium=process.env.STORAGE_CHROMIUM==='1';
const browser=isChromium?chromium:webkit;
const profile=isChromium?'.scratch/ai-csp/storage-control-chromium':'.scratch/ai-csp/storage-control-webkit';
const report={browser:isChromium?'Chromium':'Playwright WebKit',scope:'Minimal same-origin synthetic cache/localStorage/IndexedDB/SW persistence across closing and relaunching isolated browser process; no model or editor loaded',phases:[]};
const read=async page=>page.evaluate(async()=>{const names=await caches.keys();const entries=await Promise.all(names.map(async name=>{const c=await caches.open(name);return{name,keys:(await c.keys()).map(r=>r.url),marker:await(await c.match('/__storage_control_marker'))?.text()};}));const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('cold-storage-control',1);r.onupgradeneeded=()=>r.result.createObjectStore('kv');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});const idb=await new Promise((resolve,reject)=>{const t=db.transaction('kv','readonly'),r=t.objectStore('kv').get('marker');r.onsuccess=()=>resolve(r.result??null);r.onerror=()=>reject(r.error);});db.close();return{local:localStorage.getItem('cold-storage-control'),entries,idb,registrations:(await navigator.serviceWorker.getRegistrations()).map(r=>({scope:r.scope,active:r.active?.scriptURL})),controller:navigator.serviceWorker.controller?.scriptURL};});
for(let phase=0;phase<2;phase++){
 const c=await browser.launchPersistentContext(profile);const p=await c.newPage();
 try{await p.goto('http://127.0.0.1:5193/manifest.webmanifest');
 if(phase===0){await p.evaluate(async()=>{localStorage.setItem('cold-storage-control','persist-me');const cache=await caches.open('cold-storage-control');await cache.put('/__storage_control_marker',new Response('persist-me'));const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('cold-storage-control',1);r.onupgradeneeded=()=>r.result.createObjectStore('kv');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});await new Promise((resolve,reject)=>{const t=db.transaction('kv','readwrite');t.objectStore('kv').put('persist-me','marker');t.oncomplete=resolve;t.onerror=()=>reject(t.error);});db.close();await navigator.serviceWorker.register('/sw.js');await navigator.serviceWorker.ready;});await p.waitForFunction(()=>!!navigator.serviceWorker.controller,{},{timeout:120000});}
 report.phases.push({phase,...await read(p)});
 }catch(e){report.phases.push({phase,error:String(e)});}finally{await c.close();}
}
report.persisted=report.phases[1]?.local==='persist-me'&&report.phases[1]?.idb==='persist-me'&&report.phases[1]?.entries?.some(e=>e.marker==='persist-me');
await fs.writeFile('docs/evaluations/2026-10-03-cold-storage-control-'+(isChromium?'chromium':'webkit')+'.json',JSON.stringify(report,null,2)+'\n');console.log(report.browser, 'persisted',report.persisted);
