import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const assets = await fs.readdir('dist/assets');
const workers = assets.filter((x) => /^webllm\.worker-.*\.js$/.test(x));
const others = assets.filter((x) => /^agent-plugin-.*\.js$/.test(x));
if (workers.length !== 1 || others.length !== 1) throw Error('Ambiguous assets');
const worker = workers[0],
  other = others[0];
const policy =
  "default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self' https: http: blob:; worker-src 'self' blob:";
const expected = crypto
  .createHash('sha256')
  .update(await fs.readFile('dist/assets/' + worker))
  .digest('hex');
const report = {
  scope:
    'Actual local preview, static-web-server 2.42.0 and Wrangler Pages 4.146.0 response headers and Worker bytes; no deployed edge or offline upgrade claim.',
  worker,
  expectedSHA256: expected,
  rows: [],
  passed: true,
};
for (const port of [5198, 5195, 5196])
  for (const pathname of [
    '/assets/' + worker,
    '/assets/' + other,
    '/editor',
    '/web-apps/apps/documenteditor/main/index.html',
  ]) {
    const response = await fetch('http://127.0.0.1:' + port + pathname);
    const headers = Object.fromEntries(response.headers);
    const isWorker = pathname === '/assets/' + worker;
    const bytes = Buffer.from(await response.arrayBuffer());
    const row = {
      port,
      pathname,
      status: response.status,
      csp: headers['content-security-policy'] ?? null,
      cacheControl: headers['cache-control'] ?? null,
      coop: headers['cross-origin-opener-policy'],
      coep: headers['cross-origin-embedder-policy'],
    };
    if (isWorker) row.sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
    row.passed =
      response.status === 200 &&
      row.csp === (isWorker ? policy : null) &&
      row.coop === 'same-origin' &&
      row.coep === 'require-corp' &&
      (!isWorker || row.sha256 === expected);
    report.rows.push(row);
    report.passed &&= row.passed;
  }
await fs.writeFile(
  'docs/evaluations/2026-10-03-worker-csp-hosting-headers.json',
  JSON.stringify(report, null, 2) + '\n',
);
console.log(JSON.stringify({ passed: report.passed, rows: report.rows.length, worker }));
if (!report.passed) process.exitCode = 1;
