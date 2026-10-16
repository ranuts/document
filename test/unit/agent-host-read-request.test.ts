import { afterEach, expect, it, vi } from 'vitest';
import { createTaskEntry, type HostReadTask } from '../../lib/agent-plugin/ui/task-entry';
import { captureComposerContext } from '../../lib/agent-plugin/ui/composer-context';
import { captureDocumentToolScope } from '../../lib/agent-plugin/document-tool-action';
import { prepareHostRead } from '../../lib/agent-plugin/ui/host-read-request';
import { AgentChatController } from '../../lib/agent-plugin/ui/controller';
import type { LLMProvider } from '@ranuts/agent-core/llm/types';
import { t } from '@ranuts/shared/i18n';

function editor(kind: 'word' | 'cell' | 'slide' | 'pdf', selected = '') {
  const frame = document.createElement('iframe');
  frame.name = 'frameEditor';
  document.body.append(frame);
  const history = { Index: 0, Points: [] };
  const body = vi.fn(() => 'Actual Word source');
  const selection = vi.fn(() => selected);
  const range = vi.fn((row: number, column: number) => ({ getValue: () => `${row}:${column}` }));
  const pdfRead = vi.fn((_page: number, out: { Text: string }) => {
    out.Text = 'Exact second page';
  });
  const pdf = { History: history };
  const model = {
    selectionRange: { ranges: [{ r1: 1, r2: 2, c1: 1, c2: 2 }], activeCell: { row: 1, col: 1 } },
    getRange3: range,
    getMinimalRange: () => ({ r1: 0, r2: 100, c1: 0, c2: 0 }),
  };
  const logic =
    kind === 'slide'
      ? { Slides: [{ cSld: { spTree: [{ getText: () => 'Presentation source' }] } }], GetSelectedSlides: () => [0] }
      : { GetText: body, GetSelectionState: () => [0], GetDocPosType: () => 0 };
  const api = {
    isDocumentLoadComplete: true,
    isLoadFullApi: true,
    pluginMethod_GetSelectedText: selection,
    WordControl: { m_oLogicDocument: logic },
    asc_IsTrackRevisions: () => false,
    ...(kind === 'cell'
      ? {
          asc_getActiveRangeStr: () => 'B2:C3',
          asc_getActiveWorksheetIndex: () => 0,
          asc_getWorksheetName: () => 'Budget',
          wb: { getWorksheet: () => ({ model }) },
        }
      : {}),
    ...(kind === 'slide' ? { getCurrentPage: () => 0 } : {}),
    ...(kind === 'pdf'
      ? {
          isPdfEditor: () => true,
          getCurrentPage: () => 1,
          getPDFDoc: () => pdf,
          DocumentRenderer: { file: { pages: [{ text: [] }, { text: [] }], copySelection: pdfRead } },
        }
      : {}),
  };
  Object.assign(frame.contentWindow!, { editor: api, AscCommon: { History: history } });
  return { api, frame, history, body, selection, range, pdfRead };
}
function stage(id: string): HostReadTask {
  let draft = '';
  const entry = createTaskEntry({
    getInput: () => draft,
    setInput: (text) => {
      draft = text;
    },
    focus: () => {},
    session: () => 'session',
    readonly: () => false,
    capture: captureComposerContext,
    captureTarget: captureDocumentToolScope,
    onStage: () => {},
  });
  document.body.append(entry.el);
  entry.update(captureComposerContext());
  entry.el.querySelector<HTMLButtonElement>(`[data-task="${id}"]`)!.click();
  expect(draft).not.toBe('');
  return entry.consume(draft)!.hostRead!;
}
afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});
it.each([
  ['word', 'read', 'document-body', 'Actual Word source'],
  ['word', 'summarize', 'selection', 'Selected Word source'],
  ['cell', 'analyze', 'selection', '1:1\t1:2\n2:1\t2:2'],
  ['slide', 'slides', 'presentation-text', 'Presentation source'],
  ['pdf', 'page', 'pdf-page', 'Exact second page'],
] as const)(
  'answers trusted %s/%s with one inference, bounded source and no native preflight',
  async (kind, id, scope, text) => {
    const state = editor(kind, id === 'summarize' ? 'Selected Word source' : '');
    const token = stage(id);
    expect(state.body).not.toHaveBeenCalled();
    const read = prepareHostRead(token);
    expect(read.request.reply).toBeUndefined();
    const context = JSON.parse(read.request.getRequestContext()!);
    expect(context.content).toMatchObject({ scope });
    expect(context.content.text).toContain(text);
    if (kind === 'cell') expect(context.editor).toMatchObject({ sheet: 'Budget', range: 'B2:C3' });
    if (kind === 'pdf') expect(context.content).toMatchObject({ page: 2, pages: 2 });
    state.selection.mockClear();
    state.range.mockClear();
    state.body.mockClear();
    const preflight = vi.fn(async () => ({ tools: {} }));
    const chat = vi.fn(async () => ({
      text: 'unused',
      toolCalls: [],
      stopReason: 'stop',
      assistant: { role: 'assistant' as const, content: 'unused' },
    }));
    const chatStream = vi.fn(async (_messages, _tools, delta) => {
      for (let i = 0; i < 100; i++) delta('a');
      return {
        text: 'a'.repeat(100),
        toolCalls: [],
        stopReason: 'stop',
        assistant: { role: 'assistant' as const, content: 'a'.repeat(100) },
      };
    });
    const controller = new AgentChatController(
      { name: 'native', isReady: () => true, toolCallingMode: 'native', chat, chatStream } as LLMProvider,
      () => {},
      { prepareRun: preflight, onAgentDelta: () => {} },
    );
    expect((await controller.send('read source', { request: read.request })).status).toBe('success');
    expect(preflight).not.toHaveBeenCalled();
    expect(chat).not.toHaveBeenCalled();
    expect(chatStream).toHaveBeenCalledOnce();
    expect(chatStream.mock.calls[0][1]).toEqual([]);
    expect(state.selection).not.toHaveBeenCalled();
    expect(state.range).not.toHaveBeenCalled();
    expect(state.body).not.toHaveBeenCalled();
  },
);
it('never infers an answer from an unavailable PDF page and identifies its exact scope', async () => {
  const state = editor('pdf');
  state.api.DocumentRenderer!.file.pages[1] = {} as { text: never[] };
  const read = prepareHostRead(stage('page'));
  expect(read.request.reply).toContain(t('agentPdfTextUnavailable'));
  expect(read.request.reply).toContain('2');
  const chat = vi.fn();
  const controller = new AgentChatController({ name: 'test', isReady: () => true, chat }, () => {});
  await controller.send('read', { request: read.request });
  expect(chat).not.toHaveBeenCalled();
});
it('reports partial PDF page grounding without implying whole-document coverage', () => {
  const state = editor('pdf');
  state.pdfRead.mockImplementation((_page, out) => {
    out.Text = 'x'.repeat(9000);
  });
  const read = prepareHostRead(stage('points'));
  expect(read.receipt).toContain(t('agentReadPartial'));
  expect(read.receipt).toContain('2');
  expect(JSON.parse(read.request.getRequestContext()!).content).toMatchObject({
    scope: 'pdf-page',
    page: 2,
    truncated: true,
    text: expect.stringMatching(/^x+$/),
  });
});
it.each(['history', 'interaction', 'frame'])(
  'rejects original %s changes before capture and completion',
  async (cause) => {
    const state = editor('word');
    const token = stage('read');
    const read = prepareHostRead(token);
    const change = () => {
      if (cause === 'history') state.history.Index++;
      if (cause === 'interaction') state.frame.contentDocument!.dispatchEvent(new Event('pointerdown'));
      if (cause === 'frame') state.frame.remove();
    };
    const chat = vi.fn(async () => {
      change();
      return {
        text: 'stale',
        toolCalls: [],
        stopReason: 'stop',
        assistant: { role: 'assistant' as const, content: 'stale' },
      };
    });
    const turns: string[] = [];
    const controller = new AgentChatController({ name: 'test', isReady: () => true, chat }, (turn) =>
      turns.push(turn.text),
    );
    expect((await controller.send('read', { request: read.request })).status).toBe('failed');
    expect(turns).not.toContain('stale');
    expect(() => prepareHostRead(token)).toThrow('agentPlanExpired');
  },
);

it('native Word preparation reads no body and promotes the original scope before write review yields', async () => {
  const { prepareDocumentTask } = await import('../../lib/agent-plugin/document-task');
  const state = editor('word');
  const target = captureDocumentToolScope();
  const provider = { name: 'native', isReady: () => true, toolCallingMode: 'native', chat: vi.fn() } as LLMProvider;
  const review = vi.fn(async (action) => ({ status: 'cancelled' as const, action }));
  const prepared = await prepareDocumentTask(provider, 'Insert a heading', {
    target,
    readonly: false,
    review,
    receipt: () => {},
  });
  expect(state.body).not.toHaveBeenCalled();
  const pending = prepared.tools.insert_text.execute({ text: 'Heading' });
  expect(state.body).toHaveBeenCalledOnce();
  expect(review).toHaveBeenCalledOnce();
  expect(review.mock.calls[0][0].target).not.toBe(target);
  expect(review.mock.calls[0][0].target.isCurrent(true)).toBe(true);
  await pending;
  expect(provider.chat).not.toHaveBeenCalled();
});
it('refuses changed native scope before promotion or review and captures no replacement document body', async () => {
  const { createDocumentAgentTools } = await import('../../lib/agent-plugin/document-agent-tools');
  const state = editor('word');
  const target = captureDocumentToolScope();
  const review = vi.fn();
  const tools = createDocumentAgentTools({ target, readonly: false, review, receipt: () => {} });
  state.history.Index++;
  await expect(tools.insert_text.execute({ text: 'Heading' })).rejects.toThrow('agentPlanExpired');
  expect(state.body).not.toHaveBeenCalled();
  expect(review).not.toHaveBeenCalled();
});
it('rejects a document mutation during source capture before any inference', () => {
  const state = editor('word');
  const token = stage('read');
  state.body.mockImplementation(() => {
    state.history.Index++;
    return 'changed source';
  });
  expect(() => prepareHostRead(token)).toThrow('agentPlanExpired');
});

it.each(['English source '.repeat(800), '中文段落内容。'.repeat(1500), '"\\\n'.repeat(3000)])(
  'answers a large trusted source within the runtime budget with truthful partial scope',
  async (source) => {
    const state = editor('word');
    state.body.mockReturnValue(source);
    const token = stage('read');
    const read = prepareHostRead(token);
    const chat = vi.fn(async () => ({
      text: 'Grounded concise overview',
      toolCalls: [],
      stopReason: 'stop',
      assistant: { role: 'assistant' as const, content: 'Grounded concise overview' },
    }));
    const controller = new AgentChatController({ name: 'test', isReady: () => true, chat }, () => {});
    expect(
      (await controller.send('Read the current document and give me a concise overview.', { request: read.request }))
        .status,
    ).toBe('success');
    expect(chat).toHaveBeenCalledOnce();
    expect(read.receipt).toContain(t('agentReadPartial'));
    const context = JSON.parse(read.request.getRequestContext()!);
    expect(context.content.text.length).toBeGreaterThan(100);
    expect(context.content.text.length).toBeLessThan(8000);
    expect(context.content.truncated).toBe(true);
  },
);

it.each(['English selection '.repeat(600), '中文选区。'.repeat(2000), '"\\\n'.repeat(3000)])(
  'runs generic and native turns with a large metadata selection within the existing runtime budget',
  async (source) => {
    const { captureRequestContext, serializeRequestContext } =
      await import('../../lib/agent-plugin/ui/request-context');
    const { prepareDocumentTask } = await import('../../lib/agent-plugin/document-task');
    const state = editor('word', source);
    const instruction = 'Tell me a brief story and retain this exact instruction.';
    for (const native of [false, true]) {
      const target = captureDocumentToolScope();
      const reference = captureRequestContext('metadata');
      const bounded = serializeRequestContext(reference, instruction);
      const context = JSON.parse(bounded.serialized);
      expect(context.selection.truncated).toBe(true);
      const count = state.selection.mock.calls.length;
      const chatStream = vi.fn(async (messages, _tools, delta) => {
        expect(JSON.stringify(messages)).toContain(instruction);
        for (let i = 0; i < 100; i++) delta('a');
        return {
          text: 'a'.repeat(100),
          toolCalls: [],
          stopReason: 'stop',
          assistant: { role: 'assistant' as const, content: 'a'.repeat(100) },
        };
      });
      const provider = {
        name: 'test',
        isReady: () => true,
        chat: vi.fn(),
        chatStream,
        ...(native ? { toolCallingMode: 'native' as const } : {}),
      } as LLMProvider;
      const prepare = vi.fn(async (request, signal) =>
        prepareDocumentTask(provider, request, { target, readonly: false, signal, review: vi.fn(), receipt: () => {} }),
      );
      const controller = new AgentChatController(provider, () => {}, { onAgentDelta: () => {} });
      const outcome = await controller.send(instruction, {
        request: {
          tools: {},
          ...(native ? { prepareRun: prepare } : {}),
          getRequestContext: () => bounded.serialized,
          assertCurrent: () => {
            if (!target.isCurrent(false)) throw Error('expired');
          },
        },
      });
      expect(outcome.status).toBe('success');
      expect(chatStream).toHaveBeenCalledOnce();
      expect(prepare).toHaveBeenCalledTimes(native ? 1 : 0);
      expect(state.selection).toHaveBeenCalledTimes(count);
      expect(state.body).not.toHaveBeenCalled();
    }
  },
);
it.each(['Page text '.repeat(1000), '当前页面内容。'.repeat(1500), '"\\\n'.repeat(3000)])(
  'runs ordinary explicit PDF page grounding through the runtime without rereading page content',
  async (source) => {
    const { captureRequestContext, serializeRequestContext } =
      await import('../../lib/agent-plugin/ui/request-context');
    const state = editor('pdf', 'selected excerpt');
    state.pdfRead.mockImplementation((_page, out) => {
      out.Text = source;
    });
    const instruction = 'Explain the current PDF page.';
    const target = captureDocumentToolScope();
    const bounded = serializeRequestContext(captureRequestContext('pdf-page'), instruction);
    const count = state.selection.mock.calls.length;
    const chatStream = vi.fn(async (_messages, _tools, delta) => {
      for (let i = 0; i < 100; i++) delta('a');
      return {
        text: 'a'.repeat(100),
        toolCalls: [],
        stopReason: 'stop',
        assistant: { role: 'assistant' as const, content: 'a'.repeat(100) },
      };
    });
    const controller = new AgentChatController(
      { name: 'test', isReady: () => true, chat: vi.fn(), chatStream } as LLMProvider,
      () => {},
      { onAgentDelta: () => {} },
    );
    expect(
      (
        await controller.send(instruction, {
          request: {
            tools: {},
            getRequestContext: () => bounded.serialized,
            assertCurrent: () => {
              if (!target.isCurrent(false)) throw Error('expired');
            },
          },
        })
      ).status,
    ).toBe('success');
    expect(chatStream).toHaveBeenCalledOnce();
    expect(JSON.parse(bounded.serialized).content).toMatchObject({
      scope: 'pdf-page',
      page: 2,
      pages: 2,
      truncated: true,
    });
    expect(state.pdfRead).toHaveBeenCalledOnce();
    expect(state.selection).toHaveBeenCalledTimes(count);
  },
);

it('reserves space for the complete user instruction by reducing only reference text', async () => {
  const { captureRequestContext, serializeRequestContext } = await import('../../lib/agent-plugin/ui/request-context');
  editor('word', '中'.repeat(8000));
  const instruction = '完整保留这条用户指令。'.repeat(100);
  const bounded = serializeRequestContext(captureRequestContext('metadata'), instruction);
  const chat = vi.fn(async (messages) => {
    expect(messages.at(-1)?.content.endsWith(instruction)).toBe(true);
    return {
      text: 'answer',
      toolCalls: [],
      stopReason: 'stop',
      assistant: { role: 'assistant' as const, content: 'answer' },
    };
  });
  const controller = new AgentChatController({ name: 'test', isReady: () => true, chat } as LLMProvider, () => {});
  expect(
    (
      await controller.send(instruction, {
        request: { tools: {}, getRequestContext: () => bounded.serialized, assertCurrent: () => {} },
      })
    ).status,
  ).toBe('success');
  expect(chat).toHaveBeenCalledOnce();
  expect(bounded.context.selection?.truncated).toBe(true);
});

it('budgets attached snapshots together with the captured host read and full instruction', () => {
  const state = editor('word');
  state.body.mockReturnValue('Captured document body '.repeat(1000));
  const references = [{ id: 'attached', title: 'Notes', connector: 'local', text: 'Budget evidence '.repeat(1000) }];
  const instruction = 'Explain the complete selected passage. '.repeat(20);
  const read = prepareHostRead(stage('read'), instruction, references);
  const context = JSON.parse(read.request.getRequestContext()!);
  expect(context.content.scope).toBe('document-body');
  expect(context.content.truncated).toBe(true);
  expect(context.references[0]).toMatchObject({ id: 'S1', sourceId: 'attached', title: 'Notes' });
  expect(read.evidence[0].text).toBe(context.references[0].text);
  expect(read.evidence[0].text.length).toBeLessThan(references[0].text.length);
  references[0].text = 'changed after preparation';
  expect(JSON.parse(read.request.getRequestContext()!).references[0].text).not.toContain('changed');
  expect(new TextEncoder().encode(read.request.getRequestContext()!).length).toBeLessThanOrEqual(4096);
  expect(read.request.tools).toEqual({});
  expect(read.request.maxIterations).toBe(1);
});

it('sends trusted-read attachments and full instruction once without classifier or tools', async () => {
  editor('word', 'Host-selected passage');
  const instruction = 'Explain this passage using the attached notes.';
  const read = prepareHostRead(stage('explain'), instruction, [
    { id: 'notes', title: 'Attached notes', connector: 'local', text: 'Independent attached evidence' },
  ]);
  const observed = vi.fn();
  const preflight = vi.fn();
  const chat = vi.fn(async (messages, tools) => {
    expect(messages.at(-1).content).toContain('Host-selected passage');
    expect(messages.at(-1).content).toContain('Independent attached evidence');
    expect(messages.at(-1).content.endsWith(instruction)).toBe(true);
    expect(tools).toEqual([]);
    return {
      text: 'Answer [S1]',
      toolCalls: [],
      stopReason: 'stop',
      assistant: { role: 'assistant' as const, content: 'Answer [S1]' },
    };
  });
  const controller = new AgentChatController({ name: 'test', isReady: () => true, chat } as LLMProvider, () => {}, {
    prepareRun: preflight,
    onRequestContext: observed,
  });
  expect((await controller.send(instruction, { request: read.request })).status).toBe('success');
  expect(chat).toHaveBeenCalledOnce();
  expect(preflight).not.toHaveBeenCalled();
  expect(observed).toHaveBeenCalledWith(read.request.getRequestContext());
});
