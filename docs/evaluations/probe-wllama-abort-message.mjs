import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const report={scope:'Synthetic non-string abort payload sent to installed SDK handler; not the captured payload of a real WASM failure.',probeSHA256:sha(await fs.readFile(new URL(import.meta.url))),rows:[]};
for(const entry of ['index.js','index.cjs']) {
 const source=await fs.readFile('packages/agent-core/node_modules/@wllama/wllama/esm/'+entry,'utf8');
 const code=source.match(/var ProxyToWorker = (class \{[\s\S]*?\n\});/)?.[1]; if(!code)throw Error('SDK proxy class not found');
 const asyncHelper=(self,args,generator)=>new Promise((resolve,reject)=>{const iterator=generator.call(self);const step=value=>{try{const next=iterator.next(value);if(next.done)resolve(next.value);else Promise.resolve(next.value).then(step,reject);}catch(error){reject(error);}};step();});
 const Proxy=new Function('__publicField','__async','canUseAsyncFileRead','JSPI_STUB','LLAMA_CPP_WORKER_CODE','createWorker','isSafariMobile','WllamaRuntimeError','Debug',`return (${code});`)((obj,key,value)=>{obj[key]=value;},asyncHelper,()=>false,'','',()=>({}),()=>false,Error,{decodeStackTrace:async stack=>stack});
 const proxy=new Proxy({wasmPath:'/local.wasm'},0,false,{error(){}});
 let failure;const handler=error=>{failure={name:error.name,message:error.message,stack:error.stack};};process.once('unhandledRejection',handler);
 proxy.onRecvMsg({data:{verb:'signal.abort',args:['abort',{message:'Synthetic WASM network failure'},'',null]}});
 await new Promise(resolve=>setTimeout(resolve,50));process.removeListener('unhandledRejection',handler);
 report.rows.push({entry,sdkSHA256:sha(source),failure});
}
report.status=report.rows.every(r=>r.failure?.message.includes('replace is not a function'))?'reproduced':'not-reproduced';
await fs.writeFile('docs/evaluations/2026-10-04-wllama-abort-message.json',JSON.stringify(report,null,2)+'\n');
console.log(report.status);if(report.status!=='reproduced')process.exitCode=1;
