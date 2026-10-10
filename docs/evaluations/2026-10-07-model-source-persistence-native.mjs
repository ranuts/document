import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
const report={scope:'Synthetic marker UI persistence diagnostic; no model load, real credential or complete cache/privacy acceptance',marker:'synthetic-privacy-probe-20261007',rows:[]};let context;
try{
 context=await chromium.launch({channel:'chromium'});const page=await context.newPage();await page.goto('http://127.0.0.1:5193/editor?new=docx&agent=1&locale=zh-CN',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>typeof window.__toggleAgentPanel==='function',null,{timeout:90000});await page.evaluate(()=>window.__toggleAgentPanel());
 for(const [key,value] of [['agent-local-model-url',`https://example.invalid/models/?token=${report.marker}`],['agent-local-model-lib',`https://example.invalid/model.wasm?signature=${report.marker}`]]){
  const input=page.locator('.'+key);await input.evaluate((el,value)=>{el.value=value;el.dispatchEvent(new Event('change',{bubbles:true}));},value);
  const stored=await page.evaluate(key=>localStorage.getItem(key),key);report.rows.push({key,value,stored,fullValuePersisted:stored===value});
 }
 await page.evaluate(()=>{localStorage.removeItem('agent-local-model-url');localStorage.removeItem('agent-local-model-lib');});report.cleaned=true;report.finished=true;
}catch(e){report.error=String(e);process.exitCode=1;}finally{await context?.close();report.browserClosed=true;await fs.writeFile('.scratch/2026-10-07-model-source-persistence-native.json',JSON.stringify(report,null,2));}
