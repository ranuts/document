import { createServer } from 'vite';
import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const hash = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const server = await createServer({ configFile: false, root: process.cwd(), server: { host: '127.0.0.1', port: 0 }, logLevel: 'error',
  plugins: [{ name: 'chat-motion-harness', configureServer(server) {
    server.middlewares.use('/__chat_motion', async (_req, res) => {
      res.setHeader('Content-Type', 'text/html');
      res.end(await server.transformIndexHtml('/__chat_motion', '<!doctype html><script type="module">import {ChatView} from "/packages/chat-ui/src/chat-view.ts"; window.ChatView=ChatView;</script>'));
    });
  } }],
});
const report={probeSHA256:hash(await fs.readFile(new URL(import.meta.url))),sourceSHA256:hash(await fs.readFile('packages/chat-ui/src/chat-view.ts')),results:[],errors:[],scope:'Chromium media emulation and real jump button, scrollTo observation plus actual endpoint; isolated source harness, not physical OS settings.'};
let browser;
try {
 await server.listen();browser=await chromium.launch();const page=await browser.newPage();
 page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__chat_motion`);
 await page.waitForFunction(()=>!!window.ChatView);
 await page.evaluate(()=>{
  window.calls=[];window.view=new window.ChatView({onSend(){}});
  Object.assign(window.view.el.style,{width:'420px',height:'600px'});document.body.append(window.view.el);
  for(let i=0;i<15;i++)window.view.append({role:'agent',text:'Earlier reply '+i+' content. '.repeat(40)});
  const el=window.view.el.querySelector('.cui-messages');const original=el.scrollTo.bind(el);
  el.scrollTo=(options)=>{window.calls.push({...options});original(options);};
 });
 for(const preference of ['reduce','no-preference','reduce']){
  await page.emulateMedia({reducedMotion:preference});
  await page.evaluate(()=>{window.calls=[];const el=window.view.el.querySelector('.cui-messages');el.scrollTop=0;el.dispatchEvent(new Event('scroll'));});
  await page.waitForFunction(()=>!document.querySelector('.cui-scroll-bottom').hidden);
  await page.locator('.cui-scroll-bottom').click();
  await page.waitForFunction(()=>{const el=document.querySelector('.cui-messages');return Math.abs(el.scrollHeight-el.scrollTop-el.clientHeight)<=2;});
  report.results.push({preference,...await page.evaluate(()=>{const el=document.querySelector('.cui-messages');return {matches:matchMedia('(prefers-reduced-motion: reduce)').matches,calls:[...window.calls],gap:el.scrollHeight-el.scrollTop-el.clientHeight};})});
 }
 report.status='completed';
}catch(error){report.status='failed';report.error=String(error);process.exitCode=1;}
finally{await browser?.close();await server.close();await fs.writeFile('docs/evaluations/2026-10-04-chat-reduced-motion-browser.json',JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify(report));
