import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {createServer} from 'node:http';
import {createReadStream} from 'node:fs';
const artifact='/private/tmp/document-selfhost-qwen3-06b.gguf';
const size=(await fs.stat(artifact)).size;
const served=[];
const modelServer=createServer((req,res)=>{
 const entry={method:req.method,url:req.url,range:req.headers.range??null,requestBytes:0,responseBytes:0};served.push(entry);
 req.on('data',b=>entry.requestBytes+=b.length);
 res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Expose-Headers','Content-Length, Content-Range, Accept-Ranges');res.setHeader('Accept-Ranges','bytes');res.setHeader('Content-Type','application/octet-stream');
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
const archivePath='docs/evaluations/2026-10-04-cpu-system-sampling-diagnostic.json';const archiveBytes=await fs.readFile(archivePath);const archived=JSON.parse(archiveBytes).results[0].requests[0].request;const base=modelUrl.replace('/model.gguf','');
const report={status:'running',scope:'Isolated exact-token whole-turn history trimming feasibility using captured app system/current message and synthetic old tool turns; not production implementation; standalone SDK, no editor write or production changes',files:{},served,errors:[],console:[]};
report.archivePath=archivePath;report.archiveSHA256=sha(archiveBytes);report.probeSHA256=sha(await fs.readFile(new URL(import.meta.url)));report.patchSHA256=sha(await fs.readFile('docs/evaluations/cpu-native-count-structured-rejection.patch'));for(const f of ['js','wasm'])report.files[f]=sha(await fs.readFile('/private/tmp/document-wllama-count-build-4020/wllama.'+f));
const browser=await chromium.launch();const context=await browser.newContext({serviceWorkers:'block'});
const sdk=await fs.readFile('dist/assets/esm-BmP3Hx_J.js','utf8');const marker='cmpl_res:{';if(sdk.split(marker).length!==2)throw Error('SDK response schema marker changed');const addon='cntc_res:{name:`cntc_res`,structName:`glue_msg_count_chat_res`,className:`GlueMsgCountChatRes`,fields:[{type:`bool`,name:`success`,isNullable:!1},{type:`str`,name:`error`,isNullable:!1},{type:`int`,name:`prompt_tokens`,isNullable:!1},{type:`int`,name:`context_tokens`,isNullable:!1}]},';report.sdkSHA256=sha(sdk);report.routeHits=[];await context.route('**/assets/esm-BmP3Hx_J.js',route=>{report.routeHits.push(route.request().url());return route.fulfill({contentType:'application/javascript',body:sdk.replace(marker,addon+marker)});});const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>report.console.push({type:m.type(),text:m.text()}));
try{
 const cdp=await context.newCDPSession(page);await cdp.send('Network.enable');await cdp.send('Network.setBypassServiceWorker',{bypass:true});await page.goto('http://127.0.0.1:5193/');
 report.result=await page.evaluate(async({base,modelUrl,archived})=>{
  const original=WebAssembly.validate.bind(WebAssembly);
  WebAssembly.validate=b=>b.byteLength===13?false:original(b);
  const {Wllama}=await import('/assets/esm-BmP3Hx_J.js');
  window.__phase='construct';const runtime=new Wllama({default:base+'/runtime.wasm'},{allowOffline:true});
  runtime.setCompat({wasm:base+'/runtime.wasm',worker:{code:await(await fetch(base+'/runtime.js')).text()}},'firefox_safari');
  try{
   window.__phase='load';await runtime.loadModelFromUrl(modelUrl,{n_ctx:2048,ctx_shift:false,n_gpu_layers:0,n_threads:1,reasoning:false,useCache:false});
   window.__phase='loaded';const info=runtime.getLoadedContextInfo();
   window.__phase='count';
   const actions=[];const native=runtime.proxy.wllamaAction.bind(runtime.proxy);runtime.proxy.wllamaAction=(name,...args)=>{actions.push(name);return native(name,...args);};
   window.__partial={results:[],counts:[]};const count=async options=>{const response=await runtime.proxy.wllamaAction('count_chat',{_name:'cmpl_req',is_chat:true,data_json:JSON.stringify(options),files:[]});window.__partial.counts.push({options,response});if(!response.success)throw Error(response.error);return response;};
   const system=archived.messages[0];const current=archived.messages.at(-1);
   const turns=[
    [{role:'user',content:'Old reference:'+(' a'.repeat(1000))},{role:'assistant',content:'Acknowledged.'}],
    [{role:'user',content:'Read the selection.'},{role:'assistant',content:null,tool_calls:[{id:'old_call',type:'function',function:{name:'read_selection',arguments:'{}'}}]},{role:'tool',tool_call_id:'old_call',content:JSON.stringify({text:' b'.repeat(900)})},{role:'assistant',content:'Read complete.'}],
   ];
   const archive=JSON.stringify(turns);window.__partial.trim={archiveBefore:archive,attempts:[]};let removed=0;let finalOptions,measured;
   while(true){
    finalOptions={...archived,stream:false,messages:[system,...turns.slice(removed).flat(),current]};measured=await count(finalOptions);
    window.__partial.trim.attempts.push({removed,options:finalOptions,measured});
    if(measured.prompt_tokens+finalOptions.max_tokens+1<=measured.context_tokens)break;
    if(removed===turns.length)throw Error('agentContextTooLong');removed++;
   }
   if(removed!==1)throw Error('Unexpected trim coverage');
   if(JSON.stringify(turns)!==archive)throw Error('Archive changed');
   if(JSON.stringify(finalOptions.messages.at(-1))!==JSON.stringify(current))throw Error('Current request changed');
   const reply=await runtime.createChatCompletion(finalOptions);
   if(reply.usage.prompt_tokens!==measured.prompt_tokens)throw Error('Trimmed prompt usage mismatch');
   const tooLongOptions={...finalOptions,messages:[system,{...current,content:'龘'.repeat(1900)}]};const tooLong=await count(tooLongOptions);
   if(tooLong.prompt_tokens+tooLongOptions.max_tokens+1<=tooLong.context_tokens)throw Error('Current turn overflow missed');
   window.__partial.trim.archiveAfter=JSON.stringify(turns);
   window.__phase='verified';return {info,removed,finalOptions,measured,reply,tooLongOptions,tooLong,actions};
  }finally{await runtime.exit();}
 },{base,modelUrl,archived});
 report.status='completed';
}catch(e){report.status='failed';report.error=String(e);process.exitCode=1;}
finally{report.phase=await page.evaluate(()=>window.__phase).catch(()=>null);report.partial=await page.evaluate(()=>window.__partial).catch(()=>null);await browser.close();await new Promise(resolve=>modelServer.close(resolve));await fs.writeFile('docs/evaluations/2026-10-04-cpu-native-count-history-trim.json',JSON.stringify(report,null,2)+'\n');}
console.log(report.status,report.error??'');
