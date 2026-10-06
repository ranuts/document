import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
const modules=['editor-action','native-redo','excel-cell-format','excel-history-group','excel-history-ownership','excel-native-paste','excel-paste-guard','excel-text-preflight','excel-text-transaction','excel-text-write'];
const dir=await fs.mkdtemp(path.join(os.tmpdir(),'excel-writer-'));
const hashes={};let helper='';
try {
 await promisify(execFile)('pnpm',['exec','tsc','--ignoreConfig','--target','ES2022','--module','ESNext','--skipLibCheck','--outDir',dir,...modules.map(m=>`lib/agent-plugin/${m}.ts`)]);
 for(const m of modules){hashes[m]=crypto.createHash('sha256').update(await fs.readFile(`lib/agent-plugin/${m}.ts`)).digest('hex');helper+='\n'+(await fs.readFile(path.join(dir,`${m}.js`),'utf8')).replace(/^import .*;$/gm,'').replace(/export (async )?function/g,'$1function');}
}finally{await fs.rm(dir,{recursive:true,force:true});}
const report={status:'running',hashes,cases:[],errors:[]};
const browser=await chromium.launch();const page=await browser.newPage();
page.on('pageerror',e=>report.errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:5193/editor?new=xlsx&locale=en');
 const body=page.frameLocator('#app iframe').locator('body');
 await body.evaluate(()=>new Promise((resolve,reject)=>{const start=Date.now();const poll=()=>{const a=window.editor??window.Asc?.editor;if(a?.isDocumentLoadComplete&&a?.isLoadFullApi)resolve();else if(Date.now()-start>60000)reject(Error('Editor timeout'));else setTimeout(poll,50);};poll();}));
 for(const originalFormat of ['General','0.00']) for(const mode of ['success','cancel','foreign','foreignStop','postCompleteForeign','postCompleteForeignStop']){
  await body.evaluate((_el,fmt)=>{const a=window.editor??window.Asc.editor;a.asc_findCell('B2');a.pluginMethod_PasteText('30');a.asc_setCellFormat(fmt);},originalFormat);
  await page.waitForTimeout(100);
  await body.evaluate(()=>{(window.editor??window.Asc.editor).pluginMethod_PasteText('40');});await page.waitForTimeout(100);
  await body.evaluate(()=>{(window.editor??window.Asc.editor).asc_Undo();});await page.waitForTimeout(100);
  const result=await body.evaluate(`(async()=>{
   ${helper}
   const a=window.editor??window.Asc.editor,h=window.AscCommon.History,view=a.wb.getWorksheet(),model=view.model,cell=model.getRange3(1,1,1,1),paste=window.AscCommon.g_specialPasteHelper;
   const documentCurrent=()=>window.AscCommon.History===h&&(window.editor??window.Asc.editor)===a;
   const scope={api:a,view,model,cell,history:h,nativeRange:new window.Asc.Range(1,1,1,1),readonly:false,
    codes:{BlockInteraction:window.Asc.c_oAscAsyncActionType.BlockInteraction,ApplyChanges:window.Asc.c_oAscAsyncAction.ApplyChanges},
    clipboardFormat:window.AscCommon.c_oAscClipboardDataFormat.Text,closedGroupDescription:window.AscDFH.historydescription_GroupPoints,
    isCurrent:()=>documentCurrent()&&a.wb.getWorksheet()===view,isDocumentCurrent:documentCurrent,
    endPaste:()=>{if(window.AscCommon.g_specialPasteHelper===paste&&paste.Api===a)paste.Paste_Process_End();}};
   const backupDepthBefore=h.StoredData.length,oldFuture=h.Points.slice(h.Index+1);
   const before={value:cell.getValue(),format:cell.getNumFormat().sFormat};
   let release,failure;const original=view._loadFonts,abort=new AbortController();
   if(${JSON.stringify(mode)}!=='success')view._loadFonts=function(fonts,cb){release=()=>new Promise(resolve=>original.call(view,fonts,()=>{cb();if(${JSON.stringify(mode)}.startsWith('postComplete')){model.getRange3(2,2,2,2).setNumFormat(${JSON.stringify(mode==='postCompleteForeignStop'?'0.0000':'0.000')});if(${JSON.stringify(mode)}==='postCompleteForeignStop')abort.abort();}resolve();}));};
   try{
    const outcome=writeExcelLiteralText(scope,'00123',abort.signal).then(()=>({}),error=>({failure:{name:error.name,message:error.message}}));
    if(${JSON.stringify(mode)}==='cancel'){if(!release)throw Error('Font callback not deferred');abort.abort();}
    if(${JSON.stringify(mode)}==='foreign'||${JSON.stringify(mode)}==='foreignStop'){if(!release)throw Error('Font callback not deferred');model.getRange3(2,2,2,2).setNumFormat(${JSON.stringify(mode==='foreignStop'?'0.0':(originalFormat==='General'?'0%':'0.00'))});if(${JSON.stringify(mode)}==='foreignStop')abort.abort();else await release();}
    if(${JSON.stringify(mode)}.startsWith('postComplete')){if(!release)throw Error('Font callback not deferred');await release();}
    ({failure}=await outcome);
    if(release)await release();
   }finally{if(view._loadFonts!==original)view._loadFonts=original;}
   return {before,failure,backupDepthBefore,backupDepthAfter:h.StoredData.length,oldFuturePresent:oldFuture.every(point=>h.Points.includes(point)),after:{value:cell.getValue(),format:cell.getNumFormat().sFormat},foreignFormat:model.getRange3(2,2,2,2).getNumFormat().sFormat,groupIndex:h._getLongPointIndex(),busy:a.isLongAction()};
  })()`);
  if(mode==='success'){
   await body.evaluate(()=>{(window.editor??window.Asc.editor).asc_Undo();});await page.waitForTimeout(100);
   result.undo=await body.evaluate(()=>{const r=(window.editor??window.Asc.editor).wb.getWorksheet().model.getRange3(1,1,1,1);return {value:r.getValue(),format:r.getNumFormat().sFormat};});
   await body.evaluate(()=>{(window.editor??window.Asc.editor).asc_Redo();});await page.waitForTimeout(100);
   result.redo=await body.evaluate(()=>{const r=(window.editor??window.Asc.editor).wb.getWorksheet().model.getRange3(1,1,1,1);return {value:r.getValue(),format:r.getNumFormat().sFormat};});
  }
  report.cases.push({mode,originalFormat,...result});
 }
 report.status='completed';
}catch(error){report.status='failed';report.error=String(error);process.exitCode=1;}
finally{await browser.close();await fs.writeFile('docs/evaluations/2026-10-04-excel-text-write-native.json',JSON.stringify(report,null,2)+'\n');}
console.log(report.status,report.error??'');
