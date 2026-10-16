import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

it('resolves every assistant design-token role against the installed foundation or host hooks', () => {
  const host = readFileSync('styles/assistant.css', 'utf8');
  const foundation = readFileSync('public/ran-tokens.css', 'utf8');
  const definitions = new Set([...`${foundation}\n${host}`.matchAll(/(--ran-[\w-]+)\s*:/g)].map((m) => m[1]));
  const missing = [...new Set([...host.matchAll(/var\((--ran-[\w-]+)/g)].map((m) => m[1]))].filter(
    (name) => !definitions.has(name),
  );
  // Fallbacks cannot silently conceal a misspelled or removed design role.
  expect(missing).toEqual([]);
});
