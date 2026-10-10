import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
const report={scope:'Owned warmed Chromium profile; ordinary registration update, no forced activation or cache deletion',errors:[],snapshots:[]};let context;
try{
context=await chromium.launchPersistentContext('.scratch/default-cpu-process-profile-20261005',{channel:'chromium',serviceWorkers:'allow'});
for(const page of context.pages())await page.close();
const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
await page.goto('http://127.0.0.1:5193/');
const snapshot=async(label)=>{const state=await page.evaluate(async()=>{
 const regs=await navigator.serviceWorker.getRegistrations();
 const versions=await Promise.all(regs.map(async r=>{
 const describe=w=>w?{scriptURL:w.scriptURL,state:w.state}:null;
 const version=await new Promise(resolve=>{if(!r.active)return resolve(null);const ch=new MessageChannel();const t=setTimeout(()=>resolve({timeout:true}),3000);ch.port1.onmessage=e=>{clearTimeout(t);resolve(e.data);};r.active.postMessage({type:'VERSION'},[ch.port2]);});
 return {scope:r.scope,active:describe(r.active),waiting:describe(r.waiting),installing:describe(r.installing),version};}));
 const cachesSnapshot=await Promise.all((await caches.keys()).filter(n=>n.startsWith('document-editor-')).map(async name=>{const c=await caches.open(name);const html=await c.match('/editor.html');return {name,entries:(await c.keys()).length,editorScripts:html?Array.from((await html.text()).matchAll(/\/assets\/editor-[^" ]+/g),m=>m[0]):[]};}));
 return {controller:navigator.serviceWorker.controller?.scriptURL,versions,caches:cachesSnapshot,scripts:Array.from(document.scripts,s=>s.src)};});report.snapshots.push({label,...state});};
await snapshot('online-home-before-explicit-update');
await page.evaluate(async()=>{for(const r of await navigator.serviceWorker.getRegistrations())await r.update();});
await page.waitForTimeout(15000);await snapshot('online-home-after-update-15s');
}catch(e){report.error=String(e);}finally{if(context)await context.close();report.closed=true;await fs.writeFile('.scratch/2026-10-07-cached-worker-update-probe.json',JSON.stringify(report,null,2));}
if(report.error)process.exitCode=1;
