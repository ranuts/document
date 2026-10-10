import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
const context=await chromium.launchPersistentContext('.scratch/ai-offline/profile',{serviceWorkers:'block',viewport:{width:1280,height:900}});
await context.addInitScript(()=>Object.defineProperty(navigator,'gpu',{value:undefined,configurable:true}));
const report={errors:[]};
try{
 const page=context.pages()[0]??await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto('http://127.0.0.1:5193/editor?new=docx&agent=1&locale=zh-CN');
 await page.frameLocator('#app iframe').locator('.agent-sidebar-entry').click({timeout:90000});
 await page.waitForFunction(()=>document.querySelector('.agent-panel-note')?.textContent?.includes('模型已加载'),null,{timeout:600000});
 report.model=await page.locator('.agent-model-status').textContent();report.modelTitle=await page.locator('.agent-model-status').getAttribute('title');
 if(report.model!=='CPU · Qwen3 · 0.6B'||report.modelTitle!=='Qwen_Qwen3-0.6B-Q4_K_M.gguf')throw Error('Model identity mismatch');
 await page.locator('.agent-panel-clear').click();
 await page.locator('.cui-input').fill('请只回复：你好。');await page.locator('.cui-input').press('Enter');
 await page.waitForFunction(()=>!document.querySelector('.cui-input')?.disabled,null,{timeout:180000});
 report.speed=await page.locator('.agent-generation-stats').textContent();
 report.details=await page.locator('.agent-generation-details').textContent();
 report.mainDetailsVisible=await page.locator('.agent-generation-details').isVisible();
 report.previewCount=await page.locator('.agent-plan-preview').count();
 if(!report.speed.includes('token/s')||report.speed.includes(' · ')||report.mainDetailsVisible||report.previewCount)throw Error('Main statistics clutter');
 await page.screenshot({path:'.scratch/im-ui-main-after.png'});
 await page.locator('.agent-panel-settings-toggle').click();
 await page.locator('.agent-generation-options summary').click();
 await page.locator('.agent-generation-details').scrollIntoViewIfNeeded();
 if(!await page.locator('.agent-generation-details').isVisible())throw Error('Advanced metrics unavailable');
 await page.screenshot({path:'.scratch/im-ui-settings-after.png'});
 await page.setViewportSize({width:390,height:550});
 report.compact=await page.evaluate(()=>{const footer=document.querySelector('.cui-footer').getBoundingClientRect();const settings=document.querySelector('.agent-panel-settings');return {footerTop:footer.top,footerBottom:footer.bottom,footerHeight:footer.height,settingsScroll:settings.scrollHeight,settingsHeight:settings.clientHeight,panelWidth:document.querySelector('.agent-panel').getBoundingClientRect().width};});
 if(report.compact.footerBottom>551||report.compact.footerTop<0||report.compact.panelWidth>390)throw Error('Compact viewport overflow');
 await page.screenshot({path:'.scratch/im-ui-compact-after.png'});
 report.status='completed';console.log(JSON.stringify(report));
} catch(error){report.status='failed';report.error=String(error);process.exitCode=1;console.log(JSON.stringify(report));}
finally{await fs.writeFile('.scratch/im-ui-quiet-status.json',JSON.stringify(report,null,2)+'\n');await context.close();}
