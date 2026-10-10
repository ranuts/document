import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  GeminiProvider,
  parseGeminiResponse,
  toGeminiContents,
  toGeminiTools,
} from '../../packages/agent-core/src/llm/gemini';
import { clearApiKey, setApiKey } from '../../packages/agent-core/src/llm/keys';
import type { LLMMessage } from '@ranuts/agent-core/llm/types';

const okResponse = (body: unknown): Response => ({ ok: true, json: async () => body }) as unknown as Response;

describe('gemini conversion', () => {
  it('maps tools to functionDeclarations, omitting params with no properties', () => {
    const tools = toGeminiTools([
      {
        name: 'insert_text',
        description: 'd',
        inputSchema: { type: 'object', properties: { text: { type: 'string' } } },
      },
      { name: 'get_state', description: 'g', inputSchema: { type: 'object' } },
    ]);
    const decls = (tools[0] as { functionDeclarations: Array<Record<string, unknown>> }).functionDeclarations;
    expect(decls[0]).toEqual({
      name: 'insert_text',
      description: 'd',
      parameters: { type: 'object', properties: { text: { type: 'string' } } },
    });
    expect(decls[1]).toEqual({ name: 'get_state', description: 'g' }); // no parameters
  });

  it('returns no tools entry when the tool list is empty', () => {
    expect(toGeminiTools([])).toEqual([]);
  });

  it('maps roles and resolves a tool_result name from the prior tool_use id', () => {
    const messages: LLMMessage[] = [
      { role: 'user', content: 'edit it' },
      {
        role: 'assistant',
        content: [{ type: 'tool_use', id: 'insert_text-0', name: 'insert_text', input: { text: 'hi' } }],
      },
      { role: 'user', content: [{ type: 'tool_result', toolUseId: 'insert_text-0', content: '{"inserted":true}' }] },
    ];
    expect(toGeminiContents(messages)).toEqual([
      { role: 'user', parts: [{ text: 'edit it' }] },
      { role: 'model', parts: [{ functionCall: { name: 'insert_text', args: { text: 'hi' } } }] },
      { role: 'user', parts: [{ functionResponse: { name: 'insert_text', response: { inserted: true } } }] },
    ]);
  });

  it('wraps a non-object tool result under { result }', () => {
    const messages: LLMMessage[] = [
      { role: 'user', content: [{ type: 'tool_result', toolUseId: 'x', content: '"plain string"' }] },
    ];
    const parts = toGeminiContents(messages)[0].parts;
    expect(parts[0].functionResponse?.response).toEqual({ result: 'plain string' });
  });

  it('parses text and functionCall parts, synthesising stable ids', () => {
    const parsed = parseGeminiResponse({
      candidates: [
        {
          content: {
            parts: [{ text: 'sure' }, { functionCall: { name: 'insert_text', args: { text: 'hi' } } }],
          },
          finishReason: 'STOP',
        },
      ],
    });
    expect(parsed.text).toBe('sure');
    expect(parsed.toolCalls).toEqual([{ id: 'insert_text-1', name: 'insert_text', input: { text: 'hi' } }]);
    expect(parsed.stopReason).toBe('STOP');
  });
});

describe('GeminiProvider', () => {
  afterEach(() => clearApiKey('gemini'));

  it('is not ready without a key and reads it from storage', () => {
    expect(new GeminiProvider({ apiKey: undefined }).isReady()).toBe(false);
    setApiKey('gemini', 'AIza-stored');
    expect(new GeminiProvider().isReady()).toBe(true);
  });

  it('posts to generateContent with the key header and parses the result', async () => {
    const fetchImpl = vi.fn(async (_url: string, _init: RequestInit) =>
      okResponse({ candidates: [{ content: { parts: [{ text: 'hello' }] }, finishReason: 'STOP' }] }),
    );
    const provider = new GeminiProvider({ apiKey: 'AIza-123', geminiModel: 'gemini-2.0-flash', fetchImpl });

    const result = await provider.chat(
      [{ role: 'user', content: 'go' }],
      [
        {
          name: 'insert_text',
          description: 'd',
          inputSchema: { type: 'object', properties: { text: { type: 'string' } } },
        },
      ],
    );

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent');
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('AIza-123');
    const body = JSON.parse(init.body as string);
    expect(body.systemInstruction.parts[0].text).toEqual(expect.any(String));
    expect(body.tools[0].functionDeclarations[0].name).toBe('insert_text');
    expect(result.text).toBe('hello');
  });

  it('throws when no key is configured', async () => {
    const provider = new GeminiProvider({ apiKey: undefined });
    await expect(provider.chat([{ role: 'user', content: 'x' }], [])).rejects.toThrow('not configured');
  });

  it('throws with status detail on a non-ok response', async () => {
    const fetchImpl = vi.fn(
      async (_url: string, _init: RequestInit) =>
        ({ ok: false, status: 403, text: async () => 'denied' }) as unknown as Response,
    );
    const provider = new GeminiProvider({ apiKey: 'AIza-bad', fetchImpl });
    await expect(provider.chat([{ role: 'user', content: 'x' }], [])).rejects.toThrow('403');
  });
});

it('cancels a pending cloud request when Stop aborts its signal', async () => {
  const abort = new AbortController();
  const provider = new GeminiProvider({
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
  const fetchImpl = vi.fn(async () => okResponse({ candidates: [] }));
  const abort = new AbortController();
  abort.abort();
  const provider = new GeminiProvider({ apiKey: 'test', fetchImpl });
  await expect(
    (provider as import('@ranuts/agent-core/llm/types').LLMProvider).chat([], [], abort.signal),
  ).rejects.toMatchObject({ name: 'AbortError' });
  expect(fetchImpl).not.toHaveBeenCalled();
});

it('rejects a token-limited Gemini result before writing it into the document', async () => {
  const { generateWriting } = await import('../../packages/agent-core/src/llm/writing-task');
  const provider = new GeminiProvider({
    apiKey: 'test',
    fetchImpl: async () =>
      okResponse({
        candidates: [
          {
            content: { parts: [{ text: '{"text":"The committee will review the plan."}' }] },
            finishReason: 'MAX_TOKENS',
          },
        ],
      }),
  });
  await expect(
    generateWriting(
      provider,
      {
        task: 'rewrite',
        text: 'The committee plans to review the proposal tomorrow.',
      },
      new AbortController().signal,
    ),
  ).rejects.toThrow('Incomplete writing response');
});
