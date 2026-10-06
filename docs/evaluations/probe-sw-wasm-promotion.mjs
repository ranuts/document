// Isolate cached conversion WASM response consumption from native editor/save logic.
import { chromium } from '@playwright/test';
import http from 'node:http';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { brotliDecompressSync } from 'node:zlib';

const asset = await fs.readFile('public/sdkjs/common/wasm/x2t/x2t.wasm.br');
const decoded = brotliDecompressSync(asset);
const reconstruct = process.env.WASM_RECONSTRUCT !== '0';
const modes = process.env.WASM_MODES ? process.env.WASM_MODES.split(',') : ['drain','compile-main','compile-worker'];
if(modes.some(mode=>!['drain','compile-main','compile-worker'].includes(mode)))throw Error('Invalid diagnostic mode');
const report = {scope:'Isolated diagnostic: cached actual x2t WASM, no native editor or document save',reconstruct,modes,
  probeSha256:createHash('sha256').update(await fs.readFile(new URL(import.meta.url))).digest('hex'),
  wasm:{compressedBytes:asset.length,decodedBytes:decoded.length,sha256:createHash('sha256').update(decoded).digest('hex')},rows:[]};
let version = 'old';
let networkWasm = 0;
const consume = async mode => {
  const response = await fetch('/conversion.wasm');
  if(mode === 'drain') {
    let bytes = 0;
    const reader = response.body.getReader();
    while(true) {const part = await reader.read();if(part.done) break;bytes += part.value.byteLength;}
    reader.releaseLock();
    return {bytes};
  }
  const module = await WebAssembly.compileStreaming(new Response(response.body,{headers:{'Content-Type':'application/wasm'}}));
  return {exports:WebAssembly.Module.exports(module).length,imports:WebAssembly.Module.imports(module).length};
};
const server = http.createServer((req,res) => {
  res.setHeader('Cross-Origin-Opener-Policy','same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy','require-corp');
  res.setHeader('Cache-Control','no-cache');
  if(req.url.startsWith('/sw.js')) {
    res.setHeader('Content-Type','application/javascript');
    res.end(`const VERSION=${JSON.stringify(version)};
      self.addEventListener('install',()=>{if(VERSION==='old')self.skipWaiting();});
      self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
      self.addEventListener('message',e=>{
        if(e.data.type==='VERSION')e.ports[0].postMessage({version:VERSION});
        if(e.data.type==='SKIP_WAITING'){self.skipWaiting();e.ports[0].postMessage({received:true});}
      });
      self.addEventListener('fetch',e=>{
        if(new URL(e.request.url).pathname!=='/conversion.wasm')return;
        e.respondWith((async()=>{
          const cache=await caches.open('owned-wasm-control');
          const cached=await cache.match(e.request);
          const response=cached || await fetch(e.request);
          if(!cached)e.waitUntil(cache.put(e.request,response.clone()));
          if(!${JSON.stringify(reconstruct)})return response;
          const headers=new Headers(response.headers);
          headers.set('Cross-Origin-Opener-Policy','same-origin');
          headers.set('Cross-Origin-Embedder-Policy','require-corp');
          return new Response(response.body,{status:response.status,headers});
        })());
      });`);
  } else if(req.url === '/conversion.wasm') {
    networkWasm++;
    res.setHeader('Content-Type','application/wasm');
    res.setHeader('Content-Encoding','br');
    res.end(asset);
  } else if(req.url === '/compile-worker.js') {
    res.setHeader('Content-Type','application/javascript');
    res.end(`const consume=${consume.toString()};onmessage=async()=>{try{postMessage({result:await consume('compile')});}catch(e){postMessage({error:String(e)});}};`);
  } else {res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Owned WASM lifetime control</title>');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({channel:'chromium'});
report.browserVersion=browser.version();
try {
  for(const mode of modes) {
    const row={mode,observations:[]};report.rows.push(row);
    const context=await browser.newContext();
    const page=await context.newPage();
    const ask=target=>page.evaluate(async target=>{
      const registration=await navigator.serviceWorker.getRegistration();
      const worker=target==='waiting'?registration.waiting:navigator.serviceWorker.controller;
      if(!worker)return null;
      return new Promise(resolve=>{
        const channel=new MessageChannel();
        const timer=setTimeout(()=>{channel.port1.close();resolve(null);},1000);
        channel.port1.onmessage=e=>{clearTimeout(timer);channel.port1.close();resolve(e.data);};
        worker.postMessage({type:'VERSION'},[channel.port2]);
      });
    },target);
    const waitVersion=async(target,desired)=>{
      const deadline=Date.now()+20000;
      do {const value=await ask(target);row.observations.push({time:Date.now(),target,value});if(value?.version===desired)return value;await page.waitForTimeout(100);}while(Date.now()<deadline);
      throw Error('Version timeout: '+target+' '+desired);
    };
    try {
      version='old';networkWasm=0;
      await page.goto(origin);
      await page.evaluate(()=>navigator.serviceWorker.register('/sw.js'));
      await waitVersion('active','old');
      row.warm=await page.evaluate(consume,'drain');
      await page.waitForFunction(async()=>!!(await(await caches.open('owned-wasm-control')).match('/conversion.wasm')));
      const before=networkWasm;
      if(mode==='compile-worker') {
        row.cached=await page.evaluate(()=>new Promise((resolve,reject)=>{
          const timer=setTimeout(()=>reject(Error('Worker compile bound')),30000);
          const worker=new Worker('/compile-worker.js');window.ownedCompileWorker=worker;
          worker.onmessage=e=>{clearTimeout(timer);if(e.data.error)reject(Error(e.data.error));else resolve(e.data.result);};
          worker.onerror=e=>{clearTimeout(timer);reject(Error(e.message));};worker.postMessage({});
        }));
      } else row.cached=await page.evaluate(consume,mode==='drain'?'drain':'compile');
      row.cachedNetworkRequests=networkWasm-before;
      if(row.warm.bytes!==decoded.length || row.cachedNetworkRequests!==0)throw Error('Cache control failed');
      version='new';
      await page.evaluate(async()=> (await navigator.serviceWorker.getRegistration()).update());
      await waitVersion('waiting','new');
      await page.goto(origin);
      row.delivery=await page.evaluate(async()=>{
        const worker=(await navigator.serviceWorker.getRegistration()).waiting;
        return new Promise(resolve=>{
          const channel=new MessageChannel();const timer=setTimeout(()=>{channel.port1.close();resolve(null);},1000);
          channel.port1.onmessage=e=>{clearTimeout(timer);channel.port1.close();resolve(e.data);};
          worker.postMessage({type:'SKIP_WAITING'},[channel.port2]);
        });
      });
      row.final=await waitVersion('active','new');
      row.passed=row.delivery?.received===true;
    }catch(error){row.error=String(error);row.passed=false;}
    finally{await context.close();}
    console.log(JSON.stringify(row));
  }
  report.passed=report.rows.length===modes.length && report.rows.every(row=>row.passed);
  if(!report.passed)process.exitCode=1;
}finally{
  await browser.close();await new Promise(resolve=>server.close(resolve));
  await fs.writeFile(process.env.WASM_PROMOTION_REPORT || 'docs/evaluations/2026-10-03-sw-wasm-promotion.json',JSON.stringify(report,null,2)+'\n');
}
