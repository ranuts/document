import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const bundle=process.argv[2];const output=process.argv[3];
const {CacheManager,ModelManager}=await import(bundle);
const results=[];
for(const phase of ['metadata','cache-head','model-head']){
 const controller=new AbortController();const calls=[];let deletes=0;let rejectFetch;
 const backend={isSupported:()=>true,read:async()=>null,write:async()=>{},getSize:async()=>phase==='cache-head'?16:-1,list:async()=>[],delete:async()=>{deletes++;}};
 const cache=new CacheManager([backend]);
 const saved=globalThis.fetch;
 globalThis.fetch=(url,init)=>{calls.push({url,hasSignal:init?.signal===controller.signal,headers:init?.headers});return new Promise((resolve,reject)=>{rejectFetch=reject;init?.signal?.addEventListener('abort',()=>reject(init.signal.reason),{once:true});});};
 const url=phase==='metadata'?'https://huggingface.co/example/model/resolve/pinned/model.gguf':'https://models.example/model.gguf';
 const options={signal:controller.signal,headers:{'X-Test':'marker'}};
 const pending=phase==='model-head'?new ModelManager({cacheManager:cache,logger:{...console,debug(){}}}).downloadModel({url},options):cache.download(url,options);
 const outcome=pending.then(()=>({state:'resolved'}),e=>({state:'rejected',name:e.name}));
 for(let i=0;i<100&&!calls.length;i++)await new Promise(r=>setTimeout(r,1));
 controller.abort();
 const result=await Promise.race([outcome,new Promise(r=>setTimeout(()=>r({state:'pending'}),50))]);
 rejectFetch?.(controller.signal.reason);await new Promise(r=>setTimeout(r,0));globalThis.fetch=saved;
 results.push({phase,calls,deletes,result});
}
await fs.writeFile(output,JSON.stringify({scope:'Source-built SDK download cancellation using mocked network/storage, no model download',bundleSHA256:crypto.createHash('sha256').update(await fs.readFile(bundle)).digest('hex'),results},null,2)+'\n');
if(results.some(x=>x.result.state!=='rejected'||x.result.name!=='AbortError'||x.calls.length!==1||!x.calls[0].hasSignal||x.deletes))process.exitCode=1;
