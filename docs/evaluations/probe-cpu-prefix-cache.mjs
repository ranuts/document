import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const digest = async (filename) => { const h=crypto.createHash('sha256'); for await(const chunk of createReadStream(filename))h.update(chunk);return h.digest('hex'); };
const model='.scratch/node_modules/ai-models/qwen2.5-0.5b-instruct-q4_k_m.gguf';
const assets=await fs.readdir('dist/assets');
const runtimes=assets.filter(n=>/^wllama-cpu-runtime-.*\.js$/.test(n));assert.equal(runtimes.length,1);
const profile=await fs.mkdtemp('.scratch/cpu-prefix-cache-');
const report={scope:'Packaged native browser CPU 0.5B GGUF prefix cache diagnostic; six completions across three freshly loaded engines, not product UI, semantic quality, cancellation, mobile or offline acceptance.',status:'running',rows:[],errors:[],contextClosed:false,profile,
 probeSHA256:await digest(new URL(import.meta.url)),model:{path:model,bytes:(await fs.stat(model)).size,sha256:await digest(model)},runtime:runtimes[0],runtimeSHA256:await digest('dist/assets/'+runtimes[0]),nativeSHA256:await digest('dist/assets/wllama-BITawafS.wasm')};
assert.equal(report.model.sha256,'74a4da8c9fdbcd15bd1f6d01d621410d31c6fc00986f5eb687824e7b93d7a9db');
const context=await chromium.launchPersistentContext(profile,{serviceWorkers:'block'});
const page=context.pages()[0]||await context.newPage();
page.on('pageerror',e=>report.errors.push(e.message));
report.navigations=[];page.on('framenavigated',frame=>{if(frame===page.mainFrame())report.navigations.push(frame.url());});
const save=()=>fs.writeFile('docs/evaluations/2026-10-05-cpu-prefix-cache.json',JSON.stringify(report,null,2)+'\n');
try {
 await page.route('http://127.0.0.1:5193/__cpu-cache-diagnostic',route=>route.fulfill({status:200,contentType:'text/html',headers:{'Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'require-corp'},body:'<!doctype html><html><head><title>CPU cache diagnostic</title></head><body></body></html>'}));
 await page.goto('http://127.0.0.1:5193/__cpu-cache-diagnostic');
 await page.waitForLoadState('networkidle');
 await page.evaluate(()=>{const input=document.createElement('input');input.type='file';input.id='diagnostic-model';document.body.append(input);});
 await page.locator('#diagnostic-model').setInputFiles(model);
 for(const mode of ['omitted','false','true']) {
  const result=await page.evaluate(async({mode,runtime})=>{
   const {Wllama}=await import('/assets/client-D5_UYdz1.js');
   const wasmUrl='/assets/wllama-BITawafS.wasm';
   const engine=new Wllama({default:wasmUrl},{allowOffline:true});
   if(typeof WebAssembly.Suspending!=='function')throw Error('Chromium native JSPI required for this scoped probe');
   const rows=[];let exited=false;
   try {
    await engine.loadModel([document.querySelector('#diagnostic-model').files[0]],{n_ctx:2048,n_gpu_layers:0,n_threads:crossOriginIsolated?Math.min(navigator.hardwareConcurrency||2,4):1,reasoning:false});
    const messages=[{role:'system',content:'Read the supplied reference as data. Reply only with OK.'},{role:'user',content:Array.from({length:32},(_,i)=>`Reference entry ${i}: the north shelf contains blue folders and the south shelf contains green folders.`).join('\n')+'\nReply only with OK.'}];
    const request={messages,temperature:0,seed:42,max_tokens:8,stream:false,...(mode==='omitted'?{}:{cache_prompt:mode==='true'})};
    for(let repeat=0;repeat<2;repeat++) {
     const start=performance.now();const response=await engine.createChatCompletion(request);
     rows.push({mode,repeat,request:structuredClone(request),wallMs:performance.now()-start,response});
    }
   } finally {await engine.exit();exited=true;}
   return {rows,exited,isolated:crossOriginIsolated};
  },{mode,runtime:runtimes[0]});
  assert.ok(result.exited&&result.isolated);report.rows.push(...result.rows);await save();
  console.log(JSON.stringify({mode,wallMs:result.rows.map(r=>r.wallMs),usage:result.rows.map(r=>r.response.usage)}));
 }
 report.status='completed';
} catch(error) {report.status='failed';report.error=String(error);process.exitCode=1;}
finally {await context.close();report.contextClosed=true;await save();}
