import { describe, expect, it, vi } from 'vitest';
import { parseActionPlan, generateActionPlan } from '../../packages/agent-core/src/llm/action-plan';

describe('reviewed local action plans', () => {
  it('accepts one allowed operation and an empty SDK thinking prefix', () => {
    expect(parseActionPlan('<think>\n</think>\n{"tool":"insert_text","input":{"text":"Hello"}}', 'word')).toEqual({
      tool: 'insert_text',
      input: { text: 'Hello' },
    });
  });
  it.each([
    '{"tool":"delete_document","input":{}}',
    '{"tool":"insert_text","input":{"text":"Hello","html":"<script>"}}',
    '{"tool":"insert_text","input":{"text":1250}}',
    '[{"tool":"insert_text","input":{"text":"Hello"}}]',
    '{"tool":"insert_text","input":{"text":"Hello"},"approved":true}',
    '<think>reasoning</think>{"tool":"insert_text","input":{"text":"Hello"}}',
  ])('rejects untrusted or unsupported output: %s', (text) => {
    expect(() => parseActionPlan(text, 'word')).toThrow();
  });
  it('rejects wrong-editor tools and invalid cell addresses', () => {
    expect(() => parseActionPlan('{"tool":"set_cell","input":{"cell":"B2","value":"1250"}}', 'word')).toThrow();
    for (const cell of ['A0', 'XFE1', 'A1048577', 'Sheet1!A1', 'A1:B2'])
      expect(() =>
        parseActionPlan(JSON.stringify({ tool: 'set_cell', input: { cell, value: '1250' } }), 'cell'),
      ).toThrow();
    expect(parseActionPlan('{"tool":"set_cell","input":{"cell":"b2","value":"1250"}}', 'cell').input.cell).toBe('B2');
  });
  it('rejects excessive output and empty changes', () => {
    for (const text of ['', 'x'.repeat(8001)])
      expect(() => parseActionPlan(JSON.stringify({ tool: 'insert_text', input: { text } }), 'word')).toThrow();
  });
  it('does not allow formulas through the plain-value operation', () => {
    expect(() =>
      parseActionPlan(
        '{"tool":"set_cell","input":{"cell":"B2","value":"=HYPERLINK(\\"https://example.com\\")"}}',
        'cell',
      ),
    ).toThrow();
  });
  it('rejects clipboard separators that would expand a single-cell proposal', () => {
    for (const value of ['', 'safe\t=1+1', 'first\nsecond', 'first\rsecond'])
      expect(() =>
        parseActionPlan(JSON.stringify({ tool: 'set_cell', input: { cell: 'B2', value } }), 'cell'),
      ).toThrow();
  });
  it('never supplies native tools or executes changes and rejects late cancellation', async () => {
    const controller = new AbortController();
    const chat = vi.fn(async (_messages: unknown, _tools: unknown) => {
      controller.abort();
      return { text: '{"tool":"insert_text","input":{"text":"Hello"}}' };
    });
    await expect(generateActionPlan({ chat } as never, 'insert Hello', 'word', controller.signal)).rejects.toThrow();
    expect(chat.mock.calls[0][1]).toEqual([]);
  });
  it('binds generated content to the host cell, without example addresses', async () => {
    const generateJSON = vi.fn(async () => ({
      text: '{"status":"ready","content":"Alex未批准第二阶段"}',
      toolCalls: [],
      stopReason: 'stop',
    }));
    const plan = await generateActionPlan(
      { generateJSON } as never,
      '填入所选单元格',
      'cell',
      new AbortController().signal,
      '',
      'C3',
    );
    expect(plan.input).toEqual({ cell: 'C3', value: 'Alex未批准第二阶段' });
    expect(JSON.stringify(generateJSON.mock.calls)).not.toContain('requested value');
  });
  it.each(['unsupported', 'needs_clarification'])('rejects %s instead of generating an edit', async (status) => {
    const chat = vi.fn(async () => ({ text: JSON.stringify({ status, content: '' }), toolCalls: [] }));
    await expect(
      generateActionPlan({ chat } as never, 'delete everything', 'word', new AbortController().signal),
    ).rejects.toThrow();
  });
  it('rejects cell generation when the host did not supply an address', async () => {
    const chat = vi.fn();
    await expect(
      generateActionPlan({ chat } as never, 'write 1250', 'cell', new AbortController().signal),
    ).rejects.toThrow();
    expect(chat).not.toHaveBeenCalled();
  });
  it('rejects conflicting or multiple addresses before inference', async () => {
    const chat = vi.fn();
    await expect(
      generateActionPlan(
        { chat } as never,
        'Write 1250 to B2 and today to C2',
        'cell',
        new AbortController().signal,
        '',
        'C3',
      ),
    ).rejects.toThrow('another cell');
    expect(chat).not.toHaveBeenCalled();
  });
  it('parses explicit Chinese assignment without relying on model semantics', async () => {
    const chat = vi.fn();
    const plan = await generateActionPlan(
      { chat } as never,
      '将所选单元格的值设为："Alex未批准第二阶段"',
      'cell',
      new AbortController().signal,
      '',
      'C3',
    );
    expect(plan.input.value).toBe('Alex未批准第二阶段');
    expect(chat).not.toHaveBeenCalled();
  });
  it.each(['将所选单元格设为1250，并清空其他单元格', '将所选单元格设为今天的日期'])(
    'rejects nonliteral assignment %s before inference',
    async (instruction) => {
      const chat = vi.fn();
      await expect(
        generateActionPlan({ chat } as never, instruction, 'cell', new AbortController().signal, '', 'C3'),
      ).rejects.toThrow('quoted literal');
      expect(chat).not.toHaveBeenCalled();
    },
  );
  it('distinguishes an address-like literal value from its destination', async () => {
    const plan = await generateActionPlan(
      {} as never,
      'write plain value "B2" to the selected cell',
      'cell',
      new AbortController().signal,
      '',
      'C3',
    );
    expect(plan.input).toEqual({ cell: 'C3', value: 'B2' });
  });
});
