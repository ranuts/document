import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
const source=await fs.readFile('lib/agent-plugin/excel-text-transaction.ts','utf8');
const output=await fs.mkdtemp(path.join(os.tmpdir(),'document-excel-text-'));
let helper;
try {
 await promisify(execFile)('pnpm',['exec','tsc','--ignoreConfig','--target','ES2022','--module','ESNext','--skipLibCheck','--outDir',output,'lib/agent-plugin/excel-text-transaction.ts']);
 helper=(await fs.readFile(path.join(output,'excel-text-transaction.js'),'utf8')).replace('export async function','async function');
} finally {await fs.rm(output,{recursive:true,force:true});}
const report = { status: 'running', sourceSHA256:crypto.createHash('sha256').update(source).digest('hex'), errors: [], cases: [] };
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', e => report.errors.push(e.message));
try {
  await page.goto('http://127.0.0.1:5193/editor?new=xlsx&locale=en');
  const body = page.frameLocator('#app iframe').locator('body');
  await body.evaluate(() => new Promise((resolve, reject) => {
    const start = Date.now();
    const poll = () => { const a = window.editor ?? window.Asc?.editor; if (a?.isDocumentLoadComplete && a?.isLoadFullApi) resolve(); else if (Date.now()-start>60000) reject(Error('Editor timeout')); else setTimeout(poll,50); }; poll();
  }));
  for (const originalFormat of ['General', '0.00']) for (const value of ['00123', '1e3', '2026-10-04', '99', "'quoted", 'text', '12345678901234567890']) {
    await body.evaluate(() => { const a=window.editor??window.Asc.editor; a.asc_findCell('B2'); a.pluginMethod_PasteText('30'); });
    await page.waitForTimeout(100);
    const snapshot = () => body.evaluate(() => { const a=window.editor??window.Asc.editor; const r=a.wb.getWorksheet().model.getRange3(1,1,1,1); return { value:r.getValue(), format:r.getNumFormat().sFormat, type:r.getType?.(), raw:r.getValueWithoutFormat?.(), edit:r.getValueForEdit?.() }; });
    await body.evaluate((_el,format)=>{(window.editor??window.Asc.editor).asc_setCellFormat(format);},originalFormat);
    await page.waitForTimeout(100);
    const before = await snapshot();
    const completion = await body.evaluate(`async (_el,{value,originalFormat}) => {
      ${helper}
      const a=window.editor??window.Asc.editor, h=window.AscCommon.History;
      a.asc_findCell('B2');
      const model=a.wb.getWorksheet().model;
      return await withExcelTextFormat({
        originalFormat,
        isCurrent:()=>a.wb.getWorksheet().model===model,
        createPoint:()=>h.Create_NewPoint(),
        startTransaction:()=>h.StartTransaction(),
        endTransaction:()=>h.EndTransaction(),
        setFormat:format=>a.asc_setCellFormat(format)
      },()=>new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>reject(Error('Native completion timed out')),10000);
        try { a.asc_PasteData(window.AscCommon.c_oAscClipboardDataFormat.Text,value,undefined,undefined,undefined,ok=>{
          clearTimeout(timer); if(ok===false)reject(Error('Paste rejected')); else resolve({ok:ok??null});
        }); } catch(e) {clearTimeout(timer);reject(e);}
      }));
    }`,{value,originalFormat});
    const after = await snapshot();
    await body.evaluate(() => { (window.editor??window.Asc.editor).asc_Undo(); });
    await page.waitForTimeout(100); const undo = await snapshot();
    await body.evaluate(() => { (window.editor??window.Asc.editor).asc_Redo(); });
    await page.waitForTimeout(100); const redo = await snapshot();
    report.cases.push({ value, originalFormat, completion, before, after, undo, redo });
  }
  report.status='completed';
} catch(e) { report.status='failed'; report.error=String(e); process.exitCode=1; }
finally { await browser.close(); await fs.writeFile('docs/evaluations/2026-10-04-excel-text-transaction-expression-diagnostic.json',JSON.stringify(report,null,2)+'\n'); }
console.log(report.status, report.error??'');
