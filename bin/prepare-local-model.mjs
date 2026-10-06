// Metadata-only by default; --download mirrors a pinned model into public/models.
import { prebuiltAppConfig } from '../packages/agent-core/node_modules/@mlc-ai/web-llm/lib/index.js';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { resolve } from 'node:path';

const modelId = process.argv.find((arg) => arg.startsWith('--model='))?.slice(8) || 'Qwen3-1.7B-q4f16_1-MLC';
const record = prebuiltAppConfig.model_list.find((item) => item.model_id === modelId);
if (!record) throw new Error('Choose a model ID in the installed WebLLM catalog');
const repo = new URL(record.model).pathname.replace(/^\//, '').replace(/\/$/, '');
if (new URL(record.model).hostname !== 'huggingface.co')
  throw new Error('Only Hugging Face catalog models are supported by this preparation script');
const get = async (url) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed: ${response.status} ${url}`);
  return response;
};
const metadata = await (await get(`https://huggingface.co/api/models/${repo}`)).json();
const revision = metadata.sha;
if (!/^[a-f0-9]{40}$/.test(revision)) throw new Error('Missing immutable model revision');
const files = metadata.siblings
  .map((item) => item.rfilename)
  .filter((name) => /\.(json|bin|model|txt)$/.test(name) || /^(LICENSE|NOTICE|README)/i.test(name));
const root = resolve('public/models', modelId);
const plan = { modelId, repo, revision, runtime: record.model_lib, files, directory: root };
console.log(JSON.stringify(plan, null, 2));
if (process.argv.includes('--download')) {
  await mkdir(root, { recursive: true });
  for (const file of [...files, 'model.wasm']) {
    if (file.includes('..') || file.startsWith('/')) throw new Error('Unsafe artifact path');
    const target = resolve(root, file);
    await mkdir(resolve(target, '..'), { recursive: true });
    const url = file === 'model.wasm' ? record.model_lib : `https://huggingface.co/${repo}/resolve/${revision}/${file}`;
    const response = await get(url);
    await pipeline(Readable.fromWeb(response.body), createWriteStream(`${target}.part`));
    await rename(`${target}.part`, target);
    console.log(`Saved ${file}`);
  }
  await writeFile(resolve(root, 'source-manifest.json'), JSON.stringify(plan, null, 2));
  console.log(
    `VITE_LOCAL_MODEL_ID=${modelId}\nVITE_LOCAL_MODEL_URL=/models/${modelId}/\nVITE_LOCAL_MODEL_LIB_URL=/models/${modelId}/model.wasm`,
  );
}
