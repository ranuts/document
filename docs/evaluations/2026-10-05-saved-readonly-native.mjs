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
const verifyReadonly = async (p) => {
  const u = new URL(p.url());
  u.searchParams.set('readonly', '1');
  await p.goto(u.href);
  await ready(p);
  const state = await p.evaluate(() => {
    const a = document.querySelector('#app iframe').contentWindow.Asc.editor;
    return { restrictions: a.restrictions, text: a.WordControl.m_oLogicDocument.GetText() };
  });
  if ((state.restrictions & 128) !== 128) throw Error('Readonly restriction absent');
  await p.evaluate(() => document.querySelector('#app iframe').contentDocument.getElementById('area_id')?.focus());
  await p.keyboard.type('SHOULD_NOT_EDIT', { delay: 30 });
  if ((await text(p)) !== state.text) throw Error('Readonly keyboard input changed document');
  return state;
};
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
    run.sourceReadonly = await verifyReadonly(p);
    if (run.sourceReadonly.text !== run.openText) throw Error('Readonly source text mismatch');
    const editableUrl = new URL(p.url());
    editableUrl.searchParams.delete('readonly');
    await p.goto(editableUrl.href);
    await ready(p);
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
    run.snapshotReadonly = await verifyReadonly(p);
    if (run.snapshotReadonly.text !== expected + '\r\n') throw Error('Readonly snapshot text mismatch');
    await p.goto('http://127.0.0.1:5193/');
    const ordinary = p.waitForEvent('filechooser');
    await p.locator('#hero-open').click();
    await (await ordinary).setFiles('.scratch/webkit-embedded-font-native-saved.docx');
    await ready(p);
    run.ordinaryRestrictions = await p.evaluate(
      () => document.querySelector('#app iframe').contentWindow.Asc.editor.restrictions,
    );
    if (run.ordinaryRestrictions !== 0) throw Error('Ordinary reopen remains restricted');
    await p.evaluate(() => document.querySelector('#app iframe').contentDocument.getElementById('area_id')?.focus());
    await p.keyboard.type('EDITABLE_AGAIN', { delay: 30 });
    await p.waitForFunction(() =>
      document
        .querySelector('#app iframe')
        .contentWindow.Asc.editor.WordControl.m_oLogicDocument.GetText()
        .includes('EDITABLE_AGAIN'),
    );
    run.ordinaryText = await text(p);
    if (run.errors.length) throw Error('page errors');
    run.passed = true;
  } catch (e) {
    run.error = String(e);
  } finally {
    await c.close();
    await b.close();
    run.closed = true;
    await fs.writeFile('.scratch/saved-readonly-native-full.json', JSON.stringify(report, null, 2));
    console.log(JSON.stringify(run));
  }
}
if (report.runs.some((r) => !r.passed || !r.closed)) process.exitCode = 1;
