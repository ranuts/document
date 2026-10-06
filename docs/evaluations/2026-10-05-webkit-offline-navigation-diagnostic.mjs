import {webkit} from '@playwright/test';
import fs from 'node:fs/promises';
const b=await webkit.launch(), c=await b.newContext({serviceWorkers:'allow'});
const r={version:b.version(),scope:'fresh shell-only context; no model inference',failures:[],cases:[]};
c.on('requestfailed',q=>r.failures.push({url:q.url(),error:q.failure()?.errorText}));
let p=await c.newPage();
try{
await p.goto('http://127.0.0.1:5193/editor?new=docx&agent=1&locale=zh-CN');
await p.waitForFunction(()=>navigator.serviceWorker.controller,null,{timeout:60000});
r.online=await p.evaluate(async()=>({controller:navigator.serviceWorker.controller.scriptURL,caches:await Promise.all((await caches.keys()).map(async name=>({name,entries:await Promise.all((await (await caches.open(name)).keys()).filter(x=>/\/editor(?:\.html)?(?:\?|$)/.test(x.url)).map(async x=>{const v=await (await caches.open(name)).match(x);return {url:x.url,status:v.status,type:v.type,headers:Object.fromEntries(v.headers)};}))})))}));
await c.setOffline(true);
for(const mode of ['reload','newPage']){
if(mode==='newPage'){await p.close();p=await c.newPage();}
const x={mode};try{if(mode==='reload')await p.reload({waitUntil:'domcontentloaded',timeout:30000});else await p.goto('http://127.0.0.1:5193/editor?new=docx&agent=1&locale=zh-CN',{waitUntil:'domcontentloaded',timeout:30000});x.result='navigated';x.title=await p.title();x.controller=await p.evaluate(()=>navigator.serviceWorker.controller?.scriptURL);}catch(e){x.error=String(e);}r.cases.push(x);
}
}catch(e){r.error=String(e);}finally{await c.close();await b.close();r.closed=true;await fs.writeFile('.scratch/webkit-offline-navigation-diagnostic.json',JSON.stringify(r,null,2));console.log(JSON.stringify(r));}
