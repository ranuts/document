import { chromium, webkit } from '@playwright/test';
import fs from 'node:fs/promises';
const report = { runs: [] };
const ready = (p) =>
  p.waitForFunction(
    () => {
      const a = document.querySelector('#app iframe')?.contentWindow?.Asc?.editor;
      return a?.isDocumentLoadComplete && a?.isLoadFullApi && new URL(location.href).searchParams.has('saved');
    },
    null,
    { timeout: 90000 },
  );
const text = (p) =>
  p.evaluate(() =>
    document.querySelector('#app iframe').contentWindow.Asc.editor.WordControl.m_oLogicDocument.GetText(),
  );
const stored = (p) =>
  p.evaluate(async () => {
    const id = new URL(location.href).searchParams.get('saved');
    const read = (name, store, key) =>
      new Promise((resolve, reject) => {
        const r = indexedDB.open(name);
        r.onerror = () => reject(r.error);
        r.onsuccess = () => {
          const db = r.result;
          const t = db.transaction(store);
          const q = key === undefined ? t.objectStore(store).getAll() : t.objectStore(store).get(key);
          let value;
          q.onsuccess = () => {
            value = q.result;
          };
          t.oncomplete = () => {
            db.close();
            resolve(value);
          };
          t.onerror = () => {
            db.close();
            reject(t.error);
          };
        };
      });
    return {
      id,
      doc: await read('document-history', 'docs', id),
      sources: (await read('document-active-sources', 'sources')).map((s) => ({ docId: s.docId, key: s.key })),
      pointer: sessionStorage.getItem('document-active-source'),
    };
  });
for (const [name, engine] of [
  ['chromium', chromium],
  ['webkit', webkit],
]) {
  const run = { name, errors: [] };
  report.runs.push(run);
  const b = await engine.launch();
  const c = await b.newContext();
  run.version = b.version();
  try {
    const p = await c.newPage();
    p.on('pageerror', (e) => run.errors.push(e.message));
    await p.goto('http://127.0.0.1:5193/');
    const chooser = p.waitForEvent('filechooser');
    await p.locator('#hero-open').click();
    await (await chooser).setFiles('.scratch/webkit-embedded-font-native-saved.docx');
    await ready(p);
    run.openText = await text(p);
    run.open = await stored(p);
    if (
      run.openText !== 'WEBKIT_WORD_20261005\r\n' ||
      run.open.doc ||
      !run.open.sources.some((s) => s.docId === run.open.id)
    )
      throw Error('original import mismatch');
    await p.reload();
    await ready(p);
    run.reloadText = await text(p);
    run.reload = await stored(p);
    if (run.reloadText !== run.openText || run.reload.id !== run.open.id || run.reload.doc)
      throw Error('unedited reload mismatch');
    const expected = `LATEST_SNAPSHOT_${name}_20261005`;
    await p.evaluate((value) => {
      const a = document.querySelector('#app iframe').contentWindow.Asc.editor;
      a.asc_EditSelectAll();
      a.pluginMethod_InputText(value);
    }, expected);
    await p.waitForFunction(
      (value) =>
        document.querySelector('#app iframe').contentWindow.Asc.editor.WordControl.m_oLogicDocument.GetText() ===
        value + '\r\n',
      expected,
    );
    run.editText = await text(p);
    console.log(name + ': native edit complete; waiting for real autosave');
    const start = Date.now();
    while (Date.now() - start < 125000) {
      run.snapshot = await stored(p);
      if (run.snapshot.doc) break;
      await new Promise((r) => setTimeout(r, 5000));
      if ((Date.now() - start) % 30000 < 5000)
        console.log(name + ': autosave wait ' + Math.round((Date.now() - start) / 1000) + 's');
    }
    if (!run.snapshot.doc) throw Error('real autosave did not create snapshot');
    run.autosaveWaitMs = Date.now() - start;
    await p.reload();
    await ready(p);
    run.latestText = await text(p);
    run.latest = await stored(p);
    if (run.latestText !== expected + '\r\n' || run.latest.id !== run.open.id)
      throw Error('latest snapshot precedence mismatch');
    if (run.errors.length) throw Error('page errors');
    run.passed = true;
  } catch (e) {
    run.error = String(e);
  } finally {
    await c.close();
    await b.close();
    run.closed = true;
    await fs.writeFile('.scratch/active-source-native-recovery.json', JSON.stringify(report, null, 2));
    console.log(JSON.stringify(run));
  }
}
if (report.runs.some((r) => !r.passed || !r.closed)) process.exitCode = 1;
