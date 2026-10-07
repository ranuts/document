import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
const fixtures=JSON.parse(await fs.readFile('docs/evaluations/2026-10-07-gemma4-sampling-seven-language-cases.json','utf8'));
const source=fixtures.find(x=>x.id==='ko-rewrite').source;
const r={scope:'Native input readiness only; no model inference',source,errors:[],failures:[],fonts:[],samples:[]};
const b=await chromium.launch({channel:'chromium'});const c=await b.newContext({serviceWorkers:'block'});
try{
const p=await c.newPage();p.on('pageerror',e=>r.errors.push(e.message));p.on('requestfailed',q=>r.failures.push({url:q.url(),error:q.failure()?.errorText}));p.on('response',q=>{if(q.url().includes('/fonts/'))r.fonts.push({url:q.url(),status:q.status()});});
await p.goto('http://127.0.0.1:5193/editor?new=docx&locale=zh-CN');
await p.waitForFunction(()=>{const a=document.querySelector('#app iframe')?.contentWindow?.Asc?.editor;return a?.isDocumentLoadComplete&&a?.isLoadFullApi;},null,{timeout:90000});
await p.evaluate(source=>{const a=document.querySelector('#app iframe').contentWindow.Asc.editor;a.pluginMethod_InputText(source);a.asc_EditSelectAll();},source);
const read=()=>p.evaluate(()=>{const a=document.querySelector('#app iframe').contentWindow.Asc.editor;return {text:a.WordControl.m_oLogicDocument.GetText(),selection:a.pluginMethod_GetSelectedText()};});
r.samples.push({phase:'immediate',...await read()});
try{await p.waitForFunction(source=>document.querySelector('#app iframe').contentWindow.Asc.editor.WordControl.m_oLogicDocument.GetText()===source+'\r\n',source,{timeout:90000});r.inserted=true;}catch(e){r.inserted=false;r.waitError=String(e);}
r.samples.push({phase:'after insertion wait',...await read()});
await p.evaluate(()=>document.querySelector('#app iframe').contentWindow.Asc.editor.asc_EditSelectAll());r.samples.push({phase:'reselect',...await read()});
}catch(e){r.error=String(e);}finally{await c.close();await b.close();r.closed=true;await fs.writeFile('.scratch/2026-10-07-korean-native-input-readiness.json',JSON.stringify(r,null,2));console.log(JSON.stringify(r));}
