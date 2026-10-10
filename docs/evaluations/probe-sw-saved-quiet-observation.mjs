// Change only the first landing VERSION observation timing, not product updater behavior.
import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
const events=[];
const launch=chromium.launch.bind(chromium);
chromium.launch=async options=>{
  const browser=await launch(options);
  const newContext=browser.newContext.bind(browser);
  browser.newContext=async options=>{
    const context=await newContext(options);
    const newPage=context.newPage.bind(context);
    context.newPage=async()=>{
      const page=await newPage();
      const evaluate=page.evaluate.bind(page);
      let delayed=false;
      page.evaluate=async(expression,arg)=>{
        if(!delayed && new URL(page.url()).pathname==='/' && String(expression).includes("controller.postMessage({ type: 'VERSION' }")){
          delayed=true;
          const event={url:page.url(),started:Date.now(),quietMs:40000};events.push(event);
          await page.waitForTimeout(event.quietMs);event.finished=Date.now();
        }
        return evaluate(expression,arg);
      };
      return page;
    };
    return context;
  };
  return browser;
};
await import('./probe-sw-browser-channel.mjs');
const path=process.env.TWO_BUILD_REPORT;
const report=JSON.parse(await fs.readFile(path,'utf8'));
report.quietObservationDriver={scope:'First landing observer delayed; product updater/prefetch unchanged; diagnostic only',events,
  sha256:createHash('sha256').update(await fs.readFile(new URL(import.meta.url))).digest('hex')};
await fs.writeFile(path,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({quietObserverEvents:events}));
