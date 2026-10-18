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
