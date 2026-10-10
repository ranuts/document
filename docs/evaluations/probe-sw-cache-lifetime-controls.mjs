import { chromium } from '@playwright/test';
import http from 'node:http';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { brotliCompressSync, brotliDecompressSync } from 'node:zlib';

const large = await fs.readFile('public/sdkjs/common/wasm/x2t/x2t.wasm.br');
const tiny = brotliCompressSync(Buffer.from([0,97,115,109,1,0,0,0]));
const specs = [
  {name:'large-cached',tiny:false,cache:true,quietMs:0},
  {name:'tiny-cached',tiny:true,cache:true,quietMs:0},
  {name:'large-network',tiny:false,cache:false,quietMs:0},
  {name:'large-cached-quiet',tiny:false,cache:true,quietMs:40000},
];
const report={scope:'Owned diagnostic controls; drain only, no native editor/save/compilation',
  probeSha256:createHash('sha256').update(await fs.readFile(new URL(import.meta.url))).digest('hex'),rows:[]};
let spec=specs[0],version='old',network=0;
const server=http.createServer((req,res)=>{
  res.setHeader('Cross-Origin-Opener-Policy','same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy','require-corp');
  res.setHeader('Cache-Control','no-cache');
  if(req.url.startsWith('/sw.js')){
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
          let response;
          if(${JSON.stringify(spec.cache)}){
            const cache=await caches.open('owned-lifetime-control');
            const cached=await cache.match(e.request);
            response=cached || await fetch(e.request);
            if(!cached)e.waitUntil(cache.put(e.request,response.clone()));
          }else response=await fetch(e.request);
          const headers=new Headers(response.headers);
          headers.set('Cross-Origin-Opener-Policy','same-origin');
          headers.set('Cross-Origin-Embedder-Policy','require-corp');
          return new Response(response.body,{status:response.status,headers});
        })());
      });`);
  }else if(req.url==='/conversion.wasm'){
    network++;res.setHeader('Content-Type','application/wasm');res.setHeader('Content-Encoding','br');res.end(spec.tiny?tiny:large);
  }else{res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Owned cache lifetime controls</title>');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({channel:'chromium'});
report.browserVersion=browser.version();
try{
  for(const selected of specs){
    spec=selected;version='old';network=0;
    const bytes=brotliDecompressSync(spec.tiny?tiny:large);
    const row={...spec,decodedBytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),observations:[]};
    report.rows.push(row);
    const context=await browser.newContext();const page=await context.newPage();
    const ask=target=>page.evaluate(async target=>{
      const reg=await navigator.serviceWorker.getRegistration();
      const worker=target==='waiting'?reg.waiting:navigator.serviceWorker.controller;
      if(!worker)return null;
      return new Promise(resolve=>{
        const channel=new MessageChannel();const timer=setTimeout(()=>{channel.port1.close();resolve(null);},1000);
        channel.port1.onmessage=e=>{clearTimeout(timer);channel.port1.close();resolve(e.data);};
        worker.postMessage({type:'VERSION'},[channel.port2]);
      });
    },target);
    const waitVersion=async(target,desired)=>{
      const deadline=Date.now()+20000;
      do{const value=await ask(target);row.observations.push({time:Date.now(),target,value});if(value?.version===desired)return value;await page.waitForTimeout(100);}while(Date.now()<deadline);
      throw Error('Version timeout: '+target+' '+desired);
    };
    const drain=()=>page.evaluate(async()=>{
      const response=await fetch('/conversion.wasm');const reader=response.body.getReader();let total=0;
      while(true){const part=await reader.read();if(part.done)break;total+=part.value.byteLength;}
      reader.releaseLock();return total;
    });
    try{
      await page.goto(origin);await page.evaluate(()=>navigator.serviceWorker.register('/sw.js'));
      await waitVersion('active','old');
      row.firstBytes=await drain();
      if(spec.cache)await page.waitForFunction(async()=>!!(await(await caches.open('owned-lifetime-control')).match('/conversion.wasm')));
      const before=network;row.secondBytes=await drain();row.secondNetworkRequests=network-before;
      if(row.firstBytes!==bytes.length || row.secondBytes!==bytes.length || row.secondNetworkRequests!==(spec.cache?0:1))throw Error('Consumption control failed');
      row.consumptionFinished=Date.now();
      if(spec.quietMs)await page.waitForTimeout(spec.quietMs);
      row.updateStarted=Date.now();version='new';
      await page.evaluate(async()=>(await navigator.serviceWorker.getRegistration()).update());
      await waitVersion('waiting','new');await page.goto(origin);
      row.delivery=await page.evaluate(async()=>{
        const worker=(await navigator.serviceWorker.getRegistration()).waiting;
        return new Promise(resolve=>{
          const channel=new MessageChannel();const timer=setTimeout(()=>{channel.port1.close();resolve(null);},1000);
          channel.port1.onmessage=e=>{clearTimeout(timer);channel.port1.close();resolve(e.data);};
          worker.postMessage({type:'SKIP_WAITING'},[channel.port2]);
        });
      });
      row.final=await waitVersion('active','new');row.passed=row.delivery?.received===true;
    }catch(error){row.error=String(error);row.passed=false;}
    finally{await context.close();}
    console.log(JSON.stringify({...row,observations:row.observations.length}));
  }
  report.passed=report.rows.every(row=>row.passed);
  if(!report.passed)process.exitCode=1;
}finally{
  await browser.close();await new Promise(resolve=>server.close(resolve));
  await fs.writeFile(process.env.CACHE_LIFETIME_REPORT || 'docs/evaluations/2026-10-03-sw-cache-lifetime-controls.json',JSON.stringify(report,null,2)+'\n');
}
