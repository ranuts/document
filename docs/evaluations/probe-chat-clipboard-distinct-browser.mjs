import { createServer } from 'vite';
import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const hash = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const server = await createServer({ configFile: false, root: process.cwd(), server: { host: '127.0.0.1', port: 0 }, logLevel: 'error',
  plugins: [{ name: 'chat-clipboard-harness', configureServer(server) {
    server.middlewares.use('/__chat_clipboard', async (_req, res) => {
      res.setHeader('Content-Type', 'text/html');
      if (_req.url.includes('blocked')) res.setHeader('Permissions-Policy', 'clipboard-write=()');
      res.end(await server.transformIndexHtml('/__chat_clipboard', '<!doctype html><script type="module">import {ChatView} from "/packages/chat-ui/src/chat-view.ts"; window.ChatView=ChatView;</script>'));
    });
  } }],
});
const report={probeSHA256:hash(await fs.readFile(new URL(import.meta.url))),sourceSHA256:hash(await fs.readFile('packages/chat-ui/src/chat-view.ts')),results:[],errors:[],scope:'Real Chromium Clipboard API under allowed/Permissions-Policy blocked writes, isolated source harness, not OS clipboard universal compatibility.'};
const text='**中文🧾**\nSecond line: 640 EUR\nLiteral \\n';
let browser;
try{
 await server.listen();browser=await chromium.launch();
 for(const blocked of [false,true]){
  const context=await browser.newContext({permissions:['clipboard-read','clipboard-write']});
  const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__chat_clipboard${blocked?'?blocked=1':''}`);
  await page.waitForFunction(()=>!!window.ChatView);
  const attempted=blocked?`Blocked candidate\n${text}`:text;
  await page.evaluate(text=>{window.view=new window.ChatView({onSend(){}});document.body.append(window.view.el);window.view.append({role:'agent',text});},attempted);
  await page.locator('.cui-copy').click();
  await page.waitForFunction(()=>['Copied','Could not copy'].includes(document.querySelector('.cui-copy').textContent));
  const row=await page.evaluate(async()=>({label:document.querySelector('.cui-copy').textContent,disabled:document.querySelector('.cui-copy').disabled,clipboard:await navigator.clipboard.readText()}));
  report.results.push({blocked,attempted,...row});await context.close();
 }
 report.status='completed';
}catch(error){report.status='failed';report.error=String(error);process.exitCode=1;}
finally{await browser?.close();await server.close();await fs.writeFile('docs/evaluations/2026-10-04-chat-clipboard-distinct-browser.json',JSON.stringify({...report,text},null,2)+'\n');}
console.log(JSON.stringify(report));
