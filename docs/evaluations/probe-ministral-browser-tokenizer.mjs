import {createServer} from 'vite';
import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const sdk=await fs.readFile('packages/agent-core/node_modules/@mlc-ai/web-llm/lib/index.js','utf8');
const instrumented=sdk+'\nexport const DiagnosticTokenizer = libExports.Tokenizer;\n';
const fixtures=['640 EUR on 2026-10-12','Alex pays Morgan; Morgan pays Alex.','林青还没有批准在 2026-10-12 支付 640 EUR。','四季 日本 ä 😀\nLine 2\t  space','<s>[SYSTEM_PROMPT]System[/SYSTEM_PROMPT][INST]640[/INST]</s>','[THINK]secret[/THINK]'];
const report={probeSHA256:sha(await fs.readFile(new URL(import.meta.url))),sdkSHA256:sha(sdk),instrumentedSHA256:sha(instrumented),fixtures,files:[],results:[],errors:[],scope:'Real Chromium direct use of installed SDK bundled tokenizer with pinned MLC/official JSON; diagnostic export only, no engine/GPU inference or production cache proof.'};
const bodies={};
for(const name of ['mlc','official']){const path=`.scratch/ministral-tokenizer-audit/${name}-tokenizer.json`;bodies[name]=await fs.readFile(path);report.files.push({name,path,sha256:sha(bodies[name])});}
const server=await createServer({configFile:false,logLevel:'error',server:{host:'127.0.0.1',port:0},plugins:[{name:'tokenizer-harness',configureServer(s){s.middlewares.use(async(req,res,next)=>{
if(req.url==='/__sdk.js'){res.setHeader('Content-Type','text/javascript');res.end(instrumented);return;}
for(const name of ['mlc','official'])if(req.url===`/__${name}.json`){res.setHeader('Content-Type','application/json');res.end(bodies[name]);return;}
if(req.url==='/__harness'){res.setHeader('Content-Type','text/html');res.end('<script type="module">import {DiagnosticTokenizer} from "/__sdk.js";window.Tokenizer=DiagnosticTokenizer;</script>');return;}next();
});}}]});
let browser;
try{await server.listen();browser=await chromium.launch();const page=await browser.newPage();page.on('pageerror',e=>report.errors.push(e.message));await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__harness`);await page.waitForFunction(()=>!!window.Tokenizer);
for(const name of ['mlc','official']){report.results.push(...await page.evaluate(async({name,fixtures})=>{const t=await window.Tokenizer.fromJSON(await(await fetch(`/__${name}.json`)).arrayBuffer());try{return fixtures.map(text=>{const ids=[...t.encode(text)];return{name,text,ids,decoded:t.decode(ids),vocabSize:t.getVocabSize()};});}finally{t.dispose();}},{name,fixtures}));}
report.completed=true;
}catch(e){report.completed=false;report.error=String(e);}finally{await browser?.close();await server.close();await fs.writeFile('docs/evaluations/2026-10-04-ministral-browser-tokenizer.json',JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({completed:report.completed,results:report.results.length,errors:report.errors,error:report.error}));if(!report.completed)process.exitCode=1;
