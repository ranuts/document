import {chromium} from '@playwright/test';import fs from 'node:fs/promises';
const requests=JSON.parse(await fs.readFile('docs/evaluations/2026-10-07-webgpu-backend-date-requests.json','utf8'));
const modelId='Qwen2.5-3B-Instruct-q4f32_1-MLC';const r={scope:'Same-model Metal cold/reused/reset chat-state diagnostic only',modelId,runs:[]};
for(const variant of ['cold','reused','reset']){
 const args=[];const row={variant,args,requests,errors:[],outputs:[]};r.runs.push(row);let c;
 try{c=await chromium.launchPersistentContext('.scratch/ai-csp/gpu-profile',{channel:'chromium',args,serviceWorkers:'block'});row.version=c.browser()?.version();const p=await c.newPage();p.on('pageerror',e=>row.errors.push(e.message));await p.goto('http://127.0.0.1:5193/');
 row.adapter=await p.evaluate(async()=>{const a=await navigator.gpu.requestAdapter();if(!a)throw Error('No actual adapter');return {vendor:a.info.vendor,architecture:a.info.architecture,isFallbackAdapter:a.info.isFallbackAdapter};});
 if(row.adapter.vendor!=='apple')throw Error('Not actual Apple adapter');
 await p.evaluate(async modelId=>{const {WebWorkerMLCEngine,prebuiltAppConfig}=await import('/assets/lib-CSLy4uO1.js');window.__record=prebuiltAppConfig.model_list.find(x=>x.model_id===modelId);if(!window.__record)throw Error('Model record missing');window.__engine=new WebWorkerMLCEngine(new Worker('/assets/webllm.worker-CMk6FPDh.js',{type:'module'}),{appConfig:prebuiltAppConfig});window.__loadError=null;window.__engine.reload(modelId,{context_window_size:2048}).then(()=>window.__loaded=true).catch(e=>window.__loadError=String(e));},modelId);
 await p.waitForFunction(()=>window.__loaded||window.__loadError,null,{timeout:600000});row.modelRecord=await p.evaluate(()=>window.__record);row.loadError=await p.evaluate(()=>window.__loadError);if(row.loadError)throw Error(row.loadError);
 row.workerVendor=await p.evaluate(()=>window.__engine.getGPUVendor());
 const sequence=variant==='cold'?[requests[1]]:requests;
 for(const [index,request] of sequence.entries()){
 row.stage='request-'+index;
 if(variant==='reset'&&index===1){await p.evaluate(()=>window.__engine.resetChat(false));row.resetCompleted=true;}
await p.evaluate(request=>{window.__completion=null;window.__completionError=null;window.__engine.chat.completions.create(request).then(x=>window.__completion=x).catch(e=>window.__completionError=String(e));},request);await p.waitForFunction(()=>window.__completion||window.__completionError,null,{timeout:300000});const out=await p.evaluate(()=>({completion:window.__completion,error:window.__completionError}));out.request=request;row.outputs.push(out);if(out.error)throw Error(out.error);}
 row.finished=true;
 }catch(e){row.error=String(e);if(c){const p=c.pages().at(-1);if(p&&!p.isClosed())row.failureSnapshot=await p.evaluate(()=>({loaded:window.__loaded,loadError:window.__loadError,completion:window.__completion,completionError:window.__completionError,record:window.__record})).catch(e=>({snapshotError:String(e)}));}}finally{if(c)await c.close();row.contextClosed=true;await fs.writeFile('.scratch/2026-10-07-webgpu-cache-date-native.json',JSON.stringify(r,null,2));console.log(JSON.stringify(row));}
}
r.closed=true;await fs.writeFile('.scratch/2026-10-07-webgpu-cache-date-native.json',JSON.stringify(r,null,2));if(r.runs.some(x=>!x.finished))process.exitCode=1;
