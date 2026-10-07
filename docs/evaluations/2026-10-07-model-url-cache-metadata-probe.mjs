import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
const report={scope:'Fresh isolated SDK download-cache metadata observation; synthetic 32-byte payload, no model load/inference or real credential',requests:[],errors:[]};
const browser=await chromium.launch({channel:'chromium'});const context=await browser.newContext({serviceWorkers:'block'});
try{
 const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
 const url='http://127.0.0.1:5193/__synthetic_url_cache__/model.gguf?token=PUBLIC_SYNTHETIC_CACHE_AUTH_20261007';report.source=url;
 await context.route('**/__synthetic_url_cache__/**',async route=>{report.requests.push(route.request().url());await route.fulfill({status:200,headers:{'content-type':'application/octet-stream','content-length':'32','etag':'synthetic'},body:Buffer.alloc(32)});});
 await page.goto('http://127.0.0.1:5193/');
 report.firstPage=await page.evaluate(async url=>{const {Wllama}=await import('/assets/client-D5_UYdz1.js');const runtime=new Wllama({default:'/not-loaded.wasm'});await runtime.modelManager.downloadModel(url);return {loaded:runtime.isModelLoaded(),entries:await runtime.cacheManager.list()};},url);
 const second=await context.newPage();await second.goto('http://127.0.0.1:5193/');
 report.secondPage=await second.evaluate(async()=>{const {Wllama}=await import('/assets/client-D5_UYdz1.js');const runtime=new Wllama({default:'/not-loaded.wasm'});return {loaded:runtime.isModelLoaded(),entries:await runtime.cacheManager.list()};});
 report.persisted=report.secondPage.entries.some(e=>e.metadata?.originalURL===url);
 report.observationPassed=report.persisted&&!report.errors.length&&!report.firstPage.loaded&&!report.secondPage.loaded&&report.requests.length===1;
}catch(e){report.error=String(e);report.observationPassed=false;}
finally{await context.close();await browser.close();report.closed=true;await fs.writeFile('.scratch/2026-10-07-model-url-cache-metadata-probe.json',JSON.stringify(report,null,2));}
if(!report.observationPassed)process.exitCode=1;
