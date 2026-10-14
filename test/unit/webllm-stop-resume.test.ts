import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { expect, it, vi } from 'vitest';
import { WebLLMProvider, type WebLLMEngine } from '@ranuts/agent-core/llm/webllm';

// Exercise the installed SDK's real generation/interrupt lifecycle. Only its
// GPU pipeline is synthetic, so this runs without downloading model weights.
const requireSDK = createRequire(resolve('packages/agent-core/package.json'));
const { MLCEngine } = await import(requireSDK.resolve('@mlc-ai/web-llm'));

it.each(['answer', 'routing'] as const)('can ask again after stopping SDK %s generation', async (phase) => {
  const sdk = new MLCEngine();
  let text = '';
  let stopped = false;
  const abort = new AbortController();
  let first = true;
  const pipeline = {
    getMessage: () => text,
    stopped: () => stopped,
    triggerStop: () => {
      stopped = true;
    },
    getFinishReason: () => 'stop',
    getCurRoundDecodingTotalTokens: () => 1,
    getCurRoundPrefillTotalTokens: () => 1,
    getCurRoundPrefillTokensPerSec: () => 1,
    getCurRoundDecodingTokensPerSec: () => 1,
    getCurRoundGrammarInitTotalTime: () => 0,
    getCurRoundPrefillTotalTime: () => 1,
    getCurRoundDecodingTotalTime: () => 1,
    getCurRoundGrammarPerTokenTotalTime: () => 0,
    getCurRoundLatencyBreakdown: () => undefined,
  };
  // SDK-private state is substituted only at the hardware boundary, never in
  // application code. chatCompletion/asyncGenerate/interruptGenerate stay real.
  sdk.loadedModelIdToLock.set('test-model', { acquire: async () => {}, release: async () => {} });
  vi.spyOn(sdk, 'getLLMStates').mockReturnValue(['test-model', pipeline, {}]);
  vi.spyOn(sdk, 'prefill').mockImplementation(async (...args: unknown[]) => {
    const request = args[0] as { response_format?: unknown };
    stopped = false;
    text = request.response_format ? '{"task":"chat","language":"en"}' : 'Answer';
    if (phase === 'routing' && first) abort.abort();
    first = false;
  });
  vi.spyOn(sdk, 'decode').mockImplementation(async () => {
    stopped = true;
  });
  const provider = new WebLLMProvider({ engine: sdk as WebLLMEngine });
  await expect(
    phase === 'routing'
      ? provider.generateJSON([{ role: 'user', content: 'First question' }], { type: 'object' }, abort.signal)
      : provider.chatStream([{ role: 'user', content: 'First question' }], [], () => abort.abort(), abort.signal),
  ).rejects.toMatchObject({ name: 'AbortError' });
  expect(provider.isReady()).toBe(true);
  for (let turn = 0; turn < 2; turn++) {
    const route = await provider.generateJSON([{ role: 'user', content: 'Continue' }], { type: 'object' });
    expect(JSON.parse(route.text)).toEqual({ task: 'chat', language: 'en' });
    expect((await provider.chat([{ role: 'user', content: 'Continue' }], [])).text).toBe('Answer');
  }
});
