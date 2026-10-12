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

it('previews structured document content before final validation without dropping escaped text', async () => {
  let finish!: () => void;
  const gate = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const emit = vi.fn();
  const raw = '{"text":"Autumn\\n\\nLeaves."}';
  const provider = {
    generateJSON: vi.fn(async () => ({ text: raw, toolCalls: [], stopReason: 'stop' })),
    generateJSONStream: async (_messages: unknown, _schema: unknown, delta: (text: string) => void) => {
      delta('{"text":"Autumn');
      await gate;
      delta('\\n\\nLeaves."}');
      return { text: raw, toolCalls: [], stopReason: 'stop' };
    },
  } as unknown as LLMProvider;
  const result = generateDocumentDraft(provider, 'Write about autumn', new AbortController().signal, emit);
  expect(emit.mock.calls.flat().join('')).toBe('Autumn');
  finish();
  await expect(result).resolves.toBe('Autumn\n\nLeaves.');
  expect(emit.mock.calls.flat().join('')).toBe('Autumn\n\nLeaves.');
});

it.each(['cancel', 'truncate'] as const)('never accepts a %s streamed draft as a document body', async (mode) => {
  const abort = new AbortController();
  const emit = vi.fn();
  const provider = {
    generateJSONStream: async (_messages: unknown, _schema: unknown, delta: (text: string) => void) => {
      delta('{"text":"Preview');
      if (mode === 'cancel') abort.abort();
      delta(' discarded"}');
      return { text: '{"text":"Preview discarded"}', toolCalls: [], stopReason: 'length' };
    },
  } as unknown as LLMProvider;
  await expect(generateDocumentDraft(provider, 'Write', abort.signal, emit)).rejects.toThrow();
  expect(emit.mock.calls.flat().join('')).toBe(mode === 'cancel' ? 'Preview' : 'Preview discarded');
});
