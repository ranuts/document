import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {createServer} from 'node:http';
import {createReadStream} from 'node:fs';
const artifact='/private/tmp/document-selfhost-qwen3-06b.gguf';
const size=(await fs.stat(artifact)).size;
const served=[];let modelBlocked=false;
const modelServer=createServer((req,res)=>{
 const entry={method:req.method,url:req.url,range:req.headers.range??null,requestBytes:0,responseBytes:0};served.push(entry);
 req.on('data',b=>entry.requestBytes+=b.length);
 res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Expose-Headers','Content-Length, Content-Range, Accept-Ranges');res.setHeader('Accept-Ranges','bytes');res.setHeader('Content-Type','application/octet-stream');
 if(req.url==='/block-model'){modelBlocked=true;res.end('blocked');return;}
 if(req.url==='/model.gguf'&&modelBlocked){entry.blocked=true;res.writeHead(503);res.end('model origin blocked');return;}
 if(req.url.startsWith('/provider/')){const relative=req.url.slice('/provider/'.length);if(!/^[a-z0-9/-]+(?:\.js)?$/.test(relative)){res.writeHead(404);res.end();return;}res.setHeader('Content-Type','application/javascript');const f='packages/agent-core/dist/'+relative+(relative.endsWith('.js')?'':'.js');const stream=createReadStream(f);stream.on('error',()=>{res.writeHead(404);res.end();});stream.pipe(res);return;}
 if(req.url==='/sdk.js'){res.setHeader('Content-Type','application/javascript');createReadStream('/private/tmp/document-count-sdk-combined-esm/index.js').pipe(res);return;}
 if(req.url==='/runtime.wasm'||req.url==='/runtime.js'){const f='/private/tmp/document-wllama-count-build-4020/wllama.'+(req.url.endsWith('.js')?'js':'wasm');res.setHeader('Content-Type',req.url.endsWith('.js')?'application/javascript':'application/wasm');createReadStream(f).pipe(res);return;}
 if(req.url!='/model.gguf'){res.writeHead(404);res.end();return;}
 const match=/^bytes=(\d+)-(\d*)$/.exec(req.headers.range??'');
 const start=match?Number(match[1]):0;const end=match&&match[2]?Math.min(Number(match[2]),size-1):size-1;
 res.setHeader('Content-Length',end-start+1);
 if(match)res.setHeader('Content-Range',`bytes ${start}-${end}/${size}`);
 res.writeHead(match?206:200);
 if(req.method==='HEAD'){res.end();return;}
 const stream=createReadStream(artifact,{start,end});stream.on('data',b=>entry.responseBytes+=b.length);stream.pipe(res);res.on('close',()=>stream.destroy());
});
await new Promise(resolve=>modelServer.listen(0,'127.0.0.1',resolve));
const modelUrl=`http://127.0.0.1:${modelServer.address().port}/model.gguf`;

const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const base=modelUrl.replace('/model.gguf','');
const report={status:'running',scope:'Actual compiled WllamaProvider with count-capable source SDK and native CPU Worker; injected engine factory, no editor writes or shipping packaging acceptance',files:{},served,errors:[],console:[]};
report.clientSHA256=sha(await fs.readFile('/private/tmp/document-count-sdk-combined-esm/index.js'));report.probeSHA256=sha(await fs.readFile(new URL(import.meta.url)));report.patchSHA256=sha(await fs.readFile('docs/evaluations/cpu-native-count-structured-rejection.patch'));for(const f of ['js','wasm'])report.files[f]=sha(await fs.readFile('/private/tmp/document-wllama-count-build-4020/wllama.'+f));
const browser=await chromium.launch();const context=await browser.newContext({serviceWorkers:'block'});
const sdk=await fs.readFile('dist/assets/esm-BmP3Hx_J.js','utf8');const marker='cmpl_res:{';if(sdk.split(marker).length!==2)throw Error('SDK response schema marker changed');const addon='cntc_res:{name:`cntc_res`,structName:`glue_msg_count_chat_res`,className:`GlueMsgCountChatRes`,fields:[{type:`bool`,name:`success`,isNullable:!1},{type:`str`,name:`error`,isNullable:!1},{type:`int`,name:`prompt_tokens`,isNullable:!1},{type:`int`,name:`context_tokens`,isNullable:!1}]},';report.sdkSHA256=sha(sdk);report.routeHits=[];await context.route('**/assets/esm-BmP3Hx_J.js',route=>{report.routeHits.push(route.request().url());return route.fulfill({contentType:'application/javascript',body:sdk.replace(marker,addon+marker)});});let deadline;const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>report.console.push({type:m.type(),text:m.text()}));
try{
 deadline=setTimeout(()=>{report.diagnosticDeadline=true;void browser.close();},120000);
 const cdp=await context.newCDPSession(page);await cdp.send('Network.enable');await cdp.send('Network.setBypassServiceWorker',{bypass:true});await page.goto('http://127.0.0.1:5193/');
 report.result=await page.evaluate(async({base,modelUrl})=>{
  const original=WebAssembly.validate.bind(WebAssembly);
  WebAssembly.validate=b=>b.byteLength===13?false:original(b);
  const {Wllama,CacheManager}=await import(base+'/sdk.js');
  const {CacheAPIStorage}=await import(base+'/provider/llm/wllama-cache-storage.js');
  const cacheName='diagnostic-combined-cache';await caches.delete(cacheName);
  const workerCode=await(await fetch(base+'/runtime.js')).text();
  window.__partial={storageEstimate:await navigator.storage.estimate()};
  await navigator.storage.getDirectory();
  const cacheManager=new CacheManager();const storage={list:()=>cacheManager.list()};
  const make=()=>{const runtime=new Wllama({default:base+'/runtime.wasm'},{allowOffline:true,cacheManager});runtime.setCompat({wasm:base+'/runtime.wasm',worker:{code:workerCode}},'firefox_safari');return runtime;};
  const load={n_ctx:256,n_gpu_layers:0,n_threads:1,reasoning:false,useCache:true};
  const request={messages:[{role:'user',content:'Reply with hello.'}],temperature:0,max_tokens:16,stream:false};
  let first=make(),second;
  try{
   window.__phase='cache-download';await first.loadModelFromUrl(modelUrl,load);
   const initialCount=await first.countChatTokens(request);const initialReply=await first.createChatCompletion(request);
   const entries=await storage.list();window.__partial={initialCount,initialReply,entries};
   if(!entries.some(x=>x.size===484220320))throw Error('Model not cached');
   await first.exit();await fetch(base+'/block-model');
   window.__phase='cached-reload';second=make();await second.loadModelFromUrl(modelUrl,load);
   const cachedCount=await second.countChatTokens(request);const cachedReply=await second.createChatCompletion(request);
   if(JSON.stringify(cachedCount)!==JSON.stringify(initialCount)||cachedReply.usage.prompt_tokens!==cachedCount.promptTokens)throw Error('Cached native usage mismatch');
   if(cachedReply.choices[0].message.content!==initialReply.choices[0].message.content)throw Error('Cached deterministic reply changed');
   window.__phase='verified';return {initialCount,initialReply,cachedCount,cachedReply,entries,scope:'Model origin blocked only; SDK/WASM remain reachable; no full PWA offline claim'};
  }finally{await second?.exit();await first.exit();await caches.delete(cacheName);}

 },{base,modelUrl});
 report.status='completed';
}catch(e){report.status='failed';report.error=String(e);process.exitCode=1;}
finally{clearTimeout(deadline);report.phase=await page.evaluate(()=>window.__phase).catch(()=>null);report.partial=await page.evaluate(()=>window.__partial).catch(()=>null);await browser.close();await new Promise(resolve=>modelServer.close(resolve));await fs.writeFile('docs/evaluations/2026-10-04-cpu-combined-opfs-cache.json',JSON.stringify(report,null,2)+'\n');}
console.log(report.status,report.error??'');
