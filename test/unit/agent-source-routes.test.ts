import { expect, it, vi } from 'vitest';
import { runDocumentTask } from '../../lib/agent-plugin/document-task';
import { generateDocumentToolSequence } from '../../lib/agent-plugin/document-tool-sequence';
import { generateReadAnswer } from '../../lib/agent-plugin/document-read-answer';
import type { LLMResponse } from '@ranuts/agent-core/llm/types';
const response = (text: string): LLMResponse => ({
  text,
  toolCalls: [],
  stopReason: 'stop',
  assistant: { role: 'assistant', content: text },
});
const reference = JSON.stringify({
  references: [
    { id: 'S1', sourceId: 'policy-source', title: 'Policy', connector: 'local', text: 'Reference policy 123' },
  ],
});
it('grounds native-disabled task execution in captured source data', async () => {
  const chat = vi.fn(async () => response('Based on policy.'));
  await runDocumentTask(
    { name: 'test', toolCallingMode: 'native', isReady: () => true, chat },
    'Discuss the document using policy',
    {
      target: { context: { kind: 'word' }, label: 'Document', selectedText: '', isCurrent: () => true },
      readonly: true,
      review: vi.fn(),
      receipt: vi.fn(),
      requestContext: reference,
    },
  );
  expect(JSON.stringify(chat.mock.calls[0])).toContain('Reference policy 123');
  expect(JSON.stringify(chat.mock.calls[0])).toContain('cite the matching id as [S1]');
});
it('grounds structured planning and read continuations without adding source instructions as capabilities', async () => {
  const generateJSON = vi.fn(async () => response(JSON.stringify({ tool: 'get_selection', input: {} })));
  const chat = vi.fn(async () => response('Based on policy.'));
  const provider = { name: 'test', isReady: () => true, generateJSON, chat };
  await generateDocumentToolSequence(
    provider,
    'Analyze current text with policy',
    { kind: 'word' },
    new AbortController().signal,
    { referenceData: reference },
  );
  expect(JSON.stringify(generateJSON.mock.calls[0])).toContain('Reference policy 123');
  await generateReadAnswer(
    provider,
    'Compare with policy',
    { kind: 'word' },
    [],
    new AbortController().signal,
    undefined,
    reference,
  );
  expect(JSON.stringify(chat.mock.calls[0])).toContain('Reference policy 123');
  expect(JSON.stringify(chat.mock.calls[0])).toContain('cite the matching id as [S1]');
});
