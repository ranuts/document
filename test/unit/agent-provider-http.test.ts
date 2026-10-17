import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OpenAIProvider } from '../../packages/agent-core/src/llm/openai';
import { GeminiProvider } from '../../packages/agent-core/src/llm/gemini';
import { OllamaProvider } from '../../packages/agent-core/src/llm/ollama';
import { displayError } from '../../lib/agent-plugin/ui/presentation';
import { t } from '@ranuts/shared/i18n';
import { AgentChatController, type ChatTurn } from '../../lib/agent-plugin/ui/controller';

type Options = {
  fetchImpl: (url: string, init: RequestInit) => Promise<Response>;
  timeoutMs?: number;
};
const providers = [
  {
    name: 'OpenAI',
    create: (options: Options) => new OpenAIProvider({ apiKey: 'test', ...options }),
    body: { choices: [{ message: { content: 'Completed' }, finish_reason: 'stop' }] },
  },
  {
    name: 'Gemini',
    create: (options: Options) => new GeminiProvider({ apiKey: 'test', ...options }),
    body: { candidates: [{ content: { parts: [{ text: 'Completed' }] }, finishReason: 'STOP' }] },
  },
  {
    name: 'Ollama',
    create: (options: Options) => new OllamaProvider(options),
    body: { choices: [{ message: { content: 'Completed' }, finish_reason: 'stop' }] },
  },
];

/** Observe pending requests without waiting for Vitest's own timeout. */
function observe<T>(promise: Promise<T>) {
  let outcome: { state: 'pending' } | { state: 'completed'; value: T } | { state: 'failed'; error: unknown } = {
    state: 'pending',
  };
  void promise.then(
    (value) => {
      outcome = { state: 'completed', value };
    },
    (error) => {
      outcome = { state: 'failed', error };
    },
  );
  return () => outcome;
}

describe.each(providers)('$name request lifetime', ({ create, body }) => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('times out an unresponsive fetch by default and aborts the transport', async () => {
    let transport: AbortSignal | null | undefined;
    const provider = create({
      fetchImpl: (_url, init) => {
        transport = init.signal;
        return new Promise(() => {});
      },
    });
    const outcome = observe(provider.chat([], []));

    await vi.advanceTimersByTimeAsync(300_000);

    expect(outcome()).toMatchObject({ state: 'failed', error: { name: 'TimeoutError' } });
    expect(transport?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps one configurable deadline across headers and a stalled response body', async () => {
    let respond!: (response: Response) => void;
    let transport: AbortSignal | null | undefined;
    const provider = create({
      timeoutMs: 50,
      fetchImpl: (_url, init) => {
        transport = init.signal;
        return new Promise((resolve) => {
          respond = resolve;
        });
      },
    });
    const outcome = observe(provider.chat([], []));
    await vi.advanceTimersByTimeAsync(40);
    respond({ ok: true, json: () => new Promise(() => {}) } as unknown as Response);
    await vi.advanceTimersByTimeAsync(9);
    expect(outcome()).toEqual({ state: 'pending' });

    await vi.advanceTimersByTimeAsync(1);

    expect(outcome()).toMatchObject({ state: 'failed', error: { name: 'TimeoutError' } });
    expect(transport?.aborted).toBe(true);
  });

  it('preserves the caller cancellation reason during a stalled body read', async () => {
    const caller = new AbortController();
    const reason = new DOMException('Stopped by the reader', 'AbortError');
    const provider = create({
      fetchImpl: async () => ({ ok: true, json: () => new Promise(() => {}) }) as unknown as Response,
    });
    const pending = provider.chat([], [], caller.signal);
    const outcome = observe(pending);
    await vi.advanceTimersByTimeAsync(0);

    caller.abort(reason);
    await vi.advanceTimersByTimeAsync(0);

    expect(outcome()).toEqual({ state: 'failed', error: reason });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not start transport for an already cancelled request', async () => {
    const caller = new AbortController();
    caller.abort();
    const fetchImpl = vi.fn(async () => Response.json(body));
    const provider = create({ fetchImpl });

    await expect(provider.chat([], [], caller.signal)).rejects.toMatchObject({ name: 'AbortError' });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('releases its timeout and caller subscription after a successful response', async () => {
    const caller = new AbortController();
    let transport: AbortSignal | null | undefined;
    const provider = create({
      fetchImpl: async (_url, init) => {
        transport = init.signal;
        return Response.json(body);
      },
    });

    expect((await provider.chat([], [], caller.signal)).text).toBe('Completed');
    caller.abort();
    await vi.advanceTimersByTimeAsync(300_000);

    expect(transport?.aborted).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('discards and cancels a response arriving after the deadline', async () => {
    let respond!: (response: Response) => void;
    let cancelled = false;
    const provider = create({
      timeoutMs: 50,
      fetchImpl: () =>
        new Promise((resolve) => {
          respond = resolve;
        }),
    });
    const outcome = observe(provider.chat([], []));
    await vi.advanceTimersByTimeAsync(50);
    respond(
      new Response(
        new ReadableStream({
          cancel() {
            cancelled = true;
          },
        }),
      ),
    );
    await vi.advanceTimersByTimeAsync(0);

    expect(outcome()).toMatchObject({ state: 'failed', error: { name: 'TimeoutError' } });
    expect(cancelled).toBe(true);
  });

  it('reports HTTP failure without waiting for a stalled error body', async () => {
    let cancelled = false;
    const provider = create({
      fetchImpl: async () =>
        new Response(
          new ReadableStream({
            cancel() {
              cancelled = true;
            },
          }),
          { status: 503 },
        ),
    });
    const outcome = observe(provider.chat([], []));
    await vi.advanceTimersByTimeAsync(0);

    expect(outcome()).toMatchObject({ state: 'failed', error: { status: 503 } });
    expect(cancelled).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cancels an actual streaming response when its host transport ignores abort', async () => {
    let cancelled = false;
    const response = new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('{"partial":'));
        },
        cancel() {
          cancelled = true;
        },
      }),
    );
    const provider = create({ timeoutMs: 50, fetchImpl: async () => response });
    const outcome = observe(provider.chat([], []));

    await vi.advanceTimersByTimeAsync(50);

    expect(outcome()).toMatchObject({ state: 'failed', error: { name: 'TimeoutError' } });
    expect(cancelled).toBe(true);
    expect(response.body!.locked).toBe(false);
  });

  it('clears the deadline when JSON decoding fails', async () => {
    const provider = create({ fetchImpl: async () => new Response('Invalid JSON') });

    await expect(provider.chat([], [])).rejects.toBeInstanceOf(SyntaxError);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('releases the chat controller after timeout and permits a new explicit request', async () => {
    let requests = 0;
    const turns: ChatTurn[] = [];
    const provider = create({
      timeoutMs: 50,
      fetchImpl: async () => (++requests === 1 ? new Promise(() => {}) : Response.json(body)),
    });
    const controller = new AgentChatController(provider, (turn) => turns.push(turn));
    const pending = controller.send('Hello');

    await vi.advanceTimersByTimeAsync(50);

    expect(await pending).toMatchObject({ status: 'failed' });
    expect(controller.isRunning()).toBe(false);
    expect(turns.find((turn) => turn.role === 'error')?.text).toBe(t('agentServiceTimedOut'));
    expect(await controller.send('Try again')).toMatchObject({ status: 'success' });
    expect(turns.at(-1)).toMatchObject({ role: 'agent', text: 'Completed' });
    expect(requests).toBe(2);
  });
});

it.each([
  [401, 'agentServiceAuthFailed'],
  [403, 'agentServiceAuthFailed'],
  [429, 'agentServiceRateLimited'],
  [503, 'agentServiceUnavailable'],
  [504, 'agentServiceTimedOut'],
] as const)('carries Gemini HTTP %i through direct and serialized product guidance', async (status, key) => {
  const provider = new GeminiProvider({
    apiKey: 'test',
    fetchImpl: async () => new Response('private upstream response', { status }),
  });
  const error = await provider.chat([], []).catch((failure: unknown) => failure);

  expect(error).toMatchObject({ status });
  expect(displayError(error)).toBe(t(key));
  expect(displayError((error as Error).message)).toBe(t(key));
  expect((error as Error).message).not.toContain('private upstream response');
});
