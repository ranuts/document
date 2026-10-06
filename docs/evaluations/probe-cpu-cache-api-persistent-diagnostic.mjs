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
const profile=await fs.mkdtemp('/private/tmp/document-cache-size-profile-');const context=await chromium.launchPersistentContext(profile,{serviceWorkers:'block'});const browser=context;
const sdk=await fs.readFile('dist/assets/esm-BmP3Hx_J.js','utf8');const marker='cmpl_res:{';if(sdk.split(marker).length!==2)throw Error('SDK response schema marker changed');const addon='cntc_res:{name:`cntc_res`,structName:`glue_msg_count_chat_res`,className:`GlueMsgCountChatRes`,fields:[{type:`bool`,name:`success`,isNullable:!1},{type:`str`,name:`error`,isNullable:!1},{type:`int`,name:`prompt_tokens`,isNullable:!1},{type:`int`,name:`context_tokens`,isNullable:!1}]},';report.sdkSHA256=sha(sdk);report.routeHits=[];await context.route('**/assets/esm-BmP3Hx_J.js',route=>{report.routeHits.push(route.request().url());return route.fulfill({contentType:'application/javascript',body:sdk.replace(marker,addon+marker)});});let deadline;const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>report.console.push({type:m.type(),text:m.text()}));
try{
 deadline=setTimeout(()=>{report.diagnosticDeadline=true;void browser.close();},120000);
 const cdp=await context.newCDPSession(page);await cdp.send('Network.enable');await cdp.send('Network.setBypassServiceWorker',{bypass:true});await page.goto('http://127.0.0.1:5193/');
 report.result=await page.evaluate(async({base,modelUrl})=>{
  const {CacheAPIStorage}=await import(base+'/provider/llm/wllama-cache-storage.js');
  const cacheName='diagnostic-cache-size';await caches.delete(cacheName);
  const cache=await caches.open(cacheName);const storage=new CacheAPIStorage(cache,location.origin);
  const initialEstimate=await navigator.storage.estimate();const results=[];window.__partial={initialEstimate,results};
  try{
   for(const bytes of [1048576,67108864,268435456,484220320]){
    window.__phase='cache-size-'+bytes;let streamedBytes=0;
    const response=await fetch(modelUrl,{headers:{Range:'bytes=0-'+(bytes-1)}});
    const stream=response.body.pipeThrough(new TransformStream({transform(chunk,controller){streamedBytes+=chunk.byteLength;controller.enqueue(chunk);}}));
    try{
     await storage.write('model',stream);const actual=await storage.getSize('model');
     if(actual!==bytes)throw Error('Cached length mismatch');results.push({bytes,state:'saved',actual,streamedBytes,estimate:await navigator.storage.estimate()});
    }catch(e){results.push({bytes,state:'failed',name:e.name,error:String(e),streamedBytes,estimate:await navigator.storage.estimate()});}
    await storage.delete('model');
   }
   window.__phase='verified';return {initialEstimate,results,scope:'Real Chromium Cache API streamed model prefixes; no native inference or full offline acceptance'};
  }finally{await caches.delete(cacheName);}

 },{base,modelUrl});
 report.status='completed';
}catch(e){report.status='failed';report.error=String(e);process.exitCode=1;}
finally{clearTimeout(deadline);report.phase=await page.evaluate(()=>window.__phase).catch(()=>null);report.partial=await page.evaluate(()=>window.__partial).catch(()=>null);await browser.close();await fs.rm(profile,{recursive:true,force:true});await new Promise(resolve=>modelServer.close(resolve));await fs.writeFile('docs/evaluations/2026-10-04-cpu-cache-api-persistent-diagnostic.json',JSON.stringify(report,null,2)+'\n');}
console.log(report.status,report.error??'');
