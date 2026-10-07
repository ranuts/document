import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const artifact={modelURL:'https://huggingface.co/mlc-ai/Qwen2.5-14B-Instruct-q4f16_1-MLC/resolve/5afd9575d32a566251616015e4ddfccf8bfd0366/'};
const bytes=await fs.readFile('.scratch/qwen25-14b-local-control.wasm');
const sha256=createHash('sha256').update(bytes).digest('hex');
const url=`http://127.0.0.1:5193/diagnostic-qwen14-${sha256}.wasm`;
const report={scope:'Locally compiled 14B library actual SDK load and generation control; not multilingual quality acceptance',library:{url,sha256,bytes:bytes.length},libraryServed:0,errors:[],progress:[]};
let context,timer;
const save=()=>fs.writeFile('.scratch/2026-10-07-local-qwen14-library-native.json',JSON.stringify(report,null,2));
try{
 context=await chromium.launchPersistentContext('.scratch/qwen25-14b-gpu-profile-20261007',{channel:'chromium',serviceWorkers:'block'});
 report.browserVersion=context.browser()?.version();
 await context.route(url,async route=>{report.libraryServed++;await route.fulfill({body:bytes,contentType:'application/wasm',headers:{'access-control-allow-origin':'*','cross-origin-resource-policy':'cross-origin'}});});
 const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));await page.goto('http://127.0.0.1:5193/');
 await page.evaluate(async ({artifact,url})=>{
  const adapter=await navigator.gpu.requestAdapter();if(!adapter)throw Error('No actual GPU adapter');window.__adapter={vendor:adapter.info.vendor,architecture:adapter.info.architecture};
  const {WebWorkerMLCEngine,prebuiltAppConfig}=await import('/assets/lib-CSLy4uO1.js');const id='Qwen2.5-14B-Instruct-q4f16_1-MLC';
  const record={...prebuiltAppConfig.model_list.find(x=>x.model_id==='Qwen2.5-7B-Instruct-q4f16_1-MLC'),model_id:id,model:artifact.modelURL,model_lib:url,vram_required_MB:10000};window.__progress=[];
  window.__worker=new Worker('/assets/webllm.worker-CMk6FPDh.js',{type:'module'});window.__workerErrors=[];window.__worker.addEventListener('error',e=>window.__workerErrors.push(e.message));
  window.__engine=new WebWorkerMLCEngine(window.__worker,{appConfig:{...prebuiltAppConfig,model_list:[record]},initProgressCallback:p=>window.__progress.push(p)});
  window.__engine.reload(id,{context_window_size:2048}).then(()=>window.__loaded=true).catch(e=>window.__loadError=String(e));
 },{artifact,url});
 timer=setInterval(async()=>{try{Object.assign(report,await page.evaluate(()=>({progress:window.__progress,loadError:window.__loadError,workerErrors:window.__workerErrors})));await save();}catch{}},5000);
 await page.waitForFunction(()=>window.__loaded||window.__loadError,{},{timeout:3600000});
 Object.assign(report,await page.evaluate(()=>({loaded:!!window.__loaded,loadError:window.__loadError,adapter:window.__adapter,workerErrors:window.__workerErrors})));
 if(!report.loaded)throw Error(report.loadError||'Load failed');
 report.reply=await page.evaluate(async()=>await window.__engine.chat.completions.create({messages:[{role:'user',content:'Say hello in English in one short sentence.'}],temperature:0,max_tokens:48}));
 report.completed=true;
}catch(e){report.error=String(e);process.exitCode=1;}finally{clearInterval(timer);await context?.close();report.browserClosed=true;await save();}
