import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const file=process.argv[2];const output=process.argv[3];
const source=await fs.readFile(file,'utf8');const marker='export const isSupportMem64 = (): boolean => {';
const start=source.indexOf(marker);const end=source.indexOf('\n};',start)+3;
if(start<0||end<3)throw Error('Missing source marker');
const code=source.slice(start,end).replace('export const isSupportMem64 = (): boolean =>','const isSupportMem64 = () =>').replace(' as any','')+'\nreturn isSupportMem64();';
const tests=[];
for(const acceptsModule of [false,true]){
 let constructorCalls=0;const validated=[];
 const capability={Memory:class{constructor(){constructorCalls++;}},validate(bytes){validated.push([...bytes]);return acceptsModule;}};
 const actual=Function('WebAssembly',code)(capability);
 tests.push({acceptsModule,actual,constructorCalls,validated});
}
await fs.writeFile(output,JSON.stringify({scope:'Exact capability function extracted from TypeScript source; mocked constructor/module validation',sourceSHA256:crypto.createHash('sha256').update(source).digest('hex'),tests},null,2)+'\n');
if(tests.some(x=>x.actual!==x.acceptsModule))process.exitCode=1;
