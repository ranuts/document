import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';

it('ships one count client with the exact browser-verified default and compatibility artifacts', async () => {
  const manifest = JSON.parse(await readFile('packages/agent-core/vendor/wllama-count/manifest.json', 'utf8'));
  const accepted = JSON.parse(await readFile('docs/evaluations/2026-10-04-cpu-count-dual-package.json', 'utf8'));
  for (const name of [
    'client/index.js',
    'native/default/wllama.js',
    'native/default/wllama.wasm',
    'native/compat/wllama.js',
    'native/compat/wllama.wasm',
  ]) {
    const bytes = await readFile('packages/agent-core/vendor/wllama-count/' + name);
    const hash = createHash('sha256').update(bytes).digest('hex');
    expect(hash).toBe(manifest.entries[name]);
    expect(hash).toBe(accepted.entries[name]);
  }
});
