import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
const source = await fs.readFile('lib/agent-plugin/excel-text-preflight.ts', 'utf8');
const output = await fs.mkdtemp(path.join(os.tmpdir(), 'document-preflight-'));
let helper;
try {
  await promisify(execFile)('pnpm', ['exec','tsc','--ignoreConfig','--target','ES2022','--module','ESNext','--skipLibCheck','--outDir',output,'lib/agent-plugin/excel-text-preflight.ts']);
  helper = (await fs.readFile(path.join(output,'excel-text-preflight.js'),'utf8')).replace('export function','function');
} finally { await fs.rm(output, {recursive:true,force:true}); }
const report = { status:'running', sourceSHA256:crypto.createHash('sha256').update(source).digest('hex'), errors:[], cases:[] };
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', e=>report.errors.push(e.message));
try {
  await page.goto('http://127.0.0.1:5193/editor?new=xlsx&locale=en');
  const body = page.frameLocator('#app iframe').locator('body');
  await body.evaluate(()=>new Promise((resolve,reject)=>{const start=Date.now();const poll=()=>{const a=window.editor??window.Asc?.editor;if(a?.isDocumentLoadComplete&&a?.isLoadFullApi)resolve();else if(Date.now()-start>60000)reject(Error('Editor timeout'));else setTimeout(poll,50);};poll();}));
  await body.evaluate(()=>{const a=window.editor??window.Asc.editor;a.asc_findCell('B2');a.pluginMethod_PasteText('30');});
  await page.waitForTimeout(100);
  const check = name => body.evaluate(`(()=>{${helper}
    const a=window.editor??window.Asc.editor,m=a.wb.getWorksheet().model,c=m.getRange3(1,1,1,1),h=window.AscCommon.History;
    const snapshot=()=>({value:c.getValue(),format:c.getNumFormat().sFormat,index:h.Index,points:h.Points.length,protected:m.getSheetProtection(),merged:!!c.hasMerged()});
    const before=snapshot();let error;
    try {assertExcelTextWritable(a,m,c,new window.Asc.Range(1,1,1,1),false);}catch(e){error=e.message;}
    return {name:${JSON.stringify(name)},error:error??null,before,after:snapshot()};
  })()`);
  report.cases.push(await check('normal'));
  await body.evaluate(()=>{const a=window.editor??window.Asc.editor;a.wb.getWorksheet().model.getRange3(1,1,1,2).merge(window.Asc.c_oAscMergeOptions.Merge);});
  report.cases.push(await check('merged'));
  await body.evaluate(()=>{(window.editor??window.Asc.editor).asc_Undo();});
  await page.waitForTimeout(100);
  await body.evaluate(()=>{const a=window.editor??window.Asc.editor,p=a.asc_getProtectedSheet();p.setSheet(true);a.asc_setProtectedSheet(p);});
  await body.evaluate(()=>new Promise((resolve,reject)=>{const start=Date.now();const poll=()=>{const a=window.editor??window.Asc.editor;if(a.wb.getWorksheet().model.getSheetProtection())resolve();else if(Date.now()-start>10000)reject(Error('Protection timeout'));else setTimeout(poll,20);};poll();}));
  report.cases.push(await check('protected'));
  report.status='completed';
} catch(e) {report.status='failed';report.error=String(e);process.exitCode=1;}
finally {await browser.close();await fs.writeFile('docs/evaluations/2026-10-04-excel-text-preflight-native.json',JSON.stringify(report,null,2)+'\n');}
console.log(report.status,report.error??'');
