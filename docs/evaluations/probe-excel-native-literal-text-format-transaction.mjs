import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
const report = { status: 'running', errors: [], cases: [] };
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
  for (const value of ['00123', '1e3', '2026-10-04', '99', "'quoted", 'text', '12345678901234567890']) {
    await body.evaluate(() => { const a=window.editor??window.Asc.editor; a.asc_findCell('B2'); a.pluginMethod_PasteText('30'); });
    await page.waitForTimeout(100);
    const snapshot = () => body.evaluate(() => { const a=window.editor??window.Asc.editor; const r=a.wb.getWorksheet().model.getRange3(1,1,1,1); return { value:r.getValue(), format:r.getNumFormat().sFormat, type:r.getType?.(), raw:r.getValueWithoutFormat?.(), edit:r.getValueForEdit?.() }; });
    const before = await snapshot();
    await body.evaluate((_el,value) => { const a=window.editor??window.Asc.editor; a.asc_findCell('B2'); window.AscCommon.History.Create_NewPoint(); window.AscCommon.History.StartTransaction(); a.asc_setCellFormat('@'); a.pluginMethod_PasteText(value); },value);
    await page.waitForTimeout(100);
    await body.evaluate(() => { const a=window.editor??window.Asc.editor; a.asc_setCellFormat('General'); window.AscCommon.History.EndTransaction(); });
    await page.waitForTimeout(100);
    const after = await snapshot();
    await body.evaluate(() => { (window.editor??window.Asc.editor).asc_Undo(); });
    await page.waitForTimeout(100); const undo = await snapshot();
    await body.evaluate(() => { (window.editor??window.Asc.editor).asc_Redo(); });
    await page.waitForTimeout(100); const redo = await snapshot();
    report.cases.push({ value, before, after, undo, redo });
  }
  report.status='completed';
} catch(e) { report.status='failed'; report.error=String(e); process.exitCode=1; }
finally { await browser.close(); await fs.writeFile('docs/evaluations/2026-10-04-excel-native-literal-text-format-transaction.json',JSON.stringify(report,null,2)+'\n'); }
console.log(report.status, report.error??'');
