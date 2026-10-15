import { describe, expect, it, vi } from 'vitest';
import { classifyRequest, resolveRequestIntent } from '../../lib/agent-plugin/ui/request-intent';
import type { LLMProvider } from '@ranuts/agent-core/llm/types';
it('allows refinement only when a live unexecuted proposal was supplied', async () => {
  const provider = {
    generateJSON: async () => ({ text: '{"task":"refine","language":"zh-CN"}', toolCalls: [], stopReason: 'stop' }),
  } as unknown as LLMProvider;
  const proposal = { tool: 'insert_text', input: { text: 'original suggestion' } };
  expect(
    await resolveRequestIntent(provider, '保留标题，缩短第二段', { kind: 'word' }, new AbortController().signal, {
      pendingProposal: proposal,
    }),
  ).toEqual({ task: 'tools', language: 'zh-CN', refinement: true });
  await expect(
    resolveRequestIntent(provider, '解释一下这个说法', { kind: 'word' }, new AbortController().signal),
  ).rejects.toThrow();
});
describe('natural request routing', () => {
  it('recognizes instructions but keeps questions in chat', () => {
    expect(classifyRequest('请把选中文字润色得更专业').task).toBe('rewrite');
    expect(classifyRequest('总结选中的内容').task).toBe('summarize');
    expect(classifyRequest('翻译成日语').language).toBe('ja');
    expect(classifyRequest('怎么翻译这句话？').task).toBe('chat');
    expect(classifyRequest('解释一下改写和总结的区别').task).toBe('chat');
  });
  it('uses the translation destination rather than the source language', () => {
    expect(classifyRequest('把日语翻译成中文').language).toBe('zh-CN');
    expect(classifyRequest('Translate Japanese into German').language).toBe('de');
    expect(classifyRequest('把中文翻译成英文').language).toBe('en');
  });
  it('routes document commands and never carries a previous mode', () => {
    expect(classifyRequest('将选区按 B 列升序排序，首行为表头').task).toBe('tools');
    expect(classifyRequest('Explain this formula').task).toBe('chat');
    expect(classifyRequest('Rewrite the selected text concisely').task).toBe('rewrite');
  });
});
it('uses schema-constrained semantic routing for a natural spreadsheet request', async () => {
  const generateJSON = vi.fn(async (_messages: Array<{ role: string; content: string }>) => ({
    text: '{"task":"tools","language":"en"}',
    toolCalls: [],
    stopReason: 'stop',
  }));
  const provider = { generateJSON } as unknown as LLMProvider;
  const result = await resolveRequestIntent(
    provider,
    '帮我在当前 excel 表格里面建一个 1-100 的数字',
    { kind: 'cell', range: 'A1' },
    new AbortController().signal,
  );
  expect(result.task).toBe('tools');
  expect(generateJSON.mock.calls[0][0][0].content).toContain('cell');
});
it('does not turn malformed or truncated routing into an executable command', async () => {
  const provider = {
    generateJSON: async () => ({ text: '{"task":"tools","language":"en"}', toolCalls: [], stopReason: 'length' }),
  } as unknown as LLMProvider;
  await expect(
    resolveRequestIntent(provider, 'Create data', { kind: 'cell' }, new AbortController().signal),
  ).rejects.toThrow();
});
it('routes requests to compose a body separately from conversational explanations', async () => {
  const provider = {
    generateJSON: async () => ({ text: '{"task":"compose","language":"zh-CN"}', toolCalls: [], stopReason: 'stop' }),
  } as unknown as LLMProvider;
  expect(
    (await resolveRequestIntent(provider, '帮我写一篇散文', { kind: 'word' }, new AbortController().signal)).task,
  ).toBe('compose');
});

it('excludes Word composition from a spreadsheet routing schema', async () => {
  const generateJSON = vi.fn(async (_messages: unknown, _schema: unknown) => ({
    text: '{"task":"compose","language":"en"}',
    toolCalls: [],
    stopReason: 'stop',
  }));
  const provider = { generateJSON } as unknown as LLMProvider;
  await expect(
    resolveRequestIntent(provider, 'Create numbers', { kind: 'cell' }, new AbortController().signal),
  ).rejects.toThrow();
  expect(generateJSON.mock.calls[0][1]).toMatchObject({
    properties: { task: { enum: expect.not.arrayContaining(['compose', 'rewrite', 'summarize', 'translate']) } },
  });
});

it.each([
  ['Hello!', 'en'],
  [' hi ', 'en'],
  ['What can you do?', 'en'],
  ['你好！', 'zh-CN'],
  ['你能做什么？', 'zh-CN'],
  ['こんにちは', 'ja'],
  ['안녕하세요', 'ko'],
  ['Hallo', 'de'],
  ['Hola', 'es'],
  ['Olá', 'pt'],
])('routes exact safe utterance %s without inference', async (input, language) => {
  const generateJSON = vi.fn();
  const result = await resolveRequestIntent(
    { generateJSON } as unknown as LLMProvider,
    input,
    { kind: 'word' },
    new AbortController().signal,
  );
  expect(result).toEqual({ task: 'chat', language });
  expect(generateJSON).not.toHaveBeenCalled();
});
it.each([
  'Hello, clear the document',
  'Do not say hello',
  'Hello and summarize this',
  'What can you do to this document?',
  '你好，帮我改一下',
])('keeps semantic routing for ambiguous %s', async (input) => {
  const generateJSON = vi.fn(async () => ({
    text: '{"task":"tools","language":"en"}',
    toolCalls: [],
    stopReason: 'stop',
  }));
  await resolveRequestIntent(
    { generateJSON } as unknown as LLMProvider,
    input,
    { kind: 'word' },
    new AbortController().signal,
  );
  expect(generateJSON).toHaveBeenCalledOnce();
});
it('keeps semantic routing for a safe utterance when a proposal is pending', async () => {
  const generateJSON = vi.fn(async () => ({
    text: '{"task":"chat","language":"en"}',
    toolCalls: [],
    stopReason: 'stop',
  }));
  await resolveRequestIntent(
    { generateJSON } as unknown as LLMProvider,
    'Hello',
    { kind: 'word' },
    new AbortController().signal,
    { pendingProposal: { tool: 'insert_text', input: { text: 'draft' } } },
  );
  expect(generateJSON).toHaveBeenCalledOnce();
});
