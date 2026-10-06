import {createServer} from 'vite';
import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const report={status:'running',probeSHA256:sha(await fs.readFile(new URL(import.meta.url))),errors:[],scope:'Actual Chromium keyboard deletion failure and retry in isolated source harness; repository failure is injected, not a physical IndexedDB outage. Includes original reload/export/success checks.'};
const files=['lib/agent-plugin/ui/sessions.ts','lib/agent-plugin/ui/conversation-db.ts','lib/agent-plugin/ui/history-controls.ts'];
report.sourceHashes=Object.fromEntries(await Promise.all(files.map(async f=>[f,sha(await fs.readFile(f))])));
const messages=[{role:'user',content:'中文🧾\n640 EUR\nLiteral \\n'},{role:'assistant',content:'**原文** <script>data</script>'}];
const server=await createServer({configFile:false,root:process.cwd(),logLevel:'error',server:{host:'127.0.0.1',port:0},plugins:[{name:'history-harness',configureServer(s){s.middlewares.use('/__history_native',async(_req,res)=>{res.setHeader('Content-Type','text/html');res.end(await s.transformIndexHtml('/__history_native','<!doctype html><script type="module">import {createConversationStore} from "/lib/agent-plugin/ui/sessions.ts"; import {createHistoryControls} from "/lib/agent-plugin/ui/history-controls.ts";window.createConversationStore=createConversationStore;window.createHistoryControls=createHistoryControls;window.store=createConversationStore();window.controls=createHistoryControls({store:window.store,onRestore(){}});document.body.append(window.controls.el);await window.controls.start();window.ready=true;</script>'));});}}]});
let browser;
try{
 await server.listen();browser=await chromium.launch();const page=await browser.newPage({acceptDownloads:true});page.on('pageerror',e=>report.errors.push(e.message));
 const url=`http://127.0.0.1:${server.httpServer.address().port}/__history_native`;await page.goto(url);await page.waitForFunction(()=>window.ready);
 report.initial=await page.evaluate(()=>({saving:store.saving,history:store.history().load()}));
 await page.evaluate(messages=>store.history().save(messages),messages);await page.locator('.agent-history-save').check();await page.waitForFunction(()=>store.saving);
 await page.evaluate(()=>store.flush());report.beforeReload=await page.evaluate(()=>({id:store.activeId,messages:store.history().load()}));
 await page.reload();await page.waitForFunction(()=>window.ready);report.restored=await page.evaluate(()=>({saving:store.saving,id:store.activeId,messages:store.history().load()}));
 const downloaded=page.waitForEvent('download');await page.locator('.agent-history-export').click();const download=await downloaded;
 report.downloadName=download.suggestedFilename();report.downloadError=await download.failure();report.export=JSON.parse(await fs.readFile(await download.path(),'utf8'));
 report.focusResults=[];
 for(const selector of ['.agent-history-delete-current','.agent-history-delete-all']) {
  await page.locator(selector).click();await page.locator('.agent-history-confirm').focus();await page.keyboard.press('Enter');
  await page.waitForFunction(()=>document.querySelector('.agent-history-confirmation').hidden && !document.querySelector('.agent-history-delete-all').disabled);
  report.focusResults.push(await page.evaluate(selector=>({selector,active:document.activeElement.className,hidden:document.querySelector('.agent-history-confirmation').hidden}),selector));
 }
 await page.evaluate(() => {
  document.body.replaceChildren();
  window.failClear = true;
  window.store=createConversationStore(undefined,{repository:{load:async()=>null,save:async()=>1,clear:async()=>{if(window.failClear)throw new DOMException('Unavailable','UnknownError');return 1;}}});
  store.history().save([{role:'user',content:'preserve on failure'}]);
  window.controls=createHistoryControls({store,onRestore(){}});document.body.append(controls.el);
 });
 await page.locator('.agent-history-delete-all').click();await page.locator('.agent-history-confirm').focus();await page.keyboard.press('Enter');
 await page.waitForFunction(()=>document.querySelector('.agent-history-status').title==='Unavailable' && !document.querySelector('.agent-history-confirm').disabled);
 report.failedDeletion=await page.evaluate(()=>({active:document.activeElement.className,hidden:document.querySelector('.agent-history-confirmation').hidden,messages:store.history().load(),status:document.querySelector('.agent-history-status').textContent}));
 await page.evaluate(()=>window.failClear=false);await page.keyboard.press('Enter');
 await page.waitForFunction(()=>document.querySelector('.agent-history-confirmation').hidden && !document.querySelector('.agent-history-delete-all').disabled);
 report.retriedDeletion=await page.evaluate(()=>({active:document.activeElement.className,hidden:document.querySelector('.agent-history-confirmation').hidden,messages:store.history().load()}));
 report.messages=messages;report.status='completed';
}catch(e){report.status='failed';report.error=String(e);process.exitCode=1;}
finally{await browser?.close();await server.close();await fs.writeFile('docs/evaluations/2026-10-04-history-deletion-failure-retry-browser.json',JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({status:report.status,error:report.error,errors:report.errors}));
