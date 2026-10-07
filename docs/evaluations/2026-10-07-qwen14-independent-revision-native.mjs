import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
const artifact = JSON.parse(await fs.readFile('.scratch/qwen14-local-artifact.json', 'utf8'));
const protocol = JSON.parse(await fs.readFile('.scratch/qwen14-independent-revision-protocol.json', 'utf8'));
const cases = protocol.cases;
const library = await fs.readFile(artifact.library.localDiagnosticFile);
if (
  library.length !== artifact.library.bytes ||
  createHash('sha256').update(library).digest('hex') !== artifact.library.sha256
)
  throw Error('Library mismatch');
const report = {
  scope:
    'Known-source seven-language independent revision pass, 21 generations, fixed previous baselines, no native application or product adoption',
  artifact,
  protocol,
  protocolSha256: createHash('sha256')
    .update(await fs.readFile('.scratch/qwen14-independent-revision-protocol.json'))
    .digest('hex'),
  requests: cases,
  outputs: [],
  errors: [],
  progress: [],
  libraryResponses: 0,
};
let context, timer;
const save = () =>
  fs.writeFile('.scratch/2026-10-07-qwen14-independent-revision-native.json', JSON.stringify(report, null, 2));
await save();
console.log('checkpoint: start');
try {
  report.stage = 'launch';
  await save();
  context = await chromium.launchPersistentContext('.scratch/qwen25-14b-gpu-profile-20261007', {
    channel: 'chromium',
    serviceWorkers: 'block',
  });
  report.browserVersion = context.browser()?.version();
  report.stage = 'browser-ready';
  await save();
  console.log('checkpoint: browser-ready');
  const page = await context.newPage();
  page.on('pageerror', (e) => report.errors.push(e.message));
  await context.route(artifact.library.url, async (route) => {
    report.libraryResponses++;
    await route.fulfill({
      body: library,
      contentType: 'application/wasm',
      headers: { 'access-control-allow-origin': '*', 'cross-origin-resource-policy': 'cross-origin' },
    });
  });
  report.stage = 'navigate';
  await save();
  await page.goto('http://127.0.0.1:5193/', { waitUntil: 'domcontentloaded' });
  report.stage = 'engine-init';
  await save();
  console.log('checkpoint: engine-init');
  await page.evaluate(async (artifact) => {
    const a = await navigator.gpu.requestAdapter();
    if (!a || a.info.vendor !== 'apple') throw Error('Expected actual Apple GPU');
    window.__adapter = {
      vendor: a.info.vendor,
      architecture: a.info.architecture,
      isFallbackAdapter: a.info.isFallbackAdapter,
    };
    const { WebWorkerMLCEngine, prebuiltAppConfig } = await import('/assets/lib-CSLy4uO1.js');
    const id = 'Qwen2.5-14B-Instruct-q4f16_1-MLC';
    const record = { model_id: id, overrides: { context_window_size: 2048, prefill_chunk_size: 1024 } };
    window.__record = { ...record, model: artifact.modelURL, model_lib: artifact.library.url };
    window.__progress = [];
    window.__worker = new Worker('/assets/webllm.worker-CMk6FPDh.js', { type: 'module' });
    window.__engine = new WebWorkerMLCEngine(window.__worker, {
      appConfig: { ...prebuiltAppConfig, cacheBackend: 'indexeddb', model_list: [window.__record] },
      initProgressCallback: (p) => window.__progress.push(p),
    });
    window.__engine
      .reload(id, { context_window_size: 2048, prefill_chunk_size: 1024 })
      .then(() => (window.__loaded = true))
      .catch((e) => (window.__loadError = String(e)));
  }, artifact);
  timer = setInterval(async () => {
    try {
      report.progress = await page.evaluate(() => window.__progress);
      await save();
    } catch {}
  }, 5000);
  await page.waitForFunction(() => window.__loaded || window.__loadError, null, { timeout: 600000 });
  Object.assign(
    report,
    await page.evaluate(() => ({
      adapter: window.__adapter,
      modelRecord: window.__record,
      loaded: window.__loaded,
      loadError: window.__loadError,
      progress: window.__progress,
    })),
  );
  await save();
  if (report.loadError) throw Error(report.loadError);
  const complete = async (id, variant, request) => {
    report.stage = id + ':' + variant;
    await save();
    await page.evaluate(async (request) => {
      await window.__engine.resetChat();
      window.__completion = null;
      window.__completionError = null;
      window.__engine.chat.completions
        .create(request)
        .then((x) => (window.__completion = x))
        .catch((e) => (window.__completionError = String(e)));
    }, request);
    await page.waitForFunction(() => window.__completion || window.__completionError, null, { timeout: 300000 });
    const result = await page.evaluate(() => ({ completion: window.__completion, error: window.__completionError }));
    report.outputs.push({ id, variant, request, ...result });
    await save();
    if (result.error) throw Error(result.error);
    return result.completion;
  };
  for (const c of cases) await complete(c.id, 'revision', c.request);
  report.libraryObservation = {
    networkResponses: report.libraryResponses,
    scope:
      'Configured exact pinned local library; warmed SDK cache may satisfy retrieval. No fresh-fetch or exact-consumption certification is asserted.',
  };
  report.finished = true;
} catch (e) {
  report.error = String(e);
  if (context) {
    const p = context.pages().at(-1);
    if (p && !p.isClosed())
      report.failureSnapshot = await p
        .evaluate(() => ({
          loaded: window.__loaded,
          loadError: window.__loadError,
          completion: window.__completion,
          completionError: window.__completionError,
          progress: window.__progress,
        }))
        .catch((e) => ({ error: String(e) }));
  }
} finally {
  if (timer) clearInterval(timer);
  await save();
  if (context) await context.close();
  report.contextClosed = true;
  await save();
}
if (!report.finished) process.exitCode = 1;
