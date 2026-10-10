import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
const source=await fs.readFile('lib/agent-plugin/excel-text-transaction.ts','utf8');
const pasteSource=await fs.readFile('lib/agent-plugin/excel-paste-guard.ts','utf8');
const adapterSource=await fs.readFile('lib/agent-plugin/excel-native-paste.ts','utf8');
const output=await fs.mkdtemp(path.join(os.tmpdir(),'document-excel-text-'));
let helper;
try {
 await promisify(execFile)('pnpm',['exec','tsc','--ignoreConfig','--target','ES2022','--module','ESNext','--skipLibCheck','--outDir',output,'lib/agent-plugin/excel-text-transaction.ts','lib/agent-plugin/excel-paste-guard.ts','lib/agent-plugin/excel-native-paste.ts']);
 helper=(await fs.readFile(path.join(output,'excel-text-transaction.js'),'utf8')).replace('export async function','async function');
 helper+='\n'+(await fs.readFile(path.join(output,'excel-paste-guard.js'),'utf8')).replace('export function','function');
 helper+='\n'+(await fs.readFile(path.join(output,'excel-native-paste.js'),'utf8')).replace(/^import .*;$/gm,'').replace('export function','function');
} finally {await fs.rm(output,{recursive:true,force:true});}
const report = { status: 'running', adapterSHA256:crypto.createHash('sha256').update(adapterSource).digest('hex'), pasteSHA256:crypto.createHash('sha256').update(pasteSource).digest('hex'), sourceSHA256:crypto.createHash('sha256').update(source).digest('hex'), errors: [], cases: [] };
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
  for (const originalFormat of ['General', '0.00']) for (const value of ['00123']) {
    await body.evaluate(() => { const a=window.editor??window.Asc.editor; a.asc_findCell('B2'); a.pluginMethod_PasteText('30'); });
    await page.waitForTimeout(100);
    const snapshot = () => body.evaluate(() => { const a=window.editor??window.Asc.editor; const r=a.wb.getWorksheet().model.getRange3(1,1,1,1); return { value:r.getValue(), format:r.getNumFormat().sFormat, type:r.getType?.(), raw:r.getValueWithoutFormat?.(), edit:r.getValueForEdit?.() }; });
    await body.evaluate((_el,format)=>{(window.editor??window.Asc.editor).asc_setCellFormat(format);},originalFormat);
    await page.waitForTimeout(100);
    const before = await snapshot();
    const completion = await body.evaluate(`(async (_el,{value,originalFormat}) => {
      ${helper}
      const a=window.editor??window.Asc.editor, h=window.AscCommon.History;
      a.asc_findCell('B2');
      const model=a.wb.getWorksheet().model;
      let release, failure;
      try { await withExcelTextFormat({
        originalFormat,
        isCurrent:()=>a.wb.getWorksheet().model===model,
        createPoint:()=>h.Create_NewPoint(),
        startTransaction:()=>h.StartTransaction(),
        endTransaction:()=>h.EndTransaction(),
        setFormat:format=>a.asc_setCellFormat(format)
      },async()=>{
        const view=a.wb.getWorksheet();
        const original=view._loadFonts;
        const hold=function(fonts,insert){
          release=()=>new Promise(resolve=>original.call(view,fonts,()=>{insert();resolve();}));
        };
        view._loadFonts=hold;
        const abort=new AbortController();
        const pending=pasteExcelText(a,view,window.AscCommon.c_oAscClipboardDataFormat.Text,value,{
          isCurrent:()=>a.wb.getWorksheet().model===model,
          signal:abort.signal,
          endPaste:()=>window.AscCommon.g_specialPasteHelper.Paste_Process_End()
        });
        try {
          if(!release)throw Error('Native preparation was not deferred');
          abort.abort(new DOMException('Stopped','AbortError'));
          await pending;
        } finally {if(view._loadFonts===hold)view._loadFonts=original;}
      }); } catch(error) { failure={name:error.name,message:error.message}; }
      const restoredBeforeRelease=model.getRange3(1,1,1,1).getNumFormat().sFormat;
      if(release)await release();
      return {failure,restoredBeforeRelease,latePreparationReleased:!!release};
    })(null,${JSON.stringify({value,originalFormat})})`);
    const after = await snapshot();
    await body.evaluate(() => { (window.editor??window.Asc.editor).asc_Undo(); });
    await page.waitForTimeout(100); const undo = await snapshot();
    await body.evaluate(() => { (window.editor??window.Asc.editor).asc_Redo(); });
    await page.waitForTimeout(100); const redo = await snapshot();
    report.cases.push({ value, originalFormat, completion, before, after, undo, redo });
  }
  report.status='completed';
} catch(e) { report.status='failed'; report.error=String(e); process.exitCode=1; }
finally { await browser.close(); await fs.writeFile('docs/evaluations/2026-10-04-excel-native-paste-adapter-cancellation.json',JSON.stringify(report,null,2)+'\n'); }
console.log(report.status, report.error??'');
