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
 if(req.url==='/runtime.wasm'||req.url==='/runtime.js'){const f='/private/tmp/document-wllama-count-build/wllama.'+(req.url.endsWith('.js')?'js':'wasm');res.setHeader('Content-Type',req.url.endsWith('.js')?'application/javascript':'application/wasm');createReadStream(f).pipe(res);return;}
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
const report={status:'running',scope:'Isolated self-built CPU compatibility baseline; standalone SDK, no editor write or production changes',files:{},served,errors:[]};
for(const f of ['js','wasm'])report.files[f]=sha(await fs.readFile('/private/tmp/document-wllama-count-build/wllama.'+f));
const browser=await chromium.launch();const context=await browser.newContext({serviceWorkers:'block'});
const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:5193/');
 report.result=await page.evaluate(async({base,modelUrl})=>{
  const original=WebAssembly.validate.bind(WebAssembly);
  WebAssembly.validate=b=>b.byteLength===13?false:original(b);
  const {Wllama}=await import('/assets/esm-BmP3Hx_J.js');
  const runtime=new Wllama({default:base+'/runtime.wasm'},{allowOffline:true});
  runtime.setCompat({wasm:base+'/runtime.wasm',worker:{code:await(await fetch(base+'/runtime.js')).text()}},'firefox_safari');
  try{
   await runtime.loadModelFromUrl(modelUrl,{n_ctx:2048,n_gpu_layers:0,n_threads:1,reasoning:false,useCache:false});
   const info=runtime.getLoadedContextInfo();
   const reply=await runtime.createChatCompletion({messages:[{role:'user',content:'Reply with hello.'}],temperature:0,max_tokens:16,stream:false});
   return {info,reply};
  }finally{await runtime.exit();}
 },{base,modelUrl});
 report.status='completed';
}catch(e){report.status='failed';report.error=String(e);process.exitCode=1;}
finally{await browser.close();await new Promise(resolve=>modelServer.close(resolve));await fs.writeFile('docs/evaluations/2026-10-04-cpu-native-build-baseline.json',JSON.stringify(report,null,2)+'\n');}
console.log(report.status,report.error??'');
