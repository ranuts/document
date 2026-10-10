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
 if(req.url==='/sdk.js'){res.setHeader('Content-Type','application/javascript');createReadStream('/private/tmp/document-count-sdk-source-esm/index.js').pipe(res);return;}
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
const report={status:'running',scope:'Isolated native count prototype: four actual usage comparisons, repeat counts, overflow and unsupported-input recovery; not production acceptance; standalone SDK, no editor write or production changes',files:{},served,errors:[],console:[]};
report.clientSHA256=sha(await fs.readFile('/private/tmp/document-count-sdk-source-esm/index.js'));report.probeSHA256=sha(await fs.readFile(new URL(import.meta.url)));report.patchSHA256=sha(await fs.readFile('docs/evaluations/cpu-native-count-structured-rejection.patch'));for(const f of ['js','wasm'])report.files[f]=sha(await fs.readFile('/private/tmp/document-wllama-count-build-4020/wllama.'+f));
const browser=await chromium.launch();const context=await browser.newContext({serviceWorkers:'block'});
const sdk=await fs.readFile('dist/assets/esm-BmP3Hx_J.js','utf8');const marker='cmpl_res:{';if(sdk.split(marker).length!==2)throw Error('SDK response schema marker changed');const addon='cntc_res:{name:`cntc_res`,structName:`glue_msg_count_chat_res`,className:`GlueMsgCountChatRes`,fields:[{type:`bool`,name:`success`,isNullable:!1},{type:`str`,name:`error`,isNullable:!1},{type:`int`,name:`prompt_tokens`,isNullable:!1},{type:`int`,name:`context_tokens`,isNullable:!1}]},';report.sdkSHA256=sha(sdk);report.routeHits=[];await context.route('**/assets/esm-BmP3Hx_J.js',route=>{report.routeHits.push(route.request().url());return route.fulfill({contentType:'application/javascript',body:sdk.replace(marker,addon+marker)});});let deadline;const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>report.console.push({type:m.type(),text:m.text()}));
try{
 deadline=setTimeout(()=>{report.diagnosticDeadline=true;void browser.close();},120000);
 const cdp=await context.newCDPSession(page);await cdp.send('Network.enable');await cdp.send('Network.setBypassServiceWorker',{bypass:true});await page.goto('http://127.0.0.1:5193/');
 report.result=await page.evaluate(async({base,modelUrl})=>{
  const original=WebAssembly.validate.bind(WebAssembly);
  WebAssembly.validate=b=>b.byteLength===13?false:original(b);
  const Memory=WebAssembly.Memory;WebAssembly.Memory=new Proxy(Memory,{construct(target,args){if(args[0]?.address==='i64')throw new TypeError('Diagnostic forces CPU compat');return Reflect.construct(target,args);}});
  const {Wllama}=await import(base+'/sdk.js');
  window.__phase='construct';const runtime=new Wllama({default:base+'/runtime.wasm'},{allowOffline:true});
  runtime.setCompat({wasm:base+'/runtime.wasm',worker:{code:await(await fetch(base+'/runtime.js')).text()}},'firefox_safari');
  try{
   const selected=runtime.getWorkerResources();console.log('DIAGNOSTIC_RESOURCES',JSON.stringify({compat:selected.compat,wasmPath:selected.wasmPath,hasInlineWorker:!!selected.jsPath?.code}));if(!selected.compat||!selected.jsPath?.code)throw Error('CPU compatibility runtime not selected');
   window.__phase='load';await runtime.loadModelFromUrl(modelUrl,{n_ctx:2048,n_gpu_layers:0,n_threads:1,reasoning:false,useCache:false});
   window.__phase='loaded';const info=runtime.getLoadedContextInfo();
   window.__phase='count';
   const actions=[];const native=runtime.proxy.wllamaAction.bind(runtime.proxy);runtime.proxy.wllamaAction=(name,...args)=>{actions.push(name);return native(name,...args);};
   window.__partial={results:[],counts:[]};const count=async options=>{const value=await runtime.countChatTokens(options);const response={success:true,error:'',prompt_tokens:value.promptTokens,context_tokens:value.contextTokens};window.__partial.counts.push({options,response});if(!response.success)throw Error(response.error);return response;};
   const requests=[
    {id:'ascii',messages:[{role:'user',content:'Reply with hello.'}]},
    {id:'chinese',messages:[{role:'system',content:'简短回答。'},{role:'user',content:'你好，请回答。'}]},
    {id:'mixed',messages:[{role:'system',content:'Preserve dates and names.'},{role:'user',content:'Mira 2047-06-12 支付 640 EUR。'}]},
    {id:'multi-turn',messages:[{role:'user',content:'Hello.'},{role:'assistant',content:'Hello.'},{role:'user',content:'Reply with hello.'}]},
   ];
   const results=window.__partial.results;
   for(const c of requests){
    const options={messages:c.messages,temperature:0,max_tokens:16,stream:false};const before=actions.length;
    const first=await count(options);const second=await count(options);const countActions=actions.slice(before);
    if(first.prompt_tokens!==second.prompt_tokens||first.context_tokens!==2048)throw Error('Unstable count/context');
    if(countActions.some(a=>a!=='count_chat'))throw Error('Count invoked generation action');
    const reply=await runtime.createChatCompletion(options);
    if(first.prompt_tokens!==reply.usage.prompt_tokens)throw Error('Prompt count differs from actual usage');
    results.push({id:c.id,options,first,second,countActions,reply});
   }
   const oversized=await count({messages:[{role:'system',content:'龘'.repeat(1900)},{role:'user',content:'Reply with hello.'}]});
   if(oversized.prompt_tokens<=oversized.context_tokens)throw Error('Known overflow undercounted');
   let unsupportedError;try{await count({messages:[{role:'user',content:[{type:'text',text:'Hello'}]}]});throw Error('Unsupported input accepted');}catch(e){unsupportedError=String(e);if(!unsupportedError.includes('does not support content parts'))throw e;}
   const recovery=await count({messages:[{role:'user',content:'Reply with hello.'}]});if(recovery.prompt_tokens!==16)throw Error('Model unusable after rejection');
   const reply=await runtime.createChatCompletion({messages:[{role:'user',content:'Reply with hello.'}],temperature:0,max_tokens:16,stream:false});
   if(reply.choices[0].message.content!==results[0].reply.choices[0].message.content)throw Error('Subsequent deterministic reply changed');
   window.__phase='verified';return {info,results,oversized,unsupportedError,recovery,reply,actions};
  }finally{await runtime.exit();}
 },{base,modelUrl});
 report.status='completed';
}catch(e){report.status='failed';report.error=String(e);process.exitCode=1;}
finally{clearTimeout(deadline);report.phase=await page.evaluate(()=>window.__phase).catch(()=>null);report.partial=await page.evaluate(()=>window.__partial).catch(()=>null);await browser.close();await new Promise(resolve=>modelServer.close(resolve));await fs.writeFile('docs/evaluations/2026-10-04-cpu-public-count-source-compat.json',JSON.stringify(report,null,2)+'\n');}
console.log(report.status,report.error??'');
