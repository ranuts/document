import {build} from 'vite';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const phase=process.argv[2];if(!['before','after'].includes(phase))throw Error('Choose before or after');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const report={phase,probeSHA256:hash(await fs.readFile(new URL(import.meta.url))),entrySHA256:hash(await fs.readFile('index.ts')),cloudModules:[],chunks:[]};
await build({build:{outDir:'.scratch/local-entry-'+phase,copyPublicDir:false,emptyOutDir:true},plugins:[{name:'owned-local-entry-audit',generateBundle(_options,bundle){
 const bytes=new Map();for(const item of Object.values(bundle)){if(item.type!=='chunk')continue;report.chunks.push({name:item.fileName,bytes:Buffer.byteLength(item.code),sha256:hash(item.code)});for(const [id,m] of Object.entries(item.modules))bytes.set(id,m.renderedLength);}
 for(const id of this.getModuleIds())if(/@anthropic-ai|\/llm\/(?:anthropic|openai|ollama|gemini|factory)\.js$/.test(id))report.cloudModules.push({id:id.replace(process.cwd()+'/', ''),renderedBytes:bytes.get(id)??0});
 report.cloudModules.sort((a,b)=>a.id.localeCompare(b.id));
}}]});
report.writtenChunks=[];
const dir='.scratch/local-entry-'+phase;
for(const file of await fs.readdir(dir,{recursive:true})){if(file.endsWith('.js')){const data=await fs.readFile(dir+'/'+file);report.writtenChunks.push({name:file,bytes:data.length,sha256:hash(data)});}}
await fs.writeFile('docs/evaluations/2026-10-05-local-entry-'+phase+'.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({phase,parsedCloudModules:report.cloudModules.length,renderedCloudBytes:report.cloudModules.reduce((sum,m)=>sum+m.renderedBytes,0)}));
