import { agentTools } from '../../lib/agent-plugin/tools';
import { expect, it, vi } from 'vitest';
import { runAgent } from '@ranuts/agent-core/runtime';
import type { LLMProvider, LLMResponse } from '@ranuts/agent-core/llm/types';
import { createSchemaTaskProvider, runDocumentTask } from '../../lib/agent-plugin/document-task';

const response = (value: unknown): LLMResponse => ({
  text: JSON.stringify(value),
  toolCalls: [],
  stopReason: 'end_turn',
  assistant: { role: 'assistant', content: JSON.stringify(value) },
});
it('adapts result-dependent schema steps to the existing matched tool loop', async () => {
  const generateJSON = vi
    .fn()
    .mockResolvedValueOnce(response({ kind: 'tool', tool: 'read', input: {} }))
    .mockResolvedValueOnce(response({ kind: 'tool', tool: 'write', input: { value: '120' } }))
    .mockResolvedValueOnce(response({ kind: 'answer', text: 'Budget 120', disposition: 'answered' }));
  const provider: LLMProvider = { name: 'local', isReady: () => true, generateJSON, chat: vi.fn() };
  const write = vi.fn(async () => ({ status: 'verified', result: { value: '120' } }));
  const result = await runAgent(
    createSchemaTaskProvider(provider, () => ({ kind: 'cell', range: 'A1' })),
    'Read the budget and write it',
    {
      tools: {
        read: {
          name: 'read',
          description: 'read',
          inputSchema: {},
          readOnlyHint: true,
          execute: async () => ({ value: '120' }),
        },
        write: {
          name: 'write',
          description: 'write',
          inputSchema: {
            type: 'object',
            properties: { value: { type: 'string' } },
            required: ['value'],
            additionalProperties: false,
          },
          readOnlyHint: false,
          execute: write,
        },
      },
    },
  );
  expect(write).toHaveBeenCalledWith({ value: '120' });
  expect(JSON.stringify(generateJSON.mock.calls[1][0])).toContain('120');
  expect(JSON.stringify(generateJSON.mock.calls[2][0])).toContain('verified');
  expect(result.text).toBe('Budget 120');
  const toolIds = result.messages.flatMap((m) =>
    typeof m.content === 'string' ? [] : m.content.filter((b) => b.type === 'tool_use').map((b) => b.id),
  );
  const resultIds = result.messages.flatMap((m) =>
    typeof m.content === 'string' ? [] : m.content.filter((b) => b.type === 'tool_result').map((b) => b.toolUseId),
  );
  expect(resultIds).toEqual(toolIds);
});
it.each([
  { kind: 'tool', tool: 'not_available', input: {} },
  { kind: 'tool', tool: 'read', input: {}, text: 'extra' },
  { kind: 'answer', text: 'done', disposition: 'completed' },
  { kind: 'answer', text: '', disposition: 'answered' },
])('rejects invalid or falsely certified schema responses: %j', async (value) => {
  const provider: LLMProvider = {
    name: 'local',
    isReady: () => true,
    generateJSON: async () => response(value),
    chat: vi.fn(),
  };
  await expect(
    createSchemaTaskProvider(provider, () => ({ kind: 'word' })).chat(
      [{ role: 'user', content: 'hello' }],
      [{ name: 'read', description: 'read', inputSchema: {} }],
    ),
  ).rejects.toThrow();
});
it('retains an explicit unsupported remainder after a successful primitive', async () => {
  const provider: LLMProvider = {
    name: 'local',
    isReady: () => true,
    generateJSON: async () =>
      response({
        kind: 'answer',
        text: 'The note was added; editing PDF body text is unavailable.',
        disposition: 'partial',
      }),
    chat: vi.fn(),
  };
  const result = await createSchemaTaskProvider(provider, () => ({ kind: 'pdf' })).chat([], []);
  expect(result.text).toContain('unavailable');
  expect(result.toolCalls).toEqual([]);
});

it('coordinates a real registry read and returns its result to schema inference', async () => {
  const read = vi.spyOn(agentTools.get_document_text, 'execute').mockResolvedValue({ text: 'Budget 120' });
  const generateJSON = vi
    .fn()
    .mockResolvedValueOnce(response({ kind: 'tool', tool: 'get_document_text', input: {} }))
    .mockResolvedValueOnce(response({ kind: 'answer', text: '120', disposition: 'answered' }));
  try {
    const result = await runDocumentTask(
      { name: 'local', isReady: () => true, generateJSON, chat: vi.fn() },
      'Read the budget amount',
      {
        target: { context: { kind: 'word' }, label: 'Word', selectedText: '', isCurrent: () => true },
        readonly: false,
        review: vi.fn(),
        receipt: vi.fn(),
      },
    );
    expect(read).toHaveBeenCalledOnce();
    expect(JSON.stringify(generateJSON.mock.calls[1][0])).toContain('Budget 120');
    expect(result.text).toBe('120');
  } finally {
    read.mockRestore();
  }
});

it('rejects a PDF body edit before offering an annotation as a substitute', async () => {
  const generateJSON = vi.fn().mockResolvedValue(response({ effect: 'edit_body' }));
  const review = vi.fn();
  const result = await runDocumentTask(
    { name: 'local', isReady: () => true, generateJSON, chat: vi.fn() },
    'Change the budget in page 1 to 200.',
    {
      target: { context: { kind: 'pdf', page: 1 }, label: 'PDF', selectedText: '', isCurrent: () => true },
      readonly: false,
      review,
      receipt: vi.fn(),
    },
  );
  expect(result.text).toContain('body text');
  expect(result.toolCallCount).toBe(0);
  expect(review).not.toHaveBeenCalled();
  expect(generateJSON).toHaveBeenCalledOnce();
  expect(JSON.stringify(generateJSON.mock.calls[0][0])).not.toContain('add_pdf_comment');
});
it('restricts a PDF read request to read tools even when a native provider tries to add a note', async () => {
  const review = vi.fn();
  const result = await runDocumentTask(
    {
      name: 'native',
      toolCallingMode: 'native',
      isReady: () => true,
      generateJSON: async () => response({ effect: 'read' }),
      chat: async (_messages, tools) => {
        expect(tools.map((t) => t.name)).toEqual(['get_pdf_text']);
        return {
          ...response(''),
          text: '',
          toolCalls: [{ id: 'wrong', name: 'add_pdf_comment', input: { text: '200', page: 1 } }],
          assistant: {
            role: 'assistant',
            content: [{ type: 'tool_use', id: 'wrong', name: 'add_pdf_comment', input: { text: '200', page: 1 } }],
          },
        };
      },
    },
    'Read the budget.',
    {
      target: { context: { kind: 'pdf', page: 1 }, label: 'PDF', selectedText: '', isCurrent: () => true },
      readonly: false,
      review,
      receipt: vi.fn(),
    },
  );
  expect(review).not.toHaveBeenCalled();
  expect(JSON.stringify(result.messages)).toContain('Unknown tool');
});
