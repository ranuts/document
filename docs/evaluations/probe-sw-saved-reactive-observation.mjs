// Observe controllerchange before querying VERSION; no fixed sleep or active Worker polling during this wait.
import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
const stopPrefetch=process.env.REACTIVE_STOP_PREFETCH==='1';
const events=[],observations=[];
const launch=chromium.launch.bind(chromium);
chromium.launch=async options=>{
  const browser=await launch(options);
  const newContext=browser.newContext.bind(browser);
  browser.newContext=async options=>{
    const context=await newContext(options);
    await context.exposeBinding('__reactiveControlRecord',(_source,event)=>events.push(event));
    await context.addInitScript(({stopPrefetch})=>{
      if(location.pathname!=='/')return;
      const record=data=>window.__reactiveControlRecord({time:Date.now(),url:location.href,...data});
      window.__reactiveControllerChanges=[];
      navigator.serviceWorker.addEventListener('controllerchange',()=>{
        const event={kind:'controllerchange',controller:navigator.serviceWorker.controller?.scriptURL,time:Date.now()};
        window.__reactiveControllerChanges.push(event);record(event);
      });
      const fetch=window.fetch.bind(window);
      window.fetch=(...args)=>{
        if(new Error().stack?.includes('landing-prefetch.js'))record({kind:'prefetch-fetch',request:String(args[0])});
        return fetch(...args);
      };
      document.addEventListener('DOMContentLoaded',()=>{
        const hook=window.__landingPrefetch;
        if(!hook){record({kind:'missing-hook'});return;}
        if(stopPrefetch)hook.stopWarming();
        record({kind:'prefetch-state',stopPrefetch,leaving:hook.isLeaving()});
      },{capture:true});
    },{stopPrefetch});
    const newPage=context.newPage.bind(context);
    context.newPage=async()=>{
      const page=await newPage();const evaluate=page.evaluate.bind(page);let observed=false;
      page.evaluate=async(expression,arg)=>{
        if(!observed && new URL(page.url()).pathname==='/' && String(expression).includes("controller.postMessage({ type: 'VERSION' }")){
          observed=true;
          const row={url:page.url(),started:Date.now(),boundMs:55000};observations.push(row);
          row.result=await evaluate(()=>new Promise(resolve=>{
            if(window.__reactiveControllerChanges?.length){resolve({reason:'already-observed',event:window.__reactiveControllerChanges.at(-1)});return;}
            const done=reason=>{
              clearTimeout(timer);navigator.serviceWorker.removeEventListener('controllerchange',changed);
              resolve({reason,event:window.__reactiveControllerChanges?.at(-1)});
            };
            const changed=()=>done('controllerchange');
            const timer=setTimeout(()=>done('timeout'),55000);
            navigator.serviceWorker.addEventListener('controllerchange',changed);
          }));
          row.finished=Date.now();
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
report.reactiveObservationDriver={scope:'Event-based diagnostic observer; product updater unchanged; prefetch runtime control explicitly recorded',
  stopPrefetch,events,observations,sha256:createHash('sha256').update(await fs.readFile(new URL(import.meta.url))).digest('hex')};
await fs.writeFile(path,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({stopPrefetch,reactiveObservations:observations}));
