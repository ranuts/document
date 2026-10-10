import { prebuiltAppConfig } from '../../packages/agent-core/node_modules/@mlc-ai/web-llm/lib/index.js';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const ids = ['Llama-3.2-1B-Instruct-q4f16_1-MLC', 'gemma3-1b-it-q4f16_1-MLC', 'Ministral-3-3B-Instruct-2512-BF16-q4f16_1-MLC', 'Qwen3-4B-Instruct-2507-q4f16_1-MLC'];
const report = { date: new Date().toISOString(), probeSHA256: sha(await fs.readFile(new URL(import.meta.url))), sdk: '0.2.85', scope: 'Installed prebuilt model catalog and direct official MLC repository config fetches only; no inference, weight downloads or resource measurements.', candidates: [] };
for (const id of ids) {
  const record = prebuiltAppConfig.model_list.find((m) => m.model_id === id);
  const row = { id, catalogEntry: record ?? null };
  if (record) {
    const url = record.model + '/resolve/main/mlc-chat-config.json';
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
      const bytes = Buffer.from(await response.arrayBuffer());
      row.config = { url, resolvedURL: response.url, status: response.status, bytes: bytes.length, sha256: sha(bytes) };
      if (response.ok) {
        const config = JSON.parse(bytes.toString());
        row.config.data = config;
      }
    } catch (e) { row.configError = String(e); }
  }
  report.candidates.push(row);
}
await fs.writeFile('docs/evaluations/2026-10-04-local-writing-model-candidates.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report.candidates.map((r) => ({ id: r.id, catalog: !!r.catalogEntry, configStatus: r.config?.status, error: r.configError }))));
