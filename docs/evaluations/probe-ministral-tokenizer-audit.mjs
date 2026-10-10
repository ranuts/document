import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const repositories = [
  { repo: 'mlc-ai/Ministral-3-3B-Instruct-2512-BF16-q4f16_1-MLC', revision: 'eebad8da4ac64947d8dc9507007fc0279bf52454', name: 'mlc' },
  { repo: 'mistralai/Ministral-3-3B-Instruct-2512-BF16', revision: 'b6d637bef2393152b3da2b2fde72eecdee30557e', name: 'official' },
];
const report = { date: new Date().toISOString(), probeSHA256: sha(await fs.readFile(new URL(import.meta.url))), repositories, files: [], scope: 'Pinned tokenizer/config artifact comparison; not actual browser tokenizer execution, weight integrity or runtime correctness.' };
await fs.mkdir('.scratch/ministral-tokenizer-audit', { recursive: true });
const parsed = {};
for (const entry of repositories) {
  parsed[entry.name] = {};
  for (const file of ['tokenizer.json', 'tokenizer_config.json']) {
    const url = `https://huggingface.co/${entry.repo}/resolve/${entry.revision}/${file}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
    if (!response.ok) throw Error(`${response.status}: ${url}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    const artifact = `.scratch/ministral-tokenizer-audit/${entry.name}-${file}`;
    await fs.writeFile(artifact, bytes);
    const data = JSON.parse(bytes.toString());
    parsed[entry.name][file] = data;
    report.files.push({ name: entry.name, file, url, bytes: bytes.length, sha256: sha(bytes), artifact });
  }
}
report.tokenizerBytesIdentical = report.files[0].sha256 === report.files[2].sha256;
report.tokenizerConfigBytesIdentical = report.files[1].sha256 === report.files[3].sha256;
report.details = {};
for (const name of ['mlc', 'official']) {
  const tokenizer = parsed[name]['tokenizer.json'];
  const config = parsed[name]['tokenizer_config.json'];
  report.details[name] = {
    modelType: tokenizer.model.type, vocabEntries: Object.keys(tokenizer.model.vocab).length,
    specialTokens: tokenizer.added_tokens.filter((t) => ['<s>', '</s>', '[INST]', '[/INST]', '[SYSTEM_PROMPT]', '[/SYSTEM_PROMPT]'].includes(t.content)),
    normalizer: tokenizer.normalizer, preTokenizer: tokenizer.pre_tokenizer,
    bosToken: config.bos_token, eosToken: config.eos_token, tokenizerClass: config.tokenizer_class,
    chatTemplate: config.chat_template,
  };
}
await fs.writeFile('docs/evaluations/2026-10-04-ministral-tokenizer-audit.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ tokenizerBytesIdentical: report.tokenizerBytesIdentical, tokenizerConfigBytesIdentical: report.tokenizerConfigBytesIdentical }));
