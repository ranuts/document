import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const output='docs/evaluations/2026-10-04-qwen25-cached-weight-shards.json';
const manifests=JSON.parse(await fs.readFile('docs/evaluations/2026-10-04-qwen25-cached-manifests.json','utf8')).observed.assets.filter(a=>a.tensorCache);
const report={scope:'Read-only local cached weight bytes compared to previously pinned structurally equal manifests; no inference, downloads, writes to browser storage or documents.',probeSHA256:crypto.createHash('sha256').update(await fs.readFile(new URL(import.meta.url))).digest('hex'),assets:[],errors:[]};
const context=await chromium.launchPersistentContext('.scratch/ai-csp/gpu-profile',{serviceWorkers:'block'});
let digest;
try {
 const page=context.pages()[0] || await context.newPage();
 await page.exposeFunction('weightChunk',base64=>{digest.update(Buffer.from(base64,'base64'));});
 await page.goto('http://127.0.0.1:5193/');
 for(const asset of manifests)for(const record of asset.tensorCache.manifest.records){
  const url=new URL(record.dataPath,asset.url).href;
  digest=crypto.createHash('md5');
  const observed=await page.evaluate(async url=>{
   let data,storage;
   for(const name of await caches.keys()){
    const response=await (await caches.open(name)).match(url);
    if(response){data=await response.blob();storage='cache:'+name;break;}
   }
   if(!data)for(const info of await indexedDB.databases()){
    if(!/webllm/.test(info.name))continue;
    const db=await new Promise((resolve,reject)=>{const q=indexedDB.open(info.name);q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);q.onupgradeneeded=()=>{q.transaction.abort();reject(Error('Unexpected creation'));};});
    try{
     if(!db.objectStoreNames.contains('urls'))continue;
     const row=await new Promise((resolve,reject)=>{const q=db.transaction('urls','readonly').objectStore('urls').get(url);q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});
     if(row){data=row.data;storage='idb:'+info.name;break;}
    }finally{db.close();}
   }
   if(!data)return {missing:true};
   if(!(data instanceof Blob))data=new Blob([data]);
   for(let offset=0;offset<data.size;offset+=1024*1024){
    const bytes=new Uint8Array(await data.slice(offset,offset+1024*1024).arrayBuffer());
    let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
    await window.weightChunk(btoa(binary));
   }
   return {storage,bytes:data.size};
  },url);
  const md5=observed.missing?null:digest.digest('hex');
  const row={url,expectedBytes:record.nbytes,expectedMD5:record.md5sum,...observed,md5,match:!observed.missing && observed.bytes===record.nbytes && md5===record.md5sum};
  report.assets.push(row);
  console.log(JSON.stringify({shard:report.assets.length,match:row.match,bytes:row.bytes}));
 }
 report.status=report.assets.every(a=>a.match)?'matched':'mismatch';
}catch(error){report.status='failed';report.errors.push(String(error));process.exitCode=1;}
finally{await fs.writeFile(output,JSON.stringify(report,null,2)+'\n');await context.close();}
