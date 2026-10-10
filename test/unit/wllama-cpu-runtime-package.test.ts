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
    if (name === 'client/index.js') {
      const patch = await readFile(
        'packages/agent-core/vendor/wllama-count/source/cpu-bounded-blob-read.patch',
        'utf8',
      );
      expect(createHash('sha256').update(patch).digest('hex')).toBe(
        manifest.entries['source/cpu-bounded-blob-read.patch'],
      );
      const lines = patch
        .split('\n')
        .filter((line) => /^[ +-]/.test(line) && !line.startsWith('---') && !line.startsWith('+++'));
      const before = lines
        .filter((line) => !line.startsWith('+'))
        .map((line) => line.slice(1))
        .join('\n');
      const after = lines
        .filter((line) => !line.startsWith('-'))
        .map((line) => line.slice(1))
        .join('\n');
      const current = bytes.toString();
      expect(current.split(after)).toHaveLength(2);
      expect(createHash('sha256').update(current.replace(after, before)).digest('hex')).toBe(accepted.entries[name]);
    } else expect(hash).toBe(accepted.entries[name]);
  }
});
