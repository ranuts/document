import { expect, it, vi } from 'vitest';
import type { LLMProvider } from '@ranuts/agent-core/llm/types';
import { generateDocumentDraft } from '../../lib/agent-plugin/ui/document-draft';
it('returns only a structured document body, never a conversational wrapper', async () => {
  const generateJSON = vi.fn(async (_messages: Array<{ role: string; content: string }>) => ({
    text: '{"text":"秋风\\n\\n树叶轻轻摇曳。"}',
    toolCalls: [],
    stopReason: 'stop',
  }));
  const body = await generateDocumentDraft(
    { generateJSON } as unknown as LLMProvider,
    '写一篇散文',
    new AbortController().signal,
  );
  expect(body).toBe('秋风\n\n树叶轻轻摇曳。');
  expect(generateJSON.mock.calls[0][0][0].content).toContain('no conversational');
});
it.each(['{"text":""}', '{"text":"body","comment":"I inserted it"}'])('rejects invalid artifact %s', async (text) => {
  const provider = {
    generateJSON: async () => ({ text, toolCalls: [], stopReason: 'stop' }),
  } as unknown as LLMProvider;
  await expect(generateDocumentDraft(provider, 'write', new AbortController().signal)).rejects.toThrow();
});
