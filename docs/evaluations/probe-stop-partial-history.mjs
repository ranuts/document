import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const digest = async (filename) => { const h=crypto.createHash('sha256'); for await(const chunk of createReadStream(filename))h.update(chunk);return h.digest('hex'); };
const model='.scratch/node_modules/ai-models/qwen2.5-0.5b-instruct-q4_k_m.gguf';
const assets=await fs.readdir('dist/assets');
const runtimes=assets.filter(n=>/^wllama-cpu-runtime-.*\.js$/.test(n));assert.equal(runtimes.length,1);
const profile=await fs.mkdtemp('.scratch/stop-partial-history-');
const report={scope:'Packaged native browser CPU 0.5B GGUF prefix cache diagnostic; two captured partial-assistant post-Stop shapes on fresh CPU 0.5B engines, not product UI, semantic quality, cancellation, mobile or offline acceptance.',status:'running',rows:[],errors:[],contextClosed:false,profile,
 probeSHA256:await digest(new URL(import.meta.url)),model:{path:model,bytes:(await fs.stat(model)).size,sha256:await digest(model)},runtime:runtimes[0],runtimeSHA256:await digest('dist/assets/'+runtimes[0]),nativeSHA256:await digest('dist/assets/wllama-BITawafS.wasm'),clientSHA256:await digest('dist/assets/client-D5_UYdz1.js')};
assert.equal(report.model.sha256,'74a4da8c9fdbcd15bd1f6d01d621410d31c6fc00986f5eb687824e7b93d7a9db');
const source='docs/evaluations/2026-10-05-stop-native-requests.json';
const originalBytes=await fs.readFile(source);assert.ok(originalBytes.equals(execFileSync('git',['show','b4d2100:'+source])));
const captured=JSON.parse(originalBytes).sent.sdk;const partial=captured[0].chunks.flatMap(chunk=>chunk.choices.map(choice=>choice.delta?.content||'')).join('');assert.ok(partial);report.partial=partial;const original=captured[1].request;report.sourceSHA256=crypto.createHash('sha256').update(originalBytes).digest('hex');
const context=await chromium.launchPersistentContext(profile,{serviceWorkers:'block'});
const page=context.pages()[0]||await context.newPage();
page.on('pageerror',e=>report.errors.push(e.message));
const captures=[];page.on('response',response=>{if(new URL(response.url()).pathname==='/assets/client-D5_UYdz1.js')captures.push(response.body().then(bytes=>{report.servedClientSHA256=crypto.createHash('sha256').update(bytes).digest('hex');}));});
report.navigations=[];page.on('framenavigated',frame=>{if(frame===page.mainFrame())report.navigations.push(frame.url());});
const save=()=>fs.writeFile('docs/evaluations/2026-10-05-stop-partial-history.json',JSON.stringify(report,null,2)+'\n');
try {
 await page.route('http://127.0.0.1:5193/__cpu-cache-diagnostic',route=>route.fulfill({status:200,contentType:'text/html',headers:{'Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'require-corp'},body:'<!doctype html><html><head><title>CPU cache diagnostic</title></head><body></body></html>'}));
 await page.goto('http://127.0.0.1:5193/__cpu-cache-diagnostic');
 await page.waitForLoadState('networkidle');
 await page.evaluate(()=>{const input=document.createElement('input');input.type='file';input.id='diagnostic-model';document.body.append(input);});
 await page.locator('#diagnostic-model').setInputFiles(model);
 for(const mode of ['partial','partial-status']) {
  const result=await page.evaluate(async({mode,runtime,original,partial})=>{
   const {Wllama}=await import('/assets/client-D5_UYdz1.js');
   const wasmUrl='/assets/wllama-BITawafS.wasm';
   const engine=new Wllama({default:wasmUrl},{allowOffline:true});
   if(typeof WebAssembly.Suspending!=='function')throw Error('Chromium native JSPI required for this scoped probe');
   const rows=[];let exited=false;
   try {
    await engine.loadModel([document.querySelector('#diagnostic-model').files[0]],{n_ctx:2048,n_gpu_layers:0,n_threads:crossOriginIsolated?Math.min(navigator.hardwareConcurrency||2,4):1,reasoning:false});
    let messages=structuredClone(original.messages);
    messages.splice(messages.length-1,0,{role:'assistant',content:partial+(mode==='partial-status'?'\n[已停止。]':'')});
    const request={...original,messages,max_tokens:32,stream:false};delete request.stream_options;
    const start=performance.now();const response=await engine.createChatCompletion(request);
    rows.push({mode,request,wallMs:performance.now()-start,response});
   } finally {await engine.exit();exited=true;}
   return {rows,exited,isolated:crossOriginIsolated};
  },{mode,runtime:runtimes[0],original,partial});
  assert.ok(result.exited&&result.isolated);report.rows.push(...result.rows);await save();
  console.log(JSON.stringify({mode,wallMs:result.rows.map(r=>r.wallMs),usage:result.rows.map(r=>r.response.usage)}));
 }
 report.status='completed';
} catch(error) {report.status='failed';report.error=String(error);process.exitCode=1;}
finally {await Promise.all(captures);assert.equal(report.servedClientSHA256,report.clientSHA256);await context.close();report.contextClosed=true;await save();}
