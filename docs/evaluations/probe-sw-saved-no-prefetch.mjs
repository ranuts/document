// Diagnostic only: stop the existing landing prefetcher before its DOMContentLoaded handler.
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
    await context.exposeBinding('__prefetchControlRecord',(_source,event)=>events.push(event));
    await context.addInitScript(()=>{
      if(location.pathname!=='/')return;
      const record=data=>window.__prefetchControlRecord({time:Date.now(),url:location.href,...data});
      const fetch=window.fetch.bind(window);
      window.fetch=(...args)=>{
        if(new Error().stack?.includes('landing-prefetch.js'))record({kind:'prefetch-fetch',request:String(args[0])});
        return fetch(...args);
      };
      document.addEventListener('DOMContentLoaded',()=>{
        const hook=window.__landingPrefetch;
        if(!hook){record({kind:'missing-hook'});return;}
        hook.stopWarming();record({kind:'stopped',leaving:hook.isLeaving()});
      },{capture:true});
    });
    return context;
  };
  return browser;
};
await import('./probe-sw-saved-quiet-observation.mjs');
const path=process.env.TWO_BUILD_REPORT;
const report=JSON.parse(await fs.readFile(path,'utf8'));
report.prefetchControlDriver={scope:'Runtime diagnostic stopWarming before landing warm-up; artifacts unchanged; not product acceptance',events,
  sha256:createHash('sha256').update(await fs.readFile(new URL(import.meta.url))).digest('hex')};
await fs.writeFile(path,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({prefetchControlEvents:events}));
