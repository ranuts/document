import {chromium} from '@playwright/test';import fs from 'node:fs/promises';import {createHash} from 'node:crypto';
const report={scope:'Actual browser navigation, native Word editor, two BFCache returns then explicit local CPU load, IM literal request and native Undo/Redo/Save/reopen',errors:[],cycles:[]};
const browser=await chromium.launch({channel:'chromium',ignoreDefaultArgs:['--disable-back-forward-cache']});report.browserVersion=browser.version();const root=await browser.newBrowserCDPSession();try{const cmd=await root.send('Browser.getBrowserCommandLine');report.cacheArgs=cmd.arguments.filter(a=>/back.?forward.?cache/i.test(a));}catch(e){report.commandLineError=String(e);}const context=await browser.newContext({serviceWorkers:'block',viewport:{width:1280,height:900}});
await context.addInitScript(()=>{
Object.defineProperty(window,'showSaveFilePicker',{value:undefined,configurable:true});window.__unloadRegistrations=[];const add=EventTarget.prototype.addEventListener;EventTarget.prototype.addEventListener=function(type,listener,...rest){if(type==='unload')window.__unloadRegistrations.push({target:this===window?'window':this?.constructor?.name,source:String(listener),stack:new Error().stack});return add.call(this,type,listener,...rest);};
if(window!==top)return;localStorage.setItem('agent-panel-provider','wllama');localStorage.removeItem('agent-panel-gguf-url');window.__bfcToken=crypto.randomUUID();window.__bfcEvents=[];addEventListener('pageshow',e=>window.__bfcEvents.push({type:'show',persisted:e.persisted}));addEventListener('pagehide',e=>window.__bfcEvents.push({type:'hide',persisted:e.persisted}));});
try{const page=await context.newPage();const cdp=await context.newCDPSession(page);report.cacheDiagnostics=[];await cdp.send('Page.enable');cdp.on('Page.backForwardCacheNotUsed',e=>report.cacheDiagnostics.push(e));page.on('pageerror',e=>report.errors.push(e.message));await page.goto('http://127.0.0.1:5193/editor?new=docx&agent=1&locale=zh-CN');await page.frameLocator('#app iframe').locator('.agent-sidebar-entry').click({timeout:90000});await page.locator('.cui-input').fill('未发送的中文草稿');report.token=await page.evaluate(()=>window.__bfcToken);
report.frames=[];for(const frame of page.frames()){try{report.frames.push(await frame.evaluate(()=>({url:location.href,registered:window.__unloadRegistrations,property:String(window.onunload)})));}catch(error){report.frames.push({url:frame.url(),error:String(error)});}}
for(let cycle=0;cycle<2;cycle++){await page.goto('http://127.0.0.1:5193/?bfc-probe=1');await page.goBack({waitUntil:'commit'});await page.locator('.agent-panel').waitFor({state:'attached',timeout:90000});const row=await page.evaluate(()=>({token:window.__bfcToken,events:window.__bfcEvents,draft:document.querySelector('.cui-input')?.value,handles:document.querySelectorAll('.agent-panel-resizer').length,entries:[...document.querySelectorAll('iframe')].reduce((n,f)=>n+(f.contentDocument?.querySelectorAll('.agent-sidebar-entry').length??0),0),notRestoredReasons:performance.getEntriesByType('navigation')[0]?.notRestoredReasons?.toJSON?.()}));row.cleanupCalls=await page.evaluate(()=>[...document.querySelectorAll('iframe')].map(f=>({url:f.contentWindow?.location.href,guard:f.contentWindow?.__ooUnloadPagehidePatched===true})));report.cycles.push(row);if(row.token!==report.token)break;await page.locator('.agent-panel-resizer').press('ArrowLeft');await page.locator('.agent-panel-close').click();await page.evaluate(()=>{const button=document.querySelector('#app iframe')?.contentDocument?.querySelector('.agent-sidebar-entry');if(!button)throw Error('Missing actual cached sidebar');button.click();});if(await page.locator('.agent-panel').evaluate(el=>el.classList.contains('agent-panel-hidden')))throw Error('Native cached sidebar did not reopen panel');}
report.cached=report.cycles.length===2&&report.cycles.every(r=>r.token===report.token&&r.events.some(e=>e.type==='show'&&e.persisted)&&r.draft==='未发送的中文草稿'&&r.handles===1&&r.entries===1);

if(!report.cached)throw Error('Actual BFCache return failed');
const text=()=>page.evaluate(()=>document.querySelector('#app iframe').contentWindow.Asc.editor.WordControl.m_oLogicDocument.GetText());
report.beforeText=await text();
await page.locator('.agent-panel-settings-toggle').click();
await page.locator('.agent-panel-gguf-files').setInputFiles('.scratch/node_modules/ai-models/qwen2.5-0.5b-instruct-q4_k_m.gguf');
await page.locator('.agent-panel-gguf-load').click();
await page.waitForFunction(()=>document.querySelector('.agent-panel-note')?.textContent?.includes('模型已加载'),null,{timeout:180000});
report.loadedAfterReturn=await page.locator('.agent-model-status').textContent();
await page.locator('.agent-panel-settings-toggle').click();
await page.locator('.agent-writing-task').selectOption('tools');
await page.locator('.cui-input').fill('Insert the exact text BFC_WORD_20261005 at the cursor.');
await page.locator('.cui-input').press('Enter');
await page.waitForFunction(()=>!document.querySelector('.cui-input').disabled,null,{timeout:180000});
report.messages=await page.locator('.cui-msg').allTextContents();report.previews=await page.locator('.agent-plan-preview').count();report.editText=await text();if(!report.editText.includes('BFC_WORD_20261005'))throw Error('IM literal write missing');
await page.evaluate(()=>document.querySelector('#app iframe').contentWindow.Asc.editor.Undo());report.undoText=await text();if(report.undoText!==report.beforeText)throw Error('Undo mismatch');
await page.evaluate(()=>document.querySelector('#app iframe').contentWindow.Asc.editor.Redo());report.redoText=await text();if(report.redoText!==report.editText)throw Error('Redo mismatch');
const downloadPromise=page.waitForEvent('download',{timeout:120000});
await page.evaluate(()=>document.querySelector('#app iframe').contentDocument.querySelector('#slot-btn-dt-save button').click());
const download=await downloadPromise;const savedPath='.scratch/bfc-word-20261005.docx';await download.saveAs(savedPath);const bytes=await fs.readFile(savedPath);report.saved={path:savedPath,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),failure:await download.failure()};if(!bytes.length||report.saved.failure)throw Error('Save failed');
await page.goto('http://127.0.0.1:5193/');const chooser=page.waitForEvent('filechooser');await page.locator('#hero-open').click();await(await chooser).setFiles(savedPath);
await page.waitForFunction(()=>{const a=document.querySelector('#app iframe')?.contentWindow?.Asc?.editor;return a?.isDocumentLoadComplete&&a?.isLoadFullApi;},{},{timeout:90000});
report.reopenedText=await text();if(report.reopenedText!==report.redoText)throw Error('Reopened text mismatch');report.nativeDocumentPassed=true;

}catch(e){report.error=String(e);}finally{await browser.close();report.contextClosed=true;await fs.writeFile('.scratch/im-product-pagehide-word-loaded.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
