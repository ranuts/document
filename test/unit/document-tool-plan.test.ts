import { describe, expect, it, vi } from 'vitest';
import { parseDocumentToolPlan, generateDocumentToolPlan } from '../../lib/agent-plugin/document-tool-plan';
import { agentTools } from '../../lib/agent-plugin/tools';
import type { LLMProvider, LLMResponse } from '@ranuts/agent-core/llm/types';
const json = (tool: string, input: Record<string, unknown> = {}) => JSON.stringify({ tool, input });
const response = (text: string): LLMResponse => ({
  text,
  toolCalls: [],
  stopReason: 'stop',
  assistant: { role: 'assistant', content: text },
});
it('distinguishes a valid unsupported plan from a malformed or unavailable tool', () => {
  expect(() => parseDocumentToolPlan(json('unsupported'), { kind: 'cell' })).toThrow('agentToolNotChosen');
  expect(() => parseDocumentToolPlan(json('get_document_text'), { kind: 'cell' })).toThrow('not available');
  expect(() => parseDocumentToolPlan(json('unsupported', { unexpected: true }), { kind: 'cell' })).toThrow(
    'not available',
  );
});
describe('local document tool planning', () => {
  it('accepts applicable tools without executing them', () => {
    const execute = vi.spyOn(agentTools.slide_action, 'execute');
    const plan = parseDocumentToolPlan(json('slide_action', { action: 'duplicate' }), { kind: 'slide', page: 2 });
    expect(plan).toEqual({ tool: 'slide_action', input: { action: 'duplicate' }, readOnly: false });
    expect(execute).not.toHaveBeenCalled();
    execute.mockRestore();
  });
  it('rejects tools from another editor and unknown tools', () => {
    expect(() => parseDocumentToolPlan(json('set_cell', { cell: 'A1', value: 'ok' }), { kind: 'word' })).toThrow(
      /available/,
    );
    expect(() => parseDocumentToolPlan(json('eval', { code: 'alert(1)' }), { kind: 'slide' })).toThrow(/available/);
  });
  it('validates required parameters, exact types, enums and unexpected keys before API calls', () => {
    for (const input of [
      {},
      { action: 'delete' },
      { action: 'navigate', page: '2' },
      { action: 'navigate', page: 0 },
      { action: 'navigate', page: 1.5 },
      { action: 'add', code: 'evil' },
    ])
      expect(() => parseDocumentToolPlan(json('slide_action', input), { kind: 'slide' })).toThrow();
  });
  it('requires a page for navigation and rejects unused page parameters', () => {
    expect(() => parseDocumentToolPlan(json('slide_action', { action: 'navigate' }), { kind: 'slide' })).toThrow();
    expect(() => parseDocumentToolPlan(json('slide_action', { action: 'add', page: 5 }), { kind: 'slide' })).toThrow();
  });
  it('classifies conditional nonmutating operations correctly', () => {
    expect(parseDocumentToolPlan(json('sum_range', { range: 'A1:A3' }), { kind: 'cell' }).readOnly).toBe(true);
    expect(parseDocumentToolPlan(json('sum_range', { range: 'A1:A3', target: 'B1' }), { kind: 'cell' }).readOnly).toBe(
      false,
    );
    expect(
      parseDocumentToolPlan(json('slide_action', { action: 'navigate', page: 2 }), { kind: 'slide' }).readOnly,
    ).toBe(true);
  });
  it('bounds ranges, addresses, formulas in plain cells and text size', () => {
    for (const [tool, input] of [
      ['set_cell', { cell: 'XFE1', value: 'x' }],
      ['set_cell', { cell: 'A1', value: '=SUM(A1:A3)' }],
      ['sum_range', { range: 'A1:XFD1048576' }],
      ['sort_range', { range: 'A1:B3', column: 'C', descending: false, header: true }],
    ] as const)
      expect(() => parseDocumentToolPlan(json(tool, input), { kind: 'cell' })).toThrow();
    expect(() => parseDocumentToolPlan(json('insert_text', { text: 'x'.repeat(8001) }), { kind: 'word' })).toThrow();
  });
  it('rejects extra envelope fields and multiple actions', () => {
    expect(() =>
      parseDocumentToolPlan(JSON.stringify([{ tool: 'get_selection', input: {} }]), { kind: 'word' }),
    ).toThrow();
    expect(() =>
      parseDocumentToolPlan(JSON.stringify({ tool: 'get_selection', input: {}, execute: true }), { kind: 'word' }),
    ).toThrow();
  });
  it('requests schema constrained planning with only the current editor capabilities', async () => {
    let prompt = '';
    const provider: LLMProvider = {
      name: 'probe',
      isReady: () => true,
      chat: async () => {
        throw Error('unexpected');
      },
      generateJSON: async (messages) => {
        prompt = String(messages[0].content);
        return response(json('slide_action', { action: 'add' }));
      },
    };
    expect(
      await generateDocumentToolPlan(provider, 'Add a slide', { kind: 'slide', page: 2 }, new AbortController().signal),
    ).toMatchObject({ tool: 'slide_action' });
    expect(prompt).toContain('slide_action');
    expect(prompt).not.toContain('set_cell');
    expect(prompt).not.toContain('insert_text');
  });
  it('rejects truncated responses and cancellation before accepting a plan', async () => {
    const controller = new AbortController();
    const provider: LLMProvider = {
      name: 'probe',
      isReady: () => true,
      chat: async () => ({ ...response(json('get_selection')), stopReason: 'length' }),
    };
    await expect(
      generateDocumentToolPlan(provider, 'Read selection', { kind: 'word' }, controller.signal),
    ).rejects.toThrow(/Incomplete/);
    provider.chat = async () => {
      controller.abort();
      return response(json('get_selection'));
    };
    await expect(
      generateDocumentToolPlan(provider, 'Read selection', { kind: 'word' }, controller.signal),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });
});

it('separates read-only sum and sum-to-cell generation without accepting empty destinations', async () => {
  let schema: Record<string, unknown> = {};
  const provider: LLMProvider = {
    name: 'probe',
    isReady: () => true,
    chat: async () => {
      throw Error('unexpected');
    },
    generateJSON: async (_messages, format) => {
      schema = format;
      return response(json('sum_range', { range: 'A1:A3' }));
    },
  };
  const plan = await generateDocumentToolPlan(
    provider,
    'Sum A1:A3 and write the result to B4',
    { kind: 'cell' },
    new AbortController().signal,
  );
  expect(plan.readOnly).toBe(true);
  const choices = (
    schema.anyOf as Array<{
      properties: {
        tool: { enum: string[] };
        input: {
          required: string[];
          additionalProperties: boolean;
          properties: Record<string, { minLength?: number }>;
        };
      };
    }>
  ).filter((c) => c.properties.tool.enum[0] === 'sum_range');
  expect(choices).toHaveLength(2);
  expect(choices[0].properties.input.required).toEqual(['range']);
  expect(choices[0].properties.input.properties).not.toHaveProperty('target');
  expect(choices[0].properties.input.additionalProperties).toBe(false);
  expect(choices[1].properties.input.required).toEqual(['range', 'target']);
  expect(choices[1].properties.input.properties.target.minLength).toBe(1);
  expect(choices[1].properties.input.properties.target).toMatchObject({ enum: ['B4'] });
  expect(() => parseDocumentToolPlan(json('sum_range', { range: 'A1:A3', target: '' }), { kind: 'cell' })).toThrow();
});

it('excludes sum destinations not explicitly given separately from source ranges', async () => {
  let schema: Record<string, unknown> = {};
  const provider: LLMProvider = {
    name: 'probe',
    isReady: () => true,
    chat: async () => {
      throw Error('unexpected');
    },
    generateJSON: async (_messages, format) => {
      schema = format;
      return response(json('sum_range', { range: 'A1:A3', target: 'A4' }));
    },
  };
  await expect(
    generateDocumentToolPlan(
      provider,
      'Sum A1:A3 and report the result only',
      { kind: 'cell' },
      new AbortController().signal,
    ),
  ).rejects.toThrow('destination');
  const choices = (
    schema.anyOf as Array<{ properties: { tool: { enum: string[] }; input: { properties: Record<string, unknown> } } }>
  ).filter((c) => c.properties.tool.enum[0] === 'sum_range');
  expect(choices).toHaveLength(1);
  expect(choices[0].properties.input.properties).not.toHaveProperty('target');
});

it.each(['B4', 'A4', 'A3'])('checks an explicit sum destination against a generated %s target', async (target) => {
  const provider: LLMProvider = {
    name: 'probe',
    isReady: () => true,
    chat: async () => response(json('sum_range', { range: 'A1:A3', target })),
  };
  const result = generateDocumentToolPlan(
    provider,
    '求和 A1:A3，写入 b4。',
    { kind: 'cell' },
    new AbortController().signal,
  );
  if (target === 'B4') expect((await result).readOnly).toBe(false);
  else await expect(result).rejects.toThrow();
});

it('constrains slide generation to operation-specific parameter shapes', async () => {
  let schema: Record<string, unknown> = {};
  const provider: LLMProvider = {
    name: 'probe',
    isReady: () => true,
    chat: async () => {
      throw Error('unexpected');
    },
    generateJSON: async (_messages, format) => {
      schema = format;
      return response(json('slide_action', { action: 'add' }));
    },
  };
  await generateDocumentToolPlan(provider, 'Add a slide', { kind: 'slide' }, new AbortController().signal);
  const choices = schema.anyOf as Array<{
    properties: { tool: { enum: string[] }; input: { properties: Record<string, unknown> } };
  }>;
  expect(choices).toBeDefined();
  const slideChoices = choices.filter((c) => c.properties.tool.enum[0] === 'slide_action');
  expect(slideChoices).toHaveLength(3);
  expect(slideChoices.filter((c) => Object.hasOwn(c.properties.input.properties, 'page'))).toHaveLength(1);
});

it('opts into a stable capability prefix without changing tools, context or constraints', async () => {
  const chat = vi.fn().mockResolvedValue(response(json('get_cell', { cell: 'A1' })));
  const provider: LLMProvider = { name: 'test', isReady: () => true, chat };
  const context = { kind: 'cell' as const, range: 'B2', sheet: 'Sheet1' };
  await generateDocumentToolPlan(provider, 'Read A1', context, new AbortController().signal);
  await generateDocumentToolPlan(provider, 'Read A1', context, new AbortController().signal, {
    stableCapabilityPrefix: true,
  });
  const original = chat.mock.calls[0][0][0].content as string;
  const optimized = chat.mock.calls[1][0][0].content as string;
  expect(original.indexOf('Current context:')).toBeLessThan(original.indexOf('Capabilities:'));
  expect(optimized.indexOf('Capabilities:')).toBeLessThan(optimized.indexOf('Current context:'));
  expect(optimized.split('\n').sort()).toEqual(original.split('\n').sort());
});

it.each([
  ['Sort A1:B4 in ascending order by B. Row 1 is a header.', true],
  ['Sort A1:B4 in descending order by B. Row 1 is a header.', false],
  ['将 A1:B4 按 B 列升序排序，首行为表头。', true],
  ['将 A1:B4 按 B 列降序排序，首行为表头。', false],
])(
  'rejects opposite generated sorting direction for %s before returning an executable plan',
  async (request, descending) => {
    const provider: LLMProvider = {
      name: 'probe',
      isReady: () => true,
      chat: async () => response(json('sort_range', { range: 'A1:B4', column: 'B', descending, header: true })),
    };
    await expect(
      generateDocumentToolPlan(provider, request, { kind: 'cell' }, new AbortController().signal),
    ).rejects.toThrow(/direction/i);
  },
);

it.each([
  ['ascending', false],
  ['descending', true],
  ['升序', false],
  ['降序', true],
] as const)('constrains schema direction for %s and accepts a matching sort', async (direction, descending) => {
  let schema: Record<string, unknown> = {};
  const provider: LLMProvider = {
    name: 'probe',
    isReady: () => true,
    chat: async () => {
      throw Error('unexpected');
    },
    generateJSON: async (_messages, format) => {
      schema = format;
      return response(json('sort_range', { range: 'A1:B4', column: 'B', descending, header: true }));
    },
  };
  const plan = await generateDocumentToolPlan(
    provider,
    `Sort A1:B4 by B ${direction}, row 1 is a header`,
    { kind: 'cell' },
    new AbortController().signal,
  );
  expect(plan.input.descending).toBe(descending);
  const choices = schema.anyOf as Array<{
    properties: { tool: { enum: string[] }; input: { properties: Record<string, unknown> } };
  }>;
  expect(
    choices.find((c) => c.properties.tool.enum[0] === 'sort_range')?.properties.input.properties.descending,
  ).toEqual({ type: 'boolean', enum: [descending] });
});

it('rejects a sort plan for conflicting direction cues instead of guessing a clause', async () => {
  const provider: LLMProvider = {
    name: 'probe',
    isReady: () => true,
    chat: async () => response(json('sort_range', { range: 'A1:B4', column: 'B', descending: false, header: true })),
  };
  await expect(
    generateDocumentToolPlan(
      provider,
      'Sort A1:B4 ascending, or descending if preferred.',
      { kind: 'cell' },
      new AbortController().signal,
    ),
  ).rejects.toThrow(/direction/i);
});

it.each([
  'Do not sort ascending.',
  'Do not sort A1:B4 in descending order.',
  '不要将 A1:B4 按 B 列降序排序。',
  'Sort A1:B4, not descending.',
  '不要升序排序 A1:B4。',
  '不按降序排列 A1:B4。',
])('refuses to treat a negated direction as an affirmative request: %s', async (request) => {
  const provider: LLMProvider = {
    name: 'probe',
    isReady: () => true,
    chat: async () =>
      response(
        json('sort_range', {
          range: 'A1:B4',
          column: 'B',
          descending: request.includes('descending') || request.includes('降序'),
          header: true,
        }),
      ),
  };
  await expect(
    generateDocumentToolPlan(provider, request, { kind: 'cell' }, new AbortController().signal),
  ).rejects.toThrow(/direction/i);
});

const literalRequest = (text: string) =>
  '将当前选中的文字替换为下面的完整文本，保留每一个字符，不修改选区以外的文字：' + text;
it('plans exact replacement of an existing PPT text selection', async () => {
  const text = '项目 😀\tPayment\n  NOT approved  ';
  const provider: LLMProvider = {
    name: 'probe',
    isReady: () => true,
    chat: async () => response(json('replace_selection', { text })),
  };
  expect(
    await generateDocumentToolPlan(
      provider,
      literalRequest(text),
      { kind: 'slide', selectionCharacters: 5 },
      new AbortController().signal,
    ),
  ).toMatchObject({ tool: 'replace_selection', input: { text }, readOnly: false });
});
it('declines altered literal text in a PPT selection replacement', async () => {
  const provider: LLMProvider = {
    name: 'probe',
    isReady: () => true,
    chat: async () => response(json('replace_selection', { text: 'NOT approved' })),
  };
  await expect(
    generateDocumentToolPlan(
      provider,
      literalRequest('  NOT approved  '),
      { kind: 'slide', selectionCharacters: 5 },
      new AbortController().signal,
    ),
  ).rejects.toThrow('officeSlideLiteralTextChanged');
});
it('does not expose PPT selection replacement without a verified nonempty selection', () => {
  expect(() => parseDocumentToolPlan(json('replace_selection', { text: 'Alex' }), { kind: 'slide' })).toThrow(
    'not available',
  );
});
const literalSlideRequest = (text: string) =>
  'Add a new text box on the current slide with exactly this text, preserving all line breaks, tabs, spaces and characters: ' +
  text;
it.each(['在当前页新增文本框：', 'Add a new text box on the current slide with exactly this text: '])(
  'constrains concise exact slide text requests: %s',
  async (prefix) => {
    const text = '项目 😀\tPayment\n  NOT approved  ';
    let schema: Record<string, unknown> = {};
    const provider: LLMProvider = {
      name: 'probe',
      isReady: () => true,
      chat: async () => {
        throw Error('unexpected');
      },
      generateJSON: async (_, format) => {
        schema = format;
        return response(json('add_slide_text', { text }));
      },
    };
    expect(
      (await generateDocumentToolPlan(provider, prefix + text, { kind: 'slide' }, new AbortController().signal)).input
        .text,
    ).toBe(text);
    const choices = schema.anyOf as Array<{
      properties: { tool: { enum: string[] }; input: { properties: Record<string, unknown> } };
    }>;
    expect(choices.map((c) => c.properties.tool.enum[0])).toEqual(['add_slide_text', 'unsupported']);
    expect(choices[0].properties.input.properties.text).toEqual({ type: 'string', enum: [text] });
  },
);
it.each([
  'Do not ' + literalSlideRequest('Alex'),
  'Explain this command: ' + literalSlideRequest('Alex'),
  '不要在当前幻灯片添加一个新的文本框，逐字保留以下文本：Alex',
])('does not constrain unrelated or negated slide commands: %s', async (request) => {
  let schema: Record<string, unknown> = {};
  const provider: LLMProvider = {
    name: 'probe',
    isReady: () => true,
    chat: async () => {
      throw Error('unexpected');
    },
    generateJSON: async (_, format) => {
      schema = format;
      return response(json('get_presentation_text'));
    },
  };
  expect(
    (await generateDocumentToolPlan(provider, request, { kind: 'slide' }, new AbortController().signal)).tool,
  ).toBe('get_presentation_text');
  expect((schema.anyOf as unknown[]).length).toBeGreaterThan(2);
});
it.each(['raw', 'json', 'chinese', 'plain', 'plain-short'])(
  'constrains exact slide text to its supplied literal data (%s)',
  async (kind) => {
    const text = '项目 😀\tPayment\n  "quoted" \\n NOT approved  ';
    const request =
      kind === 'plain-short'
        ? 'Add a new text box on the current slide with this exact plain text: ' + text
        : kind === 'plain'
          ? 'Add a new text box on the current slide with this exact plain text, preserving line breaks: ' + text
          : kind === 'chinese'
            ? '请在当前幻灯片添加一个新的文本框，逐字保留以下文本：' + text
            : kind === 'json'
              ? 'Add a new text box on the current slide with exactly this JSON string decoded as plain text: ' +
                JSON.stringify(text)
              : literalSlideRequest(text);
    let schema: Record<string, unknown> = {};
    const provider: LLMProvider = {
      name: 'probe',
      isReady: () => true,
      chat: async () => {
        throw Error('unexpected');
      },
      generateJSON: async (_, format) => {
        schema = format;
        return response(json('add_slide_text', { text }));
      },
    };
    expect(
      (await generateDocumentToolPlan(provider, request, { kind: 'slide' }, new AbortController().signal)).input.text,
    ).toBe(text);
    const choices = schema.anyOf as Array<{
      properties: { tool: { enum: string[] }; input: { properties: Record<string, unknown> } };
    }>;
    expect(choices.map((c) => c.properties.tool.enum[0])).toEqual(['add_slide_text', 'unsupported']);
    expect(choices[0].properties.input.properties.text).toEqual({ type: 'string', enum: [text] });
  },
);
it.each(['"Alex"  ', '"line\\nnext"'])(
  'preserves ordinary literal quotes and escapes without guessing JSON: %s',
  async (text) => {
    const provider: LLMProvider = {
      name: 'probe',
      isReady: () => true,
      chat: async () => response(json('add_slide_text', { text })),
    };
    expect(
      (
        await generateDocumentToolPlan(
          provider,
          literalSlideRequest(text),
          { kind: 'slide' },
          new AbortController().signal,
        )
      ).input.text,
    ).toBe(text);
  },
);
it.each(['"unfinished', '{"text":"Alex"}', '42'])(
  'rejects invalid explicit JSON slide data before generation: %s',
  async (data) => {
    const chat = vi.fn(async () => response(json('add_slide_text', { text: 'Alex' })));
    const provider: LLMProvider = { name: 'probe', isReady: () => true, chat };
    await expect(
      generateDocumentToolPlan(
        provider,
        'Add a new text box on the current slide with exactly this JSON string decoded as plain text: ' + data,
        { kind: 'slide' },
        new AbortController().signal,
      ),
    ).rejects.toThrow(/request/i);
    expect(chat).not.toHaveBeenCalled();
  },
);
it.each(['trim', 'escape'])('rejects a changed literal slide text plan (%s)', async (change) => {
  const text = '项目 😀\tPayment\n  NOT approved  ';
  const provider: LLMProvider = {
    name: 'probe',
    isReady: () => true,
    chat: async () =>
      response(
        json('add_slide_text', {
          text: change === 'trim' ? text.trimEnd() : text.replace(/\t/g, '\\t').replace(/\n/g, '\\n'),
        }),
      ),
  };
  await expect(
    generateDocumentToolPlan(provider, literalSlideRequest(text), { kind: 'slide' }, new AbortController().signal),
  ).rejects.toThrow(/literal/i);
});
it.each(['trim', 'fact', 'tool'])('rejects a changed literal replacement plan (%s)', async (change) => {
  const text = 'Alex · 1,250 EUR · NOT approved  ';
  const provider: LLMProvider = {
    name: 'probe',
    isReady: () => true,
    chat: async () =>
      response(
        json(change === 'tool' ? 'insert_text' : 'replace_selection', {
          text:
            change === 'trim' ? text.trimEnd() : change === 'fact' ? text.replace('NOT approved', 'approved') : text,
        }),
      ),
  };
  await expect(
    generateDocumentToolPlan(provider, literalRequest(text), { kind: 'word' }, new AbortController().signal),
  ).rejects.toThrow(/literal/i);
});
it.each([
  (text: string) => literalRequest(text),
  (text: string) => '请把当前选中的文本替换成以下完整文本，逐字保留：' + text,
  (text: string) => 'Replace the currently selected text with exactly the following text:' + text,
])('constrains an explicit literal replacement to the original data', async (request) => {
  const text = '第一行 <b>Alex & Co</b>\n  第二行 · NOT approved  ';
  let schema: Record<string, unknown> = {};
  const provider: LLMProvider = {
    name: 'probe',
    isReady: () => true,
    chat: async () => {
      throw Error('unexpected');
    },
    generateJSON: async (_messages, format) => {
      schema = format;
      return response(json('replace_selection', { text }));
    },
  };
  expect(
    (await generateDocumentToolPlan(provider, request(text), { kind: 'word' }, new AbortController().signal)).input
      .text,
  ).toBe(text);
  const choices = schema.anyOf as Array<{
    properties: { tool: { enum: string[] }; input: { properties: Record<string, unknown> } };
  }>;
  expect(choices.map((c) => c.properties.tool.enum[0])).toEqual(['replace_selection', 'unsupported']);
  expect(choices[0].properties.input.properties.text).toEqual({ type: 'string', enum: [text] });
});
it('accepts a nonempty whitespace-only literal replacement', async () => {
  const provider: LLMProvider = {
    name: 'probe',
    isReady: () => true,
    chat: async () => response(json('replace_selection', { text: '  ' })),
  };
  expect(
    (await generateDocumentToolPlan(provider, literalRequest('  '), { kind: 'word' }, new AbortController().signal))
      .input.text,
  ).toBe('  ');
});

it.each([
  'Do not Replace the currently selected text with exactly the following text:Alex',
  'The quoted instruction is: Replace selected text with exactly following text:Alex',
  '请解释下面的文本，而不是执行替换：Alex',
])('does not treat an unrelated or negated prefix as a terminal literal command: %s', async (request) => {
  let schema: Record<string, unknown> = {};
  const provider: LLMProvider = {
    name: 'probe',
    isReady: () => true,
    chat: async () => {
      throw Error('unexpected');
    },
    generateJSON: async (_messages, format) => {
      schema = format;
      return response(json('get_selection'));
    },
  };
  expect((await generateDocumentToolPlan(provider, request, { kind: 'word' }, new AbortController().signal)).tool).toBe(
    'get_selection',
  );
  expect((schema.anyOf as unknown[]).length).toBeGreaterThan(2);
});

it.each([
  [literalRequest('Alex · 1,250 EUR · NOT approved'), 5, true],
  ['Replace the selected text with exactly the following text:Alex', 5, true],
  [literalRequest('Alex'), 0, false],
  ['Do not Replace the selected text with exactly the following text:Alex', 5, false],
])(
  'bounds literal-data guidance to an affirmative command with a selection (%s)',
  async (request, selectionCharacters, expected) => {
    let prompt = '';
    const provider: LLMProvider = {
      name: 'probe',
      isReady: () => true,
      chat: async (messages) => {
        prompt = messages[0].content as string;
        return response(json('unsupported'));
      },
    };
    await expect(
      generateDocumentToolPlan(provider, request, { kind: 'word', selectionCharacters }, new AbortController().signal),
    ).rejects.toThrow('agentToolNotChosen');
    expect(prompt.includes('these are not additional operations')).toBe(expected);
  },
);

it.each([
  ['启用当前文档的修订模式', true],
  ['关闭当前文档的修订模式', false],
  ['Please enable track changes.', true],
  ['Turn off track changes', false],
])('constrains an explicit review mode command: %s', async (request, enabled) => {
  let schema: Record<string, unknown> = {};
  const provider: LLMProvider = {
    name: 'probe',
    isReady: () => true,
    chat: async () => {
      throw Error('unexpected');
    },
    generateJSON: async (_messages, format) => {
      schema = format;
      return response(json('set_review_mode', { enabled }));
    },
  };
  const plan = await generateDocumentToolPlan(
    provider,
    String(request),
    { kind: 'word' },
    new AbortController().signal,
  );
  expect(plan.input.enabled).toBe(enabled);
  const choices = schema.anyOf as Array<{
    properties: { tool: { enum: string[] }; input: { properties: Record<string, unknown> } };
  }>;
  expect(choices.map((c) => c.properties.tool.enum[0])).toEqual(['set_review_mode', 'unsupported']);
  expect(choices[0].properties.input.properties.enabled).toEqual({ type: 'boolean', enum: [enabled] });
});

it.each([
  ['set_review_mode', { enabled: false }],
  ['get_document_text', {}],
])('rejects a mismatched explicit review command plan: %s', async (tool, input) => {
  const provider: LLMProvider = {
    name: 'probe',
    isReady: () => true,
    chat: async () => response(json(String(tool), input as Record<string, unknown>)),
  };
  await expect(
    generateDocumentToolPlan(provider, '启用当前文档的修订模式', { kind: 'word' }, new AbortController().signal),
  ).rejects.toThrow(/Review mode/);
});

it.each([
  '不要启用当前文档的修订模式',
  '启用当前文档的修订模式？',
  '启用当前文档的修订模式并加粗',
  'Explain: Turn off track changes',
])('does not constrain unrelated or ambiguous review wording: %s', async (request) => {
  let schema: Record<string, unknown> = {};
  const provider: LLMProvider = {
    name: 'probe',
    isReady: () => true,
    chat: async () => {
      throw Error('unexpected');
    },
    generateJSON: async (_messages, format) => {
      schema = format;
      return response(json('get_document_text'));
    },
  };
  await generateDocumentToolPlan(provider, request, { kind: 'word' }, new AbortController().signal);
  const choices = schema.anyOf as Array<{
    properties: { tool: { enum: string[] }; input: { properties: Record<string, unknown> } };
  }>;
  const review = choices.find((c) => c.properties.tool.enum[0] === 'set_review_mode');
  expect(review?.properties.input.properties.enabled).toEqual(expect.objectContaining({ type: 'boolean' }));
  expect(review?.properties.input.properties.enabled).not.toHaveProperty('enum');
  expect(choices.length).toBeGreaterThan(2);
});

const explicitSortRequest =
  '请将 A1:B4 区域按 B 列数字升序排序，整行一起移动。第 1 行是表头，保持不变，不要修改 A1:B4 以外的单元格。';
it.each([
  [explicitSortRequest, false],
  [explicitSortRequest.replace('升序', '降序'), true],
  [
    'Sort the complete rows in A1:B4 by numeric column B in ascending order. Row 1 is a header and must stay unchanged. Do not change cells outside A1:B4.',
    false,
  ],
])('constrains a complete explicit numeric sort command: %s', async (request, descending) => {
  let schema: Record<string, unknown> = {};
  const provider: LLMProvider = {
    name: 'probe',
    isReady: () => true,
    chat: async () => {
      throw Error('unexpected');
    },
    generateJSON: async (_messages, format) => {
      schema = format;
      return response(json('sort_range', { range: 'A1:B4', column: 'B', descending, header: true }));
    },
  };
  await generateDocumentToolPlan(provider, String(request), { kind: 'cell' }, new AbortController().signal);
  const choices = schema.anyOf as Array<{
    properties: { tool: { enum: string[] }; input: { properties: Record<string, unknown> } };
  }>;
  expect(choices.map((c) => c.properties.tool.enum[0])).toEqual(['sort_range', 'unsupported']);
  expect(choices[0].properties.input.properties).toEqual({
    range: { type: 'string', enum: ['A1:B4'] },
    column: { type: 'string', enum: ['B'] },
    descending: { type: 'boolean', enum: [descending] },
    header: { type: 'boolean', enum: [true] },
  });
});
it.each([
  { range: 'A1:C4', column: 'B', descending: false, header: true },
  { range: 'A1:B4', column: 'A', descending: false, header: true },
  { range: 'A1:B4', column: 'B', descending: false, header: false },
])('rejects changed parameters in an explicit numeric sort: %j', async (input) => {
  const provider: LLMProvider = {
    name: 'probe',
    isReady: () => true,
    chat: async () => response(json('sort_range', input)),
  };
  await expect(
    generateDocumentToolPlan(provider, explicitSortRequest, { kind: 'cell' }, new AbortController().signal),
  ).rejects.toThrow(/Sort parameters/);
});
it.each([
  '不要' + explicitSortRequest,
  explicitSortRequest + '然后清空 D2',
  explicitSortRequest.replace('A1:B4 以外', 'A1:C4 以外'),
  explicitSortRequest.replace('第 1 行', '第 2 行'),
])('does not constrain ambiguous sort requests: %s', async (request) => {
  let schema: Record<string, unknown> = {};
  const provider: LLMProvider = {
    name: 'probe',
    isReady: () => true,
    chat: async () => {
      throw Error('unexpected');
    },
    generateJSON: async (_messages, format) => {
      schema = format;
      return response(json('get_cell', { cell: 'A1' }));
    },
  };
  await generateDocumentToolPlan(provider, request, { kind: 'cell' }, new AbortController().signal);
  expect((schema.anyOf as unknown[]).length).toBeGreaterThan(2);
});

it.each(['en', 'zh'])('binds exact Word cursor insertion to supplied raw text (%s)', async (language) => {
  const text = '  四季 😀 "quoted" \\n\tPayment\nNOT approved  ';
  const request =
    language === 'en'
      ? 'Insert exactly this plain text at the cursor: ' + text
      : '请在当前光标处逐字插入以下文本：' + text;
  let captured: Record<string, unknown> = {};
  const provider: LLMProvider = {
    name: 'probe',
    isReady: () => true,
    chat: async () => {
      throw Error('unexpected');
    },
    generateJSON: async (_, schema) => {
      captured = schema;
      return response(json('insert_text', { text }));
    },
  };
  const plan = await generateDocumentToolPlan(provider, request, { kind: 'word' }, new AbortController().signal);
  expect(plan.input.text).toBe(text);
  const choices = captured.anyOf as Array<{
    properties: { tool: { enum: string[] }; input: { properties: { text: unknown } } };
  }>;
  expect(choices.map((c) => c.properties.tool.enum[0])).toEqual(['insert_text', 'unsupported']);
  expect(choices[0].properties.input.properties.text).toEqual({ type: 'string', enum: [text] });
  provider.generateJSON = async () => response(json('insert_text', { text: text + 'extra' }));
  await expect(
    generateDocumentToolPlan(provider, request, { kind: 'word' }, new AbortController().signal),
  ).rejects.toThrow('Insertion must preserve');
});

it.each([
  'Do not Insert exactly this plain text at the cursor: data',
  'Explain: Insert exactly this plain text at the cursor: data',
  '不要在当前光标处逐字插入以下文本：data',
])('does not restrict discussion or negation to Word insertion: %s', async (request) => {
  let captured: Record<string, unknown> = {};
  const provider: LLMProvider = {
    name: 'probe',
    isReady: () => true,
    chat: async () => {
      throw Error('unexpected');
    },
    generateJSON: async (_, schema) => {
      captured = schema;
      return response(json('get_document_text'));
    },
  };
  const plan = await generateDocumentToolPlan(provider, request, { kind: 'word' }, new AbortController().signal);
  expect(plan.tool).toBe('get_document_text');
  expect((captured.anyOf as unknown[]).length).toBeGreaterThan(2);
});

it('rejects a complete no-sort keep-unchanged request instead of inventing a read', async () => {
  const provider = {
    name: 'probe',
    isReady: () => true,
    chat: async () => response(json('sum_range', { range: 'C1' })),
  };
  await expect(
    generateDocumentToolPlan(
      provider,
      '不要将 A1:B4 按 B 列升序排序，保持所有单元格不变。',
      { kind: 'cell' },
      new AbortController().signal,
    ),
  ).rejects.toThrow('agentToolNotChosen');
});
it('retains an explicit read after a negated sort', async () => {
  const provider = { name: 'probe', isReady: () => true, chat: async () => response(json('get_cell', { cell: 'B2' })) };
  const plan = await generateDocumentToolPlan(
    provider,
    '不要排序 A1:B4，只读取 B2 的值。',
    { kind: 'cell' },
    new AbortController().signal,
  );
  expect(plan.tool).toBe('get_cell');
  expect(plan.input).toEqual({ cell: 'B2' });
});

it('rejects an English no-sort keep-unchanged command before accepting a valid but unsolicited sort', async () => {
  const provider = {
    name: 'probe',
    isReady: () => true,
    chat: async () => response(json('sort_range', { range: 'A1:B4', column: 'B', descending: false, header: true })),
  };
  await expect(
    generateDocumentToolPlan(
      provider,
      'Do not sort A1:B4. Leave every cell unchanged.',
      { kind: 'cell' },
      new AbortController().signal,
    ),
  ).rejects.toThrow('agentToolNotChosen');
});
it('preserves an English affirmative read after a negated sort', async () => {
  const provider = { name: 'probe', isReady: () => true, chat: async () => response(json('get_cell', { cell: 'B2' })) };
  expect(
    (
      await generateDocumentToolPlan(
        provider,
        'Do not sort A1:B4. Read B2 only.',
        { kind: 'cell' },
        new AbortController().signal,
      )
    ).tool,
  ).toBe('get_cell');
});

it.each(['读取 A1:B4，不要排序或修改。', 'Read A1:B4 only. Do not change any cells.'])(
  'preserves the complete explicitly requested read range: %s',
  async (request) => {
    const provider = {
      name: 'probe',
      isReady: () => true,
      chat: async () => response(json('get_cell', { cell: 'A1' })),
    };
    const plan = await generateDocumentToolPlan(provider, request, { kind: 'cell' }, new AbortController().signal);
    expect(plan).toEqual({ tool: 'get_range', input: { range: 'A1:B4' }, readOnly: true });
  },
);

it('reads the complete region for the ordinary Chinese content request', async () => {
  const provider = { name: 'probe', isReady: () => true, chat: async () => response(json('get_cell', { cell: 'A1' })) };
  expect(
    await generateDocumentToolPlan(provider, '读取 A1:B4 的内容。', { kind: 'cell' }, new AbortController().signal),
  ).toEqual({ tool: 'get_range', input: { range: 'A1:B4' }, readOnly: true });
});

it('rejects a write to a range endpoint instead of the explicit destination', async () => {
  const provider = {
    name: 'probe',
    isReady: () => true,
    chat: async () => response(json('set_cell', { cell: 'A1', value: '99' })),
  };
  await expect(
    generateDocumentToolPlan(
      provider,
      '读取 A1:B4 的内容，然后将 B2 设置为 99。',
      { kind: 'cell' },
      new AbortController().signal,
    ),
  ).rejects.toThrow('agentToolNotChosen');
});
it('retains a write to the explicit cell destination', async () => {
  const provider = {
    name: 'probe',
    isReady: () => true,
    chat: async () => response(json('set_cell', { cell: 'B2', value: '99' })),
  };
  expect(
    (await generateDocumentToolPlan(provider, '将 B2 设置为 99。', { kind: 'cell' }, new AbortController().signal))
      .input,
  ).toEqual({ cell: 'B2', value: '99' });
});

it.each(['读取 A1:B2 和 A3:B4 的内容。', 'Read A1:B2 and A3:B4. Do not change any cells.'])(
  'preserves both explicitly requested regions: %s',
  async (request) => {
    const provider = {
      name: 'probe',
      isReady: () => true,
      chat: async () => response(json('get_range', { range: 'A1:B2' })),
    };
    expect(await generateDocumentToolPlan(provider, request, { kind: 'cell' }, new AbortController().signal)).toEqual({
      tool: 'get_ranges',
      input: { ranges: 'A1:B2,A3:B4' },
      readOnly: true,
    });
  },
);

it.each([
  { cell: 'B2', value: '00123' },
  { cell: 'B2', value: '00123', valueType: 'auto' },
  { cell: 'B2', value: '123', valueType: 'text' },
  { cell: 'C3', value: '00123', valueType: 'text' },
])('rejects a quoted cell assignment plan that changes literal semantics: %j', async (input) => {
  const provider: LLMProvider = {
    name: 'probe',
    isReady: () => true,
    chat: async () => response(json('set_cell', input)),
  };
  await expect(
    generateDocumentToolPlan(provider, 'Set B2 to "00123".', { kind: 'cell' }, new AbortController().signal),
  ).rejects.toThrow();
});
it.each(['Set B2 to "00123".', '请将 B2 设置为 "00123"。'])(
  'constrains a quoted cell literal and preserves leading zeros: %s',
  async (request) => {
    let schema: Record<string, unknown> = {};
    const provider: LLMProvider = {
      name: 'probe',
      isReady: () => true,
      chat: async () => {
        throw Error('unexpected');
      },
      generateJSON: async (_, format) => {
        schema = format;
        return response(json('set_cell', { cell: 'B2', value: '00123', valueType: 'text' }));
      },
    };
    const plan = await generateDocumentToolPlan(provider, request, { kind: 'cell' }, new AbortController().signal);
    expect(plan.input).toEqual({ cell: 'B2', value: '00123', valueType: 'text' });
    const choices = schema.anyOf as Array<{
      properties: {
        tool: { enum: string[] };
        input: { required: string[]; properties: Record<string, { enum: unknown[] }> };
      };
    }>;
    const write = choices.find((c) => c.properties.tool.enum[0] === 'set_cell')!;
    expect(write.properties.input.required).toContain('valueType');
    expect(write.properties.input.properties.value.enum).toEqual(['00123']);
    expect(write.properties.input.properties.cell.enum).toEqual(['B2']);
    expect(write.properties.input.properties.valueType.enum).toEqual(['text']);
  },
);
it('retains native numeric entry for an unquoted cell assignment', async () => {
  const provider: LLMProvider = {
    name: 'probe',
    isReady: () => true,
    chat: async () => response(json('set_cell', { cell: 'B2', value: '123' })),
  };
  expect(
    (await generateDocumentToolPlan(provider, 'Set B2 to 123.', { kind: 'cell' }, new AbortController().signal)).input,
  ).toEqual({ cell: 'B2', value: '123' });
});
