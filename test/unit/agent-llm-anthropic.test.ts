import { afterEach, describe, expect, it, vi } from 'vitest';
import { APIUserAbortError } from '../../packages/agent-core/node_modules/@anthropic-ai/sdk';
import {
  AnthropicProvider,
  parseAnthropicResponse,
  toAnthropicMessage,
  toAnthropicTool,
} from '../../packages/agent-core/src/llm/anthropic';
import { clearApiKey, setApiKey } from '../../packages/agent-core/src/llm/keys';
import type { LLMMessage } from '@ranuts/agent-core/llm/types';

describe('anthropic provider conversion', () => {
  it('maps a tool definition to input_schema shape', () => {
    expect(toAnthropicTool({ name: 'insert_text', description: 'd', inputSchema: { type: 'object' } })).toEqual({
      name: 'insert_text',
      description: 'd',
      input_schema: { type: 'object' },
    });
  });

  it('passes string message content through', () => {
    expect(toAnthropicMessage({ role: 'user', content: 'hi' })).toEqual({ role: 'user', content: 'hi' });
  });

  it('maps block content (text, tool_use, tool_result)', () => {
    const message: LLMMessage = {
      role: 'assistant',
      content: [
        { type: 'text', text: 'ok' },
        { type: 'tool_use', id: 't1', name: 'insert_text', input: { text: 'x' } },
        { type: 'tool_result', toolUseId: 't1', content: 'done', isError: true },
      ],
    };
    expect(toAnthropicMessage(message)).toEqual({
      role: 'assistant',
      content: [
        { type: 'text', text: 'ok' },
        { type: 'tool_use', id: 't1', name: 'insert_text', input: { text: 'x' } },
        { type: 'tool_result', tool_use_id: 't1', content: 'done', is_error: true },
      ],
    });
  });

  it('defaults tool_result is_error to false', () => {
    const out = toAnthropicMessage({
      role: 'user',
      content: [{ type: 'tool_result', toolUseId: 't1', content: 'r' }],
    }) as { content: Array<{ is_error: boolean }> };
    expect(out.content[0].is_error).toBe(false);
  });

  it('parses text and tool_use blocks into a normalised response', () => {
    const parsed = parseAnthropicResponse({
      content: [
        { type: 'text', text: 'Hello ' },
        { type: 'text', text: 'world' },
        { type: 'tool_use', id: 't1', name: 'get_selection', input: {} },
      ],
      stop_reason: 'tool_use',
    });
    expect(parsed.text).toBe('Hello world');
    expect(parsed.toolCalls).toEqual([{ id: 't1', name: 'get_selection', input: {} }]);
    expect(parsed.stopReason).toBe('tool_use');
    expect(parsed.assistant).toEqual({
      role: 'assistant',
      content: [
        { type: 'text', text: 'Hello ' },
        { type: 'text', text: 'world' },
        { type: 'tool_use', id: 't1', name: 'get_selection', input: {} },
      ],
    });
  });

  it('defaults stopReason to end_turn when absent', () => {
    expect(parseAnthropicResponse({ content: [], stop_reason: null }).stopReason).toBe('end_turn');
  });
});

describe('AnthropicProvider', () => {
  afterEach(() => {
    clearApiKey('anthropic');
  });

  it('is not ready without a key or client', () => {
    expect(new AnthropicProvider({ apiKey: undefined }).isReady()).toBe(false);
  });

  it('is ready when an API key is configured', () => {
    expect(new AnthropicProvider({ apiKey: 'sk-ant-123' }).isReady()).toBe(true);
  });

  it('reads the key from storage when not passed explicitly', () => {
    setApiKey('anthropic', 'sk-ant-stored');
    expect(new AnthropicProvider().isReady()).toBe(true);
  });

  it('chat() sends the mapped request and returns the parsed response', async () => {
    const create = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'done' }],
      stop_reason: 'end_turn',
    });
    const provider = new AnthropicProvider({ client: { messages: { create } }, model: 'claude-opus-4-8' });

    const result = await provider.chat(
      [{ role: 'user', content: 'edit it' }],
      [{ name: 'insert_text', description: 'd', inputSchema: { type: 'object' } }],
    );

    expect(create).toHaveBeenCalledTimes(1);
    const body = create.mock.calls[0][0];
    expect(body.model).toBe('claude-opus-4-8');
    expect(body.tools).toEqual([{ name: 'insert_text', description: 'd', input_schema: { type: 'object' } }]);
    expect(body.messages).toEqual([{ role: 'user', content: 'edit it' }]);
    expect(typeof body.system).toBe('string');
    expect(result.text).toBe('done');
  });

  it('chat() throws when no key and no client are configured', async () => {
    const provider = new AnthropicProvider({ apiKey: undefined });
    await expect(provider.chat([{ role: 'user', content: 'x' }], [])).rejects.toThrow('not configured');
  });

  it('chatStream() forwards text deltas and parses finalMessage()', async () => {
    const deltas: string[] = [];
    const stream = vi.fn().mockReturnValue({
      on: (_event: 'text', listener: (d: string) => void) => {
        listener('Hel');
        listener('lo');
      },
      finalMessage: async () => ({ content: [{ type: 'text', text: 'Hello' }], stop_reason: 'end_turn' }),
    });
    const provider = new AnthropicProvider({ client: { messages: { create: vi.fn(), stream } } });

    const result = await provider.chatStream([{ role: 'user', content: 'go' }], [], (d) => deltas.push(d));

    expect(stream).toHaveBeenCalledTimes(1);
    expect(deltas).toEqual(['Hel', 'lo']);
    expect(result.text).toBe('Hello');
  });

  it('chatStream() falls back to chat() when the client cannot stream', async () => {
    const create = vi
      .fn()
      .mockResolvedValue({ content: [{ type: 'text', text: 'fallback' }], stop_reason: 'end_turn' });
    const provider = new AnthropicProvider({ client: { messages: { create } } });
    const onDelta = vi.fn();
    const result = await provider.chatStream([{ role: 'user', content: 'go' }], [], onDelta);
    expect(create).toHaveBeenCalledTimes(1);
    expect(onDelta).not.toHaveBeenCalled();
    expect(result.text).toBe('fallback');
  });
});

it.each(['chat', 'stream', 'fallback'] as const)(
  'cancels a pending Anthropic %s request through the SDK signal',
  async (mode) => {
    const abort = new AbortController();
    const request = (_body: Record<string, unknown>, options?: { signal?: AbortSignal }) => {
      expect(options?.signal).toBe(abort.signal);
      return new Promise<never>((_resolve, reject) => {
        options!.signal!.addEventListener('abort', () => reject(new APIUserAbortError()), { once: true });
      });
    };
    const provider = new AnthropicProvider({
      client: {
        messages: {
          create: request,
          ...(mode === 'stream'
            ? {
                stream: (body, options) => {
                  const result = request(body, options);
                  return { on: () => {}, finalMessage: () => result };
                },
              }
            : {}),
        },
      },
    });
    const typed = provider as import('@ranuts/agent-core/llm/types').LLMProvider;
    const pending =
      mode === 'chat' ? typed.chat([], [], abort.signal) : typed.chatStream!([], [], () => {}, abort.signal);
    abort.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  },
);
