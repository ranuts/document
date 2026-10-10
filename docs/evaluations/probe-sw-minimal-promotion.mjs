import { chromium } from '@playwright/test';
import http from 'node:http';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
let version = 'old';
const server = http.createServer((req, res) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  res.setHeader('Cache-Control', 'no-cache');
  if (req.url.startsWith('/sw.js')) {
    res.setHeader('Content-Type', 'application/javascript');
    res.end(`const VERSION = ${JSON.stringify(version)};
      self.addEventListener('install', event => { if(VERSION === 'old') self.skipWaiting(); });
      self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
      self.addEventListener('message', event => {
        if(event.data.type === 'VERSION') event.ports[0].postMessage({version:VERSION});
        if(event.data.type === 'SKIP_WAITING') {self.skipWaiting(); if(event.ports[0]) event.ports[0].postMessage({received:true,version:VERSION});}
      });`);
  } else { res.setHeader('Content-Type','text/html'); res.end('<!doctype html><title>Owned minimal SW control</title>'); }
});
await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
const origin = 'http://127.0.0.1:' + server.address().port;
const browser = await chromium.launch();
const page = await browser.newPage();
const report = {nativeBlobDownload: process.env.MINIMAL_DOWNLOAD === '1', scope:'Isolated bare SW positive control, no product/cache/editor workflow', browserVersion:browser.version(), probeSha256:createHash('sha256').update(await fs.readFile(new URL(import.meta.url))).digest('hex')};
const ask = target => page.evaluate(async target => {
  const reg = await navigator.serviceWorker.getRegistration();
  const worker = target === 'waiting' ? reg.waiting : navigator.serviceWorker.controller;
  if(!worker) return null;
  return new Promise(resolve => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => {channel.port1.close(); resolve(null);},1000);
    channel.port1.onmessage = event => {clearTimeout(timer); channel.port1.close(); resolve(event.data);};
    worker.postMessage({type:'VERSION'},[channel.port2]);
  });
},target);
try {
  await page.goto(origin);
  await page.evaluate(() => navigator.serviceWorker.register('/sw.js?isolation=1'));
  const initialDeadline = Date.now()+15000;
  do {report.initial=await ask('active'); if(report.initial?.version === 'old') break; await page.waitForTimeout(100);} while(Date.now()<initialDeadline);
  if(report.initial?.version !== 'old') throw Error('Baseline control missing');
  if (report.nativeBlobDownload) {
    const downloadPending = page.waitForEvent('download');
    await page.evaluate(() => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob(['SW_BLOB_CONTROL']));
      a.download = 'sw-control.txt';
      document.body.append(a);
      a.click();
      a.remove();
    });
    const download = await downloadPending;
    const artifact = '/private/tmp/document-sw-promotion-control-download.txt';
    await download.saveAs(artifact);
    report.download = {failure:await download.failure(),text:await fs.readFile(artifact,'utf8')};
    if(report.download.failure || report.download.text !== 'SW_BLOB_CONTROL') throw Error('Native Blob control save failed');
  }
  version='new';
  await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
  const waitingDeadline=Date.now()+15000;
  do {report.waiting=await ask('waiting'); if(report.waiting?.version === 'new') break; await page.waitForTimeout(100);} while(Date.now()<waitingDeadline);
  if(report.waiting?.version !== 'new') throw Error('Waiting positive control missing');
  await page.goto(origin);
  report.delivery = await page.evaluate(async () => {
    const worker=(await navigator.serviceWorker.getRegistration()).waiting;
    return new Promise(resolve => {
      const channel=new MessageChannel();
      const timer=setTimeout(() => {channel.port1.close(); resolve(null);},1000);
      channel.port1.onmessage=event => {clearTimeout(timer); channel.port1.close(); resolve(event.data);};
      worker.postMessage({type:'SKIP_WAITING'},[channel.port2]);
    });
  });
  const deadline=Date.now()+15000;
  do {report.final=await ask('active'); if(report.final?.version === 'new') break; await page.waitForTimeout(100);} while(Date.now()<deadline);
  report.passed=report.delivery?.received === true && report.final?.version === 'new';
  if(!report.passed) process.exitCode=1;
} catch(error) {report.error=String(error);report.passed=false;process.exitCode=1;}
finally {await fs.writeFile(process.env.MINIMAL_REPORT || 'docs/evaluations/2026-10-03-sw-minimal-promotion.json',JSON.stringify(report,null,2)+'\n');await browser.close();await new Promise(resolve => server.close(resolve));console.log(JSON.stringify(report));}
