import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const bundle=process.argv[2];const output=process.argv[3];
const {ProxyToWorker}=await import(bundle);
const errors=[];process.on('unhandledRejection',e=>errors.push(String(e)));
const logger={debug(){},log(){},warn(){},error(){throw Error('Diagnostic logger failure');}};
const wait=async p=>Promise.race([p.then(()=>({state:'resolved'}),e=>({state:'rejected',error:String(e)})),new Promise(r=>setTimeout(()=>r({state:'pending'}),50))]);
const make=()=>{const p=new ProxyToWorker({wasmPath:'unused',compat:true},1,false,logger);let terminated=0;p.worker={postMessage(){},terminate(){terminated++;}};return {p,get terminated(){return terminated;}};};
const retired=make();const first=retired.p.wllamaStart();first.catch(()=>{});await retired.p.wllamaExit();const before=await wait(first);const late=await wait(retired.p.wllamaStart());
const aborted=make();const pending=aborted.p.wllamaStart();pending.catch(()=>{});let synchronousError;
try{aborted.p.onRecvMsg({data:{verb:'signal.abort',args:['abort',{message:'Diagnostic native failure'},null,null]}});}catch(e){synchronousError=String(e);}
const abortResult=await wait(pending);const abortLate=await wait(aborted.p.wllamaStart());
const result={scope:'Compiled source proxy with mock Worker transport; not actual WASM or IM Stop',bundleSHA256:crypto.createHash('sha256').update(await fs.readFile(bundle)).digest('hex'),retirement:{before,late,terminated:retired.terminated},abort:{result:abortResult,late:abortLate,terminated:aborted.terminated,synchronousError},errors};
await fs.writeFile(output,JSON.stringify(result,null,2)+'\n');
if([before,late,abortResult,abortLate].some(x=>x.state!=='rejected')||errors.length||synchronousError)process.exitCode=1;
