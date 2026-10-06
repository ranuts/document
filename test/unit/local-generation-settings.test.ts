import { expect, it, vi } from 'vitest';
import { WebLLMProvider } from '../../packages/agent-core/src/llm/webllm';
import { WllamaProvider } from '../../packages/agent-core/src/llm/wllama';

const reply = { choices: [{ message: { content: 'answer' }, finish_reason: 'stop' }] };
it('applies local generation settings to WebLLM without reloading its engine', async () => {
  const create = vi.fn(async (_body: Record<string, unknown>) => reply);
  const provider = new WebLLMProvider({ engine: { chat: { completions: { create } } } });
  provider.setGenerationOptions({ systemPrompt: 'Respond briefly.', temperature: 0.2, topP: 0.9, maxTokens: 128 });
  await provider.chat([{ role: 'user', content: 'hello' }], []);
  expect(create.mock.calls[0][0]).toMatchObject({
    temperature: 0.2,
    top_p: 0.9,
    max_tokens: 128,
    messages: [
      { role: 'system', content: expect.stringContaining('Respond briefly.') },
      { role: 'user', content: 'hello' },
    ],
  });
  expect(provider.isReady()).toBe(true);
});

it('applies the same settings to CPU inference without recreating the runtime', async () => {
  const create = vi.fn(async (_body: Record<string, unknown>) => reply);
  const factory = vi.fn(async () => ({
    isModelLoaded: () => true,
    createChatCompletion: create,
    exit: async () => {},
  }));
  const provider = new WllamaProvider({ engineFactory: factory });
  await provider.preload();
  provider.setGenerationOptions({ systemPrompt: 'Respond briefly.', temperature: 0.2, topP: 0.9, maxTokens: 128 });
  await provider.chat([{ role: 'user', content: 'hello' }], []);
  expect(create.mock.calls[0][0]).toMatchObject({
    temperature: 0.2,
    top_p: 0.9,
    max_tokens: 128,
    messages: [
      { role: 'system', content: 'Respond briefly.' },
      { role: 'user', content: 'hello' },
    ],
  });
  expect(factory).toHaveBeenCalledOnce();
});

it.each([
  { temperature: NaN },
  { temperature: 3 },
  { topP: 0 },
  { topP: 1.1 },
  { maxTokens: 0 },
  { maxTokens: 128.5 },
  { maxTokens: 2049 },
  { systemPrompt: 'x'.repeat(2001) },
])('rejects invalid local generation settings before running the engine: %j', (generation) => {
  expect(() => new WebLLMProvider({ generation })).toThrow(/generation|prompt|temperature|token|top/i);
  expect(() => new WllamaProvider({ generation })).toThrow(/generation|prompt|temperature|token|top/i);
});

it('keeps schema-constrained writing deterministic even when chat settings are creative', async () => {
  const create = vi.fn(async (_body: Record<string, unknown>) => reply);
  const provider = new WebLLMProvider({
    engine: { chat: { completions: { create } } },
    generation: { temperature: 1.5, maxTokens: 256 },
  });
  await provider.generateJSON([{ role: 'user', content: 'return JSON' }], { type: 'object' });
  expect(create.mock.calls[0][0]).toMatchObject({
    temperature: 0,
    max_tokens: 256,
    response_format: { type: 'json_object' },
  });
});
