import { afterEach, describe, expect, it, vi } from 'vitest';
import { OpenAIProvider } from '../../packages/agent-core/src/llm/openai';
import { clearApiKey, setApiKey } from '../../packages/agent-core/src/llm/keys';

const okResponse = (body: unknown): Response => ({ ok: true, json: async () => body }) as unknown as Response;

describe('OpenAIProvider', () => {
  afterEach(() => clearApiKey('openai'));

  it('uses a compatible endpoint, custom model and bearer key', async () => {
    const fetchImpl = vi.fn(async (_url: string, _init: RequestInit) =>
      okResponse({ choices: [{ message: { content: 'ok' } }] }),
    );
    await new OpenAIProvider({
      apiKey: 'custom-key',
      model: 'custom-model',
      baseURL: 'https://inference.example/v1/',
      fetchImpl,
    }).chat([{ role: 'user', content: 'hello' }], []);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://inference.example/v1/chat/completions');
    expect(JSON.parse(init.body as string).model).toBe('custom-model');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer custom-key');
  });

  it('is not ready without a key', () => {
    expect(new OpenAIProvider({ apiKey: undefined }).isReady()).toBe(false);
  });

  it('reads the key from storage', () => {
    setApiKey('openai', 'sk-oai-stored');
    expect(new OpenAIProvider().isReady()).toBe(true);
  });

  it('posts an OpenAI chat-completions request with auth and parses the result', async () => {
    const fetchImpl = vi.fn(async (_url: string, _init: RequestInit) =>
      okResponse({ choices: [{ message: { content: 'hi there' }, finish_reason: 'stop' }] }),
    );
    const provider = new OpenAIProvider({ apiKey: 'sk-oai-123', model: 'gpt-4o-mini', fetchImpl });

    const result = await provider.chat(
      [{ role: 'user', content: 'go' }],
      [{ name: 'insert_text', description: 'd', inputSchema: { type: 'object' } }],
    );

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sk-oai-123');
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe('gpt-4o-mini');
    expect(body.tool_choice).toBe('auto');
    expect(body.messages[0].role).toBe('system');
    expect(result.text).toBe('hi there');
  });

  it('throws with status detail on a non-ok response', async () => {
    const fetchImpl = vi.fn(
      async () => ({ ok: false, status: 401, text: async () => 'Unauthorized' }) as unknown as Response,
    );
    const provider = new OpenAIProvider({ apiKey: 'bad', fetchImpl });
    await expect(provider.chat([{ role: 'user', content: 'x' }], [])).rejects.toThrow('401');
  });

  it('throws when no key is configured', async () => {
    const provider = new OpenAIProvider({ apiKey: undefined });
    await expect(provider.chat([{ role: 'user', content: 'x' }], [])).rejects.toThrow('not configured');
  });
});

it('cancels a pending cloud request when Stop aborts its signal', async () => {
  const abort = new AbortController();
  const provider = new OpenAIProvider({
    apiKey: 'test',
    fetchImpl: async (_url, init) => {
      expect(init.signal).toBe(abort.signal);
      return new Promise((_resolve, reject) => {
        init.signal!.addEventListener('abort', () => reject(init.signal!.reason), { once: true });
      });
    },
  });
  const pending = (provider as import('@ranuts/agent-core/llm/types').LLMProvider).chat([], [], abort.signal);
  abort.abort();
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
});

it('does not send an already cancelled cloud request', async () => {
  const fetchImpl = vi.fn(async () => okResponse({ choices: [] }));
  const abort = new AbortController();
  abort.abort();
  const provider = new OpenAIProvider({ apiKey: 'test', fetchImpl });
  await expect(
    (provider as import('@ranuts/agent-core/llm/types').LLMProvider).chat([], [], abort.signal),
  ).rejects.toMatchObject({ name: 'AbortError' });
  expect(fetchImpl).not.toHaveBeenCalled();
});
