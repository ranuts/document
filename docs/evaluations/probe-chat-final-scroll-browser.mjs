import { createServer } from 'vite';
import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const hash = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const server = await createServer({ configFile: false, root: process.cwd(), server: { host: '127.0.0.1', port: 0 }, logLevel: 'error',
  plugins: [{ name: 'chat-scroll-harness', configureServer(server) {
    server.middlewares.use('/__chat_scroll', async (_req, res) => {
      res.setHeader('Content-Type', 'text/html');
      res.end(await server.transformIndexHtml('/__chat_scroll', '<!doctype html><script type="module">import {ChatView} from "/packages/chat-ui/src/chat-view.ts"; window.ChatView=ChatView;</script>'));
    });
  } }],
});
const report = { probeSHA256: hash(await fs.readFile(new URL(import.meta.url))), sources: {}, results: [], errors: [], scope: 'Real Chromium current source ChatView with production styles; isolated layout harness, no model or native editor integration.' };
for (const file of ['packages/chat-ui/src/chat-view.ts','packages/chat-ui/src/styles.ts','packages/chat-ui/src/markdown.ts']) report.sources[file] = hash(await fs.readFile(file));
let browser;
try {
 await server.listen();
 browser = await chromium.launch();
 const context = await browser.newContext({serviceWorkers:'block'});
 const page = await context.newPage();
 page.on('pageerror', e => report.errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__chat_scroll`);
 await page.waitForFunction(() => !!window.ChatView);
 for (const width of [1280,390]) {
  await page.setViewportSize({width,height:900});
  for (const format of ['list','table']) for (const atBottom of [true,false]) {
   const row = await page.evaluate(async ({width,format,atBottom}) => {
    document.body.replaceChildren();
    const view = new window.ChatView({onSend(){}});
    Object.assign(view.el.style,{width:`${Math.min(width-24,420)}px`,height:'600px'});
    document.body.append(view.el);
    for (let i=0;i<12;i++) view.append({role:'agent',text:`Earlier reply ${i}: `+'Historical content. '.repeat(30)});
    const payload = format === 'list' ? Array.from({length:20},(_,i)=>`- Item ${i} **Important detail**`).join('\n') : '| Name | Value |\n| --- | --- |\n'+Array.from({length:20},(_,i)=>`| Item ${i} | Value ${i} |`).join('\n');
    view.appendDelta(payload);
    const el=view.el.querySelector('.cui-messages');
    el.scrollTop=atBottom?el.scrollHeight:120;
    const before={top:el.scrollTop,height:el.scrollHeight,client:el.clientHeight};
    view.endStream();
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const after={top:el.scrollTop,height:el.scrollHeight,client:el.clientHeight};
    const rendered = format === 'list' ? view.el.querySelectorAll('ul li').length===20 : view.el.querySelectorAll('tbody tr').length===20;
    return {before,after,rendered,passed:rendered && (atBottom ? Math.abs(after.height-after.top-after.client)<=2 : Math.abs(after.top-before.top)<=2)};
   },{width,format,atBottom});
   report.results.push({width,format,atBottom,...row});
  }
 }
 report.passed=report.results.length===8 && report.results.every(r=>r.passed) && !report.errors.length;
} catch(error){ report.passed=false;report.error=String(error); }
finally { await browser?.close();await server.close();await fs.writeFile('docs/evaluations/2026-10-04-chat-final-scroll-browser.json',JSON.stringify(report,null,2)+'\n'); }
console.log(JSON.stringify(report));
if(!report.passed) process.exitCode=1;
