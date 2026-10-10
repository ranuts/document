import {createServer} from 'vite';
import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const report={status:'running',probeSHA256:sha(await fs.readFile(new URL(import.meta.url))),errors:[],scope:'Actual Chromium IndexedDB, reload restoration and native JSON download in isolated source harness; no model/editor integration or OS persistence certification.'};
const files=['lib/agent-plugin/ui/sessions.ts','lib/agent-plugin/ui/conversation-db.ts','lib/agent-plugin/ui/history-controls.ts'];
report.sourceHashes=Object.fromEntries(await Promise.all(files.map(async f=>[f,sha(await fs.readFile(f))])));
const messages=[{role:'user',content:'中文🧾\n640 EUR\nLiteral \\n'},{role:'assistant',content:'**原文** <script>data</script>'}];
const server=await createServer({configFile:false,root:process.cwd(),logLevel:'error',server:{host:'127.0.0.1',port:0},plugins:[{name:'history-harness',configureServer(s){s.middlewares.use('/__history_native',async(_req,res)=>{res.setHeader('Content-Type','text/html');res.end(await s.transformIndexHtml('/__history_native','<!doctype html><script type="module">import {createConversationStore} from "/lib/agent-plugin/ui/sessions.ts"; import {createHistoryControls} from "/lib/agent-plugin/ui/history-controls.ts";window.store=createConversationStore();window.controls=createHistoryControls({store:window.store,onRestore(){}});document.body.append(window.controls.el);await window.controls.start();window.ready=true;</script>'));});}}]});
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
 report.messages=messages;report.status='completed';
}catch(e){report.status='failed';report.error=String(e);process.exitCode=1;}
finally{await browser?.close();await server.close();await fs.writeFile('docs/evaluations/2026-10-04-history-native-indexeddb-export.json',JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({status:report.status,error:report.error,errors:report.errors}));
