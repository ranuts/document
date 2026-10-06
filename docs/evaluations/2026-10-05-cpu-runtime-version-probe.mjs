import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import http from 'node:http';
import { createHash } from 'node:crypto';
const cases = JSON.parse(await fs.readFile('docs/evaluations/2026-10-05-cpu-runtime-version-cases.json', 'utf8'));
const model = '.scratch/node_modules/ai-models/Qwen_Qwen3-0.6B-Q4_K_M.gguf';
const pairs = {
  current: {
    version: '3.6.1-source-count',
    client: 'packages/agent-core/vendor/wllama-count/client/index.js',
    wasm: 'packages/agent-core/vendor/wllama-count/native/default/wllama.wasm',
  },
  candidate: {
    version: '3.8.1-npm',
    client: '.scratch/wllama-381-probe/node_modules/@wllama/wllama/esm/index.js',
    wasm: '.scratch/wllama-381-probe/node_modules/@wllama/wllama/esm/wasm/wllama.wasm',
  },
};
const sha = async (file) =>
  createHash('sha256')
    .update(await fs.readFile(file))
    .digest('hex');
const report = {
  protocol: '2026-10-05-cpu-runtime-version-protocol.md',
  runtime: '7452d09',
  model: { path: model, bytes: (await fs.stat(model)).size, sha256: await sha(model) },
  pairs: {},
  rows: [],
};
if (report.model.sha256 !== '9acfc1e001311f34b4252001b626f2e466d592a42065f66571bff3790d4e1b14')
  throw Error('Model hash mismatch');
for (const [k, v] of Object.entries(pairs))
  report.pairs[k] = { ...v, clientSHA256: await sha(v.client), wasmSHA256: await sha(v.wasm) };
const server = http.createServer(async (req, res) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  const route = new URL(req.url, 'http://localhost').pathname;
  if (route === '/') {
    res.setHeader('Content-Type', 'text/html');
    res.end('<!doctype html><title>Isolated CPU runtime diagnostic</title><input type="file" id="model">');
    return;
  }
  const match = route.match(/^\/(current|candidate)\/(client\.js|model\.wasm)$/);
  if (!match) {
    res.writeHead(404);
    res.end();
    return;
  }
  try {
    const file = pairs[match[1]][match[2] === 'client.js' ? 'client' : 'wasm'];
    const bytes = await fs.readFile(file);
    res.setHeader('Content-Type', match[2] === 'client.js' ? 'text/javascript' : 'application/wasm');
    res.setHeader('Content-Length', bytes.length);
    res.end(bytes);
  } catch (e) {
    res.writeHead(500);
    res.end(String(e));
  }
});
await new Promise((r) => server.listen(5195, '127.0.0.1', r));
const b = await chromium.launch();
report.browser = b.version();
try {
  for (let index = 0; index < cases.length; index++)
    for (const variant of ['current', 'candidate']) {
      const row = { index, variant, request: cases[index].request, errors: [], externalRequests: [] };
      report.rows.push(row);
      const c = await b.newContext();
      try {
        const p = await c.newPage();
        p.on('pageerror', (e) => row.errors.push(e.message));
        p.on('console', (m) => {
          if (m.type() === 'error') row.errors.push(m.text());
        });
        p.on('request', (r) => {
          if (!r.url().startsWith('http://127.0.0.1:5195/') && !r.url().startsWith('blob:'))
            row.externalRequests.push(r.url());
        });
        await p.goto('http://127.0.0.1:5195/');
        await p.locator('#model').setInputFiles(model);
        console.log('Starting ' + index + ' ' + variant);
        const started = Date.now();
        row.result = await p.evaluate(
          async ({ variant, request }) => {
            const { Wllama } = await import('/' + variant + '/client.js');
            const runtime = new Wllama({ default: '/' + variant + '/model.wasm' });
            const params = { n_ctx: 2048, n_gpu_layers: 0, n_threads: 4, reasoning: false, seed: 42 };
            try {
              await runtime.loadModel(Array.from(document.querySelector('#model').files), params);
              const response = await runtime.createChatCompletion(request);
              return { params, isolated: crossOriginIsolated, response };
            } finally {
              await runtime.exit();
            }
          },
          { variant, request: row.request },
        );
        row.durationMs = Date.now() - started;
        row.finished = true;
        console.log(JSON.stringify({ index, variant, durationMs: row.durationMs, response: row.result.response }));
      } catch (e) {
        row.error = String(e);
        console.log(JSON.stringify({ index, variant, error: row.error }));
      } finally {
        await c.close();
        row.closed = true;
        await fs.writeFile('.scratch/cpu-runtime-version-probe.json', JSON.stringify(report, null, 2));
      }
    }
} finally {
  await b.close();
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
  report.closed = true;
  await fs.writeFile('.scratch/cpu-runtime-version-probe.json', JSON.stringify(report, null, 2));
}
if (report.rows.some((r) => !r.finished || r.errors.length || r.externalRequests.length)) process.exitCode = 1;
