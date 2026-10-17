import { afterEach, describe, expect, it, vi } from 'vitest';
import { OpenAIProvider } from '../../packages/agent-core/src/llm/openai';
import { OllamaProvider } from '../../packages/agent-core/src/llm/ollama';
import { GeminiProvider } from '../../packages/agent-core/src/llm/gemini';
import { LoopbackProvider } from '../../packages/agent-core/src/llm/loopback';
import type { LLMProvider } from '../../packages/agent-core/src/llm/types';
import type { ProviderHttpOptions } from '../../packages/agent-core/src/llm/provider-http';

const encoder = new TextEncoder();
const sse = (value: unknown) => `data: ${JSON.stringify(value)}\r\n\r\n`;
const chunk = (text: string, finish: string | null = null) => ({
  choices: [{ delta: { content: text }, finish_reason: finish }],
});
const gemini = (text: string, finish?: string) => ({
  candidates: [{ content: { parts: [{ text }] }, ...(finish ? { finishReason: finish } : {}) }],
});
const formats = [
  {
    name: 'OpenAI',
    create: (options: ProviderHttpOptions) => new OpenAIProvider({ apiKey: 'test', ...options }),
    type: 'text/event-stream',
    head: sse(chunk('你好')),
    tail: sse(chunk(' world', 'stop')) + 'data: [DONE]\n\n',
    full: { choices: [{ message: { content: 'JSON fallback' }, finish_reason: 'stop' }] },
  },
  {
    name: 'Ollama',
    create: (options: ProviderHttpOptions) => new OllamaProvider(options),
    type: 'text/event-stream',
    head: sse(chunk('你好')),
    tail: sse(chunk(' world', 'stop')) + 'data: [DONE]\n\n',
    full: { choices: [{ message: { content: 'JSON fallback' }, finish_reason: 'stop' }] },
  },
  {
    name: 'Gemini',
    create: (options: ProviderHttpOptions) => new GeminiProvider({ apiKey: 'test', ...options }),
    type: 'text/event-stream',
    head: sse(gemini('你好')),
    tail: sse(gemini(' world', 'STOP')),
    full: gemini('JSON fallback', 'STOP'),
  },
  {
    name: 'Loopback',
    create: (options: ProviderHttpOptions) => new LoopbackProvider({ model: 'local', ...options }),
    type: 'application/x-ndjson',
    head: JSON.stringify({ done: false, message: { content: '你好' } }) + '\n',
    tail: JSON.stringify({ done: true, done_reason: 'stop', message: { content: ' world' } }) + '\n',
    full: { done: true, done_reason: 'stop', message: { content: 'JSON fallback' } },
  },
];
async function prepare(provider: LLMProvider) {
  if (provider instanceof LoopbackProvider) await provider.preload();
}
const tags = Response.json({ models: [{ name: 'local' }] });

describe.each(formats)('$name incremental request', (format) => {
  afterEach(() => vi.useRealTimers());
  it('publishes text before completion across split UTF-8/frame boundaries and returns one full answer', async () => {
    let sink!: ReadableStreamDefaultController<Uint8Array>;
    const requests: RequestInit[] = [];
    const provider = format.create({
      fetchImpl: async (url, init) => {
        if (url.endsWith('/tags')) return tags.clone();
        requests.push(init);
        return new Response(
          new ReadableStream({
            start(controller) {
              sink = controller;
            },
          }),
          { headers: { 'Content-Type': format.type } },
        );
      },
    });
    await prepare(provider);
    const deltas: string[] = [];
    let completed = false;
    const pending = provider.chatStream!([], [], (text) => deltas.push(text)).finally(() => {
      completed = true;
    });
    await vi.waitFor(() => expect(sink).toBeDefined());
    const bytes = encoder.encode(format.head);
    // Split every byte: multi-byte text, CRLF and frame delimiters must survive.
    for (const byte of bytes) sink.enqueue(new Uint8Array([byte]));
    await vi.waitFor(() => expect(deltas).toEqual(['你好']));
    expect(completed).toBe(false);
    sink.enqueue(encoder.encode(format.tail));
    sink.close();
    expect(await pending).toMatchObject({ text: '你好 world', toolCalls: [] });
    expect(deltas).toEqual(['你好', ' world']);
    const body = JSON.parse(requests[0].body as string);
    if (format.name === 'Gemini') expect(body.tools).toBeUndefined();
    else expect(body.stream).toBe(true);
    expect(requests[0].signal?.aborted).toBe(false);
  });

  it('accepts a complete JSON answer from compatible endpoints that ignore streaming', async () => {
    const provider = format.create({
      fetchImpl: async (url) => (url.endsWith('/tags') ? tags.clone() : Response.json(format.full)),
    });
    await prepare(provider);
    const deltas: string[] = [];
    expect((await provider.chatStream!([], [], (text) => deltas.push(text))).text).toBe('JSON fallback');
    expect(deltas.join('')).toBe('JSON fallback');
  });

  it('rejects a disconnected partial response instead of archiving it as complete', async () => {
    const provider = format.create({
      fetchImpl: async (url) =>
        url.endsWith('/tags') ? tags.clone() : new Response(format.head, { headers: { 'Content-Type': format.type } }),
    });
    await prepare(provider);
    await expect(provider.chatStream!([], [], () => {})).rejects.toThrow(/Incomplete .* stream/);
  });

  it('cancels a stalled stream at the total deadline even when the host ignores abort', async () => {
    let cancelled = false;
    const response = new Response(
      new ReadableStream({
        cancel() {
          cancelled = true;
        },
      }),
      { headers: { 'Content-Type': format.type } },
    );
    const provider = format.create({
      timeoutMs: 50,
      fetchImpl: async (url) => (url.endsWith('/tags') ? tags.clone() : response),
    });
    await prepare(provider);
    vi.useFakeTimers();
    const pending = provider.chatStream!([], [], () => {});
    const checked = expect(pending).rejects.toMatchObject({ name: 'TimeoutError' });
    await vi.advanceTimersByTimeAsync(50);
    await checked;
    expect(cancelled).toBe(true);
    expect(response.body!.locked).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cancels a stream that exceeds its byte ceiling and never exposes its payload', async () => {
    let cancelled = false;
    const response = new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(format.head + ' '.repeat(256)));
        },
        cancel() {
          cancelled = true;
        },
      }),
      { headers: { 'Content-Type': format.type } },
    );
    const provider = format.create({
      maxResponseBytes: 128,
      fetchImpl: async (url) => (url.endsWith('/tags') ? tags.clone() : response),
    });
    await prepare(provider);
    const onDelta = vi.fn();
    await expect(provider.chatStream!([], [], onDelta)).rejects.toThrow('AI response exceeds size limit');
    expect(onDelta).not.toHaveBeenCalled();
    expect(cancelled).toBe(true);
    expect(response.body!.locked).toBe(false);
  });
});

it.each(formats.filter((f) => f.name !== 'Loopback'))(
  '$name preserves complete tool requests rather than streaming unvalidated operations',
  async (format) => {
    let request: Record<string, unknown> = {};
    const provider = format.create({
      fetchImpl: async (_url, init) => {
        request = JSON.parse(init.body as string);
        return Response.json(format.full);
      },
    });
    const onDelta = vi.fn();
    expect((await provider.chatStream!([], [{ name: 'read', description: '', inputSchema: {} }], onDelta)).text).toBe(
      'JSON fallback',
    );
    expect(request.stream).not.toBe(true);
    expect(request.tools).toBeDefined();
    expect(onDelta).not.toHaveBeenCalled();
  },
);

it('Gemini does not stream thought text and rejects private in-band error details safely', async () => {
  const provider = new GeminiProvider({
    apiKey: 'test',
    fetchImpl: async () =>
      new Response(
        sse({
          candidates: [{ content: { parts: [{ text: 'private thought', thought: true }, { text: 'Answer' }] } }],
        }) + sse({ error: { code: 429, message: 'secret upstream content' } }),
        { headers: { 'Content-Type': 'text/event-stream' } },
      ),
  });
  const deltas: string[] = [];
  await expect(provider.chatStream!([], [], (text) => deltas.push(text))).rejects.toMatchObject({
    status: 429,
    message: 'Gemini request failed: 429',
  });
  expect(deltas).toEqual(['Answer']);
});

it('stops Gemini deltas immediately when Stop occurs inside the first part callback', async () => {
  const abort = new AbortController();
  const provider = new GeminiProvider({
    apiKey: 'test',
    fetchImpl: async () =>
      new Response(
        sse({
          candidates: [
            {
              content: { parts: [{ text: 'first' }, { text: 'late' }] },
              finishReason: 'STOP',
            },
          ],
        }),
        { headers: { 'Content-Type': 'text/event-stream' } },
      ),
  });
  const deltas: string[] = [];
  await expect(
    provider.chatStream(
      [],
      [],
      (text) => {
        deltas.push(text);
        abort.abort();
      },
      abort.signal,
    ),
  ).rejects.toMatchObject({ name: 'AbortError' });
  expect(deltas).toEqual(['first']);
});

it('parses SSE comments and multiline data and cancels at DONE without awaiting a transport close', async () => {
  let cancelled = false;
  const provider = new OpenAIProvider({
    apiKey: 'test',
    fetchImpl: async () =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(
              encoder.encode(
                ': heartbeat\r\nevent: message\r\ndata: {"choices":\r\ndata: [{"delta":{"content":"Hi"},"finish_reason":"stop"}]}\r\n\r\ndata: [DONE]\r\n\r\n',
              ),
            );
          },
          cancel() {
            cancelled = true;
          },
        }),
        { headers: { 'Content-Type': 'text/event-stream' } },
      ),
  });
  const deltas: string[] = [];
  expect((await provider.chatStream([], [], (text) => deltas.push(text))).text).toBe('Hi');
  expect(deltas).toEqual(['Hi']);
  expect(cancelled).toBe(true);
});

it('cancels and unlocks the stream if the display callback throws', async () => {
  let cancelled = false;
  const response = new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(sse(chunk('Hi'))));
      },
      cancel() {
        cancelled = true;
      },
    }),
    { headers: { 'Content-Type': 'text/event-stream' } },
  );
  const provider = new OpenAIProvider({ apiKey: 'test', fetchImpl: async () => response });
  await expect(
    provider.chatStream([], [], () => {
      throw new Error('View disposed');
    }),
  ).rejects.toThrow('View disposed');
  expect(cancelled).toBe(true);
  expect(response.body!.locked).toBe(false);
});

it('settles Gemini at the native finish marker even if the host keeps the socket open', async () => {
  let cancelled = false;
  const provider = new GeminiProvider({
    apiKey: 'test',
    timeoutMs: 50,
    fetchImpl: async () =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode(sse(gemini('Complete', 'STOP'))));
          },
          cancel() {
            cancelled = true;
          },
        }),
        { headers: { 'Content-Type': 'text/event-stream' } },
      ),
  });
  expect((await provider.chatStream([], [], () => {})).text).toBe('Complete');
  expect(cancelled).toBe(true);
});

it.each(formats)('$name accepts complete host JSON responses without a body stream', async (format) => {
  const provider = format.create({
    fetchImpl: async (url) =>
      ({
        ok: true,
        json: async () => (url.endsWith('/tags') ? { models: [{ name: 'local' }] } : format.full),
      }) as Response,
  });
  await prepare(provider);
  const deltas: string[] = [];
  expect((await provider.chatStream!([], [], (text) => deltas.push(text))).text).toBe('JSON fallback');
  expect(deltas).toEqual(['JSON fallback']);
});
