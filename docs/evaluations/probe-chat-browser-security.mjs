import { createServer } from 'vite';
import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const hash = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const payloads = [
  '<svg onload="window.__injected=1"><a href="javascript:alert(1)">x</a></svg>',
  '<iframe srcdoc="<script>parent.__injected=1</script>"></iframe>',
  '<form action="https://attacker.invalid"><input autofocus onfocus="window.__injected=1"></form>',
  '<style>body{background:url(https://attacker.invalid/pixel)}</style>',
  '[run](JaVaScRiPt:alert%281%29)', '[run](data:text/html;base64,PHNjcmlwdD4=)',
  '[run](vbscript:msgbox%281%29)', '[run](//attacker.invalid/path)', '[run](/private/path)',
  '![pixel](https://attacker.invalid/pixel)',
  '| Payload |\n| --- |\n| <img src=https://attacker.invalid/pixel onerror="window.__injected=1"> |',
  '> **[run](javascript:alert%281%29)**\n\n- <video src=https://attacker.invalid/video onerror="window.__injected=1">',
];
const server = await createServer({ configFile: false, root: process.cwd(), server: { host: '127.0.0.1', port: 0 }, logLevel: 'error',
  plugins: [{ name: 'chat-security-harness', configureServer(server) {
    server.middlewares.use('/__chat_security', async (_req, res) => {
      res.setHeader('Content-Type', 'text/html');
      res.end(await server.transformIndexHtml('/__chat_security', '<!doctype html><script type="module">import {ChatView} from "/packages/chat-ui/src/chat-view.ts"; window.ChatView=ChatView;</script>'));
    });
  } }],
});
const report = { probeSHA256: hash(await fs.readFile(new URL(import.meta.url))), sources: {}, results: [], requests: [], errors: [], dialogs: [], scope: 'Current source ChatView served by isolated Vite harness, real Chromium, no CSP; not deployed editor integration or model inference.' };
for (const path of ['packages/chat-ui/src/chat-view.ts', 'packages/chat-ui/src/markdown.ts']) report.sources[path] = hash(await fs.readFile(path));
let browser;
try {
  await server.listen();
  const port = server.httpServer.address().port;
  browser = await chromium.launch();
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const page = await context.newPage();
  page.on('pageerror', (e) => report.errors.push(e.message));
  page.on('dialog', async (d) => { report.dialogs.push(d.message()); await d.dismiss(); });
  await page.goto(`http://127.0.0.1:${port}/__chat_security`);
  await page.waitForFunction(() => !!window.ChatView);
  // All dependency fetches finish before monitoring content-induced requests.
  await page.waitForLoadState('networkidle');
  page.on('request', (r) => report.requests.push(r.url()));
  await context.route('https://attacker.invalid/**', (r) => r.abort());
  for (const payload of payloads) {
    for (const mode of ['agent', 'user', 'tool', 'stream']) {
      const result = await page.evaluate(async ({ payload, mode }) => {
        document.body.replaceChildren();
        window.__injected = 0;
        const view = new window.ChatView({ onSend() {} });
        document.body.append(view.el);
        if (mode === 'stream') {
          // Parse every character boundary, allowing event tasks between chunks.
          for (const character of payload) {
            view.appendDelta(character);
            await new Promise((resolve) => setTimeout(resolve, 0));
          }
          view.endStream();
        } else view.append({ role: mode, text: payload });
        await new Promise((resolve) => setTimeout(resolve, 20));
        const content = [...view.el.querySelectorAll('.cui-bubble, .cui-activity')];
        return {
          injected: window.__injected,
          unsafe: content.some((el) => !!el.querySelector('script,style,svg,iframe,form,input,img,video,object,embed,a')),
          handlers: content.some((el) => [...el.querySelectorAll('*')].some((node) => [...node.attributes].some((a) => /^on/i.test(a.name)))),
        };
      }, { payload, mode });
      report.results.push({ payload, mode, ...result });
    }
  }
  report.passed = report.results.length === 48 && report.results.every((r) => r.injected === 0 && !r.unsafe && !r.handlers) && !report.requests.length && !report.errors.length && !report.dialogs.length;
} catch (e) { report.passed = false; report.error = String(e); }
finally {
  await browser?.close();
  await server.close();
  await fs.writeFile('docs/evaluations/2026-10-04-chat-browser-security.json', JSON.stringify(report, null, 2) + '\n');
}
console.log(JSON.stringify({ passed: report.passed, cases: report.results.length, requests: report.requests, errors: report.errors, dialogs: report.dialogs }));
if (!report.passed) process.exitCode = 1;
