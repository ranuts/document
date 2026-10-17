import { afterEach, describe, expect, it, vi } from 'vitest';
import Anthropic, {
  APIConnectionTimeoutError,
  APIError,
} from '../../packages/agent-core/node_modules/@anthropic-ai/sdk';
import { AnthropicProvider, type AnthropicLike } from '../../packages/agent-core/src/llm/anthropic';
import { createProvider } from '../../packages/agent-core/src/llm/factory';
import { requestErrorKey } from '../../lib/agent-plugin/ui/request-error';

const response = { content: [{ type: 'text', text: 'done' }], stop_reason: 'end_turn' };
afterEach(() => vi.useRealTimers());

describe('Anthropic total request lifetime', () => {
  it.each(['chat', 'stream', 'fallback'] as const)(
    'bounds a noncooperative %s request and releases subscriptions',
    async (mode) => {
      vi.useFakeTimers();
      const owner = new AbortController();
      const remove = vi.spyOn(owner.signal, 'removeEventListener');
      let transportSignal: AbortSignal | undefined;
      let listener: ((text: string) => void) | undefined;
      const abort = vi.fn();
      const off = vi.fn();
      const stalled = new Promise<never>(() => {});
      const client: AnthropicLike = {
        messages: {
          create: (_body, options) => {
            transportSignal = options?.signal;
            return stalled;
          },
          ...(mode === 'stream'
            ? {
                stream: (_body: Record<string, unknown>, options?: { signal?: AbortSignal }) => {
                  transportSignal = options?.signal;
                  return {
                    on: (_event: 'text', next: (text: string) => void) => {
                      listener = next;
                    },
                    finalMessage: () => stalled,
                    abort,
                    off,
                  };
                },
              }
            : {}),
        },
      };
      const provider = createProvider('anthropic', { client, timeoutMs: 25 });
      const deltas: string[] = [];
      let outcome: unknown;
      const pending = (
        mode === 'chat'
          ? provider.chat([], [], owner.signal)
          : provider.chatStream!([], [], (text) => deltas.push(text), owner.signal)
      ).catch((error) => {
        outcome = error;
      });
      await vi.advanceTimersByTimeAsync(25);
      expect(outcome).toMatchObject({ name: 'TimeoutError', message: 'AI request timed out' });
      expect(transportSignal?.aborted).toBe(true);
      listener?.('late');
      expect(deltas).toEqual([]);
      if (mode === 'stream') {
        expect(abort).toHaveBeenCalledOnce();
        expect(off).toHaveBeenCalledWith('text', listener);
      }
      expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
      expect(vi.getTimerCount()).toBe(0);
      await pending;
    },
  );

  it.each(['chat', 'stream'] as const)('retains caller reasons when a %s client ignores cancellation', async (mode) => {
    vi.useFakeTimers();
    const owner = new AbortController();
    const reason = new Error('caller stopped');
    const stalled = new Promise<never>(() => {});
    const provider = new AnthropicProvider({
      client: {
        messages: {
          create: () => stalled,
          ...(mode === 'stream' ? { stream: () => ({ on: () => {}, finalMessage: () => stalled }) } : {}),
        },
      },
    });
    let outcome: unknown;
    const pending = (
      mode === 'chat' ? provider.chat([], [], owner.signal) : provider.chatStream([], [], () => {}, owner.signal)
    ).catch((error) => {
      outcome = error;
    });
    owner.abort(reason);
    await vi.advanceTimersByTimeAsync(0);
    expect(outcome).toBe(reason);
    expect(vi.getTimerCount()).toBe(0);
    await pending;
  });

  it.each(['throw', 'stop'] as const)(
    'terminates a stream after consumer %s, including reentrant deltas',
    async (mode) => {
      vi.useFakeTimers();
      const owner = new AbortController();
      const reason = new Error('consumer stopped');
      const abort = vi.fn();
      const off = vi.fn();
      const provider = new AnthropicProvider({
        client: {
          messages: {
            create: async () => response,
            stream: () => ({
              on: (_event, listener) => {
                listener('first');
                listener('late');
              },
              finalMessage: () => new Promise(() => {}),
              abort,
              off,
            }),
          },
        },
      });
      const deltas: string[] = [];
      let outcome: unknown;
      const pending = provider
        .chatStream(
          [],
          [],
          (delta) => {
            deltas.push(delta);
            if (mode === 'throw') throw reason;
            owner.abort(reason);
          },
          owner.signal,
        )
        .catch((error) => {
          outcome = error;
        });
      await vi.advanceTimersByTimeAsync(0);
      expect(outcome).toBe(reason);
      expect(deltas).toEqual(['first']);
      expect(abort).toHaveBeenCalledOnce();
      expect(off).toHaveBeenCalledOnce();
      expect(vi.getTimerCount()).toBe(0);
      await pending;
    },
  );

  it.each(['chat', 'stream'] as const)('releases its deadline after successful %s completion', async (mode) => {
    vi.useFakeTimers();
    const owner = new AbortController();
    const remove = vi.spyOn(owner.signal, 'removeEventListener');
    const abort = vi.fn();
    const off = vi.fn();
    const provider = new AnthropicProvider({
      timeoutMs: 25,
      client: {
        messages: {
          create: async () => response,
          stream: () => ({ on: () => {}, finalMessage: async () => response, abort, off }),
        },
      },
    });
    const result = await (mode === 'chat'
      ? provider.chat([], [], owner.signal)
      : provider.chatStream([], [], () => {}, owner.signal));
    expect(result.text).toBe('done');
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
    expect(vi.getTimerCount()).toBe(0);
    expect(abort).not.toHaveBeenCalled();
    if (mode === 'stream') expect(off).toHaveBeenCalledOnce();
  });

  it.each([0, -1, Infinity, NaN, 2_147_483_648])(
    'rejects invalid total timeout %s before starting transport',
    async (timeoutMs) => {
      const create = vi.fn(async () => response);
      const provider = new AnthropicProvider({ timeoutMs, client: { messages: { create } } });
      await expect(provider.chat([], [])).rejects.toThrow(RangeError);
      expect(create).not.toHaveBeenCalled();
    },
  );

  it('ignores post-completion text from minimal clients without listener removal', async () => {
    let listener!: (text: string) => void;
    const deltas: string[] = [];
    const provider = new AnthropicProvider({
      client: {
        messages: {
          create: async () => response,
          stream: () => ({
            on: (_event, next) => {
              listener = next;
            },
            finalMessage: async () => response,
          }),
        },
      },
    });
    expect((await provider.chatStream([], [], (text) => deltas.push(text))).text).toBe('done');
    listener('late');
    expect(deltas).toEqual([]);
  });

  it('bounds the default lifetime and discards a noncooperative late response', async () => {
    vi.useFakeTimers();
    let complete!: (value: typeof response) => void;
    const provider = new AnthropicProvider({
      client: {
        messages: {
          create: () =>
            new Promise((resolve) => {
              complete = resolve;
            }),
        },
      },
    });
    let outcome: unknown;
    const pending = provider.chat([], []).then(
      (value) => {
        outcome = value;
      },
      (error) => {
        outcome = error;
      },
    );
    await vi.advanceTimersByTimeAsync(299_999);
    expect(outcome).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1);
    expect(outcome).toMatchObject({ name: 'TimeoutError' });
    complete(response);
    await pending;
    expect(outcome).toMatchObject({ name: 'TimeoutError' });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not start a request or timer for a pre-aborted caller', async () => {
    vi.useFakeTimers();
    const owner = new AbortController();
    owner.abort('already stopped');
    const create = vi.fn(async () => response);
    const provider = new AnthropicProvider({ client: { messages: { create } } });
    await expect(provider.chat([], [], owner.signal)).rejects.toBe('already stopped');
    expect(create).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('retains a stream failure when abort and listener cleanup throw', async () => {
    vi.useFakeTimers();
    const reason = new Error('upstream failed');
    const owner = new AbortController();
    const remove = vi.spyOn(owner.signal, 'removeEventListener');
    const provider = new AnthropicProvider({
      client: {
        messages: {
          create: async () => response,
          stream: () => ({
            on: () => {},
            finalMessage: async () => {
              throw reason;
            },
            abort: () => {
              throw new Error('cleanup failed');
            },
            off: () => {
              throw new Error('cleanup failed');
            },
          }),
        },
      },
    });
    await expect(provider.chatStream([], [], () => {}, owner.signal)).rejects.toBe(reason);
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(['chat', 'stream'] as const)(
    'bounds real SDK %s body consumption after headers, beyond its SDK timeout',
    async (mode) => {
      let fetched = false;
      let cancelled = false;
      let fetchSignal: AbortSignal | undefined;
      const client = new Anthropic({
        apiKey: 'test',
        dangerouslyAllowBrowser: true,
        maxRetries: 0,
        timeout: 10,
        fetch: async (_url, init) => {
          fetched = true;
          fetchSignal = init?.signal ?? undefined;
          return new Response(
            new ReadableStream({
              start(controller) {
                init?.signal?.addEventListener(
                  'abort',
                  () => controller.error(new DOMException('aborted', 'AbortError')),
                  { once: true },
                );
                if (mode === 'stream')
                  controller.enqueue(
                    new TextEncoder().encode(
                      'event: message_start\ndata: {"type":"message_start","message":{"id":"test","type":"message","role":"assistant","content":[],"model":"test","stop_reason":null,"stop_sequence":null,"usage":{"input_tokens":1,"output_tokens":0}}}\n\n',
                    ),
                  );
              },
              cancel() {
                cancelled = true;
              },
            }),
            { headers: { 'content-type': mode === 'stream' ? 'text/event-stream' : 'application/json' } },
          );
        },
      });
      const owner = new AbortController();
      const provider = new AnthropicProvider({
        timeoutMs: 40,
        client: client as unknown as AnthropicLike,
        model: 'test',
        maxTokens: 100,
      });
      const pending = (
        mode === 'chat' ? provider.chat([], [], owner.signal) : provider.chatStream([], [], () => {}, owner.signal)
      ).catch((error) => error);
      let watchdog: ReturnType<typeof setTimeout> | undefined;
      try {
        const result = await Promise.race([
          pending,
          new Promise((resolve) => {
            watchdog = setTimeout(() => resolve('still pending'), 250);
          }),
        ]);
        expect(fetched).toBe(true);
        expect(result).toMatchObject({ name: 'TimeoutError' });
        expect(fetchSignal?.aborted || cancelled).toBe(true);
      } finally {
        clearTimeout(watchdog);
        owner.abort();
        await pending;
      }
    },
  );
});

it('classifies actual SDK timeout and SSE overload errors without reading private response text', () => {
  expect(requestErrorKey(new APIConnectionTimeoutError({}))).toBe('agentServiceTimedOut');
});

it('classifies actual SDK SSE overload errors without exposing private response text', () => {
  const overloaded = new APIError(
    undefined,
    { error: { type: 'overloaded_error', message: 'private key and destination' } },
    undefined,
    new Headers(),
    'overloaded_error',
  );
  expect(requestErrorKey(overloaded)).toBe('agentServiceUnavailable');
  expect(requestErrorKey(new Error('private overloaded_error destination'))).toBeUndefined();
});
