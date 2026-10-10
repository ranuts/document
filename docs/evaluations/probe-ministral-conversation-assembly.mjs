import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const source=await fs.readFile('packages/agent-core/node_modules/@mlc-ai/web-llm/lib/index.js','utf8');
const instrumented=source+'\nexport {getConversationFromChatCompletionRequest as DiagnosticConversation};\n';
await fs.mkdir('.scratch/ministral-template-audit',{recursive:true});
const modulePath='.scratch/ministral-template-audit/sdk-conversation.mjs';
await fs.writeFile(modulePath,instrumented);
const {DiagnosticConversation}=await import(pathToFileURL(process.cwd()+'/'+modulePath));
const baselineBytes=await fs.readFile('docs/evaluations/2026-10-04-ministral-writing-semantic-pairs.json');
const baseline=JSON.parse(baselineBytes);
const catalogBytes=await fs.readFile('docs/evaluations/2026-10-04-local-writing-model-candidates.json');
const catalog=JSON.parse(catalogBytes);
const config=catalog.candidates.find(r=>r.id===baseline.modelId).config.data;
const report={probeSHA256:sha(await fs.readFile(new URL(import.meta.url))),sdkSHA256:sha(source),instrumentedSHA256:sha(instrumented),baselineSHA256:sha(baselineBytes),catalogSHA256:sha(catalogBytes),scope:'Installed SDK conversation assembly with recorded actual Worker requests and separately fetched MLC config; no direct internal GPU prefill capture.',results:[]};
for(const row of baseline.results){const request=row.inputs[0].request;const conv=DiagnosticConversation(request,config,true);conv.appendReplyHeader('assistant');const prompts=conv.getPromptArray(config);report.results.push({id:row.id,systemPrefixTokenIds:config.conv_template.system_prefix_token_ids,prompts,unexpandedFunctionPlaceholder:prompts.some(p=>typeof p==='string'&&p.includes('{function_string}'))});}
await fs.writeFile('docs/evaluations/2026-10-04-ministral-conversation-assembly.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report.results.map(r=>({id:r.id,unexpandedFunctionPlaceholder:r.unexpandedFunctionPlaceholder}))));
