import { describe, expect, it, vi } from 'vitest';
import {
  accumulateOpenAIStream,
  type OpenAIStreamChunk,
  parseOpenAIResponse,
  toOpenAIMessages,
  toOpenAITools,
} from '@ranuts/agent-core/llm/openai-format';
import type { LLMMessage } from '@ranuts/agent-core/llm/types';

async function* asStream(chunks: OpenAIStreamChunk[]): AsyncIterable<OpenAIStreamChunk> {
  for (const chunk of chunks) yield chunk;
}

describe('openai-format conversion', () => {
  it('maps tools to OpenAI function shape', () => {
    expect(toOpenAITools([{ name: 'insert_text', description: 'd', inputSchema: { type: 'object' } }])).toEqual([
      { type: 'function', function: { name: 'insert_text', description: 'd', parameters: { type: 'object' } } },
    ]);
  });

  it('prepends the system prompt and maps string content', () => {
    expect(toOpenAIMessages([{ role: 'user', content: 'hi' }], 'SYS')).toEqual([
      { role: 'system', content: 'SYS' },
      { role: 'user', content: 'hi' },
    ]);
  });

  it('maps an assistant turn with text + tool_use to tool_calls', () => {
    const messages: LLMMessage[] = [
      {
        role: 'assistant',
        content: [
          { type: 'text', text: 'ok' },
          { type: 'tool_use', id: 't1', name: 'insert_text', input: { text: 'x' } },
        ],
      },
    ];
    expect(toOpenAIMessages(messages, 'SYS')[1]).toEqual({
      role: 'assistant',
      content: 'ok',
      tool_calls: [
        { id: 't1', type: 'function', function: { name: 'insert_text', arguments: JSON.stringify({ text: 'x' }) } },
      ],
    });
  });

  it('maps a tool_result block to a tool message', () => {
    const messages: LLMMessage[] = [
      { role: 'user', content: [{ type: 'tool_result', toolUseId: 't1', content: 'done' }] },
    ];
    expect(toOpenAIMessages(messages, 'SYS')[1]).toEqual({ role: 'tool', tool_call_id: 't1', content: 'done' });
  });

  it('parses text and tool_calls (with JSON arguments) from a completion', () => {
    const parsed = parseOpenAIResponse({
      choices: [
        {
          message: {
            content: 'sure',
            tool_calls: [{ id: 't1', type: 'function', function: { name: 'insert_text', arguments: '{"text":"hi"}' } }],
          },
          finish_reason: 'tool_calls',
        },
      ],
    });
    expect(parsed.text).toBe('sure');
    expect(parsed.toolCalls).toEqual([{ id: 't1', name: 'insert_text', input: { text: 'hi' } }]);
    expect(parsed.stopReason).toBe('tool_calls');
  });

  it('falls back to {} for unparseable tool arguments and defaults stopReason', () => {
    const parsed = parseOpenAIResponse({
      choices: [
        {
          message: {
            content: null,
            tool_calls: [{ id: 't1', type: 'function', function: { name: 'x', arguments: 'not json' } }],
          },
        },
      ],
    });
    expect(parsed.toolCalls[0].input).toEqual({});
    expect(parsed.text).toBe('');
    expect(parsed.stopReason).toBe('stop');
  });
});

describe('accumulateOpenAIStream', () => {
  it('concatenates text deltas and reports each via onDelta', async () => {
    const onDelta = vi.fn();
    const completion = await accumulateOpenAIStream(
      asStream([
        { choices: [{ delta: { content: 'Hel' } }] },
        { choices: [{ delta: { content: 'lo' } }] },
        { choices: [{ delta: {}, finish_reason: 'stop' }] },
      ]),
      onDelta,
    );
    expect(onDelta.mock.calls.map((c) => c[0])).toEqual(['Hel', 'lo']);
    const parsed = parseOpenAIResponse(completion);
    expect(parsed.text).toBe('Hello');
    expect(parsed.stopReason).toBe('stop');
    expect(parsed.toolCalls).toEqual([]);
  });

  it('reassembles a tool call from fragmented deltas by index', async () => {
    const onDelta = vi.fn();
    const completion = await accumulateOpenAIStream(
      asStream([
        { choices: [{ delta: { tool_calls: [{ index: 0, id: 't1', function: { name: 'insert_text' } }] } }] },
        { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '{"text":"' } }] } }] },
        { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: 'hi"}' } }] } }] },
        { choices: [{ delta: {}, finish_reason: 'tool_calls' }] },
      ]),
      onDelta,
    );
    expect(onDelta).not.toHaveBeenCalled();
    const parsed = parseOpenAIResponse(completion);
    expect(parsed.toolCalls).toEqual([{ id: 't1', name: 'insert_text', input: { text: 'hi' } }]);
    expect(parsed.stopReason).toBe('tool_calls');
  });

  it('keeps multiple tool calls separate and ordered by index', async () => {
    const completion = await accumulateOpenAIStream(
      asStream([
        {
          choices: [
            {
              delta: {
                tool_calls: [
                  { index: 1, id: 'b', function: { name: 'second', arguments: '{}' } },
                  { index: 0, id: 'a', function: { name: 'first', arguments: '{}' } },
                ],
              },
            },
          ],
        },
      ]),
      vi.fn(),
    );
    const parsed = parseOpenAIResponse(completion);
    expect(parsed.toolCalls.map((c) => c.name)).toEqual(['first', 'second']);
  });
});

it('preserves the final usage-only stream chunk without counting text fragments as tokens', async () => {
  const completion = await accumulateOpenAIStream(
    asStream([
      { choices: [{ delta: { content: 'hello' } }] },
      { choices: [{ delta: { content: ' world' }, finish_reason: 'stop' }] },
      {
        choices: [],
        usage: {
          completion_tokens: 7,
          prompt_tokens: 13,
          extra: { decode_tokens_per_s: 21.5, time_to_first_token_s: 0.4 },
        },
      },
    ]),
    () => undefined,
  );
  expect(parseOpenAIResponse(completion).usage).toEqual({
    completionTokens: 7,
    promptTokens: 13,
    decodeTokensPerSecond: 21.5,
    timeToFirstTokenMs: 400,
  });
});

it('does not invent usage when the backend omits statistics', () => {
  expect(parseOpenAIResponse({ choices: [{ message: { content: 'hello' } }] })).not.toHaveProperty('usage');
});

it('ignores malformed or non-finite backend statistics', () => {
  expect(
    parseOpenAIResponse({
      choices: [{ message: { content: 'hello' } }],
      usage: {
        completion_tokens: -1,
        prompt_tokens: 1.5,
        extra: { decode_tokens_per_s: Infinity, time_to_first_token_s: NaN },
      },
    }),
  ).not.toHaveProperty('usage');
});

it('preserves backend prompt and decode timings from a CPU completion', () => {
  const completion = {
    choices: [{ message: { content: 'hello' }, finish_reason: 'stop' }],
    timings: { prompt_ms: 5000, predicted_ms: 300, predicted_per_second: 40 },
  };
  expect(parseOpenAIResponse(completion).usage).toMatchObject({
    promptProcessingDurationMs: 5000,
    decodingDurationMs: 300,
    decodeTokensPerSecond: 40,
  });
});

it('retains timings in a streamed tail without choices and rejects invalid measurements', async () => {
  async function* chunks(): AsyncIterable<OpenAIStreamChunk> {
    yield { choices: [{ delta: { content: 'hello' } }] };
    yield { timings: { prompt_ms: 0, predicted_ms: 20, predicted_per_second: 50 } };
  }
  expect(parseOpenAIResponse(await accumulateOpenAIStream(chunks(), () => {})).usage).toMatchObject({
    promptProcessingDurationMs: 0,
    decodingDurationMs: 20,
    decodeTokensPerSecond: 50,
  });
  expect(
    parseOpenAIResponse({
      choices: [],
      timings: {
        prompt_ms: -1,
        predicted_ms: Infinity,
        predicted_per_second: NaN,
      },
    }).usage,
  ).toBeUndefined();
});
