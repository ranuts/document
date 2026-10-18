import { expect, it, vi } from 'vitest';
import { runAgent } from '@ranuts/agent-core/runtime';
import type { LLMMessage, LLMProvider, LLMResponse } from '@ranuts/agent-core/llm/types';
import { getDocumentTextTool, getPresentationTextTool } from '../../lib/agent-plugin/tools';
import { createDocumentAgentTools } from '../../lib/agent-plugin/document-agent-tools';

const editor = vi.hoisted(() => ({ body: '', slide: false }));
vi.mock('../../lib/agent-plugin/editor-bridge', () => ({
  requireEditorApi: () => ({
    WordControl: {
      m_oLogicDocument: editor.slide
        ? { Slides: [{ cSld: { spTree: [{ getText: () => editor.body }] } }] }
        : { GetText: () => editor.body },
    },
  }),
}));
const answer: LLMResponse = {
  text: 'Summary from the excerpt',
  toolCalls: [],
  stopReason: 'stop',
  assistant: { role: 'assistant', content: 'Summary from the excerpt' },
};
const byteSize = (messages: LLMMessage[]) =>
  messages.reduce(
    (sum, message) =>
      sum + new TextEncoder().encode(JSON.stringify({ role: message.role, content: message.content })).length + 16,
    0,
  );
function scripted(name: string, count = 1) {
  const snapshots: LLMMessage[][] = [];
  const calls = Array.from({ length: count }, (_, index) => ({ id: `read-${index}`, name, input: {} }));
  const provider: LLMProvider = {
    name: 'native-cloud',
    isReady: () => true,
    toolCallingMode: 'native',
    chat: async (messages) => {
      snapshots.push(structuredClone(messages));
      return snapshots.length === 1
        ? {
            text: '',
            toolCalls: calls,
            stopReason: 'tool_calls',
            assistant: { role: 'assistant', content: calls.map((call) => ({ type: 'tool_use' as const, ...call })) },
          }
        : answer;
    },
  };
  return { provider, snapshots };
}

for (const scoped of [false, true]) {
  it.each([
    ['ASCII', 'a'.repeat(8000), true],
    ['Chinese', '文'.repeat(2200), true],
    ['emoji', '😀'.repeat(2600), true],
    ['JSON escaping', '"\\\n'.repeat(2400), true],
    ['short text', 'a'.repeat(500), false],
  ] as const)(
    `fits real %s document results before inference two (${scoped ? 'scoped' : 'raw'} tools)`,
    async (_label, body, truncated) => {
      editor.body = body;
      editor.slide = false;
      const tools = scoped
        ? createDocumentAgentTools({
            target: { context: { kind: 'word' }, label: 'DOCX', selectedText: '', isCurrent: () => true },
            readonly: false,
            receipt: () => {},
            review: async () => {
              throw new Error('Read must not require review');
            },
          })
        : { get_document_text: getDocumentTextTool };
      const { provider, snapshots } = scripted('get_document_text');
      const result = await runAgent(provider, 'Summarize the current document', { tools });
      expect(result.text).toBe('Summary from the excerpt');
      expect(snapshots).toHaveLength(2);
      expect(byteSize(snapshots[1])).toBeLessThanOrEqual(6144);
      const results = snapshots[1]
        .flatMap((message) => (typeof message.content === 'string' ? [] : message.content))
        .filter((block) => block.type === 'tool_result');
      expect(results).toHaveLength(1);
      const output = JSON.parse(results[0].content);
      const excerpt = scoped ? output.result : output;
      expect(excerpt.truncated).toBe(truncated);
      expect(excerpt.text.length).toBeGreaterThan(0);
      expect(body.startsWith(excerpt.text)).toBe(true);
      expect(excerpt.text).not.toMatch(/[\uD800-\uDBFF]$/u);
      if (!truncated) expect(excerpt.text).toBe(body);
      if (scoped) expect(output.status).toBe('completed');
      expect(snapshots[1][0].content).toBe('Summarize the current document');
      expect(snapshots[1][1].content).toEqual([
        { type: 'tool_use', id: 'read-0', name: 'get_document_text', input: {} },
      ]);
    },
  );
}

it('fits two actual read results together with the current request, escaped tool JSON and optional reference data', async () => {
  editor.body = '文😀"\\\n'.repeat(2400);
  editor.slide = false;
  const { provider, snapshots } = scripted('get_document_text', 2);
  const question = 'Explain the source: ' + 'q'.repeat(800);
  await runAgent(provider, question, {
    tools: { get_document_text: getDocumentTextTool },
    maxContextBytes: 2600,
    requestContext: JSON.stringify({ scope: 'word', text: 'optional'.repeat(1000) }),
  });
  expect(snapshots).toHaveLength(2);
  expect(byteSize(snapshots[1])).toBeLessThanOrEqual(2600);
  expect(JSON.stringify(snapshots[1][0])).toContain(question);
  const results = snapshots[1]
    .flatMap((message) => (typeof message.content === 'string' ? [] : message.content))
    .filter((block) => block.type === 'tool_result');
  expect(results.map((block) => block.toolUseId)).toEqual(['read-0', 'read-1']);
  for (const block of results) expect(JSON.parse(block.content)).toMatchObject({ truncated: true });
});
it('preserves presentation read metadata when fitting UTF-8 excerpts', async () => {
  editor.body = '文'.repeat(2600);
  editor.slide = true;
  const { provider, snapshots } = scripted('get_presentation_text');
  await runAgent(provider, 'Summarize the slides', { tools: { get_presentation_text: getPresentationTextTool } });
  expect(byteSize(snapshots[1])).toBeLessThanOrEqual(6144);
  const block = snapshots[1]
    .flatMap((message) => (typeof message.content === 'string' ? [] : message.content))
    .find((block) => block.type === 'tool_result');
  expect(JSON.parse(block!.content)).toMatchObject({ truncated: true, slidesRead: 1, totalSlides: 1 });
});

it.each(['read', 'write'] as const)(
  'refits a prior long read when a later %s exchange grows the same turn',
  async (next) => {
    editor.body = 'a'.repeat(8000);
    editor.slide = false;
    const snapshots: LLMMessage[][] = [];
    const checkpoints: LLMMessage[][] = [];
    const writes: string[] = [];
    const calls = [
      { id: 'first-read', name: 'get_document_text', input: {} },
      next === 'read'
        ? { id: 'next-read', name: 'get_document_text', input: { maxChars: 1000 } }
        : { id: 'write', name: 'write', input: { text: 'Verified edit' } },
    ];
    const result = await runAgent(
      {
        name: 'native-cloud',
        isReady: () => true,
        chat: async (messages) => {
          snapshots.push(structuredClone(messages));
          const call = calls.shift();
          return call
            ? {
                text: '',
                toolCalls: [call],
                stopReason: 'tool_calls',
                assistant: { role: 'assistant', content: [{ type: 'tool_use', ...call }] },
              }
            : answer;
        },
      },
      'Read, then continue the task and confirm the result',
      {
        tools: {
          get_document_text: getDocumentTextTool,
          write: {
            name: 'write',
            description: 'write',
            readOnlyHint: false,
            inputSchema: {},
            execute: async ({ text }) => {
              writes.push(String(text));
              return { verified: true, receipt: 'unchanged protocol' };
            },
          },
        },
        onToolExchange: (messages) => checkpoints.push(structuredClone(messages)),
      },
    );
    expect(result.text).toBe('Summary from the excerpt');
    expect(snapshots).toHaveLength(3);
    expect(checkpoints).toHaveLength(2);
    for (const messages of [...snapshots, ...checkpoints]) expect(byteSize(messages)).toBeLessThanOrEqual(6144);
    const results = (messages: LLMMessage[]) =>
      messages
        .flatMap((message) => (typeof message.content === 'string' ? [] : message.content))
        .filter((block) => block.type === 'tool_result');
    const before = JSON.parse(results(snapshots[1])[0].content);
    const after = JSON.parse(results(snapshots[2])[0].content);
    expect(after.text.length).toBeLessThan(before.text.length);
    expect(after).toMatchObject({ truncated: true });
    expect(results(snapshots[2]).map((block) => block.toolUseId)).toEqual([
      'first-read',
      next === 'read' ? 'next-read' : 'write',
    ]);
    if (next === 'read') expect(JSON.parse(results(snapshots[2])[1].content).text.length).toBeGreaterThan(0);
    else {
      expect(writes).toEqual(['Verified edit']);
      expect(JSON.parse(results(snapshots[2])[1].content)).toEqual({ verified: true, receipt: 'unchanged protocol' });
    }
    expect(results(result.messages)).toEqual(results(snapshots[2]));
  },
);

for (const precedingRead of [false, true]) {
  it.each(['input', 'output'] as const)(
    `preserves terminal writes with oversized %s and no further inference (${precedingRead ? 'after read' : 'write only'})`,
    async (oversized) => {
      editor.body = 'a'.repeat(8000);
      editor.slide = false;
      const writes: string[] = [];
      let inferences = 0;
      const largeText = 'x'.repeat(8000);
      const calls = [
        ...(precedingRead ? [{ id: 'source', name: 'get_document_text', input: {} }] : []),
        { id: 'terminal', name: 'write', input: { text: oversized === 'input' ? largeText : 'small text' } },
      ];
      const result = await runAgent(
        {
          name: 'native-cloud',
          isReady: () => true,
          chat: async () => {
            inferences++;
            const call = calls.shift();
            if (!call) throw new Error('Terminal write must not trigger another inference');
            return {
              text: '',
              toolCalls: [call],
              stopReason: 'tool_calls',
              assistant: { role: 'assistant', content: [{ type: 'tool_use', ...call }] },
            };
          },
        },
        'Perform the terminal edit',
        {
          tools: {
            get_document_text: getDocumentTextTool,
            write: {
              name: 'write',
              description: 'write',
              readOnlyHint: false,
              inputSchema: {},
              concludesTurn: true,
              execute: async ({ text }) => {
                writes.push(String(text));
                return { written: true, receipt: oversized === 'output' ? largeText : 'Verified' };
              },
            },
          },
        },
      );
      expect(result).toMatchObject({ completedByTool: true, stoppedOnLimit: false, aborted: false });
      expect(writes).toEqual([oversized === 'input' ? largeText : 'small text']);
      expect(inferences).toBe(precedingRead ? 2 : 1);
      const results = result.messages
        .flatMap((message) => (typeof message.content === 'string' ? [] : message.content))
        .filter((block) => block.type === 'tool_result');
      expect(JSON.parse(results.at(-1)!.content)).toEqual({
        written: true,
        receipt: oversized === 'output' ? largeText : 'Verified',
      });
    },
  );
}

it.each(['abort', 'terminal'] as const)(
  'fills pending result shells after %s while refitting an earlier read',
  async (mode) => {
    editor.body = 'a'.repeat(8000);
    editor.slide = false;
    const abort = new AbortController();
    let turn = 0;
    const checkpoints: LLMMessage[][] = [];
    const executed: string[] = [];
    const result = await runAgent(
      {
        name: 'native-cloud',
        isReady: () => true,
        chat: async () => {
          const calls =
            turn++ === 0
              ? [{ id: 'read', name: 'get_document_text', input: {} }]
              : [
                  { id: 'settle', name: 'settle', input: {} },
                  { id: 'tail', name: 'tail', input: {} },
                ];
          return {
            text: '',
            toolCalls: calls,
            stopReason: 'tool_calls',
            assistant: { role: 'assistant', content: calls.map((call) => ({ type: 'tool_use', ...call })) },
          };
        },
      },
      'Read and perform the owned step',
      {
        signal: abort.signal,
        onToolExchange: (messages) => checkpoints.push(structuredClone(messages)),
        tools: {
          get_document_text: getDocumentTextTool,
          settle: {
            name: 'settle',
            description: 'settle',
            inputSchema: {},
            readOnlyHint: false,
            concludesTurn: mode === 'terminal',
            execute: async () => {
              executed.push('settle');
              if (mode === 'abort') abort.abort();
              return { verified: true };
            },
          },
          tail: {
            name: 'tail',
            description: 'tail',
            inputSchema: {},
            readOnlyHint: false,
            execute: async () => {
              executed.push('tail');
              return { verified: true };
            },
          },
        },
      },
    );
    expect(executed).toEqual(['settle']);
    expect(turn).toBe(2);
    expect(result.aborted).toBe(mode === 'abort');
    if (mode === 'terminal') expect(result.completedByTool).toBe(true);
    const checkpoint = checkpoints.at(-1)!;
    expect(byteSize(checkpoint)).toBeLessThanOrEqual(6144);
    const results = checkpoint
      .flatMap((message) => (typeof message.content === 'string' ? [] : message.content))
      .filter((block) => block.type === 'tool_result');
    expect(results.map((block) => block.toolUseId)).toEqual(['read', 'settle', 'tail']);
    expect(results.every((block) => block.content.length > 0)).toBe(true);
    expect(results.at(-1)).toMatchObject({
      isError: true,
      content: mode === 'abort' ? 'Cancelled before execution' : 'Turn concluded before execution',
    });
    expect(JSON.parse(results[0].content)).toMatchObject({ truncated: true });
  },
);
