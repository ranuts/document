import { describe, expect, it, vi } from 'vitest';
import { fetchProviderJson, type ProviderHttpOptions } from '../../packages/agent-core/src/llm/provider-http';
import { OpenAIProvider } from '../../packages/agent-core/src/llm/openai';
import { GeminiProvider } from '../../packages/agent-core/src/llm/gemini';
import { OllamaProvider } from '../../packages/agent-core/src/llm/ollama';

const encode = (text: string) => new TextEncoder().encode(text);

describe('provider response byte budget', () => {
  it.each([undefined, '1'])('cancels oversized bodies even when Content-Length is %s', async (length) => {
    let cancelled = false;
    const response = new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(encode('{"text":"这是超过预算的内容"}'));
        },
        cancel() {
          cancelled = true;
        },
      }),
      { headers: length ? { 'Content-Length': length } : {} },
    );
    await expect(
      fetchProviderJson(
        'test',
        'https://example.test',
        {},
        {
          maxResponseBytes: 16,
          fetchImpl: async () => response,
        },
      ),
    ).rejects.toThrow('AI response exceeds size limit');
    expect(cancelled).toBe(true);
    expect(response.body!.locked).toBe(false);
  });

  it('rejects an oversized declared body before consuming bytes', async () => {
    const cancel = vi.fn();
    const response = new Response(new ReadableStream({ cancel }), { headers: { 'Content-Length': '8388609' } });
    await expect(
      fetchProviderJson(
        'test',
        'https://example.test',
        {},
        {
          fetchImpl: async () => response,
        },
      ),
    ).rejects.toThrow('AI response exceeds size limit');
    expect(cancel).toHaveBeenCalledOnce();
  });

  it('counts encoded bytes rather than decoded characters and accepts the exact boundary', async () => {
    expect(
      await fetchProviderJson(
        'test',
        'https://example.test',
        {},
        {
          maxResponseBytes: 5,
          fetchImpl: async () => new Response('"中"'),
        },
      ),
    ).toBe('中');
    await expect(
      fetchProviderJson(
        'test',
        'https://example.test',
        {},
        {
          maxResponseBytes: 4,
          fetchImpl: async () => new Response('"中"'),
        },
      ),
    ).rejects.toThrow('AI response exceeds size limit');
  });

  it.each([0, -1, Infinity, NaN, 1.5])('rejects an invalid byte budget (%s) before transport', async (limit) => {
    const fetchImpl = vi.fn();
    await expect(
      fetchProviderJson(
        'test',
        'https://example.test',
        {},
        {
          maxResponseBytes: limit,
          fetchImpl,
        },
      ),
    ).rejects.toBeInstanceOf(RangeError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each(['openai', 'gemini', 'ollama'] as const)('honors the %s constructor byte budget', async (kind) => {
    const options: ProviderHttpOptions = { maxResponseBytes: 2, fetchImpl: async () => new Response('{} ') };
    const provider =
      kind === 'openai'
        ? new OpenAIProvider({ apiKey: 'test', ...options })
        : kind === 'gemini'
          ? new GeminiProvider({ apiKey: 'test', ...options })
          : new OllamaProvider(options);
    await expect(provider.chat([], [])).rejects.toThrow('AI response exceeds size limit');
  });
});
