import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import crypto from 'node:crypto';

const lab = process.env.NLI_LAB_ROOT || '/private/tmp/document-nli-lab';
const dtype = process.env.NLI_DTYPE || 'q8';
const output = process.env.NLI_REPORT || 'docs/evaluations/2026-10-03-local-nli.json';
const corpus = JSON.parse(await fs.readFile(process.env.NLI_CASES || 'docs/evaluations/2026-10-03-local-nli-cases.json', 'utf8'));
const manifest = JSON.parse(await fs.readFile(path.join(lab, 'model-assets.json'), 'utf8'));
const sdkRoot = path.join(lab, 'node_modules/@huggingface/transformers');
const sdk = JSON.parse(await fs.readFile(path.join(sdkRoot, 'package.json'), 'utf8'));
const hashFile = async (file) => {
  const hash = crypto.createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
};
for (const asset of manifest.files) {
  const file = path.join(lab, 'models', manifest.model, asset.name);
  if ((await hashFile(file)) !== asset.sha256 || (await fs.stat(file)).size !== asset.bytes)
    throw Error('Model artifact mismatch: ' + asset.name);
}
const workerSource = `
const spawned = [];
const OriginalWorker = globalThis.Worker;
if (OriginalWorker) globalThis.Worker = class extends OriginalWorker {
  constructor(url, options) { super(url, options); spawned.push(String(url)); }
};
self.addEventListener('securitypolicyviolation', e => self.postMessage({kind:'csp', directive:e.violatedDirective, blocked:e.blockedURI}));
self.onmessage = async ({data}) => {
  try {
    const began = performance.now();
    const {AutoTokenizer, AutoModelForSequenceClassification, env} = await import('/sdk/transformers.js');
    env.allowRemoteModels = false;
    env.allowLocalModels = true;
    env.localModelPath = '/models/';
    env.useBrowserCache = false;
    env.backends.onnx.wasm.wasmPaths = '/sdk/';
    env.backends.onnx.wasm.numThreads = 4;
    const tokenizer = await AutoTokenizer.from_pretrained(data.model);
    const model = await AutoModelForSequenceClassification.from_pretrained(data.model, {dtype:data.dtype, device:'wasm'});
    const labels = model.config.id2label;
    if (JSON.stringify(Object.values(labels).sort()) !== JSON.stringify(['contradiction','entailment','neutral'])) throw Error('Unexpected label mapping');
    self.postMessage({kind:'loaded', loadMs:performance.now()-began, labels, isolated:crossOriginIsolated, configuredThreads:env.backends.onnx.wasm.numThreads, spawned});
    for (const sample of data.cases) {
      const start = performance.now();
      const inputs = tokenizer(sample.premise, {text_pair:sample.hypothesis, padding:true, truncation:false});
      const tokens = inputs.input_ids.dims[1];
      if (tokens > 512) throw Error('Refusing silently truncated NLI input');
      const result = await model(inputs);
      const logits = Array.from(result.logits.data);
      if (logits.length !== 3 || !logits.every(Number.isFinite)) throw Error('Invalid classifier logits');
      const maximum = Math.max(...logits);
      const exp = logits.map(x=>Math.exp(x-maximum));
      const total = exp.reduce((a,b)=>a+b,0);
      const probabilities = Object.fromEntries(exp.map((x,i)=>[labels[i],x/total]));
      const topLabel = Object.keys(probabilities).sort((a,b)=>probabilities[b]-probabilities[a])[0];
      self.postMessage({kind:'row', id:sample.id, tokens, encoded:tokenizer.decode(Array.from(inputs.input_ids.data, Number), {skip_special_tokens:false}), logits, probabilities, topLabel, inferenceMs:performance.now()-start});
    }
    await model.dispose();
    self.postMessage({kind:'done'});
  } catch(error) { self.postMessage({kind:'error', error:String(error), stack:error.stack}); }
};
`;
const pageSource = `
window.__nli = {rows:[], violations:[], status:'waiting'};
const worker = new Worker('/worker.mjs', {type:'module'});
worker.onerror = e => { window.__nli.status='failed'; window.__nli.error=e.message; };
worker.onmessage = ({data}) => {
  if(data.kind==='loaded') { window.__nli.runtime=data; window.__nli.status='running'; }
  if(data.kind==='row') window.__nli.rows.push(data);
  if(data.kind==='csp') window.__nli.violations.push(data);
  if(data.kind==='error') { window.__nli.status='failed'; window.__nli.error=data; }
  if(data.kind==='done') { window.__nli.status='completed'; worker.terminate(); }
};
window.__startNli = data => worker.postMessage(data);
`;
const policy = "default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:; connect-src 'self'; base-uri 'none'";
const server = http.createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  res.setHeader('Content-Security-Policy', policy);
  res.setHeader('Cache-Control', 'no-store');
  const bodies = {'/':'<!doctype html><meta charset="utf-8"><title>Local NLI experiment</title><script type="module" src="/page.mjs"></script>', '/page.mjs':pageSource, '/worker.mjs':workerSource};
  if (pathname in bodies) {
    res.setHeader('Content-Type', pathname==='/'?'text/html':'text/javascript');
    res.end(bodies[pathname]);
    return;
  }
  const root = pathname.startsWith('/sdk/') ? path.join(sdkRoot, 'dist') : pathname.startsWith('/models/') ? path.join(lab, 'models') : null;
  const relative = pathname.replace(/^\/(sdk|models)\//, '');
  const file = root && path.resolve(root, relative);
  if (!file || !file.startsWith(root + path.sep)) { res.writeHead(404); res.end(); return; }
  try {
    const stat = await fs.stat(file);
    if (!stat.isFile()) throw Error('Not a file');
    res.setHeader('Content-Type', file.endsWith('.wasm')?'application/wasm':file.endsWith('.js')||file.endsWith('.mjs')?'text/javascript':file.endsWith('.json')?'application/json':'application/octet-stream');
    res.setHeader('Content-Length', stat.size);
    createReadStream(file).pipe(res);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(resolve=>server.listen(0, '127.0.0.1', resolve));
const origin = 'http://127.0.0.1:' + server.address().port;
const report = {scope:'Independent local multilingual NLI WASM feasibility experiment, separate Dedicated Worker and strict self-only CSP. Predeclared controls plus archived generation failures; no product integration, IM, native document operation, model coexistence, offline or physical-device claim.', status:'running', dtype, sdkVersion:sdk.version, model:manifest, decision:corpus.decision, policy, cases:corpus.cases, rows:[], errors:[], requests:[], externalRequests:[], probeSHA256:await hashFile(new URL(import.meta.url)), sdkSHA256:await hashFile(path.join(sdkRoot, 'dist/transformers.js'))};
const browser = await chromium.launch();
const context = await browser.newContext({serviceWorkers:'block'});
context.on('request', req=> {
  const row={url:req.url(), method:req.method(), bodyBytes:req.postDataBuffer()?.length??0};
  report.requests.push(row);
  if(new URL(req.url()).origin!==origin) report.externalRequests.push(row);
});
await context.route('**/*', route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
const page = await context.newPage();
page.on('pageerror', error=>report.errors.push(error.message));
const save = ()=>fs.writeFile(output, JSON.stringify(report,null,2)+'\n');
try {
  await page.goto(origin, {waitUntil:'domcontentloaded', timeout:30000});
  await page.waitForFunction(()=>typeof window.__startNli==='function',null,{timeout:30000});
  await page.evaluate(data=>window.__startNli(data), {model:manifest.model, dtype, cases:corpus.cases.map(({id,premise,hypothesis})=>({id,premise,hypothesis}))});
  const deadline = Date.now()+180000;
  let seen=0;
  while(Date.now()<deadline) {
    const state=await page.evaluate(()=>window.__nli);
    report.runtime=state.runtime;
    report.violations=state.violations;
    report.rows=state.rows.map(row=>({...row, supported:row.topLabel===corpus.decision.supportedLabel&&row.probabilities.entailment>=corpus.decision.minimumProbability}));
    if(report.rows.length!==seen) { seen=report.rows.length; console.log('NLI rows',seen); await save(); }
    if(state.status==='failed') throw Error(JSON.stringify(state.error));
    if(state.status==='completed') { report.status='completed'; break; }
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  if(report.status!=='completed') throw Error('NLI experiment deadline exceeded');
  if(report.rows.length!==corpus.cases.length) throw Error('Missing inference rows');
} catch(error) { report.status='failed'; report.error=String(error); process.exitCode=1; }
finally {
  await save();
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
