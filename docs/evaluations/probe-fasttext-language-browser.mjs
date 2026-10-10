import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const origin='http://127.0.0.1:5193', prefix=origin+'/language-probe/';
const base='/private/tmp/document-language-fasttext';
const native=JSON.parse(await fs.readFile('docs/evaluations/2026-10-04-fasttext-language-native.json','utf8'));
const texts=native.pairs.flatMap(p=>[p.source,p.output]).concat(native.controls.map(c=>c.text));
const worker=`import create from './language_probe.js';
const begin=performance.now();const module=await create();
const bytes=new Uint8Array(await (await fetch('./lid.176.ftz')).arrayBuffer());
module.FS.writeFile('/model.ftz',bytes);const classifier=new module.LanguageProbe();classifier.load('/model.ftz');
postMessage({ready:true,initMs:performance.now()-begin,linearMemoryBytes:module.HEAPU8?.length ?? null});
onmessage=({data})=>{const start=performance.now();const predictions=data.map(text=>classifier.predict(text.split(String.fromCharCode(10)).join(' ')));postMessage({predictions,inferenceMs:performance.now()-start,linearMemoryBytes:module.HEAPU8?.length ?? null});};`;
const entries={
'':{body:'<!doctype html><meta charset="UTF-8"><title>Isolated language probe</title>',type:'text/html'},
'worker.js':{body:worker,type:'text/javascript'},
'language_probe.js':{body:await fs.readFile(base+'/webassembly/language_probe.js'),type:'text/javascript'},
'language_probe.wasm':{body:await fs.readFile(base+'/webassembly/language_probe.wasm'),type:'application/wasm'},
'lid.176.ftz':{body:await fs.readFile('/private/tmp/document-language-lid176.ftz'),type:'application/octet-stream'},
};
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const report={scope:'Actual dedicated module Worker fastText Wasm classification in isolated Chromium; route-local experiment, warmed initialized worker tested offline. Not shipped hosting/CSP, reload/cold-offline or calibrated acceptance.',driverSHA256:sha(await fs.readFile(new URL(import.meta.url))),bindingSHA256:sha(await fs.readFile(base+'/language_probe.cc')),artifacts:Object.fromEntries(Object.entries(entries).map(([k,v])=>[k,{bytes:Buffer.byteLength(v.body),sha256:sha(v.body)}])),errors:[],requests:[],nativeReportSHA256:sha(await fs.readFile('docs/evaluations/2026-10-04-fasttext-language-native.json'))};
const b=await chromium.launch();const c=await b.newContext({serviceWorkers:'block'});await c.route('**/*',async route=>{const url=route.request().url();report.requests.push(url);if(!url.startsWith(prefix)||!(url.slice(prefix.length) in entries))return route.abort();const e=entries[url.slice(prefix.length)];await route.fulfill({status:200,contentType:e.type,body:e.body});});const p=await c.newPage();p.on('pageerror',e=>report.errors.push(e.message));
try{await p.goto(prefix);await p.evaluate(()=>{window.worker=new Worker('./worker.js',{type:'module'});window.worker.onmessage=({data})=>{if(data.ready)window.ready=data;else window.result=data;};window.worker.onerror=e=>{window.workerError=e.message;};});await p.waitForFunction(()=>window.ready||window.workerError,null,{timeout:60000});report.ready=await p.evaluate(()=>window.ready);if(!report.ready)throw Error(await p.evaluate(()=>window.workerError));const before=report.requests.length;await c.setOffline(true);await p.evaluate(texts=>window.worker.postMessage(texts),texts);await p.waitForFunction(()=>window.result,null,{timeout:30000});report.offline=await p.evaluate(()=>!navigator.onLine);report.result=await p.evaluate(()=>window.result);report.requestsAfterOffline=report.requests.slice(before);const expected=native.pairs.flatMap(x=>[x.sourcePredictions,x.outputPredictions]).concat(native.controls.map(x=>x.predictions));report.nativeParity=expected.every((row,i)=>row.every((x,j)=>x.language===report.result.predictions[i][j].language&&Math.abs(x.score-report.result.predictions[i][j].score)<1e-5));report.passed=report.nativeParity&&report.offline&&!report.requestsAfterOffline.length&&!report.errors.length;await p.evaluate(()=>window.worker.terminate());}catch(e){report.passed=false;report.error=String(e);}finally{await b.close();await fs.writeFile('docs/evaluations/2026-10-04-fasttext-language-browser.json',JSON.stringify(report,null,2)+'\n');}console.log(report.passed,report.ready,report.result?.inferenceMs,report.error??'');
