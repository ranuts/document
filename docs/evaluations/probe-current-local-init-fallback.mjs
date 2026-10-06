import {webkit} from '@playwright/test';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const probeSHA256 = sha(await fs.readFile(new URL(import.meta.url)));
const assets = (await fs.readdir('dist/assets')).filter(name => /^agent-plugin-.*\.js$/.test(name));
if (assets.length !== 1) throw Error('Ambiguous plugin');
const pluginPath = 'dist/assets/' + assets[0];
const pluginSHA256 = sha(await fs.readFile(pluginPath));
const mode=process.env.FALLBACK_MODE??'adapter';
const context=await webkit.launchPersistentContext('.scratch/ai-csp/webkit-offline-profile',{viewport:{width:1280,height:900},serviceWorkers:'block'});
await context.addInitScript(mode=>{
 window.__adapterDeniedCalls=0;
 Object.defineProperty(navigator,'gpu',{configurable:true,value:{requestAdapter:async()=>{window.__adapterDeniedCalls++;if(mode==='worker')return {features:{has:()=>true}};throw new Error('Controlled adapter denied');}}});
},mode);
let failedWorkerScripts=0;
if(mode==='worker')await context.route('**/assets/webllm.worker-*.js',async route=>{failedWorkerScripts++;await route.fulfill({status:200,contentType:'application/javascript',body:'throw new Error("Controlled GPU Worker initialization failure");'});});
const page=context.pages()[0]??await context.newPage();
const report={status:'running',mode,probeSHA256,pluginPath,pluginSHA256,scope:'Current production automatic local fallback after controlled adapter rejection or GPU Worker script exception; real CPU Qwen3-0.6B chat in independent desktop Playwright WebKit with warm model cache and network available. No physical device, OOM, cold offline or generation replay claim.',errors:[],phases:[],workerEvents:[]};
page.on('pageerror',e=>report.errors.push(e.message));
page.on('worker',worker=>{report.workerEvents.push({event:'created',url:worker.url(),time:new Date().toISOString()});worker.on('close',()=>report.workerEvents.push({event:'closed',url:worker.url(),time:new Date().toISOString()}));});
const mark=text=>{report.phases.push({time:new Date().toISOString(),text});console.log(text);};
const path=process.env.FALLBACK_REPORT??'docs/evaluations/2026-10-04-local-init-fallback-'+mode+'.json';
const save=()=>fs.writeFile(path,JSON.stringify(report,null,2)+'\n');
try{
 await page.goto('http://127.0.0.1:5193/editor?new=docx&agent=1&locale=en');
 const started=Date.now();await page.frameLocator('#app iframe').locator('.agent-sidebar-entry').click({timeout:60000});
 await page.waitForFunction(()=>{const note=document.querySelector('.agent-panel-note')?.textContent;return note?.includes('Model loaded')||note?.includes('Model loading failed');},{},{timeout:240000});
 report.loadMs=Date.now()-started;report.failedWorkerScripts=failedWorkerScripts;report.note=await page.locator('.agent-panel-note').textContent();report.engine=await page.locator('.agent-model-status').textContent();report.selectedProvider=await page.locator('.agent-panel-provider').evaluate(el=>el.value);report.adapterDeniedCalls=await page.evaluate(()=>window.__adapterDeniedCalls);
 if(!report.adapterDeniedCalls||!report.engine?.includes('CPU')||!report.note?.includes('Model loaded')||report.selectedProvider!=='webllm')throw Error('Automatic adapter rejection fallback not established');
 if(mode==='worker'&&failedWorkerScripts!==1)throw Error('Controlled GPU worker failure was not observed exactly once');
 mark('Real automatic CPU model loaded');
 const body=page.frameLocator('#app iframe').locator('body');report.before=await body.evaluate(()=>(window.editor??window.Asc.editor).WordControl.m_oLogicDocument.GetText());
 await page.locator('.agent-writing-task').selectOption('chat');await page.locator('.cui-input').fill('Please reply with only hello.');const began=Date.now();await page.locator('.cui-input').press('Enter');
 await page.waitForFunction(()=>!document.querySelector('.cui-input')?.disabled,{},{timeout:180000});
 report.responseMs=Date.now()-began;report.reply=await page.locator('.cui-msg-agent').allTextContents();report.visibleErrors=await page.locator('.cui-msg-error').allTextContents();report.after=await body.evaluate(()=>(window.editor??window.Asc.editor).WordControl.m_oLogicDocument.GetText());report.documentUnchanged=report.before===report.after;report.bundles=await page.evaluate(()=>performance.getEntriesByType('resource').map(r=>r.name).filter(n=>n.includes('/assets/editor-')));
 if(!report.reply.some(r=>/hello/i.test(r))||report.visibleErrors.length||!report.documentUnchanged||report.errors.some(e=>mode!=='worker'||!e.includes('Controlled GPU Worker initialization failure')))throw Error('Actual CPU reply or document invariants failed');
 await page.screenshot({path:'.scratch/ai-csp/cpu-adapter-fallback-current.png'});report.status='passed';mark('CPU reply verified');
}catch(e){report.status='failed';report.error=String(e);}finally{report.pluginBytesUnchanged = pluginSHA256 === sha(await fs.readFile(pluginPath));await save();console.log(report.status, report.error ?? '');await context.close();if(report.status!=='passed')process.exitCode=1;}
