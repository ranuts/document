import {createServer} from 'node:http';
import {createReadStream} from 'node:fs';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {chromium} from '@playwright/test';
const modelPath='.scratch/node_modules/ai-models/qwen2.5-0.5b-instruct-q4_k_m.gguf';
const size=(await fs.stat(modelPath)).size;
const marker='LOCAL_COLD_SELFHOST_7429_中文';
const report={scope:'Fresh Chromium context, actual self-hosted GGUF download and native Word IM CPU inference. Local model server records requests including bodies. Context observes app/worker requests; service workers blocked. Not arbitrary redirects, malicious runtimes, deployed privacy or physical mobile certification.',probeSHA256:crypto.createHash('sha256').update(await fs.readFile(new URL(import.meta.url))).digest('hex'),marker,size,serverRequests:[],requests:[],errors:[]};
const server=createServer((req,res)=>{
 const row={method:req.method,url:req.url,headers:req.headers,body:''};report.serverRequests.push(row);
 req.on('data',b=>row.body+=b.toString());
 res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Cross-Origin-Resource-Policy','cross-origin');res.setHeader('Accept-Ranges','bytes');
 const range=/^bytes=(\d+)-(\d*)$/.exec(req.headers.range??'');
 const start=range?Number(range[1]):0,end=range&&range[2]?Number(range[2]):size-1;
 if(start>end||end>=size){res.writeHead(416);res.end();return;}
 res.setHeader('Content-Length',end-start+1);res.setHeader('Content-Type','application/octet-stream');
 if(range){res.statusCode=206;res.setHeader('Content-Range',`bytes ${start}-${end}/${size}`);}
 if(req.method==='HEAD'){res.end();return;}
 createReadStream(modelPath,{start,end}).pipe(res);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const modelURL=`http://127.0.0.1:${server.address().port}/qwen2.5-0.5b-instruct-q4_k_m.gguf`;
let browser;
try{
 browser=await chromium.launch();const context=await browser.newContext({serviceWorkers:'block',viewport:{width:1280,height:900}});
 await context.addInitScript(()=>{localStorage.setItem('agent-panel-provider','wllama');Object.defineProperty(navigator,'gpu',{value:undefined,configurable:true});});
 context.on('request',r=>report.requests.push({url:r.url(),method:r.method(),body:r.postData(),headers:r.headers()}));
 const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto('http://127.0.0.1:5193/editor?new=docx&agent=1&locale=en');
 await page.frameLocator('#app iframe').locator('.agent-sidebar-entry').click({timeout:90000});
 report.initial=await page.evaluate(async()=>({cacheNames:await caches.keys(),databases:(await indexedDB.databases()).map(d=>d.name)}));
 await page.locator('.agent-panel-settings-toggle').click();
 await page.locator('.agent-panel-provider').evaluate(el=>{el.value='wllama';el.dispatchEvent(new Event('change'));});
 await page.locator('.agent-panel-gguf-url').evaluate((el,url)=>{el.value=url;},modelURL);await page.locator('.agent-panel-gguf-url').dispatchEvent('change');
 await page.locator('.agent-panel-gguf-cpu').check();
 await page.locator('.agent-panel-gguf-load').click();
 await page.waitForFunction(()=>document.querySelector('.agent-panel-note')?.textContent?.includes('Model loaded'),null,{timeout:180000});
 report.engine=await page.locator('.agent-model-status').textContent();report.downloadRequestCount=report.serverRequests.length;
 await page.locator('.agent-generation-options summary').click();await page.locator('[name="maxTokens"]').fill('32');await page.locator('[name="maxTokens"]').dispatchEvent('change');
 await page.locator('.agent-panel-settings-toggle').click();
 await page.locator('.cui-input').fill(`Reply briefly to this privacy marker: ${marker}`);await page.locator('.cui-input').press('Enter');
 await page.waitForFunction(()=>!document.querySelector('.cui-input')?.disabled,null,{timeout:180000});
 report.reply=await page.locator('.cui-msg-agent').last().textContent();report.visibleErrors=await page.locator('.cui-msg-error').allTextContents();report.stats=await page.locator('.agent-generation-stats').textContent();
 report.currentPlugin=await page.evaluate(()=>performance.getEntriesByType('resource').map(e=>e.name).find(n=>/agent-plugin-.*\.js/.test(n)));
 report.passed=report.downloadRequestCount>0&&!!report.reply&&!report.visibleErrors.length&&!report.errors.length&&report.requests.every(r=>r.body===null&&!JSON.stringify(r).includes(marker))&&report.serverRequests.every(r=>r.body===''&&!JSON.stringify(r).includes(marker));
 console.log(JSON.stringify({passed:report.passed,engine:report.engine,reply:report.reply,downloads:report.downloadRequestCount,requests:report.requests.length}));
}catch(e){report.passed=false;report.error=String(e);process.exitCode=1;console.log(report.error);}
finally{await browser?.close();await new Promise(resolve=>server.close(resolve));await fs.writeFile('.scratch/cold-selfhost-cpu.json',JSON.stringify(report,null,2)+'\n');}
if(!report.passed)process.exitCode=1;
