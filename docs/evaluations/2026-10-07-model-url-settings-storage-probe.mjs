import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
const marker='PUBLIC_SYNTHETIC_AUTH_20261007';
const report={scope:'Fresh isolated Chromium synthetic settings persistence observation; no real credential or model inference',marker,modelRequests:[],errors:[]};
const browser=await chromium.launch({channel:'chromium'});const context=await browser.newContext({serviceWorkers:'block'});
try{
 await context.addInitScript(()=>{if(!localStorage.getItem('agent-panel-provider'))localStorage.setItem('agent-panel-provider','wllama');});
 await context.route('https://example.invalid/**',route=>route.abort());
 const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.on('request',r=>{if(r.url().includes('example.invalid'))report.modelRequests.push(r.url());});
 await page.goto('http://127.0.0.1:5193/editor?new=docx&agent=1&locale=zh-CN');
 await page.waitForFunction(()=>{const a=document.querySelector('#app iframe')?.contentWindow?.Asc?.editor;return a?.isDocumentLoadComplete&&a?.isLoadFullApi;},null,{timeout:90000});
 await page.evaluate(()=>window.__toggleAgentPanel());await page.locator('.agent-panel-settings-toggle').click();
 report.settings=[];
 for(const [selector,url,key] of [
  ['.agent-panel-gguf-url',`https://example.invalid/synthetic-model.gguf?token=${marker}`,'agent-panel-gguf-url'],
  ['.agent-local-model-url',`https://example.invalid/models/?signature=${marker}`,'agent-local-model-url'],
  ['.agent-local-model-lib',`https://example.invalid/model.wasm?access_token=${marker}`,'agent-local-model-lib'],
 ]){
  await page.locator(selector).evaluate((e,value)=>{e.value=value;e.dispatchEvent(new Event('change',{bubbles:true}));},url);
  report.settings.push({key,requested:url,stored:await page.evaluate(key=>localStorage.getItem(key),key)});
 }
 // A separate same-origin page reads persisted settings without opening the panel or loading a model.
 const second=await context.newPage();await second.goto('http://127.0.0.1:5193/');report.secondPageStored=await second.evaluate(()=>Object.fromEntries(['agent-panel-gguf-url','agent-local-model-url','agent-local-model-lib'].map(k=>[k,localStorage.getItem(k)])));
 report.persisted=report.settings.every(x=>x.stored===x.requested&&report.secondPageStored[x.key]===x.requested);
 report.observationPassed=report.persisted&&!report.errors.length&&!report.modelRequests.length;
}catch(e){report.error=String(e);report.observationPassed=false;}
finally{await context.close();await browser.close();report.closed=true;await fs.writeFile('.scratch/2026-10-07-model-url-settings-storage-probe.json',JSON.stringify(report,null,2));}
if(!report.observationPassed)process.exitCode=1;
