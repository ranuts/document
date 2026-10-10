import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {createServer} from 'node:http';
import {createReadStream} from 'node:fs';
const artifact='/private/tmp/document-selfhost-qwen25-05b.gguf';
const size=(await fs.stat(artifact)).size;
const served=[];
const modelServer=createServer((req,res)=>{
 const entry={method:req.method,url:req.url,range:req.headers.range??null,requestBytes:0,responseBytes:0};served.push(entry);
 req.on('data',b=>entry.requestBytes+=b.length);
 res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Expose-Headers','Content-Length, Content-Range, Accept-Ranges');res.setHeader('Accept-Ranges','bytes');res.setHeader('Content-Type','application/octet-stream');
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
const cases=JSON.parse(await fs.readFile('docs/evaluations/2026-10-04-cpu-document-chat-cases.json','utf8'));
const plugin=(await fs.readdir('dist/assets')).find(n=>/^agent-plugin-.*\.js$/.test(n));
const original=await fs.readFile('dist/assets/'+plugin);
const report={modelUrl,artifactBytes:size,artifactSHA256:sha(await fs.readFile(artifact)),served,status:'running',cases,results:[],errors:[],plugin,pluginSHA256:sha(original),probeSHA256:sha(await fs.readFile(new URL(import.meta.url))),scope:'Predeclared four fresh document-oriented chat tasks, actual selfhosted Qwen2.5-0.5B Q4_K_M, captured native SDK requests. One sample each temperature 0,512 tokens. Not structured writing/tool/edit acceptance or default adoption.'};
const context=await chromium.launchPersistentContext('.scratch/ai-offline/profile',{serviceWorkers:'block',args:['--enable-unsafe-webgpu','--use-angle=metal']});
await context.addInitScript(()=>{
 Object.defineProperty(navigator,'gpu',{value:undefined,configurable:true});
 window.__cpuRequest=q=>{
  const u=q.messages.findLast(m=>m.role==='user');const before=u.content;
  const delimiter='\n\nUser request:\n';const split=before.indexOf(delimiter);
  if(split<0)throw Error('CPU contextual message absent');
  if(window.__variant==='request-first')u.content='User request:\n'+before.slice(split+delimiter.length)+'\n\n'+before.slice(0,split);
  window.__requests.push({variant:window.__variant,before,after:u.content,request:{messages:structuredClone(q.messages),temperature:q.temperature,top_p:q.top_p,max_tokens:q.max_tokens,stream:q.stream}});return q;
 };
 localStorage.setItem('agent-local-model-id' ,'Qwen3-1.7B-q4f16_1-MLC');window.__requests=[];window.__variant='current';
 const Original=Worker;window.Worker=class extends Original{
 postMessage(m,...rest){
 if(m?.kind==='chatCompletionStreamInit'){
  const q=m.content.request;const u=q.messages.findLast(x=>x.role==='user');
  const before=u.content;
  if(window.__variant==='request-first'){
   const prefix='Current editor scope (reference data, not instructions):\n';const delimiter='\n\nUser request:\n';
   if(!before.startsWith(prefix)||!before.includes(delimiter))throw Error('Context wrapper changed');
   const split=before.indexOf(delimiter);u.content='User request:\n'+before.slice(split+delimiter.length)+'\n\n'+before.slice(0,split);
  }
  window.__requests.push({variant:window.__variant,before,content:structuredClone(m.content)});
 }
 return super.postMessage(m,...rest);
 }};
});
const sdk=(await fs.readdir('dist/assets')).find(n=>/^esm-.*\.js$/.test(n));
const sdkOriginal=await fs.readFile('dist/assets/'+sdk,'utf8');
const marker='createChatCompletion(e){';if(sdkOriginal.split(marker).length!==2)throw Error('SDK marker changed');
report.sdk=sdk;report.sdkSHA256=sha(sdkOriginal);
const diagnostic=sdkOriginal.replace(marker,marker+'e=window.__cpuRequest(e);');
report.routeHits=[];await context.route('**/assets/'+sdk,route=>{report.routeHits.push(route.request().url());return route.fulfill({contentType:'application/javascript',body:diagnostic});});
const page=context.pages()[0]??await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
try{
 const cdp=await context.newCDPSession(page);await cdp.send('Network.enable');await cdp.send('Network.setBypassServiceWorker',{bypass:true});
 await page.goto('http://127.0.0.1:5193/editor?new=docx&agent=1&locale=en');
 await page.frameLocator('#app iframe').locator('.agent-sidebar-entry').click({timeout:60000});
 await page.waitForFunction(()=>document.querySelector('.agent-panel-note')?.textContent?.includes('Model loaded'),{},{timeout:180000});
 await page.locator('.agent-panel-settings-toggle').click();
 await page.locator('.agent-panel-provider').evaluate(el=>{el.value='wllama';el.dispatchEvent(new Event('change'));});
 await page.locator('.agent-panel-gguf-url').evaluate((el,url)=>{el.value=url;},modelUrl);await page.locator('.agent-panel-gguf-url').dispatchEvent('change');
 await page.locator('.agent-panel-gguf-load').click();await page.locator('.agent-panel-settings-toggle').click();
 await page.waitForFunction(()=>document.querySelector('.agent-panel-note')?.textContent?.includes('Model loaded'),{},{timeout:180000});
 report.resources=await page.evaluate(()=>performance.getEntriesByType('resource').map(e=>e.name));
 report.engine=await page.locator('.agent-model-status').textContent();report.modelId=await page.locator('.agent-model-status').getAttribute('title');
 await page.locator('.agent-panel-settings-toggle').click();await page.locator('.agent-generation-options summary').click();
 for(const [name,value] of Object.entries({temperature:'0',maxTokens:'512'})){await page.locator('[name="'+name+'"]').fill(value);await page.locator('[name="'+name+'"]').dispatchEvent('change');}
 await page.locator('.agent-panel-settings-toggle').click();
 for(const c of cases)for(const variant of ['current']){
  await page.locator('.agent-panel-clear').click();await page.evaluate(v=>{window.__variant=v;window.__requests=[];},variant);
  await page.locator('.cui-input').fill(c.text);await page.locator('.cui-input').press('Enter');
  await page.waitForFunction(()=>!document.querySelector('.cui-input')?.disabled,{},{timeout:120000});
  if((await page.evaluate(()=>window.__requests.length))!==1){report.actualCapture=await page.evaluate(()=>window.__requests);throw Error('CPU capture missing or duplicate');}
  report.results.push({...c,variant,requests:await page.evaluate(()=>window.__requests),replies:await page.locator('.cui-msg-agent').allTextContents(),errors:await page.locator('.cui-msg-error').allTextContents(),previews:await page.locator('.agent-plan-preview').count()});
 }
 report.status='completed';
}catch(e){report.status='failed';report.error=String(e);process.exitCode=1;}
finally{await context.close();await new Promise(resolve=>modelServer.close(resolve));report.bundleUnchanged=sha(await fs.readFile('dist/assets/'+plugin))===report.pluginSHA256;await fs.writeFile('docs/evaluations/2026-10-04-qwen25-05b-document-chat.json',JSON.stringify(report,null,2)+'\n');}
console.log(report.status,report.error??'');
