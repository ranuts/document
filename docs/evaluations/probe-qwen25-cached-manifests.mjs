import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const output = 'docs/evaluations/2026-10-04-qwen25-cached-manifests.json';
const report = { scope: 'Read-only owned GPU profile Cache API/IndexedDB metadata audit; no inference, deletion or model weight-shard hashing.', probeSHA256: crypto.createHash('sha256').update(await fs.readFile(new URL(import.meta.url))).digest('hex'), assets: [], errors: [] };
const context = await chromium.launchPersistentContext('.scratch/ai-csp/gpu-profile', {serviceWorkers:'block'});
try {
 const page=context.pages()[0] || await context.newPage();
 await page.goto('http://127.0.0.1:5193/');
 report.observed=await page.evaluate(async()=>{
  const wanted=u=>/Qwen2\.5-3B-Instruct-q4f(?:16|32)_1/.test(u) && /(?:mlc-chat-config\.json|tokenizer\.json|tensor-cache\.json|\.wasm)(?:\?|$)/.test(u);
  const assets=[];
  const inspect=async(storage,url,data)=>{
   let bytes;
   if(data instanceof Blob) bytes=await data.arrayBuffer();
   else if(data instanceof ArrayBuffer) bytes=data;
   else bytes=new TextEncoder().encode(typeof data==='string'?data:JSON.stringify(data)).buffer;
   const sha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
   const entry={storage,url,bytes:bytes.byteLength,sha256};
   if(!url.endsWith('.wasm')){
    const j=JSON.parse(new TextDecoder().decode(bytes));
    const normalize=x=>Array.isArray(x)?x.map(normalize):x && typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,normalize(x[k])])):x;
    const canonical=new TextEncoder().encode(JSON.stringify(normalize(j)));
    entry.semanticSHA256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',canonical)),b=>b.toString(16).padStart(2,'0')).join('');
    if(url.includes('tokenizer.json')){
     const vocab=j.model?.vocab || {};
     entry.tokenizer={type:j.model?.type,vocabCount:Object.keys(vocab).length,normalizer:j.normalizer,preTokenizer:j.pre_tokenizer,decoder:j.decoder,probes:Object.fromEntries(['2','3','23','erves','ferences','思路','觇'].map(k=>[k,vocab[k] ?? null]))};
    }else if(url.includes('tensor-cache.json')) entry.tensorCache={manifest:j,metadata:j.metadata,recordCount:j.records?.length,declaredBytes:j.records?.reduce((s,r)=>s+(r.nbytes||0),0),firstRecord:j.records?.[0]};
    else entry.config=j;
   }
   assets.push(entry);
  };
  const cacheNames=await caches.keys();
  for(const name of cacheNames){const c=await caches.open(name);for(const key of await c.keys())if(wanted(key.url)){const r=await c.match(key);await inspect('cache:'+name,key.url,await r.arrayBuffer());}}
  const databases=await indexedDB.databases();
  for(const info of databases){
   if(!/webllm/.test(info.name))continue;
   const db=await new Promise((resolve,reject)=>{const q=indexedDB.open(info.name);q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);q.onupgradeneeded=()=>{q.transaction.abort();reject(Error('Unexpected database creation'));};});
   try{if(!db.objectStoreNames.contains('urls'))continue;
    const keys=await new Promise((resolve,reject)=>{const q=db.transaction('urls','readonly').objectStore('urls').getAllKeys();q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});
    for(const key of keys)if(typeof key==='string' && wanted(key)){
     const row=await new Promise((resolve,reject)=>{const q=db.transaction('urls','readonly').objectStore('urls').get(key);q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});
     await inspect('idb:'+info.name,key,row.data);
    }
   }finally{db.close();}
  }
  return {cacheNames,databases,assets};
 });
 report.status='completed';
 console.log(JSON.stringify({status:report.status,assets:report.observed.assets.map(a=>({url:a.url,bytes:a.bytes,sha256:a.sha256}))}));
}catch(e){report.status='failed';report.errors.push(String(e));process.exitCode=1;}
finally{await fs.writeFile(output,JSON.stringify(report,null,2)+'\n');await context.close();}
