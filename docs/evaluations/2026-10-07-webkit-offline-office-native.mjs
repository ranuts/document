import { webkit } from './playwright-webkit-fix/node_modules/@playwright/test/index.mjs';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';

const protocolBytes = await fs.readFile('docs/evaluations/2026-10-07-webkit-offline-office-protocol.json');
const protocol = JSON.parse(protocolBytes);
const report = {
  protocol,
  protocolSha256: createHash('sha256').update(protocolBytes).digest('hex'),
  rows: [],
  errors: [],
  failures: [],
  stage: 'start',
};
const output = '.scratch/2026-10-07-webkit-offline-office-native.json';
const save = () => fs.writeFile(output, JSON.stringify(report, null, 2));
const safeURL = (value) => {
  const u = new URL(value);
  return `${u.origin}${u.pathname}`;
};
let context, browser;
const launch = async () => {
  context = await webkit.launchPersistentContext(protocol.profile, {
    serviceWorkers: 'allow',
    viewport: { width: 1280, height: 900 },
  });
  browser = context.browser();
  if (!browser) throw new Error('Persistent browser ownership unavailable');
  report.browserVersion = browser.version();
  context.on('requestfailed', (request) =>
    report.failures.push({ stage: report.stage, url: safeURL(request.url()), error: request.failure()?.errorText }),
  );
  await context.addInitScript(() => {
    if (window === top) {
      localStorage.setItem('agent-panel-provider', 'webllm');
      localStorage.removeItem('agent-panel-gguf-url');
      window.showSaveFilePicker = undefined;
    }
  });
};
const newPage = async () => {
  const page = await context.newPage();
  page.on('pageerror', (error) => report.errors.push({ stage: report.stage, message: error.message }));
  return page;
};
const ready = async (page) => {
  await page.waitForFunction(
    () => {
      const api = document.querySelector('#app iframe')?.contentWindow?.Asc?.editor;
      return api?.isDocumentLoadComplete && api?.isLoadFullApi;
    },
    null,
    { timeout: 120000 },
  );
};
const model = async (page) => {
  await page.frameLocator('#app iframe').locator('.agent-sidebar-entry').click({ timeout: 90000 });
  await page.waitForFunction(
    () => document.querySelector('.agent-panel-note')?.textContent?.includes('模型已加载'),
    null,
    { timeout: 240000 },
  );
  const status = await page.locator('.agent-model-status').textContent();
  if (status !== protocol.expectedModel) throw new Error('Unexpected actual model/backend');
  return status;
};
const version = (page) =>
  page.evaluate(async () => {
    const worker = navigator.serviceWorker.controller;
    if (!worker) return null;
    return await new Promise((resolve) => {
      const channel = new MessageChannel();
      const timer = setTimeout(() => done(null), 3000);
      const done = (value) => {
        clearTimeout(timer);
        channel.port1.close();
        channel.port2.close();
        resolve(value);
      };
      channel.port1.onmessage = (event) => done(event.data);
      worker.postMessage({ type: 'VERSION' }, [channel.port2]);
    });
  });
const snapshot = (page, kind) =>
  page.evaluate((kind) => {
    const api = document.querySelector('#app iframe').contentWindow.Asc.editor;
    return kind === 'xlsx'
      ? api.wb.getWorksheet().model.getRange3(1, 1, 1, 1).getValue()
      : JSON.stringify(
          api.WordControl.m_oLogicDocument.Slides.map((slide) =>
            slide.cSld.spTree.map((shape) => shape.getText?.() ?? ''),
          ),
        );
  }, kind);
const send = async (page, text) => {
  await page.locator('.cui-input').fill(text);
  await page.locator('.cui-input').press('Enter');
  await page.waitForFunction(() => !document.querySelector('.cui-input')?.disabled, null, { timeout: 180000 });
};
const timer = setInterval(() => save().catch(() => {}), 5000);
try {
  await launch();
  for (const c of protocol.cases) {
    report.stage = `warm:${c.kind}`;
    await save();
    const page = await newPage();
    await page.goto(`${protocol.origin}/editor?new=${c.kind}&agent=1&locale=zh-CN`);
    await ready(page);
    const status = await model(page);
    await page.waitForFunction((core) => caches.has(`document-editor-core-${core}`), protocol.coreVersion, {
      timeout: 60000,
    });
    const workerVersion = await version(page);
    report.rows.push({ kind: c.kind, seedStatus: status, seedSnapshot: await snapshot(page, c.kind), workerVersion });
    if (workerVersion?.cacheVersion !== protocol.coreVersion) throw new Error('Warm controller version mismatch');
    await page.close();
  }
  const first = browser;
  first.once('disconnected', () => (report.firstBrowserDisconnected = true));
  await context.close();
  report.firstContextClosed = true;
  report.firstBrowserConnectedAfterClose = first.isConnected();
  if (first.isConnected()) throw new Error('First browser still connected');
  report.stage = 'process-restart';
  await launch();
  await context.setOffline(true);
  report.offlineBeforeFirstNavigation = true;
  for (const c of protocol.cases) {
    const row = report.rows.find((row) => row.kind === c.kind);
    report.stage = `offline:${c.kind}`;
    await save();
    let page = await newPage();
    const response = await page.goto(`${protocol.origin}/editor?new=${c.kind}&agent=1&locale=zh-CN`, {
      timeout: 60000,
    });
    row.editorFromServiceWorker = response.fromServiceWorker();
    if (!row.editorFromServiceWorker) throw new Error('Offline editor not served by worker');
    await ready(page);
    row.offlineStatus = await model(page);
    row.before = await snapshot(page, c.kind);
    if (row.before !== row.seedSnapshot) throw new Error('Fresh document differs after restart');
    await page.evaluate(async (client) => {
      const { Wllama } = await import(client);
      const original = Wllama.prototype.createChatCompletion;
      window.__requests = [];
      Wllama.prototype.createChatCompletion = function (options) {
        const { abortSignal: _abortSignal, ...request } = options;
        window.__requests.push(JSON.parse(JSON.stringify(request)));
        return original.call(this, options);
      };
    }, protocol.cpuClient);
    await send(page, protocol.chatPrompt);
    row.reply = await page.locator('.cui-msg-agent').last().getAttribute('data-source');
    row.chatRequests = await page.evaluate(() => window.__requests);
    row.afterChat = await snapshot(page, c.kind);
    if (!row.reply?.trim() || !row.chatRequests.length || row.afterChat !== row.before)
      throw new Error('Offline CPU chat missing or changed document');
    await page.locator('.agent-writing-task').selectOption('tools');
    for (const command of c.commands) await send(page, command);
    row.afterEdit = await snapshot(page, c.kind);
    row.chatErrors = await page.locator('.cui-msg-error').allTextContents();
    row.previewCount = await page.locator('.agent-plan-preview').count();
    if (row.chatErrors.length || row.previewCount || !row.afterEdit.includes(c.expectedLiteral))
      throw new Error('Offline edit incomplete');
    if (c.kind === 'pptx' && JSON.parse(row.afterEdit).length !== JSON.parse(row.before).length + 1)
      throw new Error('Slide was not added');
    await page.evaluate(
      ({ kind, steps }) => {
        const api = document.querySelector('#app iframe').contentWindow.Asc.editor;
        for (let i = 0; i < steps; i++) kind === 'xlsx' ? api.asc_Undo() : api.Undo();
      },
      { kind: c.kind, steps: c.historySteps },
    );
    row.afterUndo = await snapshot(page, c.kind);
    await page.evaluate(
      ({ kind, steps }) => {
        const api = document.querySelector('#app iframe').contentWindow.Asc.editor;
        for (let i = 0; i < steps; i++) kind === 'xlsx' ? api.asc_Redo() : api.Redo();
      },
      { kind: c.kind, steps: c.historySteps },
    );
    row.afterRedo = await snapshot(page, c.kind);
    if (row.afterUndo !== row.before || row.afterRedo !== row.afterEdit) throw new Error('Native history mismatch');
    report.stage = `save:${c.kind}`;
    await save();
    const pending = page.waitForEvent('download', { timeout: 120000 });
    pending.catch(() => {});
    await page.frameLocator('#app iframe').locator('#slot-btn-dt-save button').click();
    const download = await pending;
    const path = `.scratch/2026-10-07-webkit-offline-office.${c.kind}`;
    await download.saveAs(path);
    const bytes = await fs.readFile(path);
    row.saved = {
      path,
      bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      failure: await download.failure(),
    };
    if (!bytes.length || row.saved.failure) throw new Error('Native save failed');
    await page.close();
    page = await newPage();
    report.stage = `reopen:${c.kind}`;
    await save();
    const home = await page.goto(protocol.origin);
    row.reopenHomeFromServiceWorker = home.fromServiceWorker();
    const chooser = page.waitForEvent('filechooser');
    await page.locator('#hero-open').click();
    await (await chooser).setFiles(path);
    await ready(page);
    row.reopened = await snapshot(page, c.kind);
    if (row.reopened !== row.afterEdit) throw new Error('Saved document reopened differently');
    row.finished = true;
    await save();
    await page.close();
  }
  if (report.errors.length) throw new Error('Runtime page errors observed');
  report.finished = true;
} catch (error) {
  report.error = String(error).replaceAll(process.cwd(), '<workspace>');
} finally {
  clearInterval(timer);
  if (context) await context.close();
  report.contextClosed = true;
  report.finalBrowserConnected = browser?.isConnected();
  await save();
}
if (!report.finished) process.exitCode = 1;
