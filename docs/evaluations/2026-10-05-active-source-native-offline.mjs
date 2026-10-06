import { chromium, webkit } from '@playwright/test';
import fs from 'node:fs/promises';
import http from 'node:http';
const report = { runs: [] };
for (const [name, engine] of [
  ['chromium', chromium],
  ['webkit', webkit],
]) {
  const run = { name, errors: [], failures: [] };
  report.runs.push(run);
  const server = http.createServer((req, res) => {
    const up = http.request(
      { hostname: '127.0.0.1', port: 5193, path: req.url, method: req.method, headers: req.headers },
      (r) => {
        res.writeHead(r.statusCode, r.headers);
        r.pipe(res);
      },
    );
    up.on('error', () => {
      if (!res.headersSent) res.writeHead(502);
      res.end();
    });
    req.pipe(up);
  });
  await new Promise((r) => server.listen(5194, '127.0.0.1', r));
  const b = await engine.launch();
  const c = await b.newContext();
  run.version = b.version();
  try {
    const p = await c.newPage();
    p.on('pageerror', (e) => run.errors.push(e.message));
    p.on('requestfailed', (r) => run.failures.push({ url: r.url(), error: r.failure()?.errorText }));
    const ready = () =>
      p.waitForFunction(
        () => {
          const a = document.querySelector('#app iframe')?.contentWindow?.Asc?.editor;
          return a?.isDocumentLoadComplete && a?.isLoadFullApi && new URL(location.href).searchParams.has('saved');
        },
        null,
        { timeout: 90000 },
      );
    const text = () =>
      p.evaluate(() =>
        document.querySelector('#app iframe').contentWindow.Asc.editor.WordControl.m_oLogicDocument.GetText(),
      );
    await p.goto('http://127.0.0.1:5194/');
    const chooser = p.waitForEvent('filechooser');
    await p.locator('#hero-open').click();
    await (await chooser).setFiles('.scratch/webkit-embedded-font-native-saved.docx');
    await ready();
    run.before = await text();
    run.id = new URL(p.url()).searchParams.get('saved');
    await p.waitForFunction(() => navigator.serviceWorker.controller);
    if (name === 'chromium') {
      await c.setOffline(true);
      run.mode = 'Playwright browser offline';
    } else {
      server.closeAllConnections();
      await new Promise((r) => server.close(r));
      run.mode = 'origin server closed; browser online';
    }
    const response = await p.reload();
    run.shellFromSW = response.fromServiceWorker();
    await ready();
    run.after = await text();
    run.restoredId = new URL(p.url()).searchParams.get('saved');
    if (
      run.before !== 'WEBKIT_WORD_20261005\r\n' ||
      run.after !== run.before ||
      run.restoredId !== run.id ||
      !run.shellFromSW ||
      run.errors.length
    )
      throw Error('offline source recovery mismatch');
    run.passed = true;
  } catch (e) {
    run.error = String(e);
  } finally {
    server.closeAllConnections();
    if (server.listening) await new Promise((r) => server.close(r));
    await c.close();
    await b.close();
    run.closed = true;
    await fs.writeFile('.scratch/active-source-native-offline.json', JSON.stringify(report, null, 2));
    console.log(JSON.stringify(run));
  }
}
if (report.runs.some((r) => !r.passed || !r.closed)) process.exitCode = 1;
