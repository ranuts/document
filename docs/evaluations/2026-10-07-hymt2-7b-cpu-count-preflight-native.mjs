import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import http from 'node:http';
import { createHash } from 'node:crypto';

const protocolPath = 'docs/evaluations/2026-10-07-hymt2-7b-cpu-count-preflight-protocol.json';
const protocolBytes = await fs.readFile(protocolPath);
const protocol = JSON.parse(protocolBytes);
const artifact = JSON.parse(await fs.readFile('.scratch/hymt2-7b-artifact.json', 'utf8'));
const digest = createHash('sha256');
for await (const bytes of createReadStream(artifact.localDiagnosticFile)) digest.update(bytes);
if (
  digest.digest('hex') !== protocol.model.sha256 ||
  (await fs.stat(artifact.localDiagnosticFile)).size !== protocol.model.bytes
) {
  throw new Error('Candidate model bytes mismatch');
}
const files = {
  '/client.js': 'packages/agent-core/vendor/wllama-count/client/index.js',
  '/model.wasm': 'packages/agent-core/vendor/wllama-count/native/default/wllama.wasm',
};
const report = {
  protocol,
  protocolSha256: createHash('sha256').update(protocolBytes).digest('hex'),
  runtime: {},
  outputs: [],
  errors: [],
  console: [],
  stage: 'start',
};
for (const [route, file] of Object.entries(files)) {
  const bytes = await fs.readFile(file);
  report.runtime[route] = { bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
}
const output = '.scratch/2026-10-07-hymt2-7b-cpu-count-preflight-native.json';
const save = () => fs.writeFile(output, JSON.stringify(report, null, 2));
await save();
const server = http.createServer(async (req, res) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  const route = new URL(req.url, 'http://localhost').pathname;
  if (route === '/') {
    res.setHeader('Content-Type', 'text/html');
    res.end('<!doctype html><title>Isolated translation candidate</title><input type="file" id="model">');
    return;
  }
  if (!files[route]) {
    res.writeHead(404);
    res.end();
    return;
  }
  try {
    const bytes = await fs.readFile(files[route]);
    res.setHeader('Content-Type', route.endsWith('.wasm') ? 'application/wasm' : 'text/javascript');
    res.end(bytes);
  } catch {
    res.writeHead(500);
    res.end();
  }
});
let browser, context;
try {
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  browser = await chromium.launch({ channel: 'chromium' });
  report.browserVersion = browser.version();
  context = await browser.newContext({ serviceWorkers: 'block' });
  const page = await context.newPage();
  page.on('pageerror', (error) => report.errors.push(error.message));
  page.on('console', (message) =>
    report.console.push({ stage: report.stage, type: message.type(), text: message.text() }),
  );
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.locator('#model').setInputFiles(artifact.localDiagnosticFile);
  report.stage = 'model-load';
  await save();
  await page.evaluate((params) => {
    window.__ready = false;
    import('/client.js')
      .then(async ({ Wllama }) => {
        window.__runtime = new Wllama({ default: '/model.wasm' });
        await window.__runtime.loadModel(Array.from(document.querySelector('#model').files), params);
        window.__ready = true;
      })
      .catch((error) => (window.__loadError = String(error)));
  }, protocol.params);
  await page.waitForFunction(() => window.__ready || window.__loadError, null, { timeout: 300000 });
  report.load = await page.evaluate(() => ({
    ready: window.__ready,
    error: window.__loadError,
    isolated: crossOriginIsolated,
  }));
  await save();
  if (report.load.error) throw new Error(report.load.error);
  for (const c of protocol.cases) {
    report.stage = c.id;
    await save();
    await page.evaluate((request) => {
      window.__completion = null;
      window.__error = null;
      window.__runtime
        .countChatTokens({ ...request, stream: false })
        .then((completion) => (window.__completion = completion))
        .catch((error) => (window.__error = String(error)));
    }, c.request);
    await page.waitForFunction(() => window.__completion || window.__error, null, { timeout: 300000 });
    const result = await page.evaluate(() => ({ completion: window.__completion, error: window.__error }));
    report.outputs.push({ id: c.id, request: c.request, ...result });
    await save();
    if (result.error) throw new Error(result.error);
  }
  await page.evaluate(() => window.__runtime.exit());
  report.finished = true;
} catch (error) {
  report.error = String(error);
} finally {
  if (context) await context.close();
  if (browser) await browser.close();
  server.closeAllConnections();
  await new Promise((done) => server.close(done));
  report.contextClosed = true;
  report.browserClosed = true;
  report.serverClosed = true;
  await save();
}
if (!report.finished) process.exitCode = 1;
