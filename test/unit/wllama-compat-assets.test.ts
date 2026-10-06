import { expect, it } from 'vitest';
import { getWllamaCompatibility } from '../../packages/agent-core/src/llm/wllama-compat-assets';

const assets = { wasm: '/assets/compat.wasm', worker: { code: 'var Module = {};' } };
it('does not load compatibility assets when native modules and JSPI are supported', async () => {
  expect(
    await getWllamaCompatibility({ Suspending: class {}, validate: () => true }, async () => {
      throw new Error('unexpected download');
    }),
  ).toBeNull();
});
it.each([
  { Suspending: class {}, validate: () => false },
  { validate: () => true },
  {
    Suspending: class {},
    validate: () => {
      throw new Error('Unavailable');
    },
  },
])('loads local compatibility resources when a required native feature is unavailable: %j', async (capabilities) => {
  expect(await getWllamaCompatibility(capabilities, async () => assets)).toEqual(assets);
});
it('propagates local asset failure without silently choosing a CDN', async () => {
  await expect(
    getWllamaCompatibility({ validate: () => false }, async () => {
      throw new Error('Local asset missing');
    }),
  ).rejects.toThrow('Local asset missing');
});
