import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import crypto from 'node:crypto';
const origin='http://127.0.0.1:5193';
const model='.scratch/node_modules/ai-models/qwen2.5-3b-instruct-q4_k_m.gguf';
const hash=crypto.createHash('sha256');for await(const chunk of createReadStream(model))hash.update(chunk);
const modelSHA256=hash.digest('hex');
if(modelSHA256!=='626b4a6678b86442240e33df819e00132d3ba7dddfe1cdc4fbb18e0a9615c62d')throw Error('Reference model changed');
const baseline=JSON.parse(await fs.readFile('docs/evaluations/2026-10-04-qwen25-3b-date-tokens.json','utf8'));
const assets=(await fs.readdir('dist/assets')).filter(n=>/^(?:wllama|client-).*\.(?:js|wasm)$/.test(n));
const runtimeAsset=assets.filter(n=>/^wllama-cpu-runtime-/.test(n));if(runtimeAsset.length!==1)throw Error('Runtime ambiguous');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const report={scope:'Standalone browser CPU Worker using shipped count-capable wllama resources and exact verified official Qwen 3B GGUF; no native server or external inference. Same minimal messages/schema and requested sampling, different GGUF/runtime/template/sampler from MLC. Not native IM or quality acceptance; no production edits.',probeSHA256:sha(await fs.readFile(new URL(import.meta.url))),modelSHA256,modelBytes:(await fs.stat(model)).size,assetHashes:{},results:[],errors:[],requests:[],cases:baseline.cases};
for(const name of assets)report.assetHashes[name]=sha(await fs.readFile('dist/assets/'+name));
const context=await chromium.launch({headless:true});
const browserContext=await context.newContext({serviceWorkers:'block'});
await browserContext.addInitScript(()=>Object.defineProperty(navigator,'gpu',{value:undefined,configurable:true}));
await browserContext.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
const page=await browserContext.newPage();
page.on('pageerror',e=>report.errors.push(e.message));
page.on('request',request=>{if(request.url().startsWith('http'))report.requests.push({url:request.url(),method:request.method(),bodyBytes:request.postDataBuffer()?.length??0});});
await page.exposeFunction('recordCPUReference',async row=>{report.results.push(row);console.log(JSON.stringify({id:row.id,raw:row.completion.choices[0].message.content,exact:row.exact}));});
try{
 await page.route(origin+'/__cpu-reference',route=>route.fulfill({contentType:'text/html',headers:{'Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'require-corp'},body:'<!doctype html><html><body></body></html>'}));
 await page.goto(origin+'/__cpu-reference');
 await page.evaluate(()=>{const input=document.createElement('input');input.type='file';input.id='reference-gguf';document.body.append(input);});
 await page.locator('#reference-gguf').setInputFiles(model);
 report.runtime=await page.evaluate(async({asset,cases,baseline})=>{
  const sdk=await import('/assets/client-D5_UYdz1.js');
  const wasm=await import('/assets/wllama-DCn7BVDp.js');
  const native64=!!WebAssembly.Suspending&&WebAssembly.validate(new Uint8Array([0,97,115,109,1,0,0,0,5,3,1,4,1]));
  const compatibility=native64?null:{wasm:(await import('/assets/wllama-BIOZ48O-.js')).default,worker:{code:(await import('/assets/wllama-CaONujPU.js')).default}};
  const loaded={...sdk,wasmUrl:wasm.default,compatibility};
  const runtime=new loaded.Wllama({default:loaded.wasmUrl},{allowOffline:true});
  runtime.setCompat(loaded.compatibility,'firefox_safari');
  const resources=runtime.getWorkerResources();
  const file=document.querySelector('#reference-gguf').files[0];
  window.__referencePhase='loading';
  try{
   await runtime.loadModel([file],{n_ctx:2048,n_gpu_layers:0,n_threads:4,reasoning:false});
   window.__referencePhase='inference';
   for(const sample of cases){
    const original=baseline.results.find(r=>r.id===sample.id&&r.variant==='baseline').inputs[0].request;
    const request={messages:original.messages,temperature:0,top_p:0.8,max_tokens:512,stream:false,response_format:{type:'json_schema',json_schema:{name:'local_task',schema:JSON.parse(original.response_format.schema),strict:true}}};
    const began=performance.now();
    const completion=await runtime.createChatCompletion(request);
    const text=JSON.parse(completion.choices[0].message.content).text;
    await window.recordCPUReference({...sample,request,completion,exact:text===sample.expected,responseMs:performance.now()-began});
   }
   window.__referencePhase='completed';
   return {wasmUrl:loaded.wasmUrl,compatibility:resources.compat??null,hasInlineWorker:!!resources.jsPath?.code,crossOriginIsolated,navigatorGPU:!!navigator.gpu,threads:4,context:2048,fileBytes:file.size,fileName:file.name};
  }finally{await runtime.exit();}
 },{asset:runtimeAsset[0],cases:baseline.cases,baseline});
 report.status='completed';
}catch(error){report.status='failed';report.error=String(error);process.exitCode=1;}
finally{
 report.pageURL=page.url();
 report.phase=await page.evaluate(()=>window.__referencePhase).catch(()=>null);
 await context.close();
 await fs.writeFile('docs/evaluations/2026-10-04-qwen25-3b-browser-cpu-reference.json',JSON.stringify(report,null,2)+'\n');
}
