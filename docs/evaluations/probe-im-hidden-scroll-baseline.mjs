import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
const context=await chromium.launchPersistentContext('.scratch/ai-offline/profile',{serviceWorkers:'block',viewport:{width:1280,height:900}});
await context.addInitScript(()=>Object.defineProperty(navigator,'gpu',{value:undefined,configurable:true}));
const page=context.pages()[0]??await context.newPage();
const report={scope:'Actual production IM keyboard navigation in isolated Chromium with GPU disabled. Empty-state and completed CPU reply; no user browser.',errors:[]};
page.on('pageerror',e=>report.errors.push(e.message));
try {
 await page.goto('http://127.0.0.1:5193/editor?new=docx&agent=1&locale=en');
 await page.frameLocator('#app iframe').locator('.agent-sidebar-entry').click({timeout:60000});
 await page.waitForFunction(()=>document.querySelector('.agent-panel-note')?.textContent?.includes('Model loaded'),{},{timeout:180000});
 await page.locator('.cui-input').focus(); await page.keyboard.press('Shift+Tab');
 report.empty=await page.evaluate(()=>({focused:document.activeElement?.className,opacity:getComputedStyle(document.activeElement).opacity,visibility:getComputedStyle(document.activeElement).visibility}));
 await page.locator('.cui-input').fill('Please reply with only hello.');await page.locator('.cui-input').press('Enter');
 await page.waitForFunction(()=>!document.querySelector('.cui-input')?.disabled,{},{timeout:120000});
 report.reply=await page.locator('.cui-msg-agent').last().getAttribute('data-source');
 await page.locator('.cui-input').focus(); await page.keyboard.press('Shift+Tab');
 report.completed=await page.evaluate(()=>({focused:document.activeElement?.className,opacity:getComputedStyle(document.activeElement).opacity,visibility:getComputedStyle(document.activeElement).visibility}));
 report.reproduced=[report.empty,report.completed].every(r=>r.focused.includes('cui-scroll-bottom')&&r.opacity==='0');
} finally {await fs.writeFile('docs/evaluations/2026-10-03-im-hidden-scroll-baseline.json',JSON.stringify(report,null,2)+'\n');console.log(report);await context.close();}
