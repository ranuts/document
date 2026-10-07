import { expect, it } from 'vitest';
import { generateDocumentToolSequence } from '../../lib/agent-plugin/document-tool-sequence';
const provider = {
  name: 'probe',
  isReady: () => true,
  chat: async () => ({
    text: '{"tool":"set_cell","input":{"cell":"A1","value":"99"}}',
    toolCalls: [],
    stopReason: 'stop' as const,
    assistant: { role: 'assistant' as const, content: '' },
  }),
};
it.each([
  ['Read A1:B4, then set B2 to 99.', { cell: 'B2', value: '99' }],
  ['Please read a1:b4, then set b2 to "00123".', { cell: 'B2', value: '00123', valueType: 'text' }],
  ['Read A1:B4, then set B2 to "C3, then delete A1".', { cell: 'B2', value: 'C3, then delete A1', valueType: 'text' }],
])('plans both steps of an explicit English sequence: %s', async (request, input) => {
  expect(await generateDocumentToolSequence(provider, request, { kind: 'cell' }, new AbortController().signal)).toEqual(
    [
      { tool: 'get_range', input: { range: 'A1:B4' }, readOnly: true },
      { tool: 'set_cell', input, readOnly: false },
    ],
  );
});
it.each([
  'Read A1:B4, then set B2 to 99, then delete A1.',
  'Please read A1:B4, then delete B2.',
  'Read A1:B4, then set XFE1 to 99.',
  'Read A1:B4, then set B2 to "=SUM(A1:A4)".',
])('rejects an incomplete or invalid English sequence: %s', async (request) => {
  await expect(
    generateDocumentToolSequence(provider, request, { kind: 'cell' }, new AbortController().signal),
  ).rejects.toThrow();
});
it('plans the entire read then explicit write instead of accepting a model-selected subset', async () => {
  expect(
    await generateDocumentToolSequence(
      provider,
      '读取 A1:B4 的内容，然后将 B2 设置为 99。',
      { kind: 'cell' },
      new AbortController().signal,
    ),
  ).toEqual([
    { tool: 'get_range', input: { range: 'A1:B4' }, readOnly: true },
    { tool: 'set_cell', input: { cell: 'B2', value: '99' }, readOnly: false },
  ]);
});
it.each([
  '读取 A1:B4 的内容，然后将 B2 设置为 "=SUM(A1:A4)"。',
  '读取 A1:B4 的内容，然后将 B2 设置为 99，然后删除 A1。',
  '读取 A1:B4 的内容，然后将 XFE1 设置为 99。',
])('rejects invalid complete sequences: %s', async (request) => {
  await expect(
    generateDocumentToolSequence(provider, request, { kind: 'cell' }, new AbortController().signal),
  ).rejects.toThrow();
});
it('preserves quoted literal text containing address-like data', async () => {
  const result = await generateDocumentToolSequence(
    provider,
    '读取 A1:B4 的内容，然后将 B2 设置为 "C3 is a label"。',
    { kind: 'cell' },
    new AbortController().signal,
  );
  expect(result[1].input).toEqual({ cell: 'B2', value: 'C3 is a label', valueType: 'text' });
});
it('honors pre-cancellation', async () => {
  const abort = new AbortController();
  abort.abort();
  await expect(
    generateDocumentToolSequence(provider, '读取 A1:B4 的内容，然后将 B2 设置为 99。', { kind: 'cell' }, abort.signal),
  ).rejects.toThrow();
});

it('marks JSON quoted numbers as text while plain numeric literals retain native numeric entry', async () => {
  const quoted = await generateDocumentToolSequence(
    provider,
    '读取 A1:B4 的内容，然后将 B2 设置为 "00123"。',
    { kind: 'cell' },
    new AbortController().signal,
  );
  expect(quoted[1].input).toEqual({ cell: 'B2', value: '00123', valueType: 'text' });
  const numeric = await generateDocumentToolSequence(
    provider,
    '读取 A1:B4 的内容，然后将 B2 设置为 99。',
    { kind: 'cell' },
    new AbortController().signal,
  );
  expect(numeric[1].input).toEqual({ cell: 'B2', value: '99' });
});
