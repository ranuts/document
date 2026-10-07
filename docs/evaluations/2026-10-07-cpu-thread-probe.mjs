import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
const r={scope:'Gemma native CPU load thread observation only; no inference; cannot retroactively certify prior runs',errors:[]};
const b=await chromium.launch({channel:'chromium'});r.browserVersion=b.version();const c=await b.newContext({serviceWorkers:'block'});
await c.addInitScript(()=>{if(window===top){localStorage.setItem('agent-panel-provider','wllama');localStorage.removeItem('agent-panel-gguf-url');}});
try{
const p=await c.newPage();p.on('pageerror',e=>r.errors.push(e.message));
await p.goto('http://127.0.0.1:5193/editor?new=docx&agent=1&locale=zh-CN');
await p.waitForFunction(()=>{const e=document.querySelector('#app iframe')?.contentWindow.editor;return e?.isDocumentLoadComplete&&e?.isLoadFullApi;},null,{timeout:90000});
r.environment=await p.evaluate(async()=>{
const {Wllama}=await import('/assets/client-D5_UYdz1.js');const original=Wllama.prototype.loadModel;
window.__loads=[];
Wllama.prototype.loadModel=async function(files,options){const x={requested:{n_threads:options?.n_threads,n_ctx:options?.n_ctx,n_gpu_layers:options?.n_gpu_layers,reasoning:options?.reasoning}};window.__loads.push(x);const result=await original.call(this,files,options);x.actualThreads=this.getNumThreads();x.multithread=this.isMultithread();x.loaded=true;return result;};
return {crossOriginIsolated,hardwareConcurrency:navigator.hardwareConcurrency,sharedArrayBuffer:typeof SharedArrayBuffer};});
await p.evaluate(()=>window.__toggleAgentPanel());await p.locator('.agent-panel').waitFor();await p.locator('.agent-panel-settings-toggle').click();await p.locator('.agent-panel-gguf-files').setInputFiles('.scratch/node_modules/ai-models/gemma-4-E2B-it-Q4_0.gguf');await p.locator('.agent-panel-gguf-load').click();
await p.waitForFunction(()=>document.querySelector('.agent-panel-note')?.textContent?.includes('模型已加载'),null,{timeout:180000});
r.loads=await p.evaluate(()=>window.__loads);r.note=await p.locator('.agent-panel-note').textContent();
}catch(e){r.error=String(e);}finally{await c.close();await b.close();r.closed=true;await fs.writeFile('.scratch/2026-10-07-cpu-thread-probe.json',JSON.stringify(r,null,2));console.log(JSON.stringify(r));}
if(r.error)process.exitCode=1;
