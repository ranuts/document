// Observe effective landing script and registration state at speculative fetch starts.
import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
const events=[],tasks=[];
const launch=chromium.launch.bind(chromium);
chromium.launch=async options=>{
  const browser=await launch(options);const newContext=browser.newContext.bind(browser);
  browser.newContext=async options=>{
    const context=await newContext(options);
    await context.exposeBinding('__upgradeTraceRecord',(_source,event)=>events.push(event));
    await context.addInitScript(()=>{
      if(location.pathname!=='/')return;
      const worker=value=>value?{state:value.state,url:value.scriptURL}:null;
      const record=async data=>{
        const time=Date.now();const reg=await navigator.serviceWorker.getRegistration();
        await window.__upgradeTraceRecord({time,url:location.href,...data,active:worker(reg?.active),waiting:worker(reg?.waiting),installing:worker(reg?.installing)});
      };
      document.addEventListener('DOMContentLoaded',()=>{void record({kind:'dom-ready'});},{capture:true});
      navigator.serviceWorker.addEventListener('controllerchange',()=>{void record({kind:'controllerchange'});});
      const fetch=window.fetch.bind(window);
      window.fetch=(...args)=>{
        if(new Error().stack?.includes('landing-prefetch.js'))void record({kind:'prefetch-fetch',request:String(args[0])});
        return fetch(...args);
      };
    });
    context.on('response',response=>{
      if(new URL(response.url()).pathname!=='/landing-prefetch.js')return;
      tasks.push((async()=>{
        const bytes=await response.body();events.push({kind:'effective-script',time:Date.now(),url:response.url(),fromServiceWorker:response.fromServiceWorker(),sha256:createHash('sha256').update(bytes).digest('hex'),hasUpgradeWatch:bytes.includes(Buffer.from('watchRegistration'))});
      })().catch(error=>events.push({kind:'script-read-error',error:String(error)})));
    });
    return context;
  };
  return browser;
};
await import('./probe-sw-browser-channel.mjs');
await Promise.allSettled(tasks);
const path=process.env.TWO_BUILD_REPORT;const report=JSON.parse(await fs.readFile(path,'utf8'));
report.prefetchUpgradeTrace={scope:'Diagnostic observations only; no prefetch stop or Worker VERSION queries added',events,
  sha256:createHash('sha256').update(await fs.readFile(new URL(import.meta.url))).digest('hex')};
await fs.writeFile(path,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({prefetchUpgradeEvents:events}));
