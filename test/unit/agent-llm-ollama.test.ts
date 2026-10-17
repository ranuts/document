import { afterEach, describe, expect, it, vi } from 'vitest';
import { OllamaProvider } from '@ranuts/agent-core/llm/ollama';
import { clearApiKey } from '@ranuts/agent-core/llm/keys';

const okResponse = (body: unknown): Response => ({ ok: true, json: async () => body }) as unknown as Response;

describe('OllamaProvider', () => {
  afterEach(() => clearApiKey('ollama'));

  it('is ready without a key (local server)', () => {
    expect(new OllamaProvider().isReady()).toBe(true);
  });

  it('posts an OpenAI-compatible request to the local Ollama endpoint, no auth by default', async () => {
    const fetchImpl = vi.fn(async (_url: string, _init: RequestInit) =>
      okResponse({ choices: [{ message: { content: 'local reply' }, finish_reason: 'stop' }] }),
    );
    const provider = new OllamaProvider({ ollamaModel: 'qwen2.5', fetchImpl });

    const result = await provider.chat(
      [{ role: 'user', content: 'go' }],
      [{ name: 'insert_text', description: 'd', inputSchema: { type: 'object' } }],
    );

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('http://localhost:11434/v1/chat/completions');
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe('qwen2.5');
    expect(body.tool_choice).toBe('auto');
    expect(result.text).toBe('local reply');
  });

  it('sends auth when a key is provided (remote/proxied Ollama)', async () => {
    const fetchImpl = vi.fn(async (_url: string, _init: RequestInit) =>
      okResponse({ choices: [{ message: { content: 'x' }, finish_reason: 'stop' }] }),
    );
    const provider = new OllamaProvider({ ollamaApiKey: 'proxy-token', fetchImpl });
    await provider.chat([{ role: 'user', content: 'x' }], []);
    const init = fetchImpl.mock.calls[0][1];
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer proxy-token');
  });

  it('sends plain chat without tool-only fields to a strict compatible endpoint', async () => {
    const provider = new OllamaProvider({
      fetchImpl: async (_url, init) => {
        const body = JSON.parse(init.body as string);
        if ('tools' in body || 'tool_choice' in body) return new Response('Unexpected tool fields', { status: 400 });
        return okResponse({ choices: [{ message: { content: 'Plain reply' }, finish_reason: 'stop' }] });
      },
    });

    expect((await provider.chat([{ role: 'user', content: 'Hello' }], [])).text).toBe('Plain reply');
  });

  it('respects a custom base URL', async () => {
    const fetchImpl = vi.fn(async (_url: string, _init: RequestInit) =>
      okResponse({ choices: [{ message: { content: 'x' }, finish_reason: 'stop' }] }),
    );
    const provider = new OllamaProvider({ ollamaBaseURL: 'http://box:11434/v1', fetchImpl });
    await provider.chat([{ role: 'user', content: 'x' }], []);
    expect(fetchImpl.mock.calls[0][0]).toBe('http://box:11434/v1/chat/completions');
  });

  it('throws with status detail on a non-ok response', async () => {
    const fetchImpl = vi.fn(
      async (_url: string, _init: RequestInit) =>
        ({ ok: false, status: 500, text: async () => 'boom' }) as unknown as Response,
    );
    const provider = new OllamaProvider({ fetchImpl });
    await expect(provider.chat([{ role: 'user', content: 'x' }], [])).rejects.toThrow('500');
  });
});
