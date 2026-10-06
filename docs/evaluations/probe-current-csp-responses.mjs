import { preview } from 'vite';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
const hash = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const staticAudit = JSON.parse(await fs.readFile('docs/evaluations/2026-10-05-current-csp.json', 'utf8'));
const assets = await fs.readdir('dist/assets');
const select = (pattern) => { const matches = assets.filter((name) => pattern.test(name)); assert.equal(matches.length, 1); return matches[0]; };
const worker = select(/^webllm\.worker-.*\.js$/);
const agent = select(/^agent-plugin-.*\.js$/);
const report = {
  scope: 'Fresh owned local Vite production preview, actual GET headers and exact served bytes. No deployed edge, browser enforcement, model generation, offline or physical-device acceptance.',
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  probeSHA256: hash(await fs.readFile(new URL(import.meta.url))), rows: [], passed: false, serverClosed: false,
};
let server;
try {
  server = await preview({ preview: { host: '127.0.0.1', port: 0, open: false } });
  const address = server.httpServer.address();
  assert.equal(typeof address, 'object');
  const origin = `http://127.0.0.1:${address.port}`;
  for (const [pathname, disk, isWorker] of [
    [`/assets/${worker}`, `dist/assets/${worker}`, true],
    [`/assets/${agent}`, `dist/assets/${agent}`, false],
    ['/editor', 'dist/editor.html', false],
    ['/web-apps/apps/documenteditor/main/index.html', 'dist/web-apps/apps/documenteditor/main/index.html', false],
  ]) {
    const response = await fetch(origin + pathname);
    const bytes = Buffer.from(await response.arrayBuffer());
    const row = { pathname, status: response.status, csp: response.headers.get('content-security-policy'),
      coop: response.headers.get('cross-origin-opener-policy'), coep: response.headers.get('cross-origin-embedder-policy'),
      sha256: hash(bytes), diskSHA256: hash(await fs.readFile(disk)) };
    assert.equal(row.status, 200);
    assert.equal(row.csp, isWorker ? staticAudit.workerPolicy : null);
    assert.equal(row.coop, 'same-origin');
    assert.equal(row.coep, 'require-corp');
    assert.equal(row.sha256, row.diskSHA256);
    if (pathname === '/editor') assert.ok(bytes.toString().includes(staticAudit.shellPolicy));
    row.passed = true;
    report.rows.push(row);
  }
  report.passed = true;
} catch (error) {
  report.error = String(error);
  process.exitCode = 1;
} finally {
  if (server) await new Promise((resolve, reject) => server.httpServer.close((error) => error ? reject(error) : resolve()));
  report.serverClosed = true;
  await fs.writeFile('docs/evaluations/2026-10-05-current-csp-responses.json', JSON.stringify(report, null, 2) + '\n');
}
console.log(JSON.stringify({ passed: report.passed, rows: report.rows.length, serverClosed: report.serverClosed }));
