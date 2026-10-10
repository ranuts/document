import { createServer } from 'vite';
import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const hash = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const server = await createServer({ configFile: false, root: process.cwd(), server: { host: '127.0.0.1', port: 0 }, logLevel: 'error',
  plugins: [{ name: 'chat-keyboard-harness', configureServer(server) {
    server.middlewares.use('/__chat_keyboard', async (_req, res) => {
      res.setHeader('Content-Type', 'text/html');
      res.end(await server.transformIndexHtml('/__chat_keyboard', '<!doctype html><script type="module">import {ChatView} from "/packages/chat-ui/src/chat-view.ts"; window.ChatView=ChatView;</script>'));
    });
  } }],
});
const report={probeSHA256:hash(await fs.readFile(new URL(import.meta.url))),sourceSHA256:hash(await fs.readFile('packages/chat-ui/src/chat-view.ts')),results:[],errors:[],scope:'Real Chromium keyboard and simulated composition events in current ChatView; not physical OS IME or native editor integration.'};
let browser;
try {
 await server.listen();browser=await chromium.launch();
 const page=await browser.newPage();page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__chat_keyboard`);
 await page.waitForFunction(()=>!!window.ChatView);
 await page.evaluate(()=>{window.sent=[];window.view=new window.ChatView({onSend:text=>window.sent.push(text)});document.body.append(window.view.el);});
 const input=page.locator('.cui-input');
 await input.fill('中文消息');await input.press('Shift+Enter');
 report.results.push({id:'shift-enter',...await page.evaluate(()=>({value:document.querySelector('.cui-input').value,sent:[...window.sent]}))});
 await input.press('Enter');
 report.results.push({id:'enter-send',...await page.evaluate(()=>({value:document.querySelector('.cui-input').value,sent:[...window.sent]}))});
 await input.fill('正在选词');
 await input.evaluate(el=>el.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true})));
 await input.press('Enter');
 report.results.push({id:'composition-enter',...await page.evaluate(()=>({value:document.querySelector('.cui-input').value,sent:[...window.sent]}))});
 await input.evaluate(el=>{el.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true}));el.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',keyCode:229,bubbles:true,cancelable:true}));});
 report.results.push({id:'legacy-229',...await page.evaluate(()=>({value:document.querySelector('.cui-input').value,sent:[...window.sent]}))});
 await input.fill('继续发送');await input.press('Enter');
 report.results.push({id:'after-composition',...await page.evaluate(()=>({value:document.querySelector('.cui-input').value,sent:[...window.sent]}))});
 await page.evaluate(()=>{window.view.setInput('保留草稿');window.view.setRunning(true);});
 report.results.push({id:'running-locked',...await page.evaluate(()=>({disabled:document.querySelector('.cui-input').disabled,value:document.querySelector('.cui-input').value,sent:[...window.sent]}))});
 await page.evaluate(()=>window.view.setRunning(false));await input.press('Enter');
 report.results.push({id:'unlocked-send',...await page.evaluate(()=>({value:document.querySelector('.cui-input').value,sent:[...window.sent]}))});
 await input.press('Enter');
 report.results.push({id:'empty-enter',...await page.evaluate(()=>({value:document.querySelector('.cui-input').value,sent:[...window.sent]}))});
 report.status='completed';
}catch(error){report.status='failed';report.error=String(error);process.exitCode=1;}
finally{await browser?.close();await server.close();await fs.writeFile('docs/evaluations/2026-10-04-chat-keyboard-browser.json',JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify(report));
