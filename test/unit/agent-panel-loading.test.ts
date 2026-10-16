import 'fake-indexeddb/auto';
import { afterEach, expect, it, vi } from 'vitest';
import { createAgentPanel, setAgentPanelOpen } from '../../lib/agent-plugin/ui/panel';
import { t } from '@ranuts/shared/i18n';
import { getEndpointKey } from '@ranuts/agent-core/llm/keys';
import { AgentChatController } from '../../lib/agent-plugin/ui/controller';
import { createHistoryStorage } from '../../lib/agent-plugin/ui/storage';
import { ChatView } from '@ranuts/chat-ui';
import { RequestQueue } from '../../lib/agent-plugin/ui/request-queue';
HTMLElement.prototype.scrollTo = vi.fn();
// Runtime tests explicitly prepare, as a user must now do from settings.
function createPreparedPanel() {
  const panel = createAgentPanel();
  panel.querySelector<HTMLElement>('.agent-panel-load')!.click();
  return panel;
}

const state = vi.hoisted(() => ({
  queueStream: undefined as
    undefined | ((text: string, delta: (text: string) => void, signal?: AbortSignal) => Promise<void>),
  conversations: undefined as
    undefined | ReturnType<typeof import('../../lib/agent-plugin/ui/sessions').createConversationStore>,
  conversationRepository: undefined as
    undefined | import('../../lib/agent-plugin/ui/conversation-db').ConversationRepository,
  preload: vi.fn(),
  dispose: vi.fn().mockResolvedValue(undefined),
  actionDispose: vi.fn(),
  progress: [] as Array<(value: { text: string; progress?: number }) => void>,
  unavailable: undefined as undefined | (() => void),
  ready: false,
  nativeEndpoint: false,
  cached: false,
  cachedModel: 'Qwen3-4B-q4f16_1-MLC',
  cpuCached: false,
  deleteCache: vi.fn().mockResolvedValue(undefined),
  editorKind: 'word' as 'word' | 'cell' | 'slide',
  readonly: false,
  activeBackend: undefined as 'webllm' | 'wllama' | undefined,
  stalled: false,
  generate: vi.fn(),
  toolPlan: vi.fn(),
  routing: vi.fn(),
  semanticResponse: undefined as string | undefined,
  pdfEffect: undefined as string | undefined,
  semanticGate: undefined as Promise<void> | undefined,
  structuredStream: undefined as import('@ranuts/agent-core/llm/types').LLMProvider['generateJSONStream'],
  targetCurrent: true,
  toolContext: 'slide' as 'slide' | 'cell' | 'word' | 'pdf',
  apply: vi.fn().mockResolvedValue('verified'),
  writing: vi.fn(),
  source: '',
  readText: undefined as string | undefined,
  readAnswer: vi.fn().mockResolvedValue('120'),
  directTaskAnswer: undefined as undefined | ((delta?: (text: string) => void) => Promise<string>),
  editorReady: false,
  backend: undefined as undefined | ((backend: 'webllm' | 'wllama') => void),
  cpuProgress: undefined as undefined | ((value: { loaded: number; total: number }) => void),
  usage: undefined as import('@ranuts/agent-core/llm/types').LLMResponse['usage'],
}));
// Capture the actual owner so blank drafts need no test-only history row.
vi.mock('../../lib/agent-plugin/ui/sessions', async (original) => {
  const actual = await original<typeof import('../../lib/agent-plugin/ui/sessions')>();
  return {
    ...actual,
    createConversationStore: (...args: Parameters<typeof actual.createConversationStore>) => {
      const store = actual.createConversationStore(args[0], {
        ...args[1],
        ...(state.conversationRepository ? { repository: state.conversationRepository } : {}),
      });
      state.conversations = store;
      return store;
    },
  };
});
function activeSession(): string {
  return state.conversations!.activeId;
}
function openSession(panel: HTMLElement, id: string): void {
  if (panel.dataset.view !== 'history') panel.querySelector<HTMLButtonElement>('.agent-history-toggle')!.click();
  const row = panel.querySelector<HTMLButtonElement>(`.agent-conversation-open[data-id="${id}"]`);
  expect(row, 'A nonempty conversation is available after opening History').not.toBeNull();
  row!.click();
}

// Existing routing fixtures exercise the bounded workflow for endpoints without
// native tool support. Native transport is covered separately below.
vi.mock('@ranuts/agent-core/llm/openai', async (original) => {
  const actual = await original<typeof import('@ranuts/agent-core/llm/openai')>();
  return {
    ...actual,
    OpenAIProvider: class extends actual.OpenAIProvider {
      constructor(...args: ConstructorParameters<typeof actual.OpenAIProvider>) {
        super(...args);
        if (!state.nativeEndpoint) Object.defineProperty(this, 'toolCallingMode', { value: 'schema' });
      }
    },
  };
});
vi.mock('@ranuts/agent-core/llm/webllm', async (original) => ({
  ...(await original<typeof import('@ranuts/agent-core/llm/webllm')>()),
  isWebGPUAvailable: () => true,
  isModelCached: async (id: string) => state.cached && id === state.cachedModel,
  WebLLMProvider: class {
    constructor(options: { onProgress: (value: { text: string }) => void }) {
      state.progress.push(options.onProgress);
    }
    preload = state.preload;
    dispose = state.dispose;
    isReady() {
      return state.ready;
    }
  },
}));
vi.mock('../../lib/onlyoffice/readonly', () => ({ getReadonlyMode: () => state.readonly }));
vi.mock('@ranuts/agent-core/llm/model-cache', () => ({
  deleteCachedModel: state.deleteCache,
  listCachedGGUF: async () =>
    state.cpuCached
      ? [{ name: 'cpu-model.gguf', url: 'https://models.example/cpu-model.gguf', size: 100, complete: true }]
      : [],
  deleteCachedGGUF: state.deleteCache,
  rememberedModelSources: () => [],
  rememberModelSource: () => {},
}));
vi.mock('../../lib/agent-plugin/editor-bridge', () => ({
  getEditorApi: () =>
    state.editorReady
      ? {
          isDocumentLoadComplete: true,
          isLoadFullApi: true,
          pluginMethod_GetSelectedText: () => state.source,
          ...(state.editorKind === 'cell'
            ? {
                asc_getActiveRangeStr: () => 'B2',
                asc_getActiveWorksheetName: () => 'Sheet 1',
                wb: { getWorksheet: () => ({ model: { getRange3: () => ({ getValue: () => state.source }) } }) },
              }
            : state.editorKind === 'slide'
              ? {
                  getCurrentPage: () => 0,
                  WordControl: {
                    m_oLogicDocument: {
                      Slides: [],
                      GetCurrentController: () => ({
                        getTargetDocContent: () => ({
                          Content: [
                            {
                              Content: [
                                {
                                  Type: 39,
                                  Selection: { Use: true, StartPos: 0, EndPos: state.source.length },
                                  Content: [...state.source].map((character) => ({
                                    Type: 1,
                                    GetCodePoint: () => character.codePointAt(0),
                                  })),
                                },
                              ],
                            },
                          ],
                          GetSelectedText: () => state.source,
                        }),
                      }),
                    },
                  },
                }
              : {}),
        }
      : null,
}));
vi.mock('@ranuts/agent-core/llm/writing-task', async (original) => ({
  ...(await original<typeof import('@ranuts/agent-core/llm/writing-task')>()),
  generateWriting: state.writing,
}));
vi.mock('@ranuts/agent-core/llm/action-plan', () => ({ generateActionPlan: state.generate }));
vi.mock('@ranuts/agent-core/llm/local', async (original) => ({
  ...(await original<typeof import('@ranuts/agent-core/llm/local')>()),
  LocalInferenceProvider: class {
    get backend() {
      return state.activeBackend;
    }
    constructor(options: {
      webllm: { onProgress: (value: { text: string }) => void; onUnavailable?: () => void };
      onBackend?: (backend: 'webllm' | 'wllama') => void;
      wllama?: { onProgress: (value: { loaded: number; total: number }) => void };
    }) {
      state.progress.push(options.webllm.onProgress);
      state.unavailable = options.webllm.onUnavailable;
      state.backend = options.onBackend;
      state.cpuProgress = options.wllama?.onProgress;
    }
    preload = state.preload;
    dispose = state.dispose;
    isReady() {
      return state.ready;
    }
    get generateJSON() {
      return state.semanticResponse === undefined && state.pdfEffect === undefined
        ? undefined
        : async () => {
            await state.semanticGate;
            return {
              text: state.pdfEffect ? JSON.stringify({ effect: state.pdfEffect }) : state.semanticResponse!,
              toolCalls: [],
              stopReason: 'stop',
            };
          };
    }
    get generateJSONStream() {
      return state.structuredStream;
    }
    async chatStream(
      _messages: import('@ranuts/agent-core/llm/types').LLMMessage[],
      _tools: unknown,
      delta: (text: string) => void,
      signal?: AbortSignal,
    ) {
      if (state.queueStream)
        await state.queueStream(String(_messages.at(-1)?.content).split('User request:\n').at(-1)!, delta, signal);
      if (state.stalled)
        await new Promise((_resolve, reject) =>
          signal?.addEventListener(
            'abort',
            () => {
              state.ready = false;
              state.cached = false;
              state.editorKind = 'word';
              state.deleteCache.mockReset().mockResolvedValue(undefined);
              reject(signal.reason);
            },
            { once: true },
          ),
        );
      delta('answer');
      return {
        text: 'answer',
        toolCalls: [],
        stopReason: 'stop',
        assistant: { role: 'assistant', content: 'answer' },
        usage: state.usage,
      };
    }
  },
}));
vi.mock('../../lib/agent-plugin/reviewed-action', () => ({
  captureActionTarget: () => ({ editor: 'word', label: 'DOCX', selectedText: state.source, isCurrent: () => true }),
  ReviewedAction: class {
    constructor(
      readonly target: unknown,
      readonly plan: unknown,
    ) {}
    isCurrent() {
      return true;
    }
    cancel() {}
    apply = state.apply;
  },
}));
vi.mock('../../lib/agent-plugin/ui/request-intent', async (original) => {
  const actual = await original<typeof import('../../lib/agent-plugin/ui/request-intent')>();
  return {
    ...actual,
    resolveRequestIntent: async (...args: unknown[]) =>
      state.semanticResponse !== undefined
        ? actual.resolveRequestIntent(...(args as Parameters<typeof actual.resolveRequestIntent>))
        : state.routing.getMockImplementation()
          ? state.routing(...args)
          : actual.classifyRequest(args[1] as string),
  };
});
vi.mock('../../lib/agent-plugin/document-tool-plan', async (original) => ({
  ...(await original<typeof import('../../lib/agent-plugin/document-tool-plan')>()),
  generateDocumentToolPlan: state.toolPlan,
}));
// Panel lifecycle fixtures supply a deterministic provider boundary; schema parsing
// and matched result continuation are tested against the real adapter separately.
vi.mock('../../lib/agent-plugin/document-task', async (original) => {
  const actual = await original<typeof import('../../lib/agent-plugin/document-task')>();
  const { runAgent } = await import('@ranuts/agent-core/runtime');
  const { createDocumentAgentTools } = await import('../../lib/agent-plugin/document-agent-tools');
  const createSchemaTaskProvider = (
    provider: import('@ranuts/agent-core/llm/types').LLMProvider & { backend?: string },
    context: () => import('../../lib/agent-plugin/document-context').DocumentContext,
  ): import('@ranuts/agent-core/llm/types').LLMProvider => {
    const chat = async (
      messages: import('@ranuts/agent-core/llm/types').LLMMessage[],
      _tools: unknown,
      signal?: AbortSignal,
      delta?: (text: string) => void,
    ): Promise<import('@ranuts/agent-core/llm/types').LLMResponse> => {
      if (state.directTaskAnswer) {
        const text = await state.directTaskAnswer(delta);
        return { text, toolCalls: [], stopReason: 'end_turn', assistant: { role: 'assistant', content: text } };
      }
      const results = messages.flatMap((m) =>
        typeof m.content === 'string' ? [] : m.content.filter((b) => b.type === 'tool_result'),
      );
      if (results.length) {
        const name = messages.flatMap((m) =>
          typeof m.content === 'string' ? [] : m.content.filter((b) => b.type === 'tool_use'),
        )[0]?.name;
        const text =
          name && ['get_presentation_text', 'get_cell', 'get_range', 'get_document_text'].includes(name)
            ? state.readText === ''
              ? t('agentNoReadableText')
              : await state.readAnswer(provider, messages[0].content, context(), messages.slice(1), signal, delta)
            : 'Reviewed operation finished.';
        return { text, toolCalls: [], stopReason: 'end_turn', assistant: { role: 'assistant', content: text } };
      }
      const plan = await state.toolPlan(provider, messages[0].content, context(), signal, {
        stableCapabilityPrefix: provider.backend === 'wllama',
      });
      const call = { id: 'fixture-call', name: plan.tool, input: plan.input };
      return {
        text: '',
        toolCalls: [call],
        stopReason: 'tool_use',
        assistant: { role: 'assistant', content: [{ type: 'tool_use', ...call }] },
      };
    };
    return {
      name: 'panel-fixture',
      isReady: () => true,
      streamingTextMode: 'answer-only',
      chat,
      chatStream: (messages, tools, delta, signal) => chat(messages, tools, signal, delta),
    };
  };
  return {
    ...actual,
    createSchemaTaskProvider,
    runDocumentTask: async (
      provider: import('@ranuts/agent-core/llm/types').LLMProvider,
      request: string,
      options: Parameters<typeof import('../../lib/agent-plugin/document-task').runDocumentTask>[2],
    ) => {
      if (options.target.context.kind === 'pdf') return actual.runDocumentTask(provider, request, options);
      options.beforeRun?.();
      return runAgent(
        createSchemaTaskProvider(provider, () => options.target.context),
        request,
        { ...options, tools: createDocumentAgentTools(options) },
      );
    },
  };
});
vi.mock('../../lib/agent-plugin/document-read-answer', () => ({ generateReadAnswer: state.readAnswer }));
vi.mock('../../lib/agent-plugin/document-tool-action', () => {
  const capture = () => ({
    context:
      state.toolContext === 'pdf'
        ? { kind: 'pdf', page: 1 }
        : state.toolContext === 'cell'
          ? { kind: 'cell' }
          : state.toolContext === 'word'
            ? { kind: 'word' }
            : { kind: 'slide', page: 1 },
    label: 'PPT · 1',
    selectedText: '',
    isCurrent: () => state.targetCurrent,
  });
  return {
    captureDocumentToolTarget: capture,
    captureDocumentToolScope: capture,
    DocumentToolAction: class {
      dispose = state.actionDispose;
      cancel() {}
      isCurrent() {
        return state.targetCurrent;
      }
      apply = state.apply;
      get result() {
        return state.readText === undefined ? { verified: true, page: 2, count: 2 } : { text: state.readText };
      }
      constructor(
        readonly target: unknown,
        readonly plan: unknown,
      ) {}
    },
  };
});
afterEach(() => {
  localStorage.removeItem('agent-panel-provider');
  localStorage.removeItem('agent-local-preset');
  localStorage.removeItem('agent-panel-gguf-url');
  localStorage.removeItem('agent-writing-endpoint');
  localStorage.removeItem('agent_conversation_saving_v2');
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
  window.dispatchEvent(new Event('pagehide'));
  document.body.replaceChildren();
  state.preload.mockReset();
  state.dispose.mockClear();
  state.actionDispose.mockClear();
  state.progress.length = 0;
  state.ready = false;
  state.conversations = undefined;
  state.conversationRepository = undefined;
  state.nativeEndpoint = false;
  state.cached = false;
  state.cachedModel = 'Qwen3-4B-q4f16_1-MLC';
  state.cpuCached = false;
  state.editorKind = 'word';
  state.deleteCache.mockReset().mockResolvedValue(undefined);
  state.readonly = false;
  state.unavailable = undefined;
  state.activeBackend = undefined;
  state.stalled = false;
  state.queueStream = undefined;
  state.generate.mockReset();
  state.toolPlan.mockReset();
  state.readAnswer.mockReset().mockResolvedValue('120');
  state.directTaskAnswer = undefined;
  state.toolContext = 'slide';
  state.apply.mockClear();
  state.routing.mockReset();
  state.semanticResponse = undefined;
  state.pdfEffect = undefined;
  state.semanticGate = undefined;
  state.structuredStream = undefined;
  state.targetCurrent = true;
  state.writing.mockReset();
  state.editorReady = true;
  state.source = '';
  state.readText = undefined;
  state.editorReady = false;
  state.backend = undefined;
  state.usage = undefined;
  vi.useRealTimers();
});

/**
 * Browser-local writing is opt-in: the engines never passed seven-language
 * quality acceptance, so a document write needs the explicit consent that the
 * writing-destination settings block persists. Writing cases call this first.
 */
function allowBrowserLocalWriting(): void {
  localStorage.setItem(
    'agent-writing-endpoint',
    JSON.stringify({
      version: 1,
      kind: 'loopback',
      baseUrl: '',
      model: '',
      preference: 'device-first',
      localWritingConsent: true,
    }),
  );
}
it('stays hidden without preparing a model even after the editor becomes idle', async () => {
  vi.useFakeTimers();
  state.ready = true;
  state.preload.mockResolvedValue(undefined);
  const panel = createAgentPanel({ background: true });
  expect(panel.querySelector('.agent-panel-chatonly')).toBeNull();
  expect(panel.classList.contains('agent-panel-hidden')).toBe(true);
  expect(document.querySelector('.agent-launcher')).toBeNull();
  await vi.advanceTimersByTimeAsync(1000);
  expect(state.preload).not.toHaveBeenCalled();
  state.editorReady = true;
  await vi.advanceTimersByTimeAsync(1500);
  expect(state.preload).not.toHaveBeenCalled();
  expect(panel.classList.contains('agent-panel-hidden')).toBe(true);
});
it('opening the default model leaves preparation to the user', async () => {
  state.preload.mockResolvedValue(undefined);
  const panel = createAgentPanel();
  await Promise.resolve();
  expect(state.preload).not.toHaveBeenCalled();
  panel.querySelector<HTMLElement>('.agent-panel-load')!.click();
  await vi.waitFor(() => expect(state.preload).toHaveBeenCalledOnce());
});
it('opens first-use assistant settings without preparing a model', async () => {
  const panel = createAgentPanel({ externalEntry: true });
  await vi.waitFor(() => expect(panel.dataset.view).toBe('settings'));
  expect(state.preload).not.toHaveBeenCalled();
});
it('opens chat for a remembered model even when its runtime is not loaded', () => {
  localStorage.setItem('agent-local-preset', 'Qwen3-4B-q4f16_1-MLC');
  const panel = createAgentPanel({ externalEntry: true });
  expect(panel.dataset.view).toBe('chat');
  expect(state.preload).not.toHaveBeenCalled();
});
it('opens chat for a previously downloaded default model in another editor', async () => {
  state.cached = true;
  state.editorKind = 'cell';
  const panel = createAgentPanel({ externalEntry: true });
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(panel.dataset.view).toBe('chat');
  expect(state.preload).not.toHaveBeenCalled();
});
it('opens chat for a remembered CPU model without starting inference', () => {
  localStorage.setItem('agent-panel-provider', 'wllama');
  localStorage.setItem('agent-panel-gguf-url', 'https://models.example/cpu-model.gguf');
  const panel = createAgentPanel({ externalEntry: true });
  expect(panel.dataset.view).toBe('chat');
  expect(state.preload).not.toHaveBeenCalled();
});
it('opens chat for a configured service without connecting on its own', () => {
  localStorage.setItem(
    'agent-writing-endpoint',
    JSON.stringify({ version: 1, kind: 'loopback', baseUrl: 'http://localhost:11434', model: 'model' }),
  );
  const panel = createAgentPanel({ externalEntry: true });
  expect(panel.dataset.view).toBe('chat');
  expect(panel.querySelector('.agent-panel-endpoint-connect')?.textContent).toBe(t('agentEndpointConnect'));
});
it('keeps setup reachable for an incomplete cloud service', async () => {
  localStorage.setItem(
    'agent-writing-endpoint',
    JSON.stringify({ version: 1, kind: 'openai-compatible', baseUrl: 'https://missing-key.example', model: 'model' }),
  );
  const panel = createAgentPanel({ externalEntry: true });
  await vi.waitFor(() => expect(panel.dataset.view).toBe('settings'));
});
it('keeps setup reachable when the remembered preset is no longer supported', async () => {
  localStorage.setItem('agent-local-preset', 'Qwen3-1.7B-q4f16_1-MLC');
  const panel = createAgentPanel({ externalEntry: true });
  await vi.waitFor(() => expect(panel.dataset.view).toBe('settings'));
});
it('does not override an explicit view change while checking cached configuration', async () => {
  const panel = createAgentPanel({ externalEntry: true });
  panel.querySelector<HTMLButtonElement>('.agent-panel-settings-toggle')!.click();
  panel.querySelector<HTMLButtonElement>('.agent-panel-settings-toggle')!.click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(panel.dataset.view).toBe('chat');
});
it.each(['starting', 'listening'])(
  'does not cancel %s dictation when the initial cache check finishes',
  async (phase) => {
    class Recognition {
      static current: Recognition;
      constructor() {
        Recognition.current = this;
      }
      onstart?: () => void;
      onresult?: (event: unknown) => void;
      start = vi.fn();
      stop = vi.fn();
      abort = vi.fn();
    }
    vi.stubGlobal('SpeechRecognition', Recognition);
    try {
      const panel = createAgentPanel({ externalEntry: true });
      panel.querySelector<HTMLButtonElement>('.agent-speech-mic')!.click();
      if (phase === 'listening') Recognition.current.onstart?.();
      expect(panel.querySelector<HTMLElement>('.agent-speech')!.dataset.state).toBe(phase);
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(panel.dataset.view).toBe('chat');
      expect(Recognition.current.abort).not.toHaveBeenCalled();
      Recognition.current.onresult?.({ results: [{ isFinal: false, 0: { transcript: 'A dictated request' } }] });
      expect(panel.querySelector<HTMLTextAreaElement>('.cui-input')!.value).toBe('A dictated request');
      expect(state.preload).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  },
);
it('does not hide an edited draft when the initial cache check finishes', async () => {
  const panel = createAgentPanel({ externalEntry: true });
  const input = panel.querySelector<HTMLTextAreaElement>('.cui-input')!;
  input.value = 'Keep this draft visible';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(panel.dataset.view).toBe('chat');
  expect(input.value).toBe('Keep this draft visible');
  expect(state.preload).not.toHaveBeenCalled();
});
it('reopens a configured assistant in chat after closing its settings', () => {
  localStorage.setItem('agent-local-preset', 'Qwen3-4B-q4f16_1-MLC');
  const panel = createAgentPanel({ externalEntry: true });
  panel.querySelector<HTMLButtonElement>('.agent-panel-settings-toggle')!.click();
  expect(panel.dataset.view).toBe('settings');
  setAgentPanelOpen(false);
  setAgentPanelOpen(true);
  expect(panel.dataset.view).toBe('chat');
});
it('remembers successful default-model preparation for the next opening', async () => {
  state.preload.mockImplementation(async () => {
    state.ready = true;
  });
  createPreparedPanel();
  await vi.waitFor(() => expect(localStorage.getItem('agent-local-preset')).toBe('Qwen3-4B-q4f16_1-MLC'));
});
it('keeps the AI rail entry accessible before the model loads and after a load fails', async () => {
  const iframe = document.createElement('iframe');
  document.body.append(iframe);
  iframe.contentDocument!.body.innerHTML = '<div id="right-menu"><div class="tool-menu-btns"></div></div>';
  state.preload.mockRejectedValue(new Error('offline'));
  createAgentPanel({ background: true });
  await vi.waitFor(() => expect(iframe.contentDocument!.querySelector('.agent-sidebar-entry')).not.toBeNull());
  iframe.contentDocument!.querySelector<HTMLButtonElement>('.agent-sidebar-entry')!.click();
  expect(document.querySelector('.agent-panel')?.classList.contains('agent-panel-hidden')).toBe(false);
  document.querySelector<HTMLElement>('.agent-panel-load')!.click();
  await vi.waitFor(() => expect(state.preload).toHaveBeenCalledOnce());
  expect(iframe.contentDocument!.querySelector('.agent-sidebar-entry')).not.toBeNull();
});
it('creates a fresh conversation without disposing or reloading the local model', async () => {
  state.ready = true;
  state.preload.mockResolvedValue(undefined);
  const panel = createPreparedPanel();
  await vi.waitFor(() => expect(state.preload).toHaveBeenCalledTimes(1));
  const original = activeSession();
  (panel.querySelector('.agent-panel-clear') as HTMLElement).click();
  expect(state.dispose).not.toHaveBeenCalled();
  expect(state.conversations!.list()).toHaveLength(2);
  expect(activeSession()).not.toBe(original);
  expect(state.conversations!.history().load()).toEqual([]);
  expect(state.preload).toHaveBeenCalledTimes(1);
});

it('keeps a cleared conversation empty when a pending proposal fails later', async () => {
  state.ready = true;
  let fail!: (error: Error) => void;
  state.toolPlan.mockImplementation(
    () =>
      new Promise((_resolve, reject) => {
        fail = reject;
      }),
  );
  const panel = createPreparedPanel();
  const editTask = panel.querySelector<HTMLSelectElement>('.agent-writing-task')!;
  editTask.value = 'tools';
  editTask.dispatchEvent(new Event('change'));
  const input = panel.querySelector<HTMLTextAreaElement>('.cui-input')!;
  input.value = 'Insert a greeting';
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  expect(state.toolPlan).toHaveBeenCalled();
  (panel.querySelector('.agent-panel-clear') as HTMLElement).click();
  fail(new Error('Late failure'));
  await vi.waitFor(() => expect(input.closest('.cui-root')!.querySelector('.cui-send-stop')).toBeNull());
  expect(panel.querySelectorAll('.cui-msg')).toHaveLength(0);
});

it('chooses a preset without retaining a previous custom model override', () => {
  const keys = ['agent-local-model-id', 'agent-local-model-url', 'agent-local-model-lib', 'agent-local-preset'];
  const before = keys.map((key) => localStorage.getItem(key));
  try {
    localStorage.setItem(keys[0], 'Qwen3-4B-q4f16_1-MLC');
    localStorage.setItem(keys[1], '/models/custom');
    localStorage.setItem(keys[2], '/models/custom.wasm');
    const panel = createPreparedPanel();
    const preset = panel.querySelector('.agent-panel-model') as HTMLElement & { value: string };
    preset.value = 'Qwen3-4B-q4f16_1-MLC';
    preset.dispatchEvent(new Event('change'));
    for (const key of keys.slice(0, 3)) {
      expect(localStorage.getItem(key)).toBe('');
    }
    expect(localStorage.getItem(keys[3])).toBe(preset.value);
    const reopened = createPreparedPanel();
    expect((reopened.querySelector('.agent-panel-model') as HTMLElement & { value: string }).value).toBe(preset.value);
  } finally {
    keys.forEach((key, index) =>
      before[index] === null ? localStorage.removeItem(key) : localStorage.setItem(key, before[index]!),
    );
  }
});

it('explains invalid model addresses without suggesting another download', async () => {
  const error = new Error('Model artifacts require HTTP or HTTPS');
  error.name = 'ModelSourceError';
  state.preload.mockRejectedValue(error);
  const panel = createPreparedPanel();
  await Promise.resolve();
  (panel.querySelector('.agent-panel-load') as HTMLElement).click();
  const message = t('agentModelSourceInvalid');
  await vi.waitFor(() => expect(panel.querySelector('.agent-panel-note')?.textContent).toBe(message));
  expect(panel.querySelector('.cui-msg-error')?.textContent).toContain(message);
  expect(panel.querySelector('.agent-panel-load')?.hasAttribute('disabled')).toBe(false);
});

it('replaces stale progress with an actionable loading failure and enables retry', async () => {
  state.preload.mockRejectedValue(new DOMException('Quota exceeded', 'QuotaExceededError'));
  const panel = createPreparedPanel();
  await Promise.resolve();
  (panel.querySelector('.agent-panel-load') as HTMLElement).click();
  await vi.waitFor(() => expect(panel.querySelector('.agent-panel-note')?.textContent).toBe(t('agentModelLoadFailed')));
  expect(panel.querySelector('.agent-panel-load')?.hasAttribute('disabled')).toBe(false);
  expect(panel.querySelector('.cui-msg-error')?.textContent).toContain(t('agentModelQuota'));
});

it('offers cancellation for WebLLM loading and rejects old progress and late completion', async () => {
  let finish!: () => void;
  state.preload.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const panel = createPreparedPanel();
  await Promise.resolve();
  (panel.querySelector('.agent-panel-load') as HTMLElement).click();
  const cancel = panel.querySelector<HTMLElement>('.agent-panel-load-stop');
  expect(cancel).not.toBeNull();
  expect(cancel!.hidden).toBe(false);
  expect(cancel!.closest('.agent-panel-settings')).toBeNull();
  const progress = panel.querySelector<HTMLProgressElement>('.agent-model-progress')!;
  expect(progress).not.toBeNull();
  expect(progress.hidden).toBe(false);
  expect(progress.hasAttribute('value')).toBe(false);
  state.progress[0]({ text: 'Loading weights', progress: 0.42 });
  expect(progress.value).toBe(0.42);
  expect(panel.querySelector('.agent-model-status')?.textContent).toContain('42%');
  for (const fraction of [NaN, Infinity, -1, 2]) {
    state.progress[0]({ text: 'Unknown progress', progress: fraction });
    expect(progress.hasAttribute('value')).toBe(false);
  }
  cancel!.click();
  state.progress[0]({ text: 'Old progress 97%' });
  finish();
  await Promise.resolve();
  expect(panel.querySelector('.agent-panel-note')?.textContent).toBe(t('agentStopped'));
  expect(progress.hidden).toBe(true);
  expect(document.activeElement).toBe(panel.querySelector('.cui-input'));
  expect(state.dispose).toHaveBeenCalled();
  expect(panel.querySelector('.agent-panel-load')?.hasAttribute('disabled')).toBe(false);
});

it('keeps loading feedback beside the chosen model across settings and chat', async () => {
  state.preload.mockReturnValue(new Promise<void>(() => {}));
  const panel = createPreparedPanel();
  await Promise.resolve();
  const load = panel.querySelector<HTMLElement>('.agent-panel-load')!;
  load.click();
  const stop = panel.querySelector<HTMLElement>('.agent-panel-load-stop')!;
  expect(stop.getAttribute('type')).toBe('text');
  const toggle = panel.querySelector<HTMLElement>('.agent-panel-settings-toggle')!;
  toggle.click();
  expect(panel.querySelector('.agent-device-section .agent-runtime-row')).not.toBeNull();
  expect(load.hidden).toBe(true);
  expect(panel.querySelector('.agent-model-cache .agent-runtime-row')).toBeNull();
  toggle.click();
  expect(stop.closest('.agent-panel-settings')).toBeNull();
  expect(stop.hidden).toBe(false);
  stop.click();
  expect(load.hidden).toBe(false);
  expect(panel.querySelector('.agent-runtime-row')?.hasAttribute('hidden')).toBe(true);
});

it('preserves keyboard focus when loading replaces its action with Stop', () => {
  state.preload.mockReturnValue(new Promise<void>(() => {}));
  const panel = createAgentPanel();
  document.body.append(panel);
  panel.querySelector<HTMLElement>('.agent-panel-settings-toggle')!.click();
  const load = panel.querySelector<HTMLElement>('.agent-panel-load')!;
  // jsdom has no ranui inner button; emulate the host's focused control.
  load.tabIndex = -1;
  load.focus();
  load.click();
  const stop = panel.querySelector<HTMLElement>('.agent-panel-load-stop')!;
  expect(document.activeElement).toBe(stop);
  stop.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true, bubbles: true }));
  expect(document.activeElement).toBe(load);
});

it('requires selection before starting a writing task', async () => {
  state.ready = true;
  allowBrowserLocalWriting();
  const panel = createPreparedPanel();
  const task = panel.querySelector('.agent-writing-task') as HTMLElement & { value: string };
  task.value = 'rewrite';
  task.dispatchEvent(new Event('change'));
  const input = panel.querySelector<HTMLTextAreaElement>('.cui-input')!;
  input.value = 'Please polish';
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await vi.waitFor(() => expect(input.closest('.cui-root')!.querySelector('.cui-send-stop')).toBeNull());
  expect(state.writing).not.toHaveBeenCalled();
  expect(state.generate).not.toHaveBeenCalled();
  expect(panel.querySelector('.cui-msg-status')?.textContent).toContain(t('agentSelectText'));
});
it('refuses browser-local writing until a service is connected or consent is given', async () => {
  // The narrowing this change delivers: a document write is no longer silently
  // routed to a browser-local engine that never passed quality acceptance.
  state.ready = true;
  state.editorReady = true;
  state.source = 'Budget 1250 EUR';
  const panel = createAgentPanel();
  const task = panel.querySelector<HTMLSelectElement>('.agent-writing-task')!;
  task.value = 'rewrite';
  task.dispatchEvent(new Event('change'));
  const input = panel.querySelector<HTMLTextAreaElement>('.cui-input')!;
  input.value = 'Polish this';
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await vi.waitFor(() => expect(panel.querySelector('.agent-readiness')?.textContent).toBeTruthy());
  await vi.waitFor(() => expect(input.closest('.cui-root')!.querySelector('.cui-send-stop')).toBeNull());
  expect(state.writing).not.toHaveBeenCalled();
  expect(state.apply).not.toHaveBeenCalled();
  expect(panel.querySelector('.agent-readiness')?.textContent).toContain(t('agentWritingNeedsLocalService'));
});
it('explains a blocked writing route without requiring an unrelated model download', async () => {
  // The narrowing this change delivers: a document write is no longer silently
  // routed to a browser-local engine that never passed quality acceptance.
  state.ready = false;
  state.cached = false;
  state.editorKind = 'word';
  state.deleteCache.mockReset().mockResolvedValue(undefined);
  localStorage.setItem('agent-panel-provider', 'wllama');
  state.editorReady = true;
  state.source = 'Budget 1250 EUR';
  const panel = createAgentPanel();
  const task = panel.querySelector<HTMLSelectElement>('.agent-writing-task')!;
  task.value = 'rewrite';
  task.dispatchEvent(new Event('change'));
  const input = panel.querySelector<HTMLTextAreaElement>('.cui-input')!;
  input.value = 'Polish this';
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await vi.waitFor(() => expect(panel.querySelector('.agent-readiness')?.textContent).toBeTruthy());
  await vi.waitFor(() => expect(input.closest('.cui-root')!.querySelector('.cui-send-stop')).toBeNull());
  expect(state.writing).not.toHaveBeenCalled();
  expect(state.apply).not.toHaveBeenCalled();
  expect(panel.querySelector('.agent-readiness')?.textContent).toContain(t('agentWritingNeedsLocalService'));
});
it('persists the writing destination, model and browser-local writing consent', () => {
  const panel = createPreparedPanel();
  const url = panel.querySelector<HTMLInputElement>('.agent-panel-endpoint-url')!;
  const model = panel.querySelector<HTMLInputElement>('.agent-panel-endpoint-model')!;
  const consent = panel.querySelector<HTMLInputElement>('.agent-panel-local-writing')!;
  url.value = 'http://127.0.0.1:11434/';
  url.dispatchEvent(new Event('change'));
  model.value = '  qwen3:8b  ';
  model.dispatchEvent(new Event('change'));
  consent.checked = true;
  consent.dispatchEvent(new Event('change'));
  expect(JSON.parse(localStorage.getItem('agent-writing-endpoint')!)).toEqual({
    version: 1,
    kind: 'loopback',
    baseUrl: 'http://127.0.0.1:11434/',
    model: 'qwen3:8b',
    preference: 'device-first',
    localWritingConsent: true,
  });
});
it('never persists a plain-http remote endpoint, which would leak the key and the text', () => {
  const panel = createPreparedPanel();
  const kind = panel.querySelector<HTMLSelectElement>('.agent-endpoint-kind')!;
  kind.value = 'openai-compatible';
  kind.dispatchEvent(new Event('change'));
  const url = panel.querySelector<HTMLInputElement>('.agent-panel-endpoint-url')!;
  const model = panel.querySelector<HTMLInputElement>('.agent-panel-endpoint-model')!;
  model.value = 'gpt-4o-mini';
  model.dispatchEvent(new Event('change'));
  url.value = 'http://api.example.com/v1';
  url.dispatchEvent(new Event('change'));
  expect(localStorage.getItem('agent-writing-endpoint')).toBeNull();
});
it('shows where the writing will actually go, and says when it leaves the device', () => {
  const panel = createPreparedPanel();
  const destination = panel.querySelector('.agent-panel-write-destination')!;
  expect(destination.textContent).toContain(t('agentWriteNeedsDestination'));
  const kind = panel.querySelector<HTMLSelectElement>('.agent-endpoint-kind')!;
  kind.value = 'openai-compatible';
  kind.dispatchEvent(new Event('change'));
  const url = panel.querySelector<HTMLInputElement>('.agent-panel-endpoint-url')!;
  const model = panel.querySelector<HTMLInputElement>('.agent-panel-endpoint-model')!;
  url.value = 'https://api.example.com/v1';
  url.dispatchEvent(new Event('change'));
  model.value = 'gpt-4o-mini';
  model.dispatchEvent(new Event('change'));
  const key = panel.querySelector<HTMLInputElement>('.agent-panel-endpoint-key')!;
  key.value = 'sk-test';
  key.dispatchEvent(new Event('change'));
  panel.querySelector<HTMLButtonElement>('.agent-panel-endpoint-connect')!.click();
  return vi.waitFor(() => {
    expect(destination.textContent).toContain(t('agentWriteDestinationRemote'));
    expect(panel.querySelector<HTMLInputElement>('.agent-panel-endpoint-model')!.value).toBe('gpt-4o-mini');
  });
});
it('says a cloud destination cannot work offline instead of failing vaguely', async () => {
  // Offline, the only workable destinations are on this device. The route drops
  // the cloud endpoint, so the user is told why rather than getting a network error.
  Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
  state.ready = true;
  state.editorReady = true;
  state.source = 'Original';
  const panel = createAgentPanel();
  const kind = panel.querySelector<HTMLSelectElement>('.agent-endpoint-kind')!;
  kind.value = 'openai-compatible';
  kind.dispatchEvent(new Event('change'));
  const url = panel.querySelector<HTMLInputElement>('.agent-panel-endpoint-url')!;
  const model = panel.querySelector<HTMLInputElement>('.agent-panel-endpoint-model')!;
  const key = panel.querySelector<HTMLInputElement>('.agent-panel-endpoint-key')!;
  url.value = 'https://api.example.com/v1';
  url.dispatchEvent(new Event('change'));
  model.value = 'gpt-4o-mini';
  model.dispatchEvent(new Event('change'));
  key.value = 'sk-test';
  key.dispatchEvent(new Event('change'));
  panel.querySelector<HTMLButtonElement>('.agent-panel-endpoint-connect')!.click();
  await vi.waitFor(() =>
    expect(panel.querySelector('.agent-panel-write-destination')?.textContent).toContain(
      t('agentWriteDestinationOfflineUnavailable'),
    ),
  );
  const task = panel.querySelector<HTMLSelectElement>('.agent-writing-task')!;
  task.value = 'rewrite';
  task.dispatchEvent(new Event('change'));
  const input = panel.querySelector<HTMLTextAreaElement>('.cui-input')!;
  input.value = 'Polish this';
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await vi.waitFor(() => expect(panel.querySelector('.agent-readiness')?.textContent).toBeTruthy());
  await vi.waitFor(() => expect(input.closest('.cui-root')!.querySelector('.cui-send-stop')).toBeNull());
  expect(state.writing).not.toHaveBeenCalled();
  expect(panel.querySelector('.agent-readiness')?.textContent).toContain(t('agentWritingOfflineNeedsDevice'));
});
it('disconnects the endpoint when a field that defines the destination changes', async () => {
  // Otherwise the panel would report the new destination while requests still
  // went to the old one -- a different origin, with the old key.
  const panel = createPreparedPanel();
  const kind = panel.querySelector<HTMLSelectElement>('.agent-endpoint-kind')!;
  kind.value = 'openai-compatible';
  kind.dispatchEvent(new Event('change'));
  const url = panel.querySelector<HTMLInputElement>('.agent-panel-endpoint-url')!;
  const model = panel.querySelector<HTMLInputElement>('.agent-panel-endpoint-model')!;
  const key = panel.querySelector<HTMLInputElement>('.agent-panel-endpoint-key')!;
  url.value = 'https://api.example.com/v1';
  url.dispatchEvent(new Event('change'));
  model.value = 'gpt-4o-mini';
  model.dispatchEvent(new Event('change'));
  key.value = 'sk-test';
  key.dispatchEvent(new Event('change'));
  const connect = panel.querySelector<HTMLButtonElement>('.agent-panel-endpoint-connect')!;
  connect.click();
  await vi.waitFor(() => expect(connect.textContent).toBe(t('agentEndpointDisconnect')));
  // Editing the address must drop the connection rather than leave it stale.
  url.value = 'https://other.example.com/v1';
  url.dispatchEvent(new Event('change'));
  expect(connect.textContent).toBe(t('agentEndpointConnect'));
  expect(panel.querySelector('.agent-panel-endpoint-status')?.textContent).toBe('');
  // The new address is a different service: the key did not travel with it, so
  // reconnecting needs a key for that origin.
  key.value = 'sk-second';
  key.dispatchEvent(new Event('change'));
  connect.click();
  await vi.waitFor(() => expect(connect.textContent).toBe(t('agentEndpointDisconnect')));
  // A preference or consent change defines no destination, so it keeps the link.
  const preference = panel.querySelector<HTMLSelectElement>('.agent-write-preference')!;
  preference.value = 'remote-first';
  preference.dispatchEvent(new Event('change'));
  expect(connect.textContent).toBe(t('agentEndpointDisconnect'));
});
it('removes a stored endpoint key when the field is cleared, instead of keeping it forever', () => {
  const panel = createPreparedPanel();
  const kind = panel.querySelector<HTMLSelectElement>('.agent-endpoint-kind')!;
  kind.value = 'openai-compatible';
  kind.dispatchEvent(new Event('change'));
  const url = panel.querySelector<HTMLInputElement>('.agent-panel-endpoint-url')!;
  const key = panel.querySelector<HTMLInputElement>('.agent-panel-endpoint-key')!;
  url.value = 'https://api.example.com/v1';
  url.dispatchEvent(new Event('change'));
  key.value = 'sk-test';
  key.dispatchEvent(new Event('change'));
  expect(getEndpointKey('https://api.example.com/v1')).toBe('sk-test');
  key.value = '';
  key.dispatchEvent(new Event('change'));
  expect(getEndpointKey('https://api.example.com/v1')).toBeUndefined();
});
it('asks for the API key instead of reporting a generic failure', async () => {
  const panel = createPreparedPanel();
  const kind = panel.querySelector<HTMLSelectElement>('.agent-endpoint-kind')!;
  kind.value = 'openai-compatible';
  kind.dispatchEvent(new Event('change'));
  const url = panel.querySelector<HTMLInputElement>('.agent-panel-endpoint-url')!;
  const model = panel.querySelector<HTMLInputElement>('.agent-panel-endpoint-model')!;
  url.value = 'https://api.example.com/v1';
  url.dispatchEvent(new Event('change'));
  model.value = 'gpt-4o-mini';
  model.dispatchEvent(new Event('change'));
  panel.querySelector<HTMLButtonElement>('.agent-panel-endpoint-connect')!.click();
  await vi.waitFor(() =>
    expect(panel.querySelector('.agent-panel-endpoint-status')?.textContent).toBe(t('agentEndpointKeyRequired')),
  );
});
it('says the configured cloud endpoint is unavailable offline rather than "not configured"', async () => {
  const panel = createPreparedPanel();
  const kind = panel.querySelector<HTMLSelectElement>('.agent-endpoint-kind')!;
  kind.value = 'openai-compatible';
  kind.dispatchEvent(new Event('change'));
  const url = panel.querySelector<HTMLInputElement>('.agent-panel-endpoint-url')!;
  const model = panel.querySelector<HTMLInputElement>('.agent-panel-endpoint-model')!;
  const key = panel.querySelector<HTMLInputElement>('.agent-panel-endpoint-key')!;
  url.value = 'https://api.example.com/v1';
  url.dispatchEvent(new Event('change'));
  model.value = 'gpt-4o-mini';
  model.dispatchEvent(new Event('change'));
  key.value = 'sk-test';
  key.dispatchEvent(new Event('change'));
  panel.querySelector<HTMLButtonElement>('.agent-panel-endpoint-connect')!.click();
  await vi.waitFor(() =>
    expect(panel.querySelector('.agent-panel-write-destination')?.textContent).toContain(
      t('agentWriteDestinationRemote'),
    ),
  );
  Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
  window.dispatchEvent(new Event('offline'));
  const destination = panel.querySelector('.agent-panel-write-destination')!;
  expect(destination.textContent).toContain(t('agentWriteDestinationOfflineUnavailable'));
  expect(destination.textContent).not.toContain(t('agentWriteNeedsDestination'));
});
it('asks for the model to be loaded when consent is on but no model is ready', async () => {
  allowBrowserLocalWriting();
  state.editorReady = true;
  state.source = 'Original';
  const panel = createPreparedPanel();
  const input = panel.querySelector<HTMLTextAreaElement>('.cui-input')!;
  // The panel auto-loads on open; canSend is false while that is in flight, so a
  // keypress sent before it settles would be swallowed rather than tested.
  await vi.waitFor(() => expect(input.closest('.cui-root')!.querySelector('.cui-send-stop')).toBeNull());
  const task = panel.querySelector<HTMLSelectElement>('.agent-writing-task')!;
  task.value = 'rewrite';
  task.dispatchEvent(new Event('change'));
  input.value = 'Polish this';
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await vi.waitFor(() => expect(input.closest('.cui-root')!.querySelector('.cui-send-stop')).toBeNull());
  // It asks for the model rather than telling the user to enable the switch they
  // already enabled, and it does not pretend to have run anything.
  expect(state.writing).not.toHaveBeenCalled();
  expect(input.value).toBe('Polish this');
  expect(panel.querySelector('.agent-readiness [role="status"]')?.textContent).toBe(t('agentPrepareRequired'));
  expect(panel.querySelector('.cui-send')?.textContent).toBe(t('agentLoadModel'));
});
it('serves a writing request through a connected endpoint with no local model loaded', async () => {
  // Regression: the first-download gate used to fire for every submit, so a user
  // with a cloud endpoint and no browser model got asked to download a model and
  // the request never went anywhere.
  state.editorReady = true;
  state.source = 'Original selected text';
  state.writing.mockResolvedValue('Rewritten body');
  const panel = createAgentPanel();
  const input = panel.querySelector<HTMLTextAreaElement>('.cui-input')!;
  await vi.waitFor(() => expect(input.closest('.cui-root')!.querySelector('.cui-send-stop')).toBeNull());
  const kind = panel.querySelector<HTMLSelectElement>('.agent-endpoint-kind')!;
  kind.value = 'openai-compatible';
  kind.dispatchEvent(new Event('change'));
  const url = panel.querySelector<HTMLInputElement>('.agent-panel-endpoint-url')!;
  const model = panel.querySelector<HTMLInputElement>('.agent-panel-endpoint-model')!;
  const key = panel.querySelector<HTMLInputElement>('.agent-panel-endpoint-key')!;
  url.value = 'https://api.example.com/v1';
  url.dispatchEvent(new Event('change'));
  model.value = 'gpt-4o-mini';
  model.dispatchEvent(new Event('change'));
  key.value = 'sk-test';
  key.dispatchEvent(new Event('change'));
  const connect = panel.querySelector<HTMLButtonElement>('.agent-panel-endpoint-connect')!;
  connect.click();
  await vi.waitFor(() => expect(connect.textContent).toBe(t('agentEndpointDisconnect')));
  const task = panel.querySelector<HTMLSelectElement>('.agent-writing-task')!;
  task.value = 'rewrite';
  task.dispatchEvent(new Event('change'));
  input.value = 'Polish this';
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await vi.waitFor(() => expect(state.writing).toHaveBeenCalled());
  await vi.waitFor(() => expect(input.closest('.cui-root')!.querySelector('.cui-send-stop')).toBeNull());
  expect(state.apply).not.toHaveBeenCalled();
  panel.querySelector<HTMLElement>('.agent-plan-apply')!.click();
  await vi.waitFor(() => expect(state.apply).toHaveBeenCalledOnce());
  // And it was not diverted into the model-download prompt.
  expect(panel.textContent).not.toContain(t('agentModelFirstDownload'));
});
it('uses the connected endpoint to plan an open-ended operation', async () => {
  // The endpoint serves the writing tasks; it does not choose document operations.
  // An open-ended request therefore still needs the browser-local model, and must
  // not slip past the model gate just because some endpoint answers.
  const panel = createAgentPanel();
  const kind = panel.querySelector<HTMLSelectElement>('.agent-endpoint-kind')!;
  kind.value = 'openai-compatible';
  kind.dispatchEvent(new Event('change'));
  const url = panel.querySelector<HTMLInputElement>('.agent-panel-endpoint-url')!;
  const model = panel.querySelector<HTMLInputElement>('.agent-panel-endpoint-model')!;
  const key = panel.querySelector<HTMLInputElement>('.agent-panel-endpoint-key')!;
  url.value = 'https://api.example.com/v1';
  url.dispatchEvent(new Event('change'));
  model.value = 'gpt-4o-mini';
  model.dispatchEvent(new Event('change'));
  key.value = 'sk-test';
  key.dispatchEvent(new Event('change'));
  panel.querySelector<HTMLButtonElement>('.agent-panel-endpoint-connect')!.click();
  const mode = panel.querySelector<HTMLSelectElement>('.agent-writing-task')!;
  mode.value = 'tools';
  mode.dispatchEvent(new Event('change'));
  const input = panel.querySelector<HTMLTextAreaElement>('.cui-input')!;
  await vi.waitFor(() => expect(input.closest('.cui-root')!.querySelector('.cui-send-stop')).toBeNull());
  input.value = 'Create another slide using this layout';
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await vi.waitFor(() => expect(state.toolPlan).toHaveBeenCalled());
});
it('rejects a changed editor target while semantic routing is pending', async () => {
  // The endpoint serves the writing tasks; it does not choose document operations.
  // An open-ended request therefore still needs the browser-local model, and must
  // not slip past the model gate just because some endpoint answers.
  let resolveRouting!: (value: { task: string; language: string }) => void;
  state.routing.mockImplementation(
    () =>
      new Promise((resolve) => {
        resolveRouting = resolve;
      }),
  );
  const panel = createAgentPanel();
  const kind = panel.querySelector<HTMLSelectElement>('.agent-endpoint-kind')!;
  kind.value = 'openai-compatible';
  kind.dispatchEvent(new Event('change'));
  const url = panel.querySelector<HTMLInputElement>('.agent-panel-endpoint-url')!;
  const model = panel.querySelector<HTMLInputElement>('.agent-panel-endpoint-model')!;
  const key = panel.querySelector<HTMLInputElement>('.agent-panel-endpoint-key')!;
  url.value = 'https://api.example.com/v1';
  url.dispatchEvent(new Event('change'));
  model.value = 'gpt-4o-mini';
  model.dispatchEvent(new Event('change'));
  key.value = 'sk-test';
  key.dispatchEvent(new Event('change'));
  panel.querySelector<HTMLButtonElement>('.agent-panel-endpoint-connect')!.click();
  const mode = panel.querySelector<HTMLSelectElement>('.agent-writing-task')!;
  mode.value = 'tools';
  mode.dispatchEvent(new Event('change'));
  const input = panel.querySelector<HTMLTextAreaElement>('.cui-input')!;
  await vi.waitFor(() => expect(input.closest('.cui-root')!.querySelector('.cui-send-stop')).toBeNull());
  input.value = 'Create another slide using this layout';
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await vi.waitFor(() => expect(state.routing).toHaveBeenCalled());
  state.targetCurrent = false;
  resolveRouting({ task: 'tools', language: 'en' });
  await vi.waitFor(() => expect(input.closest('.cui-root')!.querySelector('.cui-send-stop')).toBeNull());
  expect(state.toolPlan).not.toHaveBeenCalled();
  expect(state.apply).not.toHaveBeenCalled();
  expect(panel.textContent).toContain(t('agentPlanExpired'));
});
it('routes translation with the captured source and explicit language', async () => {
  state.ready = true;
  state.editorReady = true;
  state.source = 'Budget 1250 EUR';
  state.writing.mockResolvedValue('预算 1250 EUR');
  allowBrowserLocalWriting();
  const panel = createPreparedPanel();
  const task = panel.querySelector('.agent-writing-task') as HTMLElement & { value: string };
  task.value = 'translate';
  task.dispatchEvent(new Event('change'));
  const language = panel.querySelector('.agent-writing-language') as HTMLElement & { value: string };
  language.value = 'zh-CN';
  language.dispatchEvent(new Event('change'));
  const input = panel.querySelector<HTMLTextAreaElement>('.cui-input')!;
  input.value = 'Translate into Chinese, preserve numbers';
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await vi.waitFor(() => expect(input.closest('.cui-root')!.querySelector('.cui-send-stop')).toBeNull());
  expect(state.writing.mock.calls[0][1]).toEqual({
    task: 'translate',
    text: 'Budget 1250 EUR',
    targetLanguage: 'zh-CN',
    instruction: 'Translate into Chinese, preserve numbers',
  });
  expect(state.generate).not.toHaveBeenCalled();
  expect(state.apply).not.toHaveBeenCalled();
  expect(panel.querySelector('.agent-plan-content')?.textContent).toBe('预算 1250 EUR');
  panel.querySelector<HTMLElement>('.agent-plan-apply')!.click();
  await vi.waitFor(() => expect(state.apply).toHaveBeenCalledOnce());
});

it('records a writing request and verified outcome without copying selected document content into history', async () => {
  const record = vi.spyOn(AgentChatController.prototype, 'recordExternalMessages');
  try {
    state.ready = true;
    state.editorReady = true;
    state.source = 'Private selected source';
    state.writing.mockResolvedValue('Private rewritten body');
    allowBrowserLocalWriting();
    const panel = createPreparedPanel();
    const task = panel.querySelector<HTMLSelectElement>('.agent-writing-task')!;
    task.value = 'rewrite';
    task.dispatchEvent(new Event('change'));
    const input = panel.querySelector<HTMLTextAreaElement>('.cui-input')!;
    input.value = 'Rewrite it more clearly';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await vi.waitFor(() =>
      expect(panel.querySelector('.agent-plan-content')?.textContent).toBe('Private rewritten body'),
    );
    panel.querySelector<HTMLElement>('.agent-plan-apply')!.click();
    await vi.waitFor(() => expect(state.apply).toHaveBeenCalled());
    await vi.waitFor(() => expect(input.closest('.cui-root')!.querySelector('.cui-send-stop')).toBeNull());
    expect(record.mock.calls.flatMap(([messages]) => messages)).toEqual([
      { role: 'user', content: 'Rewrite it more clearly' },
      { role: 'assistant', content: 'Private rewritten body', copyOnly: true },
      { role: 'assistant', content: t('agentPlanReady'), hostGuidance: 'tool' },
      { role: 'assistant', content: t('agentPlanVerified'), hostGuidance: 'tool' },
    ]);
    const sessions = activeSession;
    const originalSession = sessions();
    panel.querySelector<HTMLButtonElement>('.agent-panel-clear')!.click();
    expect(panel.querySelector('.cui-messages')?.textContent ?? '').not.toContain('Rewrite it more clearly');
    openSession(panel, originalSession);
    expect(panel.textContent).toContain('Rewrite it more clearly');
    expect(panel.textContent).toContain('Private rewritten body');
    expect(panel.querySelector('.agent-plan-apply')).toBeNull();
    expect(panel.querySelector('.cui-apply')).toBeNull();
    expect(panel.querySelector('.cui-copy')).not.toBeNull();
    expect(panel.textContent).toContain(t('agentPlanVerified'));
    expect(panel.querySelector('.cui-msg-error')).toBeNull();
  } finally {
    record.mockRestore();
  }
});

it('records a failed writing request as an error and never reports document success', async () => {
  const record = vi.spyOn(AgentChatController.prototype, 'recordExternalMessages');
  try {
    state.ready = true;
    state.editorReady = true;
    state.source = 'Original';
    state.writing.mockRejectedValue(new Error('No rewrite was proposed'));
    allowBrowserLocalWriting();
    const panel = createPreparedPanel();
    const task = panel.querySelector<HTMLSelectElement>('.agent-writing-task')!;
    task.value = 'rewrite';
    task.dispatchEvent(new Event('change'));
    const input = panel.querySelector<HTMLTextAreaElement>('.cui-input')!;
    input.value = 'Rewrite using formal wording';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await vi.waitFor(() => expect(input.closest('.cui-root')!.querySelector('.cui-send-stop')).toBeNull());
    const messages = record.mock.calls.flatMap(([items]) => items);
    expect(messages).toEqual([
      { role: 'user', content: 'Rewrite using formal wording' },
      { role: 'assistant', content: t('agentWritingUnchanged'), hostGuidance: 'error' },
    ]);
    expect(state.apply).not.toHaveBeenCalled();
  } finally {
    record.mockRestore();
  }
});

it.each(['resolve', 'reject'] as const)(
  'keeps a late writing %s in its original conversation after switching',
  async (settlement) => {
    state.ready = true;
    state.editorReady = true;
    state.source = 'Original selection';
    let resolve!: (body: string) => void;
    let reject!: (error: Error) => void;
    state.writing.mockImplementation(
      () =>
        new Promise<string>((yes, no) => {
          resolve = yes;
          reject = no;
        }),
    );
    allowBrowserLocalWriting();
    const panel = createPreparedPanel();
    const sessions = activeSession;
    const originalSession = sessions();
    const task = panel.querySelector<HTMLSelectElement>('.agent-writing-task')!;
    task.value = 'rewrite';
    task.dispatchEvent(new Event('change'));
    const input = panel.querySelector<HTMLTextAreaElement>('.cui-input')!;
    input.value = 'Rewrite this old request';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await vi.waitFor(() => expect(state.writing).toHaveBeenCalledOnce());
    const signal = state.writing.mock.calls[0][2] as AbortSignal;
    panel.querySelector<HTMLButtonElement>('.agent-panel-clear')!.click();
    expect(signal.aborted).toBe(true);
    if (settlement === 'resolve') resolve('Late rewritten content');
    else reject(new Error('No rewrite was proposed'));
    await new Promise((done) => setTimeout(done, 0));
    expect(state.apply).not.toHaveBeenCalled();
    expect(panel.querySelector('.cui-messages')?.textContent).not.toContain('Rewrite this old request');
    expect(panel.querySelector('.cui-msg-error')).toBeNull();
    expect(input.disabled).toBe(false);
    openSession(panel, originalSession);
    expect(panel.textContent).toContain('Rewrite this old request');
    expect(panel.querySelector(settlement === 'resolve' ? '.cui-msg-status' : '.cui-msg-error')?.textContent).toContain(
      t(settlement === 'resolve' ? 'agentStopped' : 'agentWritingUnchanged'),
    );
    expect(panel.textContent).not.toContain('Late rewritten content');
  },
);

it.each(['rewrite', 'tools'])('retains a late %s failure when returning before it settles', async (mode) => {
  state.ready = true;
  state.editorReady = true;
  state.source = 'Original selection';
  let reject!: (error: Error) => void;
  const pending = new Promise<string>((_resolve, no) => {
    reject = no;
  });
  if (mode === 'rewrite') state.writing.mockReturnValue(pending);
  else state.toolPlan.mockReturnValue(pending);
  allowBrowserLocalWriting();
  const panel = createPreparedPanel();
  // A pre-existing conversation remains selectable while the new operation is pending.
  state.conversations!.history().save([{ role: 'user', content: 'Earlier request' }]);
  const sessions = activeSession;
  const original = sessions();
  const task = panel.querySelector<HTMLSelectElement>('.agent-writing-task')!;
  task.value = mode;
  task.dispatchEvent(new Event('change'));
  const input = panel.querySelector<HTMLTextAreaElement>('.cui-input')!;
  input.value = mode === 'rewrite' ? 'Rewrite pending original request' : 'Create a slide from this request';
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await vi.waitFor(() => expect(mode === 'rewrite' ? state.writing : state.toolPlan).toHaveBeenCalledOnce());
  panel.querySelector<HTMLButtonElement>('.agent-panel-clear')!.click();
  openSession(panel, original);
  task.value = 'chat';
  task.dispatchEvent(new Event('change'));
  input.value = 'Subsequent message';
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await vi.waitFor(() => expect(input.closest('.cui-root')!.querySelector('.cui-send-stop')).toBeNull());
  reject(new Error('agentToolNotChosen'));
  await new Promise((done) => setTimeout(done, 0));
  input.value = 'After settlement';
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await vi.waitFor(() => expect(input.closest('.cui-root')!.querySelector('.cui-send-stop')).toBeNull());
  panel.querySelector<HTMLButtonElement>('.agent-panel-clear')!.click();
  openSession(panel, original);
  expect(panel.querySelector('.cui-messages')?.textContent).toContain(
    mode === 'rewrite' ? 'Rewrite pending original request' : 'Create a slide from this request',
  );
  expect(panel.querySelector('.cui-msg-error')?.textContent).toContain(t('agentToolNotChosen'));
  expect(panel.querySelector('.cui-messages')?.textContent).toContain('Subsequent message');
  expect(state.apply).not.toHaveBeenCalled();
});

it('restores a failed document operation with its error in the original conversation', async () => {
  state.ready = true;
  state.toolPlan.mockRejectedValue(new Error('agentToolNotChosen'));
  const panel = createPreparedPanel();
  const sessions = activeSession;
  const original = sessions();
  const mode = panel.querySelector<HTMLSelectElement>('.agent-writing-task')!;
  mode.value = 'tools';
  mode.dispatchEvent(new Event('change'));
  const input = panel.querySelector<HTMLTextAreaElement>('.cui-input')!;
  input.value = 'Read cell A1';
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await vi.waitFor(() => expect(input.closest('.cui-root')!.querySelector('.cui-send-stop')).toBeNull());
  panel.querySelector<HTMLButtonElement>('.agent-panel-clear')!.click();
  openSession(panel, original);
  expect(panel.querySelector('.cui-messages')?.textContent).toContain('Read cell A1');
  expect(panel.querySelector('.cui-msg-error')?.textContent).toContain(t('agentToolNotChosen'));
  expect(state.apply).not.toHaveBeenCalled();
});

it('shows a clear result when the current document has no readable text', async () => {
  state.ready = true;
  state.readText = '';
  state.toolPlan.mockResolvedValue({ tool: 'get_presentation_text', input: {}, readOnly: true });
  const panel = createPreparedPanel();
  const mode = panel.querySelector<HTMLSelectElement>('.agent-writing-task')!;
  mode.value = 'tools';
  mode.dispatchEvent(new Event('change'));
  const input = panel.querySelector<HTMLTextAreaElement>('.cui-input')!;
  input.value = 'Read this presentation';
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await vi.waitFor(() => expect(input.closest('.cui-root')!.querySelector('.cui-send-stop')).toBeNull());
  expect(panel.querySelector('.cui-activity')?.textContent).toContain('No readable text was found.');
  const sessions = activeSession;
  const original = sessions();
  panel.querySelector<HTMLButtonElement>('.agent-panel-clear')!.click();
  openSession(panel, original);
  expect(panel.querySelector('.cui-activity')?.textContent).toContain('No readable text was found.');
  expect(panel.querySelector('.cui-msg-error')).toBeNull();
});

it('executes successive explicit writing requests only after separate confirmations', async () => {
  state.ready = true;
  state.editorReady = true;
  state.source = 'Original';
  state.writing.mockResolvedValueOnce('First proposal').mockResolvedValueOnce('Second proposal');
  allowBrowserLocalWriting();
  const panel = createPreparedPanel();
  const task = panel.querySelector<HTMLSelectElement>('.agent-writing-task')!;
  task.value = 'rewrite';
  task.dispatchEvent(new Event('change'));
  const input = panel.querySelector<HTMLTextAreaElement>('.cui-input')!;
  input.value = 'Rewrite first';
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await vi.waitFor(() => expect(input.closest('.cui-root')!.querySelector('.cui-send-stop')).toBeNull());
  panel.querySelector<HTMLElement>('.agent-plan-apply')!.click();
  await Promise.resolve();

  input.value = 'Rewrite second';
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await vi.waitFor(() => expect(input.closest('.cui-root')!.querySelector('.cui-send-stop')).toBeNull());
  panel.querySelectorAll<HTMLElement>('.agent-plan-apply')[1]!.click();
  await Promise.resolve();
  expect(panel.textContent).toContain('First proposal');
  expect(panel.textContent).toContain('Second proposal');
  expect(panel.querySelector('.agent-plan-preview')).not.toBeNull();
  expect(state.apply).toHaveBeenCalledTimes(2);
  expect(panel.querySelectorAll('.agent-plan-preview[data-state=verified]')).toHaveLength(2);
  expect(panel.querySelectorAll('.cui-activity')).toHaveLength(0);
  expect(panel.querySelector('details.cui-activity')).toBeNull();
  input.value = '你好';
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await vi.waitFor(() => expect(panel.querySelector('.cui-msg-agent .cui-bubble')?.textContent).toBe('answer'));
  expect(panel.querySelector('.cui-msg-error')).toBeNull();
  expect(state.apply).toHaveBeenCalledTimes(2);
});

it('retains the actual CPU fallback and model identity after loading finishes', async () => {
  state.ready = true;
  state.preload.mockImplementation(async () => state.backend?.('wllama'));
  const panel = createPreparedPanel();
  await vi.waitFor(() =>
    expect(panel.querySelector('.agent-model-status')?.textContent).toContain(t('agentUseDevice')),
  );
  expect(panel.querySelector('.agent-model-status')?.textContent).toBe(t('agentUseDevice'));
  expect(panel.querySelector<HTMLElement>('.agent-model-status')?.title).toBe('Qwen_Qwen3-0.6B-Q4_K_M.gguf');
  window.dispatchEvent(new Event('languagechange'));
  expect(panel.querySelector('.agent-model-status')?.textContent).toContain(t('agentUseDevice'));
  window.dispatchEvent(new Event('pagehide'));
  expect(panel.querySelector('.agent-model-status')?.textContent).toBe('');
});

it('requires explicit preparation after Stop without replaying the request', async () => {
  state.ready = true;
  state.stalled = true;
  let restore!: () => void;
  state.preload.mockResolvedValueOnce(undefined).mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        restore = () => {
          state.ready = true;
          resolve();
        };
      }),
  );
  const panel = createPreparedPanel();
  document.body.append(panel);
  await vi.waitFor(() => expect(state.preload).toHaveBeenCalledOnce());
  const input = panel.querySelector<HTMLTextAreaElement>('.cui-input')!;
  input.value = 'Hello';
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await vi.waitFor(() => expect(input.closest('.cui-root')!.querySelector('.cui-send-stop')).not.toBeNull());
  panel.querySelector<HTMLButtonElement>('.cui-send-stop')!.click();
  await vi.waitFor(() => expect(input.closest('.cui-root')!.querySelector('.cui-send-stop')).toBeNull());
  expect(state.preload).toHaveBeenCalledOnce();
  panel.querySelector<HTMLElement>('.agent-panel-load')!.click();
  await vi.waitFor(() => expect(state.preload).toHaveBeenCalledTimes(2));
  expect(input.disabled).toBe(false);
  expect(panel.querySelectorAll('.cui-msg-user')).toHaveLength(1);
  expect(panel.querySelector('.agent-model-status')?.textContent).toContain(t('agentPreparing'));
  input.value = 'Next question';
  input.dispatchEvent(new Event('input'));
  expect(panel.querySelector<HTMLButtonElement>('.cui-send')!.disabled).toBe(true);
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  expect(input.value).toBe('Next question');
  input.value = '写到当前的文档上';
  input.dispatchEvent(new Event('input'));
  expect(panel.querySelector<HTMLButtonElement>('.cui-send')!.disabled).toBe(false);
  input.value = 'Next question';
  input.dispatchEvent(new Event('input'));
  expect(panel.querySelector('.agent-panel-settings-toggle')?.getAttribute('aria-expanded')).toBe('false');
  restore();
  await vi.waitFor(() =>
    expect(panel.querySelector('.agent-panel-note')?.textContent).toContain(t('agentModelLoaded')),
  );
  expect(panel.querySelectorAll('.cui-msg-user')).toHaveLength(1);
  expect(input.value).toBe('Next question');
  expect(panel.querySelector<HTMLButtonElement>('.cui-send')!.disabled).toBe(false);
});

it('previews a model-selected document operation before applying', async () => {
  state.ready = true;
  state.toolPlan.mockResolvedValue({ tool: 'slide_action', input: { action: 'add' }, readOnly: false });
  const panel = createPreparedPanel();
  const mode = panel.querySelector<HTMLSelectElement>('.agent-writing-task')!;
  mode.value = 'tools';
  mode.dispatchEvent(new Event('change'));
  const input = panel.querySelector<HTMLTextAreaElement>('.cui-input')!;
  input.value = 'Create another slide using this layout';
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await vi.waitFor(() => expect(panel.querySelector('.agent-plan-content')).not.toBeNull());
  expect(state.apply).not.toHaveBeenCalled();
  panel.querySelector<HTMLElement>('.agent-plan-apply')!.click();
  await vi.waitFor(() => expect(state.apply).toHaveBeenCalledOnce());
  expect(state.toolPlan.mock.calls[0][2]).toEqual({ kind: 'slide', page: 1 });
  expect(panel.querySelector('.agent-plan-preview')).not.toBeNull();
  expect(panel.textContent).toContain(t('agentPlanVerified'));
});

it.each(['webllm', 'wllama'] as const)('uses the actual %s backend to choose tool prompt caching', async (backend) => {
  state.ready = true;
  state.activeBackend = backend;
  state.toolPlan.mockResolvedValue({ tool: 'get_presentation_text', input: {}, readOnly: true });
  const panel = createPreparedPanel();
  const mode = panel.querySelector<HTMLSelectElement>('.agent-writing-task')!;
  mode.value = 'tools';
  mode.dispatchEvent(new Event('change'));
  const input = panel.querySelector<HTMLTextAreaElement>('.cui-input')!;
  input.value = 'Read presentation';
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await vi.waitFor(() => expect(state.toolPlan).toHaveBeenCalledOnce());
  expect(state.toolPlan.mock.calls[0][4]).toEqual({ stableCapabilityPrefix: backend === 'wllama' });
  await vi.waitFor(() => expect(input.closest('.cui-root')!.querySelector('.cui-send-stop')).toBeNull());
});

it('clears loaded runtime feedback when a failed operation retires its provider', async () => {
  state.ready = true;
  state.toolPlan.mockImplementation(async () => {
    state.ready = false;
    state.cached = false;
    state.editorKind = 'word';
    state.deleteCache.mockReset().mockResolvedValue(undefined);
    throw new WebAssembly.RuntimeError('Length out of range of buffer');
  });
  state.preload.mockResolvedValue(undefined);
  const panel = createPreparedPanel();
  await vi.waitFor(() => expect(panel.querySelector('.agent-panel-note')?.textContent).toBe(t('agentModelLoaded')));
  const configure = panel.querySelector<HTMLButtonElement>('.agent-configure')!;
  expect(configure).toBeNull();
  const mode = panel.querySelector<HTMLSelectElement>('.agent-writing-task')!;
  mode.value = 'tools';
  mode.dispatchEvent(new Event('change'));
  const input = panel.querySelector<HTMLTextAreaElement>('.cui-input')!;
  input.value = 'Read presentation';
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await vi.waitFor(() => expect(state.toolPlan).toHaveBeenCalledOnce());
  await vi.waitFor(() => expect(input.closest('.cui-root')!.querySelector('.cui-send-stop')).toBeNull());
  expect(panel.querySelector('.agent-panel-note')?.textContent).toBe(t('agentLoadModel'));
  expect(panel.querySelector('.agent-model-status')?.textContent).toBe('');
  expect(configure).toBeNull();
  panel.querySelector<HTMLButtonElement>('.agent-panel-clear')!.click();
  expect(panel.querySelector('.agent-configure')).toBeNull();
  state.preload.mockImplementationOnce(async () => {
    state.ready = true;
  });
  panel.querySelector<HTMLButtonElement>('.agent-panel-load')!.click();
  await vi.waitFor(() => expect(panel.querySelector('.agent-panel-note')?.textContent).toBe(t('agentModelLoaded')));
  expect(panel.querySelector('.agent-configure')).toBeNull();
});

it('preserves raw tool request whitespace through planning and the transcript', async () => {
  state.ready = true;
  state.toolPlan.mockResolvedValue({ tool: 'slide_action', input: { action: 'add' }, readOnly: false });
  const panel = createPreparedPanel();
  const mode = panel.querySelector<HTMLSelectElement>('.agent-writing-task')!;
  mode.value = 'tools';
  mode.dispatchEvent(new Event('change'));
  const input = panel.querySelector<HTMLTextAreaElement>('.cui-input')!;
  const request = '  Insert exactly:\n  Alex  \n';
  input.value = request;
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await vi.waitFor(() => expect(state.toolPlan).toHaveBeenCalledOnce());
  expect(state.toolPlan.mock.calls[0][1]).toBe(request);
  expect(panel.querySelector('.cui-msg-user')?.textContent).toBe(request);
});

it('identifies model download failures and retries without exposing network internals', async () => {
  state.preload.mockRejectedValueOnce(new Error('Failed to fetch https://private-model.example/secret'));
  const panel = createPreparedPanel();
  await vi.waitFor(() =>
    expect(panel.querySelector('.cui-msg-error')?.textContent).toContain(t('agentModelLoadFailed')),
  );
  expect(panel.querySelector('.cui-msg-error')?.textContent).not.toContain('private-model');
  expect(panel.querySelector('.cui-msg-error')?.textContent).not.toContain(t('agentRequestFailed'));
  state.preload.mockImplementationOnce(async () => {
    state.ready = true;
  });
  panel.querySelector<HTMLElement>('.agent-panel-load')!.click();
  await vi.waitFor(() => expect(panel.querySelector('.agent-panel-note')?.textContent).toBe(t('agentModelLoaded')));
  expect(state.preload).toHaveBeenCalledTimes(2);
});

it('cancels native writing of the previous answer from the visible Stop button', async () => {
  state.toolContext = 'word';
  state.ready = true;
  state.editorReady = true;
  state.preload.mockResolvedValue(undefined);
  const panel = createPreparedPanel();
  const input = panel.querySelector<HTMLTextAreaElement>('.cui-input')!;
  createHistoryStorage().save([{ role: 'assistant', content: 'Document body', documentArtifact: true }]);
  panel.querySelector<HTMLButtonElement>('.agent-history-import')!.click();
  await vi.waitFor(() => expect(panel.querySelector('.cui-apply')).not.toBeNull());
  createHistoryStorage().clear();
  let finish!: () => void;
  let forwarded: AbortSignal | undefined;
  state.apply.mockImplementationOnce(
    (signal?: AbortSignal) =>
      new Promise<'verified'>((resolve, reject) => {
        forwarded = signal;
        finish = () => resolve('verified');
        signal?.addEventListener('abort', () => reject(signal.reason), { once: true });
      }),
  );
  input.value = '写到当前的文档上';
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await vi.waitFor(() => expect(state.apply).toHaveBeenCalledOnce());
  panel.querySelector<HTMLButtonElement>('.cui-send-stop')!.click();
  try {
    expect(forwarded).toBeInstanceOf(AbortSignal);
    expect(forwarded!.aborted).toBe(true);
    await vi.waitFor(() => expect(state.actionDispose).toHaveBeenCalledOnce());
    await vi.waitFor(() => expect(input.closest('.cui-root')!.querySelector('.cui-send-stop')).toBeNull());
    expect(panel.querySelector('.cui-msg-status')?.textContent).toContain(t('agentStopped'));
    expect(panel.querySelector('.cui-msg-status .cui-restore')).not.toBeNull();
    expect(panel.querySelector('.cui-msg-error')).toBeNull();
  } finally {
    finish();
  }
});

it('does not let late GPU progress replace CPU fallback progress', async () => {
  let finish!: () => void;
  state.preload.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const panel = createPreparedPanel();
  panel.querySelector<HTMLElement>('.agent-panel-load')!.click();
  await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
  try {
    state.backend?.('webllm');
    state.progress[0]({ text: 'GPU progress', progress: 0.7 });
    const progress = panel.querySelector<HTMLProgressElement>('.agent-model-progress')!;
    expect(progress.value).toBe(0.7);
    state.backend?.('wllama');
    expect(progress.hasAttribute('value')).toBe(false);
    state.cpuProgress?.({ loaded: 40, total: 100 });
    expect(progress.value).toBe(0.4);
    state.cpuProgress?.({ loaded: 100, total: 100 });
    expect(progress.hasAttribute('value')).toBe(false);
    expect(panel.querySelector('.agent-model-status')?.textContent).not.toContain('100%');
    state.progress[0]({ text: 'Late GPU progress', progress: 0.95 });
    expect(progress.hasAttribute('value')).toBe(false);
    expect(panel.querySelector('.agent-model-status')?.textContent).toContain(t('agentUseDevice'));
    expect(panel.querySelector('.agent-panel-note')?.textContent).not.toBe('Late GPU progress');
  } finally {
    finish();
  }
});

it('hides the redundant configure action when the model is ready, retaining settings access', async () => {
  state.ready = true;
  state.preload.mockResolvedValue(undefined);
  const panel = createPreparedPanel();
  await vi.waitFor(() => expect(panel.querySelector('.agent-panel-note')?.textContent).toBe(t('agentModelLoaded')));
  expect(panel.querySelector('.agent-configure')).toBeNull();
  expect(panel.querySelector<HTMLButtonElement>('.agent-panel-settings-toggle')!.hidden).toBe(false);
  const provider = panel.querySelector<HTMLSelectElement>('.agent-panel-provider')!;
  provider.value = 'wllama';
  provider.dispatchEvent(new Event('change'));
  expect(panel.querySelector('.agent-configure')).toBeNull();
});

it.each([
  ['Qwen3-1.7B-q4f16_1-MLC', 'Qwen3 · 1.7B'],
  ['my-custom-model-q4', 'my-custom-model-q4'],
])('shows a readable GPU label for %s while retaining the exact ID', async (id, _label) => {
  localStorage.setItem('agent-local-model-id', id);
  state.ready = true;
  state.preload.mockImplementation(async () => {
    state.backend?.('webllm');
  });
  const panel = createPreparedPanel();
  await vi.waitFor(() => expect(panel.querySelector('.agent-panel-note')?.textContent).toBe(t('agentModelLoaded')));
  const status = panel.querySelector<HTMLElement>('.agent-model-status')!;
  expect(status.textContent).toBe(t('agentUseDevice'));
  expect(status.title).toBe(id);
  localStorage.removeItem('agent-local-model-id');
});

it.each(['stop', 'new conversation', 'switch conversation'] as const)(
  'cancels the remaining write when %s occurs during a sequence read',
  async (interruption) => {
    state.ready = true;
    state.toolContext = 'cell';
    state.readText = 'A1:B4\nB2: "30"';
    let finishRead!: (value: string) => void;
    state.apply.mockImplementationOnce(
      () =>
        new Promise<string>((resolve) => {
          finishRead = resolve;
        }),
    );
    const panel = createPreparedPanel();
    const sessions = activeSession;
    const originalSession = sessions();
    if (interruption === 'switch conversation') {
      // History intentionally hides untouched drafts; the return target has prior content.
      state.conversations!.history().save([{ role: 'user', content: 'Previous conversation' }]);
      panel.querySelector<HTMLButtonElement>('.agent-panel-clear')!.click();
    }
    const operationSession = sessions();
    const mode = panel.querySelector<HTMLSelectElement>('.agent-writing-task')!;
    mode.value = 'tools';
    mode.dispatchEvent(new Event('change'));
    const input = panel.querySelector<HTMLTextAreaElement>('.cui-input')!;
    const request = '读取 A1:B4 的内容，然后将 B2 设置为 99。';
    input.value = request;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await vi.waitFor(() => expect(state.apply).toHaveBeenCalledOnce());
    const signal = state.apply.mock.calls[0][0] as AbortSignal;
    expect(signal.aborted).toBe(false);
    if (interruption === 'stop') panel.querySelector<HTMLButtonElement>('.cui-send-stop')!.click();
    else if (interruption === 'new conversation') panel.querySelector<HTMLButtonElement>('.agent-panel-clear')!.click();
    else {
      openSession(panel, originalSession);
    }
    expect(signal.aborted).toBe(true);
    // Simulate a read that finishes despite cancellation. The second action must still be suppressed.
    finishRead('sent');
    await vi.waitFor(() => expect(signal.aborted).toBe(true));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(state.apply).toHaveBeenCalledOnce();
    expect(state.toolPlan).not.toHaveBeenCalled();
    expect(panel.textContent).not.toContain(t('agentPlanVerified'));
    if (interruption !== 'stop') {
      if (interruption === 'switch conversation') {
        expect(panel.querySelector('.cui-msg-user')?.textContent).toBe('Previous conversation');
        expect(panel.querySelectorAll('.cui-activity, .cui-msg-status')).toHaveLength(0);
      } else expect(panel.querySelectorAll('.cui-msg-user, .cui-activity, .cui-msg-status')).toHaveLength(0);
      openSession(panel, operationSession);
    }
    expect(input.disabled).toBe(false);
    expect(panel.textContent).toContain(request);
    expect(panel.textContent).toContain(t('agentStopped'));
    expect(panel.textContent).toContain('B2: "30"');
  },
);

it('processes Stop after showing an immediate read result and before starting the write', async () => {
  state.ready = true;
  state.toolContext = 'cell';
  state.readText = 'A1:B4\nB2: "30"';
  const panel = createPreparedPanel();
  const observer = new MutationObserver(() => {
    if (!panel.querySelector('.cui-activity')?.textContent?.includes('B2: "30"')) return;
    observer.disconnect();
    panel.querySelector<HTMLButtonElement>('.cui-send-stop')!.click();
  });
  observer.observe(panel, { childList: true, subtree: true });
  try {
    const mode = panel.querySelector<HTMLSelectElement>('.agent-writing-task')!;
    mode.value = 'tools';
    mode.dispatchEvent(new Event('change'));
    const input = panel.querySelector<HTMLTextAreaElement>('.cui-input')!;
    input.value = '读取 A1:B4 的内容，然后将 B2 设置为 99。';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await vi.waitFor(() => expect(input.closest('.cui-root')!.querySelector('.cui-send-stop')).toBeNull());
    expect(state.apply).toHaveBeenCalledOnce();
    expect(panel.textContent).toContain(t('agentStopped'));
    expect(panel.textContent).not.toContain(t('agentPlanVerified'));
  } finally {
    observer.disconnect();
  }
});

it('retains the completed read and verification error without reporting sequence success', async () => {
  state.ready = true;
  state.toolContext = 'cell';
  state.readText = 'A1:B4\nB2: "30"';
  state.apply
    .mockResolvedValueOnce('sent')
    .mockRejectedValueOnce(new Error('The change could not be verified. Check the document and use Undo if needed.'));
  const panel = createPreparedPanel();
  const sessions = activeSession;
  const originalSession = sessions();
  const mode = panel.querySelector<HTMLSelectElement>('.agent-writing-task')!;
  mode.value = 'tools';
  mode.dispatchEvent(new Event('change'));
  const input = panel.querySelector<HTMLTextAreaElement>('.cui-input')!;
  input.value = '读取 A1:B4 的内容，然后将 B2 设置为 "00123"。';
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await vi.waitFor(() => expect(input.closest('.cui-root')!.querySelector('.cui-send-stop')).toBeNull());
  expect(state.apply).toHaveBeenCalledTimes(1);
  panel.querySelector<HTMLElement>('.agent-plan-apply')!.click();
  await vi.waitFor(() => expect(state.apply).toHaveBeenCalledTimes(2));
  await vi.waitFor(() =>
    expect(panel.querySelector('.agent-plan-status')?.textContent).toContain(t('agentPlanUnverified')),
  );
  const check = () => {
    expect(panel.querySelector('.cui-activity')?.textContent).toContain('B2: "30"');
    expect(panel.textContent).not.toContain(t('agentPlanVerified'));
    expect(panel.textContent).not.toContain(t('agentPlanVerified'));
  };
  check();
  panel.querySelector<HTMLButtonElement>('.agent-panel-clear')!.click();
  expect(panel.querySelector('.cui-msg-error')).toBeNull();
  openSession(panel, originalSession);
  check();
});

it('waits for the previous runtime to exit before loading the newly selected model', async () => {
  state.preload.mockResolvedValue(undefined);
  const panel = createPreparedPanel();
  (panel.querySelector('.agent-panel-load') as HTMLElement).click();
  await vi.waitFor(() => expect(state.preload).toHaveBeenCalledTimes(1));
  let finish!: () => void;
  state.dispose.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const model = panel.querySelector<HTMLSelectElement>('.agent-panel-model')!;
  model.dispatchEvent(new Event('change'));
  (panel.querySelector('.agent-panel-load') as HTMLElement).click();
  await Promise.resolve();
  expect(state.preload).toHaveBeenCalledTimes(1);
  finish();
  await vi.waitFor(() => expect(state.preload).toHaveBeenCalledTimes(2));
});

it('restores the preparation action after runtime cleanup without another input event', async () => {
  state.ready = true;
  state.preload.mockResolvedValue(undefined);
  const panel = createPreparedPanel();
  await vi.waitFor(() => expect(panel.querySelector('.agent-panel-load')?.textContent).toBe(t('agentModelInUse')));
  let finish!: () => void;
  state.dispose.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const input = panel.querySelector<HTMLTextAreaElement>('.cui-input')!;
  const send = panel.querySelector<HTMLButtonElement>('.cui-send')!;
  input.value = 'Hello';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  state.ready = false;
  panel.querySelector('.agent-panel-model')!.dispatchEvent(new Event('change'));
  await vi.waitFor(() => expect(send.textContent).toBe(t('agentModelReleasing')));
  expect(send.disabled).toBe(true);
  finish();
  await vi.waitFor(() => expect(send.disabled).toBe(false));
  expect(send.textContent).toBe(t('agentLoadModel'));
  expect(input.value).toBe('Hello');
  expect(panel.querySelector('.cui-msg-user')).toBeNull();
  expect(state.preload).toHaveBeenCalledOnce();
});

it('keeps a failed runtime exit from starting a replacement after further model changes', async () => {
  state.preload.mockResolvedValue(undefined);
  const panel = createPreparedPanel();
  (panel.querySelector('.agent-panel-load') as HTMLElement).click();
  await vi.waitFor(() => expect(state.preload).toHaveBeenCalledTimes(1));
  state.dispose.mockRejectedValueOnce(new Error('Worker exit failed'));
  const model = panel.querySelector<HTMLElement>('.agent-panel-model')!;
  model.dispatchEvent(new Event('change'));
  await Promise.resolve();
  model.dispatchEvent(new Event('change'));
  (panel.querySelector('.agent-panel-load') as HTMLElement).click();
  await vi.waitFor(() =>
    expect(panel.querySelector('.cui-msg-error')?.textContent).toContain(t('agentModelCleanupFailed')),
  );
  expect(state.preload).toHaveBeenCalledTimes(1);
  expect(state.dispose).toHaveBeenCalledTimes(1);
  model.dispatchEvent(new Event('change'));
  await Promise.resolve();
  await Promise.resolve();
  expect(panel.querySelector('.agent-panel-note')?.textContent).toBe(t('agentModelCleanupFailed'));
  const input = panel.querySelector<HTMLTextAreaElement>('.cui-input')!;
  input.value = 'hello';
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await Promise.resolve();
  expect(panel.querySelector('.agent-panel-note')?.textContent).toBe(t('agentModelCleanupFailed'));
});

it('does not load a superseded selection when runtime cleanup finishes', async () => {
  state.preload.mockResolvedValue(undefined);
  const panel = createPreparedPanel();
  (panel.querySelector('.agent-panel-load') as HTMLElement).click();
  await vi.waitFor(() => expect(state.preload).toHaveBeenCalledTimes(1));
  let finish!: () => void;
  state.dispose.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const model = panel.querySelector<HTMLElement>('.agent-panel-model')!;
  model.dispatchEvent(new Event('change'));
  (panel.querySelector('.agent-panel-load') as HTMLElement).click();
  model.dispatchEvent(new Event('change'));
  finish();
  await Promise.resolve();
  await Promise.resolve();
  expect(state.preload).toHaveBeenCalledTimes(1);
  (panel.querySelector('.agent-panel-load') as HTMLElement).click();
  await vi.waitFor(() => expect(state.preload).toHaveBeenCalledTimes(2));
});

it('shows preparation and allows stopping while the previous runtime is exiting', async () => {
  state.preload.mockResolvedValue(undefined);
  const panel = createPreparedPanel();
  (panel.querySelector('.agent-panel-load') as HTMLElement).click();
  await vi.waitFor(() => expect(state.preload).toHaveBeenCalledTimes(1));
  let finish!: () => void;
  state.dispose.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  panel.querySelector('.agent-panel-model')!.dispatchEvent(new Event('change'));
  const load = panel.querySelector<HTMLElement>('.agent-panel-load')!;
  load.click();
  const stop = panel.querySelector<HTMLElement>('.agent-panel-load-stop')!;
  expect(stop.hidden).toBe(false);
  expect(load.hasAttribute('disabled')).toBe(true);
  expect(panel.querySelector('.agent-model-status')?.textContent).toContain(t('agentPreparing'));
  expect(panel.querySelector<HTMLProgressElement>('.agent-model-progress')!.hidden).toBe(false);
  stop.click();
  expect(panel.querySelector('.agent-panel-note')?.textContent).toBe(t('agentStopped'));
  expect(load.hasAttribute('disabled')).toBe(false);
  finish();
  await Promise.resolve();
  await Promise.resolve();
  expect(state.preload).toHaveBeenCalledTimes(1);
  expect(state.dispose).toHaveBeenCalledTimes(1);
  expect(stop.hidden).toBe(true);
  load.click();
  await vi.waitFor(() => expect(state.preload).toHaveBeenCalledTimes(2));
});

it('clears loaded feedback when the engine becomes unavailable after chat has finished', async () => {
  state.ready = true;
  state.preload.mockImplementation(async () => state.backend?.('webllm'));
  const panel = createPreparedPanel();
  await vi.waitFor(() => expect(panel.querySelector('.agent-panel-note')?.textContent).toBe(t('agentModelLoaded')));
  const configure = panel.querySelector<HTMLButtonElement>('.agent-configure')!;
  const input = panel.querySelector<HTMLTextAreaElement>('.cui-input')!;
  input.value = 'Explain rain formation';
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await vi.waitFor(() => expect(panel.querySelector('.cui-msg-agent')?.textContent).toContain('answer'));
  await vi.waitFor(() => expect(input.closest('.cui-root')!.querySelector('.cui-send-stop')).toBeNull());
  expect(panel.querySelector('.agent-model-status')?.textContent).toContain(t('agentUseDevice'));
  state.ready = false;
  state.cached = false;
  state.editorKind = 'word';
  state.deleteCache.mockReset().mockResolvedValue(undefined);
  state.readonly = false;
  state.unavailable?.();
  expect(panel.querySelector('.agent-panel-note')?.textContent).toBe(t('agentLoadModel'));
  expect(panel.querySelector('.agent-model-status')?.textContent).toBe('');
  expect(configure).toBeNull();
  expect(panel.querySelector('.cui-msg-agent')?.textContent).toContain('answer');
});

it('ignores an unavailable notification from a replaced model', async () => {
  state.ready = true;
  state.preload.mockImplementation(async () => state.backend?.('webllm'));
  const panel = createPreparedPanel();
  await vi.waitFor(() => expect(panel.querySelector('.agent-panel-note')?.textContent).toBe(t('agentModelLoaded')));
  const previous = state.unavailable;
  expect(previous).toBeTypeOf('function');
  const model = panel.querySelector<HTMLSelectElement>('.agent-panel-model')!;
  model.value = 'Qwen3-4B-q4f16_1-MLC';
  model.dispatchEvent(new Event('change'));
  await vi.waitFor(() => expect(panel.querySelector<HTMLButtonElement>('.agent-panel-load')!.disabled).toBe(false));
  panel.querySelector<HTMLButtonElement>('.agent-panel-load')!.click();
  await vi.waitFor(() => expect(state.unavailable).not.toBe(previous));
  await vi.waitFor(() => expect(panel.querySelector('.agent-panel-note')?.textContent).toBe(t('agentModelLoaded')));
  const status = panel.querySelector('.agent-model-status')?.textContent;
  previous?.();
  expect(panel.querySelector('.agent-panel-note')?.textContent).toBe(t('agentModelLoaded'));
  expect(panel.querySelector('.agent-model-status')?.textContent).toBe(status);
});

it('ignores old loading progress after switching to a different task model', async () => {
  localStorage.clear();
  localStorage.setItem('agent-local-model-id', 'custom-model-q4');
  localStorage.setItem(
    'agent-task-models',
    JSON.stringify({ version: 1, tasks: { rewrite: { backend: 'webllm', model: 'Qwen3-4B-q4f16_1-MLC' } } }),
  );
  let complete: () => void = () => {};
  state.preload.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        complete = resolve;
      }),
  );
  const panel = createPreparedPanel();
  await vi.waitFor(() => expect(panel.querySelector('.agent-panel-load')?.hasAttribute('disabled')).toBe(true));
  const oldProgress = state.progress[0];
  const task = panel.querySelector<HTMLSelectElement>('.agent-writing-task')!;
  task.value = 'rewrite';
  task.dispatchEvent(new Event('change'));
  oldProgress({ text: 'Stale model progress', progress: 0.9 });
  complete();
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(panel.querySelector('.agent-panel-note')?.textContent).not.toBe('Stale model progress');
  expect(panel.querySelector('.agent-panel-note')?.textContent).not.toBe(t('agentModelLoaded'));
  expect(panel.querySelector('.agent-panel-load')?.hasAttribute('disabled')).toBe(false);
  localStorage.removeItem('agent-task-models');
  localStorage.removeItem('agent-local-model-id');
});

it('keeps endpoint keys isolated when switching cloud kinds', () => {
  const slot = 'agent_endpoint_key_';
  localStorage.setItem(slot + 'anthropic', 'anthropic-key');
  localStorage.setItem(slot + 'gemini', 'gemini-key');
  try {
    const panel = createPreparedPanel();
    const kind = panel.querySelector<HTMLSelectElement>('.agent-endpoint-kind')!;
    const key = panel.querySelector<HTMLInputElement>('.agent-panel-endpoint-key')!;
    kind.value = 'anthropic';
    kind.dispatchEvent(new Event('change'));
    expect(key.value).toBe('anthropic-key');
    kind.value = 'gemini';
    kind.dispatchEvent(new Event('change'));
    expect(key.value).toBe('gemini-key');
    expect(getEndpointKey('anthropic')).toBe('anthropic-key');
  } finally {
    localStorage.removeItem(slot + 'anthropic');
    localStorage.removeItem(slot + 'gemini');
  }
});

it('discards a pending endpoint connection after its destination changes', async () => {
  let finish!: (response: Response) => void;
  const fetchMock = vi.fn(
    () =>
      new Promise<Response>((resolve) => {
        finish = resolve;
      }),
  );
  vi.stubGlobal('fetch', fetchMock);
  try {
    const panel = createPreparedPanel();
    const model = panel.querySelector<HTMLInputElement>('.agent-panel-endpoint-model')!;
    model.value = 'old-model';
    model.dispatchEvent(new Event('change'));
    const connect = panel.querySelector<HTMLButtonElement>('.agent-panel-endpoint-connect')!;
    connect.click();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    model.value = 'new-model';
    model.dispatchEvent(new Event('change'));
    finish(new Response(JSON.stringify({ models: [{ name: 'old-model' }] })));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(connect.textContent).toBe(t('agentEndpointConnect'));
    expect(panel.querySelector('.agent-panel-write-destination')?.textContent).toContain(
      t('agentWriteNeedsDestination'),
    );
  } finally {
    vi.unstubAllGlobals();
  }
});

it.each([
  ['Unavailable', 'agentEndpointFailed'],
  ['Failed to fetch', 'agentServiceNetworkFailed'],
] as const)('keeps actionable endpoint connection guidance for %s visible in settings', async (reason, key) => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error(reason)));
  try {
    const panel = createPreparedPanel();
    const model = panel.querySelector<HTMLInputElement>('.agent-panel-endpoint-model')!;
    model.value = 'model';
    model.dispatchEvent(new Event('change'));
    panel.querySelector<HTMLButtonElement>('.agent-panel-endpoint-connect')!.click();
    await vi.waitFor(() => expect(panel.querySelector('.agent-panel-note')?.textContent).toBe(t(key)));
    expect(panel.querySelector('.agent-panel-endpoint-status')?.textContent).toBe(t(key));
  } finally {
    vi.unstubAllGlobals();
  }
});

it('generates copyable writing in read-only mode without creating a write action', async () => {
  state.ready = true;
  state.readonly = true;
  state.editorReady = true;
  state.editorReady = true;
  state.source = 'Original';
  state.writing.mockResolvedValue('Copyable suggestion');
  allowBrowserLocalWriting();
  const panel = createPreparedPanel();
  const task = panel.querySelector<HTMLSelectElement>('.agent-writing-task')!;
  task.value = 'rewrite';
  task.dispatchEvent(new Event('change'));
  const input = panel.querySelector<HTMLTextAreaElement>('.cui-input')!;
  input.value = 'Simplify';
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await vi.waitFor(() => expect(panel.querySelector('.cui-msg-agent')?.textContent).toContain('Copyable suggestion'));
  expect(panel.querySelector('.agent-plan-apply')).toBeNull();
  expect(panel.querySelector('.cui-apply')).toBeNull();
  expect(panel.querySelector('.cui-copy')).not.toBeNull();
  expect(state.apply).not.toHaveBeenCalled();
});

it.each(['word', 'cell', 'slide'] as const)(
  'naturally routes a rewrite with %s selection into a reviewable proposal',
  async (kind) => {
    state.ready = true;
    state.editorReady = true;
    state.editorKind = kind;
    state.source = 'Original selected text';
    state.writing.mockResolvedValue('Refined selected text');
    allowBrowserLocalWriting();
    const panel = createPreparedPanel();
    const input = panel.querySelector<HTMLTextAreaElement>('.cui-input')!;
    input.value = 'Rewrite selected text clearly';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await vi.waitFor(() =>
      expect(panel.querySelector('.agent-plan-content')?.textContent).toBe('Refined selected text'),
    );
    expect(state.writing.mock.calls[0][1]).toMatchObject({ task: 'rewrite', text: state.source });
    expect(state.apply).not.toHaveBeenCalled();
    panel.querySelector<HTMLElement>('.agent-plan-apply')!.click();
    await vi.waitFor(() => expect(state.apply).toHaveBeenCalledOnce());
  },
);
it('requires confirmation and completed unload before deleting the running cached model', async () => {
  state.ready = true;
  state.cached = true;
  const panel = createPreparedPanel();
  await vi.waitFor(() => expect(panel.querySelector('.agent-panel-note')?.textContent).toBe(t('agentModelLoaded')));
  await vi.waitFor(() => expect(panel.querySelector('.agent-cache-delete')).not.toBeNull());
  const remove = panel.querySelector<HTMLElement>('.agent-cache-delete')!;
  remove.click();
  expect(state.deleteCache).not.toHaveBeenCalled();
  let release!: () => void;
  state.dispose.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
  );
  remove.click();
  await Promise.resolve();
  expect(state.deleteCache).not.toHaveBeenCalled();
  release();
  await vi.waitFor(() => expect(state.deleteCache).toHaveBeenCalledOnce());
});
it('does not delete caches when runtime unload fails', async () => {
  state.ready = true;
  state.cached = true;
  const panel = createPreparedPanel();
  await vi.waitFor(() => expect(panel.querySelector('.agent-panel-note')?.textContent).toBe(t('agentModelLoaded')));
  await vi.waitFor(() => expect(panel.querySelector('.agent-cache-delete')).not.toBeNull());
  state.dispose.mockRejectedValueOnce(new Error('unload failed'));
  const remove = panel.querySelector<HTMLElement>('.agent-cache-delete')!;
  remove.click();
  remove.click();
  await vi.waitFor(() =>
    expect(panel.querySelector('.agent-model-cache')?.textContent).toContain(t('agentModelCleanupFailed')),
  );
  expect(state.deleteCache).not.toHaveBeenCalled();
});

it('marks a loaded local model ready and prevents redundant loading', async () => {
  state.preload.mockImplementation(async () => {
    state.ready = true;
  });
  const panel = createPreparedPanel();
  const button = panel.querySelector<HTMLElement>('.agent-panel-load')!;
  await vi.waitFor(() => expect(state.preload).toHaveBeenCalledOnce());
  await vi.waitFor(() => expect(button.textContent).toBe(t('agentModelInUse')));
  expect(button.hasAttribute('disabled')).toBe(true);
  button.click();
  expect(state.preload).toHaveBeenCalledOnce();
});
it('allows the main button to warm a cached model in a new spreadsheet page', async () => {
  state.cached = true;
  state.editorKind = 'cell';
  state.preload.mockImplementation(async () => {
    state.ready = true;
  });
  const panel = createPreparedPanel();
  await vi.waitFor(() => expect(state.preload).toHaveBeenCalledOnce());
  expect(panel.querySelector('.agent-panel-load')!.textContent).toBe(t('agentModelInUse'));
});
it('warms a downloaded model directly from chat, preserving the draft without sending it', async () => {
  state.cached = true;
  localStorage.setItem('agent-local-preset', 'Qwen3-4B-q4f16_1-MLC');
  state.preload.mockImplementation(async () => {
    state.ready = true;
  });
  const panel = createAgentPanel({ externalEntry: true });
  const input = panel.querySelector<HTMLTextAreaElement>('.cui-input')!;
  input.value = 'Keep my request';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  const resume = panel.querySelector<HTMLButtonElement>('.agent-prepare-action');
  expect(resume).not.toBeNull();
  await vi.waitFor(() => expect(resume!.textContent).toBe(t('agentResumeModel')));
  resume!.click();
  resume!.click();
  await vi.waitFor(() => expect(panel.querySelector('.agent-panel-load')?.textContent).toBe(t('agentModelInUse')));
  expect(state.preload).toHaveBeenCalledOnce();
  expect(panel.dataset.view).toBe('chat');
  expect(input.value).toBe('Keep my request');
  expect(state.generate).not.toHaveBeenCalled();
});

it.each(['给选中的文字进行润色', '润色选中的文字', 'Hello', 'Polish the selected text'])(
  'offers model preparation consistently for %s',
  async (request) => {
    allowBrowserLocalWriting();
    state.cached = true;
    state.editorReady = true;
    state.source = 'Selected text';
    state.semanticResponse = '{"task":"chat","language":"en"}';
    localStorage.setItem('agent-local-preset', 'Qwen3-4B-q4f16_1-MLC');
    let release!: () => void;
    state.preload.mockImplementation(async () => {
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      state.ready = true;
    });
    const panel = createAgentPanel({ externalEntry: true });
    const input = panel.querySelector<HTMLTextAreaElement>('.cui-input')!;
    input.value = request;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    const send = panel.querySelector<HTMLButtonElement>('.cui-send')!;
    await vi.waitFor(() => expect(send.textContent).toBe(t('agentResumeModel')));
    expect(send.disabled).toBe(false);
    send.click();
    try {
      await vi.waitFor(() => expect(state.preload).toHaveBeenCalledOnce());
      expect(input.value).toBe(request);
      expect(send.disabled).toBe(true);
      expect(panel.querySelector('.cui-msg-user')).toBeNull();
    } finally {
      release?.();
      await vi.waitFor(() => expect(send.disabled).toBe(false));
      await vi.waitFor(() => expect(send.getAttribute('aria-label')).toBe(t('agentSend')));
    }
    expect(panel.querySelector('.cui-msg-user')).toBeNull();
    send.click();
    await vi.waitFor(() => expect(panel.querySelector('.cui-msg-agent .cui-bubble')?.textContent).toBe('answer'));
    expect(panel.querySelectorAll('.cui-msg-user')).toHaveLength(1);
  },
);
it('reconnects a remembered service directly from chat without submitting a draft', async () => {
  localStorage.setItem(
    'agent-writing-endpoint',
    JSON.stringify({ version: 1, kind: 'loopback', baseUrl: 'http://localhost:11434', model: 'model' }),
  );
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ models: [{ name: 'model' }] })));
  vi.stubGlobal('fetch', fetchMock);
  try {
    const panel = createAgentPanel({ externalEntry: true });
    const input = panel.querySelector<HTMLTextAreaElement>('.cui-input')!;
    input.value = 'Unsent draft';
    const resume = panel.querySelector<HTMLButtonElement>('.agent-prepare-action');
    expect(resume).not.toBeNull();
    expect(resume!.textContent).toBe(t('agentReconnectService'));
    resume!.click();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(panel.dataset.view).toBe('chat');
    expect(input.value).toBe('Unsent draft');
    expect(fetchMock.mock.calls[0][0]).toContain('/tags');
  } finally {
    vi.unstubAllGlobals();
  }
});
it('uses one advanced disclosure and no extra disclosure for the chosen service form', () => {
  const panel = createAgentPanel();
  expect(panel.querySelector('.agent-service-section')?.tagName).not.toBe('DETAILS');
  expect(panel.querySelector('.agent-preferences details')).toBeNull();
});

it('keeps the prepared model when the editor changes in the same page', async () => {
  state.cached = true;
  state.preload.mockImplementation(async () => {
    state.ready = true;
  });
  const panel = createPreparedPanel();
  await vi.waitFor(() => expect(panel.querySelector('.agent-panel-load')!.textContent).toBe(t('agentModelInUse')));
  state.editorKind = 'cell';
  window.dispatchEvent(new Event('document:content-ready'));
  expect(state.dispose).not.toHaveBeenCalled();
  expect(state.preload).toHaveBeenCalledOnce();
  await vi.waitFor(() => expect(panel.querySelector('.agent-cache-use')!.textContent).toBe(t('agentModelInUse')));
  const use = panel.querySelector<HTMLElement>('.agent-cache-use')!;
  expect(use.hasAttribute('disabled')).toBe(true);
  use.click();
  expect(state.preload).toHaveBeenCalledOnce();
  expect(state.dispose).not.toHaveBeenCalled();
});
it('lets a ready semantic planner handle a slide request outside the fixed shortcut grammar', async () => {
  state.ready = true;
  state.editorReady = true;
  state.editorKind = 'slide';
  state.routing.mockResolvedValue({ task: 'tools', language: 'zh-CN' });
  const panel = createAgentPanel();
  const kind = panel.querySelector<HTMLSelectElement>('.agent-endpoint-kind')!;
  kind.value = 'openai-compatible';
  kind.dispatchEvent(new Event('change'));
  for (const [selector, value] of [
    ['.agent-panel-endpoint-url', 'https://api.example.com/v1'],
    ['.agent-panel-endpoint-model', 'gpt-4o-mini'],
    ['.agent-panel-endpoint-key', 'sk-test'],
  ]) {
    const field = panel.querySelector<HTMLInputElement>(selector)!;
    field.value = value;
    field.dispatchEvent(new Event('change'));
  }
  panel.querySelector<HTMLButtonElement>('.agent-panel-endpoint-connect')!.click();
  const input = panel.querySelector<HTMLTextAreaElement>('.cui-input')!;
  await vi.waitFor(() => expect(input.closest('.cui-root')!.querySelector('.cui-send-stop')).toBeNull());
  input.value = '在当前幻灯片新增文本框，内容为：秋天的故事';
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await vi.waitFor(() => expect(state.routing).toHaveBeenCalled());
  await vi.waitFor(() => expect(state.toolPlan).toHaveBeenCalled());
  expect(panel.textContent).not.toContain('请明确操作范围');
});

it('sends current-editor native tools and displays a proposal without executing it', async () => {
  state.nativeEndpoint = true;
  state.editorReady = true;
  state.editorKind = 'slide';
  state.toolContext = 'slide';
  const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    const native = body.tools?.length;
    return new Response(
      JSON.stringify({
        choices: [
          {
            message: native
              ? {
                  content: null,
                  tool_calls: [
                    {
                      id: 'native-1',
                      type: 'function',
                      function: {
                        name: 'add_slide_text',
                        arguments: JSON.stringify({ text: 'Native slide text' }),
                      },
                    },
                  ],
                }
              : { content: 'connected' },
            finish_reason: native ? 'tool_calls' : 'stop',
          },
        ],
      }),
    );
  });
  vi.stubGlobal('fetch', fetchMock);
  try {
    const panel = createAgentPanel();
    const kind = panel.querySelector<HTMLSelectElement>('.agent-endpoint-kind')!;
    kind.value = 'openai-compatible';
    kind.dispatchEvent(new Event('change'));
    for (const [selector, value] of [
      ['.agent-panel-endpoint-url', 'https://api.example.com/v1'],
      ['.agent-panel-endpoint-model', 'tool-model'],
      ['.agent-panel-endpoint-key', 'sk-test'],
    ]) {
      const field = panel.querySelector<HTMLInputElement>(selector)!;
      field.value = value;
      field.dispatchEvent(new Event('change'));
    }
    const connect = panel.querySelector<HTMLButtonElement>('.agent-panel-endpoint-connect')!;
    connect.click();
    await vi.waitFor(() => expect(connect.textContent).toBe(t('agentEndpointDisconnect')));
    const input = panel.querySelector<HTMLTextAreaElement>('.cui-input')!;
    const mode = panel.querySelector<HTMLSelectElement>('.agent-writing-task')!;
    mode.value = 'tools';
    mode.dispatchEvent(new Event('change'));
    input.value = 'Put a title on this slide';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await vi.waitFor(() => expect(panel.querySelector('.agent-plan-apply')).not.toBeNull());
    await vi.waitFor(() => expect(input.closest('.cui-root')!.querySelector('.cui-send-stop')).not.toBeNull());
    const request = fetchMock.mock.calls
      .map(([, init]) => JSON.parse(String(init.body)))
      .find((body) => body.tools?.length);
    expect(request.tools.some((tool: { function: { name: string } }) => tool.function.name === 'add_slide_text')).toBe(
      true,
    );
    expect(request.tools.some((tool: { function: { name: string } }) => tool.function.name === 'set_cell')).toBe(false);
    expect(state.apply).not.toHaveBeenCalled();
    expect(state.toolPlan).not.toHaveBeenCalled();
    expect(state.routing).not.toHaveBeenCalled();
    panel.querySelector<HTMLElement>('.agent-plan-apply')!.click();
    await vi.waitFor(() => expect(state.apply).toHaveBeenCalledOnce());
  } finally {
    vi.unstubAllGlobals();
  }
});
it('requires review for a model-selected numeric fill even if the target is empty', async () => {
  state.ready = true;
  state.editorReady = true;
  state.editorKind = 'cell';
  state.toolContext = 'cell';
  state.routing.mockResolvedValue({ task: 'tools', language: 'en' });
  state.toolPlan.mockResolvedValue({ tool: 'fill_series', input: { cell: 'A1', first: 1, last: 10 }, readOnly: false });
  const panel = createPreparedPanel();
  const mode = panel.querySelector<HTMLSelectElement>('.agent-writing-task')!;
  mode.value = 'tools';
  mode.dispatchEvent(new Event('change'));
  const input = panel.querySelector<HTMLTextAreaElement>('.cui-input')!;
  await vi.waitFor(() => expect(input.closest('.cui-root')!.querySelector('.cui-send-stop')).toBeNull());
  input.value = 'Create a numeric series';
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await vi.waitFor(() => expect(panel.querySelector('.agent-plan-apply')).not.toBeNull());
  expect(state.apply).not.toHaveBeenCalled();
  panel.querySelector<HTMLElement>('.agent-plan-apply')!.click();
  await vi.waitFor(() => expect(state.apply).toHaveBeenCalledOnce());
});

it('preserves a failed routing request and lets the next Excel question start fresh', async () => {
  state.ready = true;
  state.editorReady = true;
  state.editorKind = 'cell';
  state.toolContext = 'cell';
  state.semanticResponse = '{"task":"compose","language":"en"}';
  const panel = createPreparedPanel();
  const input = panel.querySelector<HTMLTextAreaElement>('.cui-input')!;
  await vi.waitFor(() => expect(input.closest('.cui-root')!.querySelector('.cui-send-stop')).toBeNull());
  input.value = 'Explain the available editing features';
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await vi.waitFor(() => expect(panel.querySelector('.cui-msg-error')).not.toBeNull());
  expect(panel.querySelectorAll('.cui-msg-user')).toHaveLength(0);
  expect(panel.querySelector('.agent-queue-text')?.textContent).toBe('Explain the available editing features');
  expect(state.conversations!.history().load()).toEqual([]);
  panel.querySelector<HTMLButtonElement>('.agent-queue-remove')!.click();
  expect(panel.querySelector('.cui-msg-error')?.textContent).not.toContain(t('agentWordOnly'));
  expect(state.apply).not.toHaveBeenCalled();
  state.semanticResponse = '{"task":"chat","language":"en"}';
  input.value = '你好';
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await vi.waitFor(() => expect(panel.querySelector('.cui-msg-agent .cui-bubble')?.textContent).toBe('answer'));
  expect(panel.querySelectorAll('.cui-msg-user')).toHaveLength(1);
  expect(panel.querySelectorAll('.cui-msg-error')).toHaveLength(1);
  expect(state.apply).not.toHaveBeenCalled();
});

it('preserves an unexecuted suggestion after stopping refinement and ignores a late replacement', async () => {
  state.ready = true;
  state.editorReady = true;
  state.routing.mockResolvedValue({ task: 'tools', language: 'en' });
  state.toolPlan.mockResolvedValueOnce({ tool: 'add_slide_text', input: { text: 'Original draft' }, readOnly: false });
  let resolve!: (plan: unknown) => void;
  const late = new Promise((done) => {
    resolve = done;
  });
  state.toolPlan.mockReturnValueOnce(late);
  const panel = createPreparedPanel();
  document.body.append(panel);
  const input = panel.querySelector<HTMLTextAreaElement>('.cui-input')!;
  input.value = 'Add text to the slide';
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await vi.waitFor(() => expect(panel.querySelector('.agent-plan-preview[data-state=pending]')).not.toBeNull());
  const original = panel.querySelector<HTMLElement>('.agent-plan-preview')!;
  original.querySelector<HTMLElement>('.agent-plan-refine')!.click();
  await vi.waitFor(() => expect(panel.querySelector('.cui-send-stop')).toBeNull());
  input.value = 'Shorten this suggestion';
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await vi.waitFor(() => expect(state.toolPlan).toHaveBeenCalledTimes(2));
  const signal = state.toolPlan.mock.calls[1][3] as AbortSignal;
  panel.querySelector<HTMLElement>('.cui-send-stop')!.click();
  expect(signal.aborted).toBe(true);
  resolve({ tool: 'add_slide_text', input: { text: 'Late replacement' }, readOnly: false });
  await vi.waitFor(() => expect(original.hasAttribute('aria-busy')).toBe(false));
  expect(original.dataset.state).toBe('pending');
  expect(original.querySelector('.agent-plan-apply')?.hasAttribute('disabled')).toBe(false);
  expect(panel.querySelectorAll('.agent-plan-preview')).toHaveLength(1);
  expect(panel.textContent).not.toContain('Late replacement');
  expect(state.apply).not.toHaveBeenCalled();
});

it('does not claim an unchanged suggestion is available after the document changes during refinement', async () => {
  state.ready = true;
  state.editorReady = true;
  state.routing.mockResolvedValue({ task: 'tools', language: 'en' });
  state.toolPlan.mockResolvedValueOnce({ tool: 'add_slide_text', input: { text: 'Original draft' }, readOnly: false });
  let reject!: (error: Error) => void;
  state.toolPlan.mockReturnValueOnce(
    new Promise((_done, fail) => {
      reject = fail;
    }),
  );
  const panel = createPreparedPanel();
  document.body.append(panel);
  const input = panel.querySelector<HTMLTextAreaElement>('.cui-input')!;
  input.value = 'Add text to the slide';
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await vi.waitFor(() => expect(panel.querySelector('.agent-plan-preview[data-state=pending]')).not.toBeNull());
  panel.querySelector<HTMLElement>('.agent-plan-refine')!.click();
  await vi.waitFor(() => expect(panel.querySelector('.cui-send-stop')).toBeNull());
  input.value = 'Shorten this suggestion';
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await vi.waitFor(() => expect(state.toolPlan).toHaveBeenCalledTimes(2));
  state.targetCurrent = false;
  reject(new Error('agentProposalUnchanged'));
  await vi.waitFor(() => expect(input.closest('.cui-root')!.querySelector('.cui-send-stop')).toBeNull());
  expect(panel.textContent).not.toContain(t('agentProposalUnchanged'));
  expect(panel.textContent).toContain(t('agentPlanExpired'));
  expect(panel.querySelector('.agent-plan-preview')?.getAttribute('data-state')).toBe('expired');
  expect(state.apply).not.toHaveBeenCalled();
});

it.each(['chat', 'tools'] as const)('keeps connected-service readiness accurate in %s mode', async (mode) => {
  const panel = createAgentPanel();
  const kind = panel.querySelector<HTMLSelectElement>('.agent-endpoint-kind')!;
  kind.value = 'openai-compatible';
  kind.dispatchEvent(new Event('change'));
  const url = panel.querySelector<HTMLInputElement>('.agent-panel-endpoint-url')!;
  const model = panel.querySelector<HTMLInputElement>('.agent-panel-endpoint-model')!;
  const key = panel.querySelector<HTMLInputElement>('.agent-panel-endpoint-key')!;
  url.value = 'https://api.example.com/v1';
  url.dispatchEvent(new Event('change'));
  model.value = 'probe';
  model.dispatchEvent(new Event('change'));
  key.value = 'synthetic-key';
  key.dispatchEvent(new Event('change'));
  const task = panel.querySelector<HTMLSelectElement>('.agent-writing-task')!;
  task.value = mode;
  task.dispatchEvent(new Event('change'));
  const connect = panel.querySelector<HTMLElement>('.agent-panel-endpoint-connect')!;
  connect.click();
  await vi.waitFor(() => expect(connect.textContent).toBe(t('agentEndpointDisconnect')));
  const readiness = panel.querySelector('.agent-readiness [role="status"]')!;
  expect(readiness.textContent).toBe('');
  const input = panel.querySelector<HTMLTextAreaElement>('.cui-input')!;
  input.value = 'Hello';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  expect(panel.querySelector('.cui-send')?.hasAttribute('disabled')).toBe(false);
  Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
  window.dispatchEvent(new Event('offline'));
  expect(readiness.textContent).toBe(t('agentOfflineFeaturesHint'));
  expect(panel.querySelector('.cui-send')?.hasAttribute('disabled')).toBe(true);
  expect(panel.querySelector('.agent-panel-write-destination')?.textContent).toContain(
    t('agentWriteDestinationOfflineUnavailable'),
  );
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
  window.dispatchEvent(new Event('online'));
  expect(readiness.textContent).toBe('');
  connect.click();
  expect(readiness.textContent).toBe(t('agentPrepareRequired'));
  expect(panel.querySelector('.agent-panel-write-destination')?.textContent).not.toContain(
    t('agentWriteDestinationDevice'),
  );
});
it('keeps a connected local service available for editing while offline', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ models: [{ name: 'probe' }] }))),
  );
  try {
    const panel = createAgentPanel();
    const model = panel.querySelector<HTMLInputElement>('.agent-panel-endpoint-model')!;
    model.value = 'probe';
    model.dispatchEvent(new Event('change'));
    const task = panel.querySelector<HTMLSelectElement>('.agent-writing-task')!;
    task.value = 'tools';
    task.dispatchEvent(new Event('change'));
    const connect = panel.querySelector<HTMLElement>('.agent-panel-endpoint-connect')!;
    connect.click();
    await vi.waitFor(() => expect(connect.textContent).toBe(t('agentEndpointDisconnect')));
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    window.dispatchEvent(new Event('offline'));
    expect(panel.querySelector('.agent-readiness')?.textContent).toBe('');
    expect(panel.querySelector('.agent-panel-write-destination')?.textContent).toContain(
      t('agentWriteDestinationDevice'),
    );
  } finally {
    vi.unstubAllGlobals();
  }
});

it('keeps retired model downloads removable without offering to use them', async () => {
  state.cached = true;
  state.cachedModel = 'Qwen3-1.7B-q4f16_1-MLC';
  const panel = createAgentPanel();
  await vi.waitFor(() => expect(panel.querySelector('.agent-cache-delete')).not.toBeNull());
  const row = panel.querySelector<HTMLElement>('.agent-model-cache-row')!;
  expect(row.textContent).toContain('Qwen3 · 1.7B');
  expect(row.querySelector('.agent-cache-use')).toBeNull();
  const remove = row.querySelector<HTMLElement>('.agent-cache-delete')!;
  remove.click();
  expect(state.deleteCache).not.toHaveBeenCalled();
  remove.click();
  await vi.waitFor(() => expect(state.deleteCache).toHaveBeenCalledWith('Qwen3-1.7B-q4f16_1-MLC', {}));
  expect(state.preload).not.toHaveBeenCalled();
});

it('retains the use and delete actions for a cached custom CPU model', async () => {
  state.cpuCached = true;
  const panel = createAgentPanel();
  await vi.waitFor(() => expect(panel.querySelector('.agent-model-cache-row')).not.toBeNull());
  const row = panel.querySelector<HTMLElement>('.agent-model-cache-row')!;
  expect(row.textContent).toContain('cpu-model.gguf');
  expect(row.querySelector('.agent-cache-use')?.textContent).toBe(t('agentUseModel'));
  expect(row.querySelector('.agent-cache-use')?.hasAttribute('disabled')).toBe(false);
  expect(row.querySelector('.agent-cache-delete')).not.toBeNull();
});

it.each(['cancel', 'target'] as const)('discards a late grounded answer after %s changes', async (change) => {
  state.ready = true;
  state.readText = 'Budget is 120';
  state.toolPlan.mockResolvedValue({ tool: 'get_presentation_text', input: {}, readOnly: true });
  let finish!: (text: string) => void;
  state.readAnswer.mockImplementation(
    () =>
      new Promise<string>((resolve) => {
        finish = resolve;
      }),
  );
  const panel = createPreparedPanel();
  const mode = panel.querySelector<HTMLSelectElement>('.agent-writing-task')!;
  mode.value = 'tools';
  mode.dispatchEvent(new Event('change'));
  const input = panel.querySelector<HTMLTextAreaElement>('.cui-input')!;
  input.value = 'Read this presentation';
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await vi.waitFor(() => expect(state.readAnswer).toHaveBeenCalled());
  if (change === 'target') state.targetCurrent = false;
  else panel.querySelector<HTMLButtonElement>('.cui-send-stop')!.click();
  finish('LATE ANSWER');
  await vi.waitFor(() => expect(input.closest('.cui-root')!.querySelector('.cui-send-stop')).toBeNull());
  expect(panel.textContent).not.toContain('LATE ANSWER');
  expect(state.apply).toHaveBeenCalledTimes(1);
});

it('shows the grounded answer without leading model reasoning protocol', async () => {
  state.ready = true;
  state.readText = 'Budget is 120';
  state.toolPlan.mockResolvedValue({ tool: 'get_presentation_text', input: {}, readOnly: true });
  state.readAnswer.mockResolvedValue('<think>\n\n</think>\n120');
  const panel = createPreparedPanel();
  const mode = panel.querySelector<HTMLSelectElement>('.agent-writing-task')!;
  mode.value = 'tools';
  mode.dispatchEvent(new Event('change'));
  const input = panel.querySelector<HTMLTextAreaElement>('.cui-input')!;
  input.value = 'Read this presentation';
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await vi.waitFor(() => expect(input.closest('.cui-root')!.querySelector('.cui-send-stop')).toBeNull());
  expect(panel.querySelector('.cui-msg-agent .cui-bubble')?.textContent).toBe('120');
});

it('preserves external focus and the next draft when a grounded response completes', async () => {
  state.ready = true;
  state.readText = 'Budget is 120';
  state.toolPlan.mockResolvedValue({ tool: 'get_presentation_text', input: {}, readOnly: true });
  let finish!: (text: string) => void;
  state.readAnswer.mockImplementation(
    () =>
      new Promise<string>((resolve) => {
        finish = resolve;
      }),
  );
  const panel = createPreparedPanel();
  const mode = panel.querySelector<HTMLSelectElement>('.agent-writing-task')!;
  mode.value = 'tools';
  mode.dispatchEvent(new Event('change'));
  const input = panel.querySelector<HTMLTextAreaElement>('.cui-input')!;
  input.value = 'Read this presentation';
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await vi.waitFor(() => expect(state.readAnswer).toHaveBeenCalled());
  expect(input.disabled).toBe(false);
  expect(panel.querySelector('.cui-status')?.textContent).toBe(t('agentWaiting'));
  input.value = 'My next request';
  input.dispatchEvent(new Event('input'));
  const external = document.createElement('button');
  external.textContent = 'Document action';
  document.body.append(external);
  external.focus();
  finish('120');
  await vi.waitFor(() => expect(panel.querySelector('.cui-send-stop')).toBeNull());
  expect(input.value).toBe('My next request');
  expect(document.activeElement).toBe(external);
});

it('keeps validation pending before routing completes and accepts the answer request exactly once', async () => {
  state.ready = true;
  state.semanticResponse = '{"task":"chat","language":"en"}';
  let finish!: () => void;
  state.semanticGate = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const panel = createPreparedPanel();
  const input = panel.querySelector<HTMLTextAreaElement>('.cui-input')!;
  input.value = 'Tell me a brief story';
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  try {
    expect(panel.querySelectorAll('.cui-msg-user')).toHaveLength(0);
    expect(panel.querySelector('.agent-queue-text')?.textContent).toBe('Tell me a brief story');
    expect(panel.querySelector('.cui-status')?.textContent).toBe(t('agentRoutingRequest'));
    expect(input.value).toBe('');
  } finally {
    finish();
    await vi.waitFor(() => expect(panel.querySelector('.cui-send-stop')).toBeNull());
  }
  expect(panel.querySelectorAll('.cui-msg-user')).toHaveLength(1);
  expect(panel.querySelector('.cui-msg-agent .cui-bubble')?.textContent).toBe('answer');
});

it('does not show classification for a trusted staged task that skips the routing model', async () => {
  allowBrowserLocalWriting();
  state.ready = true;
  // Expose real routing capability so this exercises the staged-intent branch,
  // rather than passing because the fixture has no classification method.
  state.semanticResponse = '{"task":"rewrite","language":"en"}';
  state.editorReady = true;
  state.source = 'Original selected text';
  let finish!: (text: string) => void;
  state.writing.mockImplementation(() => new Promise<string>((resolve) => (finish = resolve)));
  const activity = vi.spyOn(ChatView.prototype, 'setActivity');
  const panel = createPreparedPanel();
  try {
    panel.querySelector<HTMLButtonElement>('[data-task="polish"]')!.click();
    panel.querySelector<HTMLButtonElement>('.cui-send')!.click();
    await vi.waitFor(() => expect(state.writing).toHaveBeenCalledOnce());
    expect(state.routing).not.toHaveBeenCalled();
    expect(activity).not.toHaveBeenCalledWith('routing');
    expect(panel.querySelector('.cui-status')?.textContent).toBe(t('agentWaiting'));
    expect(panel.querySelector('.cui-elapsed')?.textContent).toBe(t('agentWaitElapsed', { seconds: 0 }));
  } finally {
    finish?.('Polished text');
    await vi.waitFor(() => expect(panel.querySelector('.cui-send-stop')).toBeNull());
    activity.mockRestore();
  }
});

it('ends planning feedback on visible direct task text without requiring a tool result', async () => {
  state.ready = true;
  state.semanticResponse = '{"task":"tools","language":"en"}';
  let emit!: (text: string) => void;
  let finish!: (text: string) => void;
  state.directTaskAnswer = (delta) => {
    emit = delta!;
    return new Promise<string>((resolve) => (finish = resolve));
  };
  const panel = createPreparedPanel();
  const input = panel.querySelector<HTMLTextAreaElement>('.cui-input')!;
  input.value = 'Explain what should happen next in this presentation.';
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  try {
    await vi.waitFor(() => expect(emit).toBeDefined());
    emit('<think>Internal reasoning');
    expect(panel.querySelector('.cui-root')?.getAttribute('data-activity')).toBe('planning');
    expect(panel.querySelector('.cui-msg-agent')).toBeNull();
    expect(panel.querySelector<HTMLElement>('.cui-progress')?.hidden).toBe(false);
    emit('</think>Direct useful answer');
    await vi.waitFor(() =>
      expect(panel.querySelector('.cui-msg-agent .cui-bubble')?.textContent).toBe('Direct useful answer'),
    );
    expect(panel.querySelector('.cui-root')?.getAttribute('data-activity')).toBe('responding');
    expect(panel.querySelector<HTMLElement>('.cui-progress')?.hidden).toBe(true);
    expect(panel.querySelector('.cui-elapsed')?.textContent).toBe('');
    expect(state.toolPlan).not.toHaveBeenCalled();
    expect(state.apply).not.toHaveBeenCalled();
  } finally {
    finish?.('Direct useful answer');
    await vi.waitFor(() => expect(panel.querySelector('.cui-send-stop')).toBeNull());
  }
});

it('streams a grounded answer before completion and stores one complete reply', async () => {
  state.ready = true;
  state.readText = 'Budget is 120';
  state.toolPlan.mockResolvedValue({ tool: 'get_presentation_text', input: {}, readOnly: true });
  let finish!: (text: string) => void;
  state.readAnswer.mockImplementation((_provider, _request, _context, _exchange, _signal, delta) => {
    delta?.('Budget: ');
    return new Promise<string>((resolve) => {
      finish = resolve;
    });
  });
  const panel = createPreparedPanel();
  const input = panel.querySelector<HTMLTextAreaElement>('.cui-input')!;
  input.value = 'Read this presentation';
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  try {
    await vi.waitFor(() => expect(panel.querySelector('.cui-streaming .cui-bubble')?.textContent).toBe('Budget: '));
    expect(panel.querySelector('.cui-send-stop')).not.toBeNull();
    expect(panel.querySelector('.cui-status')?.textContent).toBe('');
    input.value = 'Next request';
    input.dispatchEvent(new Event('input'));
  } finally {
    // Transport normally emits every token before resolving its final response.
    const delta = state.readAnswer.mock.calls[0]?.[5] as ((text: string) => void) | undefined;
    delta?.('120');
    finish?.('Budget: 120');
    await vi.waitFor(() => expect(panel.querySelector('.cui-send-stop')).toBeNull());
  }
  expect(panel.querySelectorAll('.cui-msg-user')).toHaveLength(1);
  expect(panel.querySelectorAll('.cui-msg-agent')).toHaveLength(1);
  expect(panel.querySelector('.cui-msg-agent .cui-bubble')?.textContent).toBe('Budget: 120');
  expect(input.value).toBe('Next request');
});

it.each(['complete', 'cancel'] as const)(
  'preserves exact structured draft content on %s and protects unfinished bodies',
  async (mode) => {
    state.ready = true;
    state.editorReady = true;
    state.editorKind = 'word';
    state.toolContext = 'word';
    state.semanticResponse = '{"task":"compose","language":"en"}';
    let finish!: () => void;
    const gate = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const body = '[first] and **second**';
    state.structuredStream = async (_messages, _schema, delta) => {
      delta('{"text":"[first]');
      await gate;
      delta(' and **second**"}');
      return {
        text: JSON.stringify({ text: body }),
        toolCalls: [],
        stopReason: 'stop',
        assistant: { role: 'assistant', content: body },
      };
    };
    const panel = createPreparedPanel();
    const input = panel.querySelector<HTMLTextAreaElement>('.cui-input')!;
    input.value = 'Write a short document';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    try {
      await vi.waitFor(() => expect(panel.querySelector('.cui-streaming .cui-bubble')?.textContent).toBe('[first]'));
      const write = panel.querySelector<HTMLButtonElement>('.cui-apply')!;
      write.click();
      expect(state.apply).not.toHaveBeenCalled();
      if (mode === 'cancel') panel.querySelector<HTMLButtonElement>('.cui-send-stop')!.click();
    } finally {
      finish();
      await vi.waitFor(() => expect(panel.querySelector('.cui-send-stop')).toBeNull());
    }
    expect(panel.querySelectorAll('.cui-msg-agent')).toHaveLength(1);
    expect(panel.querySelectorAll('.cui-msg-user')).toHaveLength(1);
    if (mode === 'complete') {
      expect(panel.querySelector('.cui-msg-agent')?.getAttribute('data-source')).toBe(body);
      expect(panel.querySelector('.cui-msg-agent')?.hasAttribute('data-interrupted')).toBe(false);
    } else {
      expect(panel.querySelector('.cui-msg-agent')?.getAttribute('data-source')).toBe('[first]');
      expect(panel.querySelector('.cui-msg-agent')?.getAttribute('data-interrupted')).toBe('true');
      expect(panel.querySelector('.cui-apply')).toBeNull();
    }
    expect(state.apply).not.toHaveBeenCalled();
  },
);

it.each(['', 'Hello there'])(
  'preserves a blocked rewrite and opens its settings with composer draft %j',
  async (draft) => {
    state.ready = true;
    state.editorReady = true;
    state.source = 'Original selected text';
    state.semanticResponse = '{"task":"rewrite","language":"en"}';
    const panel = createPreparedPanel();
    const input = panel.querySelector<HTMLTextAreaElement>('.cui-input')!;
    input.value = 'Improve this selection';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await vi.waitFor(() => expect(panel.querySelector('.cui-send-stop')).toBeNull());
    expect(panel.querySelector('.cui-msg-error')).toBeNull();
    expect(input.value).toBe('');
    expect(panel.querySelector('.agent-queue-text')?.textContent).toBe('Improve this selection');
    input.value = draft;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    panel.querySelector<HTMLButtonElement>('.agent-queue-resume')!.click();
    expect(input.value).toBe(draft);
    expect(panel.getAttribute('data-view')).toBe('settings');
    expect(panel.querySelectorAll('.cui-msg-error')).toHaveLength(0);
    expect(state.conversations!.history().load()).toEqual([]);
    expect(state.writing).not.toHaveBeenCalled();
    const setup = panel.querySelector<HTMLButtonElement>('.agent-prepare-action')!;
    expect(setup.hidden).toBe(Boolean(draft));
    if (!draft) setup.click();
    expect(panel.getAttribute('data-view')).toBe('settings');
  },
);

it('keeps the draft unsent if the editor selection changes while dictation is finishing', async () => {
  const recognition: { current?: { onresult?: (event: unknown) => void; onend?: () => void } } = {};
  vi.stubGlobal(
    'SpeechRecognition',
    class {
      constructor() {
        recognition.current = this;
      }
      onresult?: (event: unknown) => void;
      onend?: () => void;
      start() {}
      stop() {}
      abort() {}
    },
  );
  try {
    state.ready = true;
    state.editorReady = true;
    state.source = 'Original selected text';
    const panel = createPreparedPanel();
    panel.querySelector<HTMLButtonElement>('.agent-speech-mic')!.click();
    recognition.current!.onresult?.({ results: [{ isFinal: false, 0: { transcript: 'Improve the selection' } }] });
    panel.querySelector<HTMLButtonElement>('.cui-send')!.click();
    state.targetCurrent = false;
    recognition.current!.onend?.();
    await vi.waitFor(() => expect(panel.textContent).toContain(t('agentSendContextChanged')));
    expect(state.routing).not.toHaveBeenCalled();
    expect(panel.querySelector<HTMLTextAreaElement>('.cui-input')!.value).toBe('Improve the selection');
  } finally {
    vi.unstubAllGlobals();
  }
});

it('keeps dictation unsent when no editor target can be bound at the Send gesture', async () => {
  const recognition: { current?: { onresult?: (event: unknown) => void; onend?: () => void } } = {};
  vi.stubGlobal(
    'SpeechRecognition',
    class {
      constructor() {
        recognition.current = this;
      }
      onresult?: (event: unknown) => void;
      onend?: () => void;
      start() {}
      stop() {}
      abort() {}
    },
  );
  const targetModule = await import('../../lib/agent-plugin/document-tool-action');
  const capture = vi.spyOn(targetModule, 'captureDocumentToolScope');
  try {
    state.ready = true;
    state.editorReady = true;
    const panel = createPreparedPanel();
    capture.mockImplementation(() => {
      throw new Error('Editor is still loading');
    });
    panel.querySelector<HTMLButtonElement>('.agent-speech-mic')!.click();
    recognition.current!.onresult?.({ results: [{ isFinal: false, 0: { transcript: 'Improve the selection' } }] });
    panel.querySelector<HTMLButtonElement>('.cui-send')!.click();
    capture.mockRestore();
    recognition.current!.onend?.();
    await vi.waitFor(() => expect(panel.textContent).toContain(t('agentEditorLoading')));
    expect(state.routing).not.toHaveBeenCalled();
    expect(panel.querySelector<HTMLTextAreaElement>('.cui-input')!.value).toBe('Improve the selection');
  } finally {
    capture.mockRestore();
    vi.unstubAllGlobals();
  }
});

it('answers an exact greeting without displaying a classification phase or copying document-body context', async () => {
  state.ready = true;
  state.editorReady = true;
  state.semanticResponse = '{"task":"chat","language":"en"}';
  const activity = vi.spyOn(ChatView.prototype, 'setActivity');
  const send = vi.spyOn(AgentChatController.prototype, 'send');
  const panel = createPreparedPanel();
  try {
    const input = panel.querySelector<HTMLTextAreaElement>('.cui-input')!;
    input.value = 'Hello';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await vi.waitFor(() => expect(panel.querySelector('.cui-msg-agent .cui-bubble')?.textContent).toBe('answer'));
    expect(activity).not.toHaveBeenCalledWith('routing');
    expect(send).toHaveBeenCalledOnce();
    const request = send.mock.calls[0][1]!.request!;
    expect(request.getRequestContext()).toBeUndefined();
  } finally {
    activity.mockRestore();
    send.mockRestore();
  }
});

it.each(['Hello', 'Tell me a brief story'])('records only observed request timing stages for %s', async (question) => {
  state.ready = true;
  state.editorReady = true;
  state.semanticResponse = '{"task":"chat","language":"en"}';
  state.usage = { contextPreparationDurationMs: 2, timeToFirstTextMs: 3, responseDurationMs: 5 };
  const measure = vi.fn();
  const now = performance.now.bind(performance);
  vi.stubGlobal('performance', { now, measure, clearMeasures: vi.fn() });
  try {
    const panel = createPreparedPanel();
    const input = panel.querySelector<HTMLTextAreaElement>('.cui-input')!;
    input.value = question;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await vi.waitFor(() => expect(measure).toHaveBeenCalledOnce());
    const [name, options] = measure.mock.calls[0];
    expect(name).toMatch(/^document\.assistant\.request\.[0-7]$/);
    expect(options.detail).toMatchObject({
      status: 'success',
      firstProviderTextMs: expect.any(Number),
      firstFilteredTextMs: expect.any(Number),
      providerContextPreparationDurationMs: 2,
      providerTimeToFirstTextMs: 3,
      providerResponseDurationMs: 5,
    });
    expect(Object.hasOwn(options.detail, 'routingDurationMs')).toBe(question !== 'Hello');
    // Detached jsdom panel cannot claim actual presentation from buffered text.
    expect(options.detail).not.toHaveProperty('firstPresentedTextMs');
    expect(Object.values(options.detail).every((value) => value === 'success' || typeof value === 'number')).toBe(true);
  } finally {
    vi.unstubAllGlobals();
  }
});

it.each(['switch', 'restore', 'import', 'delete', 'delete-all', 'provider', 'disable', 'pagehide'] as const)(
  'records supersession before %s cancels the current queued execution',
  async (action) => {
    state.ready = true;
    state.editorReady = true;
    let finish!: () => void;
    state.queueStream = async () => {
      await new Promise<void>((resolve) => {
        finish = resolve;
      });
    };
    const measure = vi.fn();
    const now = performance.now.bind(performance);
    vi.stubGlobal('performance', { now, measure, clearMeasures: vi.fn() });
    try {
      const panel = createPreparedPanel();
      enterQueueDraft(panel, 'Hello');
      await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
      if (action === 'switch') panel.querySelector<HTMLButtonElement>('.agent-panel-clear')!.click();
      else if (action === 'restore') {
        vi.spyOn(state.conversations!, 'restoreSaved').mockResolvedValue();
        panel.querySelector<HTMLButtonElement>('.agent-history-restore')!.click();
      } else if (action === 'import') {
        vi.spyOn(state.conversations!, 'importLegacy').mockResolvedValue();
        panel.querySelector<HTMLButtonElement>('.agent-history-import')!.click();
      } else if (action === 'delete' || action === 'delete-all') {
        panel
          .querySelector<HTMLButtonElement>(
            action === 'delete' ? '.agent-history-delete-current' : '.agent-history-delete-all',
          )!
          .click();
        panel.querySelector<HTMLButtonElement>('.agent-history-confirm')!.click();
      } else if (action === 'provider') {
        const provider = panel.querySelector<HTMLSelectElement>('.agent-panel-provider')!;
        provider.value = 'wllama';
        provider.dispatchEvent(new Event('change'));
      } else if (action === 'disable')
        await (await import('../../lib/agent-plugin/ui/panel')).setAgentPanelEnabled(false);
      else window.dispatchEvent(new Event('pagehide'));
      await vi.waitFor(() => expect(measure).toHaveBeenCalledOnce());
      expect(measure.mock.calls[0][1].detail.status).toBe('superseded');
      finish();
      await Promise.resolve();
      expect(measure).toHaveBeenCalledOnce();
    } finally {
      finish?.();
      vi.unstubAllGlobals();
    }
  },
);

it.each(['stop', 'send-now', 'stop-switch'] as const)(
  'preserves the first stopped timing outcome for %s',
  async (action) => {
    state.ready = true;
    state.editorReady = true;
    let finish!: () => void;
    let calls = 0;
    state.queueStream = async () => {
      if (++calls === 1)
        await new Promise<void>((resolve) => {
          finish = resolve;
        });
    };
    const measure = vi.fn();
    const now = performance.now.bind(performance);
    vi.stubGlobal('performance', { now, measure, clearMeasures: vi.fn() });
    try {
      const panel = createPreparedPanel();
      enterQueueDraft(panel, 'Hello');
      await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
      if (action === 'send-now') {
        enterQueueDraft(panel, 'Hi');
        panel.querySelector<HTMLButtonElement>('.agent-queue-send-now')!.click();
      } else panel.querySelector<HTMLButtonElement>('.cui-send-stop')!.click();
      if (action === 'stop-switch') panel.querySelector<HTMLButtonElement>('.agent-panel-clear')!.click();
      expect(measure).toHaveBeenCalledOnce();
      expect(measure.mock.calls[0][1].detail.status).toBe('stopped');
      finish();
      if (action === 'send-now') {
        await vi.waitFor(() => expect(measure).toHaveBeenCalledTimes(2));
        expect(measure.mock.calls[1][1].detail.status).toBe('success');
      } else await vi.waitFor(() => expect(panel.querySelector('.cui-send-stop')).toBeNull());
      expect(measure.mock.calls[0][1].detail.status).toBe('stopped');
    } finally {
      finish?.();
      vi.unstubAllGlobals();
    }
  },
);

it('keeps the current timing owner when a different conversation is deleted', async () => {
  state.ready = true;
  state.editorReady = true;
  let finish!: () => void;
  state.queueStream = async () => {
    await new Promise<void>((resolve) => {
      finish = resolve;
    });
  };
  const measure = vi.fn();
  const now = performance.now.bind(performance);
  vi.stubGlobal('performance', { now, measure, clearMeasures: vi.fn() });
  try {
    const panel = createPreparedPanel();
    const store = state.conversations!;
    const current = store.activeId;
    const other = store.create().id;
    store.history().save([{ role: 'user', content: 'Other conversation' }]);
    store.select(current);
    enterQueueDraft(panel, 'Hello');
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
    panel.querySelector<HTMLButtonElement>('.agent-history-toggle')!.click();
    panel.querySelector<HTMLButtonElement>(`.agent-conversation-delete[data-id="${other}"]`)!.click();
    panel.querySelector<HTMLButtonElement>('.agent-history-confirm')!.click();
    await vi.waitFor(() => expect(store.list().some((item) => item.id === other)).toBe(false));
    expect(measure).not.toHaveBeenCalled();
    finish();
    await vi.waitFor(() => expect(measure).toHaveBeenCalledOnce());
    expect(measure.mock.calls[0][1].detail.status).toBe('success');
  } finally {
    finish?.();
    vi.unstubAllGlobals();
  }
});

it('stages a selected summary as a trusted read and answers only on explicit Send without writing consent', async () => {
  state.ready = true;
  state.editorReady = true;
  state.toolContext = 'word';
  state.source = 'Selected source';
  state.semanticResponse = '{"task":"tools","language":"en"}';
  const panel = createPreparedPanel();
  const send = vi.spyOn(AgentChatController.prototype, 'send');
  try {
    panel.querySelector<HTMLButtonElement>('[data-task="summarize"]')!.click();
    expect(send).not.toHaveBeenCalled();
    expect(state.writing).not.toHaveBeenCalled();
    panel.querySelector<HTMLButtonElement>('.cui-send')!.click();
    await vi.waitFor(() => expect(panel.querySelector('.cui-msg-agent .cui-bubble')?.textContent).toBe('answer'));
    expect(send).toHaveBeenCalledOnce();
    expect(send.mock.calls[0][1]?.request?.tools).toEqual({});
    expect(state.writing).not.toHaveBeenCalled();
    expect(state.routing).not.toHaveBeenCalled();
    expect(state.toolPlan).not.toHaveBeenCalled();
    expect(state.apply).not.toHaveBeenCalled();
  } finally {
    send.mockRestore();
  }
});
it('keeps semantic routing for an exact greeting while an unexecuted suggestion is pending', async () => {
  state.ready = true;
  state.editorReady = true;
  state.editorKind = 'slide';
  state.routing.mockResolvedValue({ task: 'tools', language: 'en' });
  state.toolPlan.mockResolvedValue({ tool: 'add_slide_text', input: { text: 'Draft' }, readOnly: false });
  const panel = createPreparedPanel();
  const input = panel.querySelector<HTMLTextAreaElement>('.cui-input')!;
  input.value = 'Add a new text box on the current slide with this exact plain text: Draft';
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await vi.waitFor(() => expect(panel.querySelector('.agent-plan-preview[data-state=pending]')).not.toBeNull());
  await vi.waitFor(() => expect(panel.querySelector('.cui-send-stop')).toBeNull());
  state.semanticResponse = '{"task":"chat","language":"en"}';
  const activity = vi.spyOn(ChatView.prototype, 'setActivity');
  try {
    input.value = 'Hello';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(activity).not.toHaveBeenCalledWith('routing');
    expect(panel.querySelectorAll('.agent-queue-entry')).toHaveLength(1);
    panel.querySelector<HTMLButtonElement>('.agent-queue-send-now')!.click();
    await vi.waitFor(() => expect(panel.querySelector('.cui-msg-agent .cui-bubble')?.textContent).toBe('answer'));
    expect(activity).toHaveBeenCalledWith('routing');
    expect(state.apply).not.toHaveBeenCalled();
  } finally {
    activity.mockRestore();
  }
});

it.each(['English selection '.repeat(600), '中文选区。'.repeat(2000), '"\\\n'.repeat(3000)])(
  'answers ordinary chat with a large selection using a bounded context envelope',
  async (source) => {
    state.ready = true;
    state.editorReady = true;
    state.source = source;
    state.semanticResponse = '{"task":"chat","language":"en"}';
    const panel = createPreparedPanel();
    const input = panel.querySelector<HTMLTextAreaElement>('.cui-input')!;
    input.value = 'Tell me a brief story';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await vi.waitFor(() => expect(panel.querySelector('.cui-msg-agent .cui-bubble')?.textContent).toBe('answer'));
    expect(panel.querySelector('.cui-msg-error')).toBeNull();
  },
);

function enterQueueDraft(panel: HTMLElement, text: string): void {
  const input = panel.querySelector<HTMLTextAreaElement>('.cui-input')!;
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
}

it('opens the latest meaningful chat from the assistant title without loading opted-out history', () => {
  const panel = createAgentPanel();
  const store = state.conversations!;
  const first = store.activeId;
  vi.spyOn(Date, 'now').mockReturnValueOnce(10);
  store.history().save([{ role: 'user', content: 'Older chat' }]);
  panel.querySelector<HTMLButtonElement>('.agent-panel-clear')!.click();
  const latest = store.activeId;
  vi.spyOn(Date, 'now').mockReturnValueOnce(20);
  store.history().save([{ role: 'user', content: 'Latest chat' }]);
  openSession(panel, first);
  panel.querySelector<HTMLButtonElement>('.agent-panel-clear')!.click();
  const restore = vi.spyOn(store, 'restoreSaved');
  const history = vi.spyOn(store, 'history');
  const title = panel.querySelector<HTMLButtonElement>('button.agent-panel-title');
  expect(title).not.toBeNull();
  expect(title!.type).toBe('button');
  expect(title!.textContent).toBe(t('agentTitle'));
  panel.querySelector<HTMLButtonElement>('.agent-panel-settings-toggle')!.click();
  title!.click();
  expect(panel.dataset.view).toBe('chat');
  expect(store.activeId).toBe(latest);
  expect(panel.querySelector('.cui-msg-user')?.textContent).toBe('Latest chat');
  expect(restore).not.toHaveBeenCalled();
  expect(history).toHaveBeenCalledOnce();
});

it('keeps drafts with their displayed owners across new-chat and title navigation', () => {
  const panel = createAgentPanel();
  const store = state.conversations!;
  const original = store.activeId;
  store.history().save([{ role: 'user', content: 'Existing chat' }]);
  const input = panel.querySelector<HTMLTextAreaElement>('.cui-input')!;
  input.value = 'Original draft';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  panel.querySelector<HTMLButtonElement>('.agent-panel-clear')!.click();
  const blank = store.activeId;
  expect(input.value).toBe('');
  input.value = 'Blank chat draft';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  panel.querySelector<HTMLButtonElement>('.agent-panel-title')!.click();
  expect(store.activeId).toBe(original);
  expect(input.value).toBe('Original draft');
  openSession(panel, blank);
  expect(input.value).toBe('Blank chat draft');
  expect(store.history().load()).toEqual([]);
  openSession(panel, original);
  expect(input.value).toBe('Original draft');
});

it.each(['starting', 'listening', 'finishing'] as const)(
  'keeps %s dictation with its owner when the title returns to another chat',
  (phase) => {
    class Recognition {
      static current: Recognition;
      constructor() {
        Recognition.current = this;
      }
      onstart?: () => void;
      onend?: () => void;
      onresult?: (event: unknown) => void;
      start = vi.fn();
      stop = vi.fn();
      abort = vi.fn();
    }
    vi.stubGlobal('SpeechRecognition', Recognition);
    try {
      const panel = createAgentPanel();
      const store = state.conversations!;
      const original = store.activeId;
      store.history().save([{ role: 'user', content: 'Existing chat' }]);
      const input = panel.querySelector<HTMLTextAreaElement>('.cui-input')!;
      input.value = 'Original target draft';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      panel.querySelector<HTMLButtonElement>('.agent-panel-clear')!.click();
      const owner = store.activeId;
      input.value = 'New chat draft';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      panel.querySelector<HTMLButtonElement>('.agent-speech-mic')!.click();
      const recognition = Recognition.current;
      if (phase !== 'starting') {
        recognition.onstart?.();
        recognition.onresult?.({ results: [{ isFinal: false, 0: { transcript: 'Dictated continuation' } }] });
      }
      if (phase === 'finishing') panel.querySelector<HTMLButtonElement>('.agent-speech-mic')!.click();
      expect(panel.querySelector<HTMLElement>('.agent-speech')!.dataset.state).toBe(phase);
      const dictated = input.value;
      panel.querySelector<HTMLButtonElement>('.agent-panel-title')!.click();
      expect(store.activeId).toBe(original);
      expect(recognition.abort).toHaveBeenCalledOnce();
      expect(input.value).toBe('Original target draft');
      recognition.onstart?.();
      recognition.onresult?.({ results: [{ isFinal: true, 0: { transcript: 'Obsolete speech' } }] });
      recognition.onend?.();
      expect(input.value).toBe('Original target draft');
      openSession(panel, owner);
      expect(input.value).toBe(dictated);
      openSession(panel, original);
      expect(input.value).toBe('Original target draft');
    } finally {
      vi.unstubAllGlobals();
    }
  },
);

it('keeps the existing draft or empty chat when the title has no meaningful history', () => {
  const panel = createAgentPanel();
  const original = activeSession();
  const input = panel.querySelector<HTMLTextAreaElement>('.cui-input')!;
  input.value = 'Unsent draft';
  panel.querySelector<HTMLButtonElement>('.agent-panel-settings-toggle')!.click();
  panel.querySelector<HTMLButtonElement>('.agent-panel-title')!.click();
  expect(panel.dataset.view).toBe('chat');
  expect(activeSession()).toBe(original);
  expect(input.value).toBe('Unsent draft');
  input.value = '';
  panel.querySelector<HTMLButtonElement>('.agent-history-toggle')!.click();
  panel.querySelector<HTMLButtonElement>('.agent-panel-title')!.click();
  expect(panel.dataset.view).toBe('chat');
  expect(activeSession()).toBe(original);
  expect(state.conversations!.list()).toHaveLength(1);
});

it('does not interrupt the displayed new chat while its first request is still validating', async () => {
  state.ready = true;
  const panel = createPreparedPanel();
  state.conversations!.history().save([{ role: 'user', content: 'Older chat' }]);
  panel.querySelector<HTMLButtonElement>('.agent-panel-clear')!.click();
  const original = activeSession();
  let finish!: () => void;
  state.semanticResponse = '{"task":"chat","language":"en"}';
  state.semanticGate = new Promise<void>((resolve) => {
    finish = resolve;
  });
  enterQueueDraft(panel, 'Tell me a brief story');
  await vi.waitFor(() => expect(panel.querySelector('.agent-queue-entry')).not.toBeNull());
  expect(state.conversations!.history().load()).toEqual([]);
  panel.querySelector<HTMLButtonElement>('.agent-panel-settings-toggle')!.click();
  panel.querySelector<HTMLButtonElement>('.agent-panel-title')!.click();
  expect(panel.dataset.view).toBe('chat');
  expect(activeSession()).toBe(original);
  finish();
  await vi.waitFor(() => expect(panel.querySelector('.cui-msg-agent .cui-bubble')?.textContent).toBe('answer'));
});

it('returns to a paused chat from the title without resuming its queued requests', async () => {
  state.ready = true;
  const calls: string[] = [];
  state.queueStream = (text, _delta, signal) =>
    new Promise((_resolve, reject) => {
      calls.push(text);
      signal?.addEventListener('abort', () => reject(signal.reason), { once: true });
    });
  const panel = createPreparedPanel();
  enterQueueDraft(panel, 'Hello');
  await vi.waitFor(() => expect(calls).toHaveLength(1));
  const original = activeSession();
  enterQueueDraft(panel, 'Hi');
  panel.querySelector<HTMLButtonElement>('.agent-panel-title')!.click();
  expect(calls).toEqual(['Hello']);
  panel.querySelector<HTMLButtonElement>('.agent-panel-clear')!.click();
  await vi.waitFor(() => expect(panel.querySelector('.cui-send-stop')).toBeNull());
  panel.querySelector<HTMLButtonElement>('.agent-panel-title')!.click();
  expect(activeSession()).toBe(original);
  expect(calls).toEqual(['Hello']);
  expect(panel.querySelectorAll('.agent-queue-entry')).toHaveLength(1);
  expect(panel.querySelector('.agent-queue-resume')?.hasAttribute('hidden')).toBe(false);
});

it('keeps the displayed live answer even when another conversation receives a newer update', async () => {
  state.ready = true;
  let finish!: () => void;
  let aborted = false;
  state.queueStream = (_text, _delta, signal) =>
    new Promise((resolve) => {
      finish = resolve;
      signal?.addEventListener(
        'abort',
        () => {
          aborted = true;
        },
        { once: true },
      );
    });
  const panel = createPreparedPanel();
  const store = state.conversations!;
  const previous = store.activeId;
  store.history().save([{ role: 'user', content: 'Previous chat' }]);
  panel.querySelector<HTMLButtonElement>('.agent-panel-clear')!.click();
  const current = store.activeId;
  enterQueueDraft(panel, 'Hello');
  await vi.waitFor(() => expect(finish).toBeDefined());
  vi.spyOn(Date, 'now').mockReturnValueOnce(Date.now() + 1000);
  store.history(previous).save([{ role: 'user', content: 'Later background result' }]);
  panel.querySelector<HTMLButtonElement>('.agent-panel-title')!.click();
  expect(store.activeId).toBe(current);
  expect(aborted).toBe(false);
  finish();
  await vi.waitFor(() => expect(panel.querySelector('.cui-msg-agent .cui-bubble')?.textContent).toBe('answer'));
});

it('returns to a draft-only chat when the title has no saved messages', () => {
  const panel = createAgentPanel();
  const original = activeSession();
  const input = panel.querySelector<HTMLTextAreaElement>('.cui-input')!;
  input.value = 'Draft-only chat';
  panel.querySelector<HTMLButtonElement>('.agent-panel-clear')!.click();
  panel.querySelector<HTMLButtonElement>('.agent-panel-title')!.click();
  expect(activeSession()).toBe(original);
  expect(input.value).toBe('Draft-only chat');
});

it('clears noncurrent draft-only history membership on restore without keeping its old draft', async () => {
  const panel = createAgentPanel();
  const store = state.conversations!;
  const blank = store.activeId;
  const input = panel.querySelector<HTMLTextAreaElement>('.cui-input')!;
  input.value = 'Discarded by restore';
  panel.querySelector<HTMLButtonElement>('.agent-panel-clear')!.click();
  store.history().save([{ role: 'user', content: 'Current chat' }]);
  vi.spyOn(store, 'restoreSaved').mockResolvedValue();
  panel.querySelector<HTMLButtonElement>('.agent-history-restore')!.click();
  await vi.waitFor(() => expect(panel.querySelector('.cui-msg-user')?.textContent).toBe('Current chat'));
  panel.querySelector<HTMLButtonElement>('.agent-history-toggle')!.click();
  expect(panel.querySelector(`.agent-conversation-open[data-id="${blank}"]`)).toBeNull();
  expect(input.value).toBe('');
});

it('preserves the current draft when deleting a different draft-only conversation', async () => {
  const panel = createAgentPanel();
  const store = state.conversations!;
  const other = store.activeId;
  const input = panel.querySelector<HTMLTextAreaElement>('.cui-input')!;
  input.value = 'Deleted draft';
  panel.querySelector<HTMLButtonElement>('.agent-panel-clear')!.click();
  const current = store.activeId;
  input.value = 'Current draft';
  panel.querySelector<HTMLButtonElement>('.agent-history-toggle')!.click();
  panel.querySelector<HTMLButtonElement>(`.agent-conversation-delete[data-id="${other}"]`)!.click();
  panel.querySelector<HTMLButtonElement>('.agent-history-confirm')!.click();
  await vi.waitFor(() => expect(store.list().some((item) => item.id === other)).toBe(false));
  expect(store.activeId).toBe(current);
  expect(input.value).toBe('Current draft');
  panel.querySelector<HTMLButtonElement>('.agent-panel-title')!.click();
  expect(store.activeId).toBe(current);
  expect(input.value).toBe('Current draft');
});

it('preserves deletion continuity for a held current reply and its next draft', async () => {
  state.ready = true;
  let finish!: () => void;
  let aborted = false;
  let calls = 0;
  state.queueStream = async (_text, delta, signal) => {
    if (++calls > 1) return;
    delta('Partial ');
    signal?.addEventListener(
      'abort',
      () => {
        aborted = true;
      },
      { once: true },
    );
    await new Promise<void>((resolve) => {
      finish = resolve;
    });
  };
  const panel = createPreparedPanel();
  const store = state.conversations!;
  const other = store.activeId;
  store.history().save([{ role: 'user', content: 'Other chat' }]);
  panel.querySelector<HTMLButtonElement>('.agent-panel-clear')!.click();
  const current = store.activeId;
  enterQueueDraft(panel, 'Hello');
  const dispose = vi.spyOn(AgentChatController.prototype, 'dispose');
  try {
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
    const live = panel.querySelector('.cui-streaming');
    enterQueueDraft(panel, 'Hi');
    const queuedId = panel.querySelector<HTMLElement>('.agent-queue-edit')!.dataset.entry;
    const input = panel.querySelector<HTMLTextAreaElement>('.cui-input')!;
    input.value = 'Keep next draft';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    dispose.mockClear();
    panel.querySelector<HTMLButtonElement>('.agent-history-toggle')!.click();
    panel.querySelector<HTMLButtonElement>(`.agent-conversation-delete[data-id="${other}"]`)!.click();
    panel.querySelector<HTMLButtonElement>('.agent-history-confirm')!.click();
    await vi.waitFor(() => expect(panel.querySelector<HTMLElement>('.agent-history-confirmation')!.hidden).toBe(true));
    expect(store.activeId).toBe(current);
    expect(aborted).toBe(false);
    expect(dispose).not.toHaveBeenCalled();
    expect(panel.querySelector('.cui-streaming')).toBe(live);
    expect(panel.querySelector<HTMLElement>('.agent-queue-edit')?.dataset.entry).toBe(queuedId);
    expect(panel.querySelector('.agent-queue-text')?.textContent).toBe('Hi');
    expect(calls).toBe(1);
    expect(panel.querySelector('.cui-send-stop')).not.toBeNull();
    expect(input.value).toBe('Keep next draft');
    finish();
    await vi.waitFor(() =>
      expect(panel.querySelector('.cui-msg-agent .cui-bubble')?.textContent).toBe('Partial answer'),
    );
    await vi.waitFor(() => expect(calls).toBe(2));
    expect(input.value).toBe('Keep next draft');
  } finally {
    dispose.mockRestore();
    finish?.();
  }
});
it('preserves deletion continuity for loaded pages, action nodes, draft and reading offset', async () => {
  const panel = createAgentPanel();
  const store = state.conversations!;
  const current = store.activeId;
  store.history().save(
    Array.from({ length: 100 }, (_, index) => ({
      role: index % 2 ? 'assistant' : 'user',
      content: `Message ${index}`,
    })),
  );
  panel.querySelector<HTMLButtonElement>('.agent-panel-clear')!.click();
  const other = store.activeId;
  store.history().save([{ role: 'user', content: 'Other chat' }]);
  openSession(panel, current);
  panel.querySelector<HTMLButtonElement>('.cui-load-earlier')!.click();
  const messages = panel.querySelector<HTMLElement>('.cui-messages')!;
  expect(messages.querySelectorAll('.cui-msg')).toHaveLength(80);
  const first = messages.querySelector('.cui-msg');
  const copy = messages.querySelector('.cui-copy');
  messages.scrollTop = 150;
  const input = panel.querySelector<HTMLTextAreaElement>('.cui-input')!;
  input.value = 'Keep reading draft';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  panel.querySelector<HTMLButtonElement>('.agent-history-toggle')!.click();
  panel.querySelector<HTMLButtonElement>(`.agent-conversation-delete[data-id="${other}"]`)!.click();
  panel.querySelector<HTMLButtonElement>('.agent-history-confirm')!.click();
  await vi.waitFor(() => expect(panel.querySelector<HTMLElement>('.agent-history-confirmation')!.hidden).toBe(true));
  expect(messages.querySelectorAll('.cui-msg')).toHaveLength(80);
  expect(messages.querySelector('.cui-msg')).toBe(first);
  expect(messages.querySelector('.cui-copy')).toBe(copy);
  expect(messages.scrollTop).toBe(150);
  expect(input.value).toBe('Keep reading draft');
});
it.each([true, false])(
  'preserves deletion continuity for navigation during awaited deletion: initially current=%s',
  async (initiallyCurrent) => {
    const panel = createAgentPanel();
    const store = state.conversations!;
    const target = store.activeId;
    store.history().save([{ role: 'user', content: 'Target chat' }]);
    panel.querySelector<HTMLButtonElement>('.agent-panel-clear')!.click();
    const next = store.activeId;
    store.history().save([{ role: 'user', content: 'Next chat' }]);
    if (initiallyCurrent) openSession(panel, target);
    let finish!: () => void;
    vi.spyOn(store, 'flush').mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    panel.querySelector<HTMLButtonElement>('.agent-history-toggle')!.click();
    panel.querySelector<HTMLButtonElement>(`.agent-conversation-delete[data-id="${target}"]`)!.click();
    panel.querySelector<HTMLButtonElement>('.agent-history-confirm')!.click();
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
    try {
      openSession(panel, next);
      const row = panel.querySelector('.cui-msg-user');
      const input = panel.querySelector<HTMLTextAreaElement>('.cui-input')!;
      input.value = 'New owner draft';
      input.focus();
      finish();
      await vi.waitFor(() =>
        expect(panel.querySelector<HTMLElement>('.agent-history-confirmation')!.hidden).toBe(true),
      );
      expect(store.activeId).toBe(next);
      expect(panel.querySelector('.cui-msg-user')).toBe(row);
      expect(input.value).toBe('New owner draft');
      expect(document.activeElement).toBe(input);
    } finally {
      finish?.();
    }
  },
);

it('reloads replaced history after restore while retaining only the surviving current draft', async () => {
  const panel = createAgentPanel();
  const store = state.conversations!;
  const input = panel.querySelector<HTMLTextAreaElement>('.cui-input')!;
  input.value = 'Surviving draft';
  const restore = vi.spyOn(store, 'restoreSaved').mockImplementation(async () => {
    store.history().save([{ role: 'user', content: 'Restored chat' }]);
  });
  panel.querySelector<HTMLButtonElement>('.agent-history-restore')!.click();
  await vi.waitFor(() => expect(restore).toHaveBeenCalledOnce());
  await vi.waitFor(() => expect(panel.querySelector('.cui-msg-user')?.textContent).toBe('Restored chat'));
  expect(input.value).toBe('Surviving draft');
  panel.querySelector<HTMLButtonElement>('.agent-history-delete-current')!.click();
  panel.querySelector<HTMLButtonElement>('.agent-history-confirm')!.click();
  await vi.waitFor(() => expect(input.value).toBe(''));
  await vi.waitFor(() => expect(panel.querySelector('.cui-msg-user')).toBeNull());
});

function delayedConversationRepository() {
  const id = '11111111-1111-4111-8111-111111111111';
  const saved: import('../../lib/agent-plugin/ui/conversation-db').StoredConversations = {
    version: 1,
    revision: 1,
    activeId: id,
    sessions: [
      { id, title: 'Saved chat', createdAt: 1, updatedAt: 1, messages: [{ role: 'user', content: 'Saved chat' }] },
    ],
  };
  let finish!: (value: typeof saved) => void;
  const repository = {
    load: vi.fn(
      () =>
        new Promise<typeof saved>((resolve) => {
          finish = resolve;
        }),
    ),
    save: vi.fn(
      async (_data: import('../../lib/agent-plugin/ui/conversation-db').ConversationData, revision: number) =>
        revision + 1,
    ),
    clear: vi.fn(async () => 2),
  };
  state.conversationRepository = repository;
  return { id, repository, finish: () => finish(saved) };
}

it.each(['automatic', 'manual'] as const)(
  'preserves early placeholder typing only during %s history restoration',
  async (reason) => {
    const stored = delayedConversationRepository();
    if (reason === 'automatic') localStorage.setItem('agent_conversation_saving_v2', 'true');
    const panel = createAgentPanel();
    const initial = activeSession();
    const input = panel.querySelector<HTMLTextAreaElement>('.cui-input')!;
    input.value = 'Keep this draft';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    if (reason === 'manual') {
      await Promise.resolve();
      expect(stored.repository.load).not.toHaveBeenCalled();
      panel.querySelector<HTMLButtonElement>('.agent-history-restore')!.click();
    }
    await vi.waitFor(() => expect(stored.repository.load).toHaveBeenCalledOnce());
    stored.finish();
    await vi.waitFor(() => expect(panel.querySelector('.cui-msg-user')?.textContent).toBe('Saved chat'));
    expect(activeSession()).toBe(stored.id);
    expect(state.conversations!.list().some((item) => item.id === initial)).toBe(false);
    panel.querySelector<HTMLButtonElement>('.agent-history-toggle')!.click();
    panel
      .querySelector<HTMLElement>('.agent-history-view')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(input.value).toBe(reason === 'automatic' ? 'Keep this draft' : '');
  },
);

it('keeps a different displayed draft owner created while automatic history hydration is pending', async () => {
  const stored = delayedConversationRepository();
  localStorage.setItem('agent_conversation_saving_v2', 'true');
  const panel = createAgentPanel();
  const input = panel.querySelector<HTMLTextAreaElement>('.cui-input')!;
  input.value = 'Initial placeholder draft';
  panel.querySelector<HTMLButtonElement>('.agent-panel-clear')!.click();
  const current = activeSession();
  input.value = 'New owner draft';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await vi.waitFor(() => expect(stored.repository.load).toHaveBeenCalledOnce());
  stored.finish();
  await vi.waitFor(() => expect(state.conversations!.saving).toBe(true));
  expect(activeSession()).toBe(current);
  expect(input.value).toBe('New owner draft');
  openSession(panel, stored.id);
  expect(input.value).toBe('');
  openSession(panel, current);
  expect(input.value).toBe('New owner draft');
});

it.each(['running', 'stopped', 'scope-changed'] as const)(
  'retains the original pending owner through initial history hydration: %s',
  async (mode) => {
    const stored = delayedConversationRepository();
    localStorage.setItem('agent_conversation_saving_v2', 'true');
    state.ready = true;
    state.editorReady = true;
    state.toolContext = 'word';
    state.semanticResponse = '{"task":"chat","language":"en"}';
    if (mode === 'scope-changed') state.source = 'Original selected source';
    let finishRouting!: () => void;
    state.semanticGate = new Promise<void>((resolve) => {
      finishRouting = resolve;
    });
    const panel = createPreparedPanel();
    document.body.append(panel);
    const original = activeSession();
    const text = 'Tell me a brief story';
    enterQueueDraft(panel, text);
    await vi.waitFor(() => expect(panel.querySelector('.cui-status')?.textContent).toBe(t('agentRoutingRequest')));
    expect(state.conversations!.history().load()).toEqual([]);
    if (mode === 'stopped') {
      panel.querySelector<HTMLButtonElement>('.cui-send-stop')!.click();
      finishRouting();
      await vi.waitFor(() => expect(panel.querySelector('.cui-send-stop')).toBeNull());
    } else if (mode === 'scope-changed') state.targetCurrent = false;
    stored.finish();
    await vi.waitFor(() => expect(state.conversations!.saving).toBe(true));
    expect(state.conversations!.list().some((item) => item.id === original)).toBe(true);
    expect(activeSession()).toBe(original);
    expect(panel.querySelector('.agent-queue-text')?.textContent).toBe(text);
    expect(state.conversations!.history().load()).toEqual([]);
    expect(stored.repository.save.mock.calls.every(([data]) => !JSON.stringify(data).includes(text))).toBe(true);
    if (mode !== 'stopped') finishRouting();
    if (mode === 'running') {
      await vi.waitFor(() => expect(panel.querySelector('.cui-msg-agent .cui-bubble')?.textContent).toBe('answer'));
      expect(panel.querySelectorAll('.cui-msg-user')).toHaveLength(1);
    } else {
      await vi.waitFor(() => expect(panel.querySelector('.cui-send-stop')).toBeNull());
      panel.querySelector<HTMLButtonElement>('.agent-queue-edit')!.click();
      expect(panel.querySelector<HTMLTextAreaElement>('.cui-input')!.value).toBe(text);
      expect(state.conversations!.history().load()).toEqual([]);
    }
    expect(stored.repository.save.mock.calls.every(([data]) => !JSON.stringify(data).includes('recoverOnly'))).toBe(
      true,
    );
  },
);

it('keeps an accepted first answer active while initial history hydration finishes', async () => {
  const stored = delayedConversationRepository();
  localStorage.setItem('agent_conversation_saving_v2', 'true');
  state.ready = true;
  let finishAnswer!: () => void;
  let aborted = false;
  state.queueStream = (_text, _delta, signal) =>
    new Promise((resolve) => {
      finishAnswer = resolve;
      signal?.addEventListener('abort', () => {
        aborted = true;
      });
    });
  const panel = createPreparedPanel();
  const original = activeSession();
  enterQueueDraft(panel, 'Hello');
  await vi.waitFor(() => expect(finishAnswer).toBeTypeOf('function'));
  stored.finish();
  await vi.waitFor(() => expect(state.conversations!.saving).toBe(true));
  expect(activeSession()).toBe(original);
  expect(aborted).toBe(false);
  finishAnswer();
  await vi.waitFor(() => expect(panel.querySelector('.cui-msg-agent .cui-bubble')?.textContent).toBe('answer'));
});

it('executes queued drafts in FIFO order and echoes them only after the active host turn settles', async () => {
  state.ready = true;
  const calls: string[] = [];
  const releases: Array<() => void> = [];
  state.queueStream = (text) =>
    new Promise((resolve) => {
      calls.push(text);
      releases.push(resolve);
    });
  const panel = createPreparedPanel();
  document.body.append(panel);
  enterQueueDraft(panel, 'Hello');
  await vi.waitFor(() => expect(calls).toHaveLength(1));
  enterQueueDraft(panel, 'Hi');
  enterQueueDraft(panel, 'Hey');
  expect(calls).toEqual(['Hello']);
  expect(panel.querySelectorAll('.agent-queue-entry')).toHaveLength(2);
  expect([...panel.querySelectorAll('.cui-msg-user')].map((row) => row.textContent)).toEqual(['Hello']);
  releases[0]();
  await vi.waitFor(() => expect(calls).toEqual(['Hello', 'Hi']));
  releases[1]();
  await vi.waitFor(() => expect(calls).toEqual(['Hello', 'Hi', 'Hey']));
  releases[2]();
  await vi.waitFor(() => expect(panel.querySelector('.cui-send-stop')).toBeNull());
  expect(panel.querySelectorAll('.agent-queue-entry')).toHaveLength(0);
});
it('pauses queued requests after Stop, accepts new drafts while paused, and resumes only explicitly', async () => {
  state.ready = true;
  const calls: string[] = [];
  state.queueStream = (text, _delta, signal) =>
    new Promise((_resolve, reject) => {
      calls.push(text);
      signal?.addEventListener('abort', () => reject(signal.reason), { once: true });
    });
  const panel = createPreparedPanel();
  document.body.append(panel);
  enterQueueDraft(panel, 'Hello');
  await vi.waitFor(() => expect(calls).toHaveLength(1));
  enterQueueDraft(panel, 'Hi');
  panel.querySelector<HTMLButtonElement>('.cui-send-stop')!.click();
  await vi.waitFor(() => expect(panel.querySelector('.cui-send-stop')).toBeNull());
  enterQueueDraft(panel, 'Hey');
  expect(calls).toHaveLength(1);
  expect(panel.querySelectorAll('.agent-queue-entry')).toHaveLength(2);
  panel.querySelector<HTMLButtonElement>('.agent-queue-resume')!.click();
  await vi.waitFor(() => expect(calls).toEqual(['Hello', 'Hi']));
});
it('retains stale original scopes for explicit editing and never overwrites an occupied composer', async () => {
  state.ready = true;
  let release!: () => void;
  state.queueStream = () =>
    new Promise((resolve) => {
      release = resolve;
    });
  const panel = createPreparedPanel();
  document.body.append(panel);
  enterQueueDraft(panel, 'Hello');
  await vi.waitFor(() => expect(release).toBeTypeOf('function'));
  state.editorReady = true;
  state.source = 'Original selected source';
  state.semanticResponse = '{"task":"chat","language":"en"}';
  enterQueueDraft(panel, 'Explain the selected source');
  state.targetCurrent = false;
  release();
  await vi.waitFor(() => expect(panel.querySelector('.agent-queue-resume')?.hasAttribute('hidden')).toBe(false));
  const input = panel.querySelector<HTMLTextAreaElement>('.cui-input')!;
  input.value = 'My occupied draft';
  input.dispatchEvent(new Event('input'));
  panel.querySelector<HTMLButtonElement>('.agent-queue-edit')!.click();
  expect(input.value).toBe('My occupied draft');
  expect(panel.querySelectorAll('.agent-queue-entry')).toHaveLength(1);
  expect(panel.textContent).toContain(t('agentQueueComposerOccupied'));
  input.value = '';
  input.dispatchEvent(new Event('input'));
  panel.querySelector<HTMLButtonElement>('.agent-queue-edit')!.click();
  expect(input.value).toBe('Explain the selected source');
  expect(panel.querySelectorAll('.agent-queue-entry')).toHaveLength(0);
});
it('lets a fresh Send after Stop start normally when no older pending request remains', async () => {
  state.ready = true;
  const calls: string[] = [];
  state.queueStream = (text, _delta, signal) =>
    new Promise((_resolve, reject) => {
      calls.push(text);
      signal?.addEventListener('abort', () => reject(signal.reason), { once: true });
    });
  const panel = createPreparedPanel();
  document.body.append(panel);
  enterQueueDraft(panel, 'Hello');
  await vi.waitFor(() => expect(calls).toHaveLength(1));
  panel.querySelector<HTMLButtonElement>('.cui-send-stop')!.click();
  await vi.waitFor(() => expect(panel.querySelector('.cui-send-stop')).toBeNull());
  enterQueueDraft(panel, 'Hi');
  await vi.waitFor(() => expect(calls).toEqual(['Hello', 'Hi']));
});
it('promotes Send now once and waits for the previous host submit to settle', async () => {
  state.ready = true;
  const calls: string[] = [];
  let finish!: () => void;
  let aborts = 0;
  state.queueStream = (text, _delta, signal) =>
    new Promise((resolve) => {
      calls.push(text);
      finish = resolve;
      signal?.addEventListener('abort', () => aborts++, { once: true });
    });
  const panel = createPreparedPanel();
  document.body.append(panel);
  enterQueueDraft(panel, 'Hello');
  await vi.waitFor(() => expect(calls).toHaveLength(1));
  enterQueueDraft(panel, 'Hi');
  enterQueueDraft(panel, 'Hey');
  panel.querySelectorAll<HTMLButtonElement>('.agent-queue-send-now')[1].click();
  panel.querySelectorAll<HTMLButtonElement>('.agent-queue-send-now')[0].click();
  expect(aborts).toBe(1);
  expect(calls).toEqual(['Hello']);
  finish();
  await vi.waitFor(() => expect(calls).toEqual(['Hello', 'Hey']));
  expect([...panel.querySelectorAll('.agent-queue-text')].map((row) => row.textContent)).toEqual(['Hi']);
});
it('holds pending work through review Apply in flight and advances only on its verified settlement', async () => {
  state.ready = true;
  state.toolContext = 'slide';
  state.editorReady = true;
  state.editorKind = 'slide';
  state.toolPlan.mockResolvedValue({ tool: 'add_slide_text', input: { text: 'Draft' }, readOnly: false });
  const calls: string[] = [];
  state.queueStream = async (text) => {
    calls.push(text);
  };
  const panel = createPreparedPanel();
  document.body.append(panel);
  enterQueueDraft(panel, 'Add a new text box on the current slide with this exact plain text: Draft');
  await vi.waitFor(() => expect(panel.querySelector('.agent-plan-preview[data-state=pending]')).not.toBeNull());
  enterQueueDraft(panel, 'Hello');
  expect(calls).toEqual([]);
  expect(panel.querySelectorAll('.agent-queue-entry')).toHaveLength(1);
  let finish!: (outcome: 'verified') => void;
  state.apply.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  panel.querySelector<HTMLElement>('.agent-plan-apply')!.click();
  expect(panel.querySelector('.agent-plan-preview')?.getAttribute('data-state')).toBe('applying');
  enterQueueDraft(panel, 'Hi');
  expect(calls).toEqual([]);
  finish('verified');
  await vi.waitFor(() => expect(calls).toEqual(['Hello', 'Hi']));
});
it.each(['cancelled', 'failed', 'sent'] as const)('pauses older pending work after review %s', async (status) => {
  state.ready = true;
  state.toolContext = 'slide';
  state.editorKind = 'slide';
  state.editorReady = true;
  state.toolPlan.mockResolvedValue({ tool: 'add_slide_text', input: { text: 'Draft' }, readOnly: false });
  const calls: string[] = [];
  state.queueStream = async (text) => {
    calls.push(text);
  };
  const panel = createPreparedPanel();
  document.body.append(panel);
  enterQueueDraft(panel, 'Add a new text box on the current slide with this exact plain text: Draft');
  await vi.waitFor(() => expect(panel.querySelector('.agent-plan-preview[data-state=pending]')).not.toBeNull());
  enterQueueDraft(panel, 'Hello');
  if (status === 'cancelled') panel.querySelector<HTMLElement>('.agent-plan-cancel')!.click();
  else {
    state.apply.mockImplementationOnce(async () => {
      if (status === 'failed') throw new Error('write failed');
      return 'sent';
    });
    panel.querySelector<HTMLElement>('.agent-plan-apply')!.click();
  }
  await vi.waitFor(() => expect(panel.querySelector('.agent-queue-resume')?.hasAttribute('hidden')).toBe(false));
  expect(calls).toEqual([]);
  enterQueueDraft(panel, 'Hi');
  expect(calls).toEqual([]);
});
it('prioritizes explicit Refine without executing its old suggestion or unrelated pending work', async () => {
  state.ready = true;
  state.toolContext = 'slide';
  state.editorKind = 'slide';
  state.editorReady = true;
  state.toolPlan
    .mockResolvedValueOnce({ tool: 'add_slide_text', input: { text: 'First' }, readOnly: false })
    .mockResolvedValueOnce({ tool: 'add_slide_text', input: { text: 'Replacement' }, readOnly: false });
  const panel = createPreparedPanel();
  document.body.append(panel);
  enterQueueDraft(panel, 'Add a new text box on the current slide with this exact plain text: First');
  await vi.waitFor(() => expect(panel.querySelector('.agent-plan-preview[data-state=pending]')).not.toBeNull());
  enterQueueDraft(panel, 'Hello');
  panel.querySelector<HTMLElement>('.agent-plan-refine')!.click();
  enterQueueDraft(panel, 'Change the suggestion text to Replacement');
  await vi.waitFor(() => expect(panel.querySelectorAll('.agent-plan-preview')).toHaveLength(2));
  expect(panel.querySelector('.agent-plan-preview:last-child')?.getAttribute('data-state')).toBe('pending');
  expect(state.apply).not.toHaveBeenCalled();
  expect([...panel.querySelectorAll('.agent-queue-text')].map((row) => row.textContent)).toEqual(['Hello']);
});
it('pauses the previous conversation on switch and requires Resume on return', async () => {
  state.ready = true;
  const calls: string[] = [];
  state.queueStream = (text, _delta, signal) =>
    new Promise((_resolve, reject) => {
      calls.push(text);
      signal?.addEventListener('abort', () => reject(signal.reason), { once: true });
    });
  const panel = createPreparedPanel();
  document.body.append(panel);
  const original = activeSession();
  enterQueueDraft(panel, 'Hello');
  await vi.waitFor(() => expect(calls).toHaveLength(1));
  enterQueueDraft(panel, 'Hi');
  panel.querySelector<HTMLButtonElement>('.agent-panel-clear')!.click();
  await vi.waitFor(() => expect(panel.querySelector('.cui-send-stop')).toBeNull());
  expect(panel.querySelectorAll('.agent-queue-entry')).toHaveLength(0);
  openSession(panel, original);
  expect(calls).toHaveLength(1);
  expect(panel.querySelectorAll('.agent-queue-entry')).toHaveLength(1);
  panel.querySelector<HTMLButtonElement>('.agent-queue-resume')!.click();
  await vi.waitFor(() => expect(calls).toEqual(['Hello', 'Hi']));
});
it('preserves a pending original provider binding after switching the selected model', async () => {
  state.ready = true;
  let finish!: () => void;
  const calls: string[] = [];
  state.queueStream = (text) =>
    new Promise((resolve) => {
      calls.push(text);
      finish = resolve;
    });
  const panel = createPreparedPanel();
  document.body.append(panel);
  enterQueueDraft(panel, 'Hello');
  await vi.waitFor(() => expect(calls).toHaveLength(1));
  enterQueueDraft(panel, 'Hi');
  const select = panel.querySelector<HTMLElement>('.agent-panel-model')!;
  select.setAttribute('value', 'another-model');
  select.dispatchEvent(new Event('change'));
  finish();
  await new Promise((resolve) => setTimeout(resolve, 0));
  panel.querySelector<HTMLButtonElement>('.agent-queue-resume')!.click();
  await vi.waitFor(() => expect(panel.textContent).toContain(t('agentQueueScopeChanged')));
  expect(calls).toHaveLength(1);
  expect(panel.querySelectorAll('.agent-queue-entry')).toHaveLength(1);
});
it('replaces an actual native-tool review through Refine without overlapping its old submit or applying either proposal', async () => {
  state.nativeEndpoint = true;
  state.editorReady = true;
  state.editorKind = 'slide';
  state.toolContext = 'slide';
  state.toolPlan.mockResolvedValue({ tool: 'add_slide_text', input: { text: 'Replacement' }, readOnly: false });
  const nativeBodies: Array<Record<string, unknown>> = [];
  const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    if (body.tools?.length) nativeBodies.push(body);
    return new Response(
      JSON.stringify({
        choices: [
          {
            message: body.tools?.length
              ? {
                  content: null,
                  tool_calls: [
                    {
                      id: 'native-review',
                      type: 'function',
                      function: { name: 'add_slide_text', arguments: JSON.stringify({ text: 'Original native' }) },
                    },
                  ],
                }
              : { content: 'connected' },
            finish_reason: body.tools?.length ? 'tool_calls' : 'stop',
          },
        ],
      }),
    );
  });
  vi.stubGlobal('fetch', fetchMock);
  try {
    const panel = createAgentPanel();
    document.body.append(panel);
    const kind = panel.querySelector<HTMLSelectElement>('.agent-endpoint-kind')!;
    kind.value = 'openai-compatible';
    kind.dispatchEvent(new Event('change'));
    for (const [selector, value] of [
      ['.agent-panel-endpoint-url', 'https://api.example.com/v1'],
      ['.agent-panel-endpoint-model', 'tool-model'],
      ['.agent-panel-endpoint-key', 'sk-test'],
    ]) {
      const field = panel.querySelector<HTMLInputElement>(selector)!;
      field.value = value;
      field.dispatchEvent(new Event('change'));
    }
    const connect = panel.querySelector<HTMLButtonElement>('.agent-panel-endpoint-connect')!;
    connect.click();
    await vi.waitFor(() => expect(connect.textContent).toBe(t('agentEndpointDisconnect')));
    enterQueueDraft(panel, 'Put a title on this slide');
    await vi.waitFor(() => expect(panel.querySelector('.agent-plan-preview[data-state=pending]')).not.toBeNull());
    enterQueueDraft(panel, 'Hello');
    panel.querySelector<HTMLElement>('.agent-plan-refine')!.click();
    enterQueueDraft(panel, 'Change the suggestion title to Replacement');
    await vi.waitFor(() => expect(panel.querySelectorAll('.agent-plan-preview')).toHaveLength(2));
    expect(state.apply).not.toHaveBeenCalled();
    expect(nativeBodies).toHaveLength(1);
    expect(panel.querySelectorAll('.agent-queue-entry')).toHaveLength(1);
    expect(panel.querySelector('.agent-queue-text')?.textContent).toBe('Hello');
  } finally {
    vi.unstubAllGlobals();
  }
});
it('waits for a cancelled review Apply to actually settle before Send now starts a model turn', async () => {
  state.ready = true;
  state.toolContext = 'slide';
  state.editorKind = 'slide';
  state.editorReady = true;
  state.toolPlan.mockResolvedValue({ tool: 'add_slide_text', input: { text: 'Draft' }, readOnly: false });
  const calls: string[] = [];
  state.queueStream = async (text) => {
    calls.push(text);
  };
  const panel = createPreparedPanel();
  document.body.append(panel);
  enterQueueDraft(panel, 'Add a new text box on the current slide with this exact plain text: Draft');
  await vi.waitFor(() => expect(panel.querySelector('.agent-plan-preview[data-state=pending]')).not.toBeNull());
  let finish!: (status: 'verified') => void;
  state.apply.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  panel.querySelector<HTMLElement>('.agent-plan-apply')!.click();
  enterQueueDraft(panel, 'Hello');
  panel.querySelector<HTMLButtonElement>('.agent-queue-send-now')!.click();
  expect(calls).toEqual([]);
  expect(panel.querySelector('.agent-plan-preview')?.getAttribute('data-state')).toBe('applying');
  finish('verified');
  await vi.waitFor(() => expect(calls).toEqual(['Hello']));
  expect(panel.querySelector('.agent-plan-preview')?.getAttribute('data-state')).toBe('cancelled');
  expect(panel.querySelector('.agent-plan-preview')?.textContent).not.toContain(t('agentPlanVerified'));
});
it('keeps a queued request pending through a readiness failure and preserves a different composer draft', async () => {
  state.ready = true;
  const calls: string[] = [];
  let finish!: () => void;
  state.queueStream = (text) =>
    new Promise((resolve) => {
      calls.push(text);
      finish = resolve;
    });
  const panel = createPreparedPanel();
  document.body.append(panel);
  enterQueueDraft(panel, 'Hello');
  await vi.waitFor(() => expect(calls).toHaveLength(1));
  enterQueueDraft(panel, 'Hi');
  const input = panel.querySelector<HTMLTextAreaElement>('.cui-input')!;
  input.value = 'A different draft';
  input.dispatchEvent(new Event('input'));
  state.ready = false;
  finish();
  await vi.waitFor(() => expect(panel.querySelector('.agent-queue-resume')?.hasAttribute('hidden')).toBe(false));
  expect(calls).toEqual(['Hello']);
  expect(panel.querySelectorAll('.cui-msg-user')).toHaveLength(1);
  expect(panel.querySelector('.agent-queue-text')?.textContent).toBe('Hi');
  expect(input.value).toBe('A different draft');
  state.ready = true;
  panel.querySelector<HTMLButtonElement>('.agent-queue-resume')!.click();
  await vi.waitFor(() => expect(calls).toEqual(['Hello', 'Hi']));
  expect(input.value).toBe('A different draft');
});
it('pauses older queued requests after a model failure instead of treating promise resolution as success', async () => {
  state.ready = true;
  let fail!: () => void;
  const calls: string[] = [];
  state.queueStream = (text) =>
    new Promise((_resolve, reject) => {
      calls.push(text);
      fail = () => reject(new Error('Model failed'));
    });
  const panel = createPreparedPanel();
  document.body.append(panel);
  enterQueueDraft(panel, 'Hello');
  await vi.waitFor(() => expect(calls).toHaveLength(1));
  enterQueueDraft(panel, 'Hi');
  fail();
  await vi.waitFor(() => expect(panel.querySelector('.agent-queue-resume')?.hasAttribute('hidden')).toBe(false));
  enterQueueDraft(panel, 'Hey');
  expect(calls).toEqual(['Hello']);
  expect(panel.querySelectorAll('.agent-queue-entry')).toHaveLength(2);
});
it.each(['restore', 'import', 'delete-current', 'delete-all'] as const)(
  'invalidates volatile pending work on history %s',
  async (action) => {
    state.ready = true;
    const calls: string[] = [];
    state.queueStream = (text, _delta, signal) =>
      new Promise((_resolve, reject) => {
        calls.push(text);
        signal?.addEventListener('abort', () => reject(signal.reason), { once: true });
      });
    const panel = createPreparedPanel();
    document.body.append(panel);
    enterQueueDraft(panel, 'Hello');
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    enterQueueDraft(panel, 'Hi');
    panel.querySelector<HTMLButtonElement>(`.agent-history-${action}`)!.click();
    if (action.startsWith('delete-')) panel.querySelector<HTMLButtonElement>('.agent-history-confirm')!.click();
    await vi.waitFor(() => expect(panel.querySelectorAll('.agent-queue-entry')).toHaveLength(0));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(calls).toEqual(['Hello']);
  },
);
it('pauses before pagehide review disposal and never auto-sends on BFCache restoration', async () => {
  state.ready = true;
  state.toolContext = 'slide';
  state.editorKind = 'slide';
  state.editorReady = true;
  state.toolPlan.mockResolvedValue({ tool: 'add_slide_text', input: { text: 'Draft' }, readOnly: false });
  const calls: string[] = [];
  state.queueStream = async (text) => {
    calls.push(text);
  };
  const panel = createPreparedPanel();
  document.body.append(panel);
  enterQueueDraft(panel, 'Add a new text box on the current slide with this exact plain text: Draft');
  await vi.waitFor(() => expect(panel.querySelector('.agent-plan-preview[data-state=pending]')).not.toBeNull());
  enterQueueDraft(panel, 'Hello');
  const hide = new Event('pagehide');
  Object.defineProperty(hide, 'persisted', { value: true });
  window.dispatchEvent(hide);
  const show = new Event('pageshow');
  Object.defineProperty(show, 'persisted', { value: true });
  window.dispatchEvent(show);
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(calls).toEqual([]);
  expect(panel.querySelectorAll('.agent-queue-entry')).toHaveLength(1);
  expect(panel.querySelector('.agent-queue-resume')?.hasAttribute('hidden')).toBe(false);
});
it.each(['execute', 'edit'] as const)(
  'keeps queued trusted reads by reference and revokes their provenance on %s',
  async (action) => {
    state.ready = true;
    state.editorReady = true;
    state.toolContext = 'word';
    state.source = 'Selected original source';
    let finish!: () => void;
    state.queueStream = () =>
      new Promise((resolve) => {
        finish = resolve;
      });
    const hostRead = await import('../../lib/agent-plugin/ui/host-read-request');
    const prepare = vi.spyOn(hostRead, 'prepareHostRead');
    const panel = createPreparedPanel();
    document.body.append(panel);
    const summary = panel.querySelector<HTMLButtonElement>('[data-task="summarize"]')!;
    try {
      enterQueueDraft(panel, 'Hello');
      await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
      summary.click();
      const input = panel.querySelector<HTMLTextAreaElement>('.cui-input')!;
      const text = input.value;
      expect(text).not.toBe('');
      enterQueueDraft(panel, text);
      expect(prepare).not.toHaveBeenCalled();
      if (action === 'edit') {
        panel.querySelector<HTMLButtonElement>('.agent-queue-edit')!.click();
        expect(input.value).toBe(text);
        expect(panel.querySelectorAll('.agent-queue-entry')).toHaveLength(0);
      }
      finish();
      if (action === 'execute') {
        await vi.waitFor(() => expect(prepare).toHaveBeenCalledOnce());
        const { isCurrentHostRead } = await import('../../lib/agent-plugin/ui/task-entry');
        expect(isCurrentHostRead(prepare.mock.calls[0][0])).toBe(true);
        expect(prepare.mock.results[0].value.request.tools).toEqual({});
        expect(state.routing).not.toHaveBeenCalled();
      } else {
        await vi.waitFor(() => expect(panel.querySelector('.cui-send-stop')).toBeNull());
        enterQueueDraft(panel, text);
        await vi.waitFor(() => expect(panel.querySelector('.cui-send-stop')).toBeNull());
        expect(prepare).not.toHaveBeenCalled();
      }
    } finally {
      prepare.mockRestore();
    }
  },
);

it('pauses the next queued request after a real unsupported PDF preflight refusal without starting an answer call', async () => {
  state.ready = true;
  state.editorReady = true;
  state.toolContext = 'pdf';
  state.pdfEffect = 'edit_body';
  state.routing.mockResolvedValue({ task: 'tools', language: 'en' });
  let finish!: () => void;
  state.semanticGate = new Promise((resolve) => {
    finish = resolve;
  });
  const calls: string[] = [];
  state.queueStream = async (text) => {
    calls.push(text);
  };
  const panel = createPreparedPanel();
  document.body.append(panel);
  enterQueueDraft(panel, 'Please change the PDF body budget to 200.');
  await vi.waitFor(() => expect(panel.querySelector('.cui-send-stop')).not.toBeNull());
  enterQueueDraft(panel, 'Hello');
  finish();
  await vi.waitFor(() => expect(panel.querySelector('.agent-queue-resume')?.hasAttribute('hidden')).toBe(false));
  expect(panel.textContent).toContain(t('agentPdfBodyUnsupported'));
  expect(calls).toEqual([]);
  expect(state.apply).not.toHaveBeenCalled();
  expect([...panel.querySelectorAll('.agent-queue-text')].map((row) => row.textContent)).toEqual([
    'Please change the PDF body budget to 200.',
    'Hello',
  ]);
  expect(panel.querySelectorAll('.cui-msg-user')).toHaveLength(0);
  expect(state.conversations!.history().load()).toEqual([]);
});
it('pauses queued work when an explicit direct operation has no verified capability receipt', async () => {
  state.ready = true;
  state.editorReady = true;
  state.editorKind = 'slide';
  state.toolContext = 'slide';
  const { agentTools } = await import('../../lib/agent-plugin/tools');
  let finish!: () => void;
  const execute = vi.spyOn(agentTools.slide_action, 'execute').mockImplementation(async () => {
    await new Promise<void>((resolve) => {
      finish = resolve;
    });
    return { verified: false, count: 2, page: 2 } as never;
  });
  const calls: string[] = [];
  state.queueStream = async (text) => {
    calls.push(text);
  };
  try {
    const panel = createPreparedPanel();
    document.body.append(panel);
    enterQueueDraft(panel, 'Add a slide');
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
    enterQueueDraft(panel, 'Hello');
    finish();
    await vi.waitFor(() => expect(panel.querySelector('.cui-send-stop')).toBeNull());
    expect(calls).toEqual([]);
    expect(panel.querySelector('.agent-queue-text')?.textContent).toBe('Hello');
    expect(panel.textContent).not.toContain(t('agentPlanVerified'));
    expect(panel.querySelector('.agent-queue-resume')?.hasAttribute('hidden')).toBe(false);
  } finally {
    execute.mockRestore();
  }
});
it.each(['missing-selection', 'protocol', 'stale', 'stop'] as const)(
  'retains an unresolved request through held routing %s without echoing or persisting an executed turn',
  async (mode) => {
    state.ready = true;
    state.editorReady = true;
    state.toolContext = 'word';
    if (mode === 'stale') state.source = 'Original selected source';
    state.semanticResponse =
      mode === 'missing-selection'
        ? '{"task":"rewrite","language":"en"}'
        : mode === 'protocol'
          ? '{"unexpected":true}'
          : '{"task":"chat","language":"en"}';
    let finish!: () => void;
    state.semanticGate = new Promise((resolve) => {
      finish = resolve;
    });
    const calls: string[] = [];
    state.queueStream = async (text) => {
      calls.push(text);
    };
    const panel = createPreparedPanel();
    document.body.append(panel);
    const text = 'Please improve the wording of my request.';
    enterQueueDraft(panel, text);
    await vi.waitFor(() => expect(panel.querySelector('.cui-status')?.textContent).toBe(t('agentRoutingRequest')));
    expect(panel.querySelectorAll('.agent-queue-entry')).toHaveLength(1);
    expect(panel.querySelectorAll('.cui-msg-user')).toHaveLength(0);
    if (mode === 'stale') state.targetCurrent = false;
    if (mode === 'stop') panel.querySelector<HTMLButtonElement>('.cui-send-stop')!.click();
    finish();
    await vi.waitFor(() => expect(panel.querySelector('.cui-send-stop')).toBeNull());
    expect(calls).toEqual([]);
    expect(state.writing).not.toHaveBeenCalled();
    expect(panel.querySelector('.agent-queue-text')?.textContent).toBe(text);
    expect(panel.querySelector('.agent-queue-resume')?.hasAttribute('hidden')).toBe(mode === 'stop');
    expect(state.conversations!.history().load()).toEqual([]);
  },
);
it.each(['unavailable', 'empty'] as const)(
  'retains a trusted %s source request without calling the answer model',
  async (kind) => {
    state.ready = true;
    state.editorReady = true;
    state.toolContext = 'word';
    const context = await import('../../lib/agent-plugin/ui/request-context');
    const read = vi.spyOn(context, 'captureRequestContext').mockReturnValue({
      editor: { kind: 'word' },
      selection: { text: '', truncated: false },
      content: { scope: 'document-body', ...(kind === 'unavailable' ? { unavailable: true as const } : { text: '' }) },
    });
    const calls: string[] = [];
    state.queueStream = async (text) => {
      calls.push(text);
    };
    try {
      const panel = createPreparedPanel();
      document.body.append(panel);
      panel.querySelector<HTMLButtonElement>('[data-task="read"]')!.click();
      const text = panel.querySelector<HTMLTextAreaElement>('.cui-input')!.value;
      enterQueueDraft(panel, text);
      await vi.waitFor(() => expect(panel.querySelector('.cui-send-stop')).toBeNull());
      expect(calls).toEqual([]);
      expect(state.routing).not.toHaveBeenCalled();
      expect(panel.querySelector('.agent-queue-text')?.textContent).toBe(text);
      expect(panel.querySelectorAll('.cui-msg-user')).toHaveLength(0);
      expect(state.conversations!.history().load()).toEqual([]);
    } finally {
      read.mockRestore();
    }
  },
);
it.each([false, true])(
  'allows fresh Send after routing Stop only when older executable work is absent: older=%s',
  async (older) => {
    state.ready = true;
    state.editorReady = true;
    state.toolContext = 'word';
    state.semanticResponse = '{"task":"chat","language":"en"}';
    let finish!: () => void;
    state.semanticGate = new Promise((resolve) => {
      finish = resolve;
    });
    const calls: string[] = [];
    state.queueStream = async (text) => {
      calls.push(text);
    };
    const panel = createPreparedPanel();
    document.body.append(panel);
    enterQueueDraft(panel, 'Tell me a brief story');
    await vi.waitFor(() => expect(panel.querySelector('.cui-status')?.textContent).toBe(t('agentRoutingRequest')));
    if (older) enterQueueDraft(panel, 'Hi');
    panel.querySelector<HTMLButtonElement>('.cui-send-stop')!.click();
    finish();
    await vi.waitFor(() => expect(panel.querySelector('.cui-send-stop')).toBeNull());
    state.semanticResponse = undefined;
    enterQueueDraft(panel, 'Hello');
    if (older) {
      expect(calls).toEqual([]);
      panel.querySelector<HTMLButtonElement>('.agent-queue-resume')!.click();
      await vi.waitFor(() => expect(calls).toEqual(['Hi', 'Hello']));
    } else await vi.waitFor(() => expect(calls).toEqual(['Hello']));
    expect(panel.querySelector('.agent-queue-text')?.textContent).toBe('Tell me a brief story');
    expect(panel.querySelector('.agent-queue-recovery')?.textContent).toBe(t('agentStopped'));
    expect(panel.querySelector<HTMLButtonElement>('.agent-queue-send-now')!.hidden).toBe(true);
  },
);
it('keeps a queue-only conversation reachable after switching away during validation without persisting its pending request', async () => {
  state.ready = true;
  state.editorReady = true;
  state.toolContext = 'word';
  state.semanticResponse = '{"task":"chat","language":"en"}';
  let finish!: () => void;
  state.semanticGate = new Promise((resolve) => {
    finish = resolve;
  });
  const panel = createPreparedPanel();
  document.body.append(panel);
  const original = activeSession();
  enterQueueDraft(panel, 'Tell me a brief story');
  await vi.waitFor(() => expect(panel.querySelector('.cui-status')?.textContent).toBe(t('agentRoutingRequest')));
  panel.querySelector<HTMLButtonElement>('.agent-panel-clear')!.click();
  finish();
  await new Promise((resolve) => setTimeout(resolve, 0));
  openSession(panel, original);
  expect(state.conversations!.history().load()).toEqual([]);
  expect(panel.querySelector('.agent-queue-text')?.textContent).toBe('Tell me a brief story');
  expect(panel.querySelectorAll('.cui-msg-user')).toHaveLength(0);
});
it('retains unsupported native PDF preflight and its next request before any controller turn or tool execution', async () => {
  state.nativeEndpoint = true;
  state.editorReady = true;
  state.toolContext = 'pdf';
  let finish!: () => void;
  const gate = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const requests: Array<Record<string, unknown>> = [];
  const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    requests.push(body);
    await gate;
    return new Response(
      JSON.stringify({ choices: [{ message: { content: '{"effect":"edit_body"}' }, finish_reason: 'stop' }] }),
    );
  });
  vi.stubGlobal('fetch', fetchMock);
  try {
    const panel = createAgentPanel();
    document.body.append(panel);
    const kind = panel.querySelector<HTMLSelectElement>('.agent-endpoint-kind')!;
    kind.value = 'openai-compatible';
    kind.dispatchEvent(new Event('change'));
    for (const [selector, value] of [
      ['.agent-panel-endpoint-url', 'https://api.example.com/v1'],
      ['.agent-panel-endpoint-model', 'tool-model'],
      ['.agent-panel-endpoint-key', 'sk-test'],
    ]) {
      const field = panel.querySelector<HTMLInputElement>(selector)!;
      field.value = value;
      field.dispatchEvent(new Event('change'));
    }
    const connect = panel.querySelector<HTMLButtonElement>('.agent-panel-endpoint-connect')!;
    connect.click();
    await vi.waitFor(() => expect(connect.textContent).toBe(t('agentEndpointDisconnect')));
    enterQueueDraft(panel, 'Change the budget in this PDF to 200.');
    await vi.waitFor(() => expect(requests).toHaveLength(1));
    enterQueueDraft(panel, 'Hello');
    expect(panel.querySelectorAll('.cui-msg-user')).toHaveLength(0);
    finish();
    await vi.waitFor(() => expect(panel.querySelector('.cui-send-stop')).toBeNull());
    expect(requests).toHaveLength(1);
    expect(requests[0].tools ?? []).toEqual([]);
    expect(state.apply).not.toHaveBeenCalled();
    expect(state.conversations!.history().load()).toEqual([]);
    expect([...panel.querySelectorAll('.agent-queue-text')].map((row) => row.textContent)).toEqual([
      'Change the budget in this PDF to 200.',
      'Hello',
    ]);
    expect(panel.textContent).toContain(t('agentPdfBodyUnsupported'));
  } finally {
    finish?.();
    vi.unstubAllGlobals();
  }
});
it.each(['stopped', 'failed'] as const)(
  'serializes Apply on the retained original after a %s refinement before a fresh request',
  async (outcome) => {
    state.ready = true;
    state.editorReady = true;
    state.editorKind = 'slide';
    state.toolContext = 'slide';
    let finishCandidate!: () => void;
    state.toolPlan
      .mockResolvedValueOnce({ tool: 'add_slide_text', input: { text: 'Original' }, readOnly: false })
      .mockImplementationOnce(
        () =>
          new Promise((resolve, reject) => {
            finishCandidate = () =>
              outcome === 'failed'
                ? reject(new Error('Candidate failed'))
                : resolve({ tool: 'add_slide_text', input: { text: 'Late' }, readOnly: false });
          }),
      );
    const calls: string[] = [];
    state.queueStream = async (text) => {
      calls.push(text);
    };
    const panel = createPreparedPanel();
    document.body.append(panel);
    enterQueueDraft(panel, 'Add a new text box on the current slide with this exact plain text: Original');
    await vi.waitFor(() => expect(panel.querySelector('.agent-plan-preview[data-state=pending]')).not.toBeNull());
    const original = panel.querySelector<HTMLElement>('.agent-plan-preview')!;
    original.querySelector<HTMLElement>('.agent-plan-refine')!.click();
    enterQueueDraft(panel, 'Change the suggestion text to Candidate');
    await vi.waitFor(() => expect(finishCandidate).toBeTypeOf('function'));
    if (outcome === 'stopped') panel.querySelector<HTMLButtonElement>('.cui-send-stop')!.click();
    finishCandidate();
    await vi.waitFor(() => expect(panel.querySelector('.cui-send-stop')).toBeNull());
    expect(original.dataset.state).toBe('pending');
    panel.querySelector<HTMLButtonElement>('.agent-refinement-context button')!.click();
    let finishApply!: () => void;
    state.apply.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishApply = () => resolve('verified');
        }),
    );
    original.querySelector<HTMLElement>('.agent-plan-apply')!.click();
    await vi.waitFor(() => expect(finishApply).toBeTypeOf('function'));
    enterQueueDraft(panel, 'Hello');
    expect(calls).toEqual([]);
    finishApply();
    await vi.waitFor(() => expect(calls).toEqual(['Hello']));
  },
);
it('serializes completed document-result Apply with a fresh Send until the actual write settles', async () => {
  state.ready = true;
  state.editorReady = true;
  state.toolContext = 'word';
  state.semanticResponse = '{"task":"compose","language":"en"}';
  const draft = await import('../../lib/agent-plugin/ui/document-draft');
  const generate = vi.spyOn(draft, 'generateDocumentDraft').mockResolvedValue('Completed article');
  const calls: string[] = [];
  state.queueStream = async (text) => {
    calls.push(text);
  };
  try {
    const panel = createPreparedPanel();
    document.body.append(panel);
    enterQueueDraft(panel, 'Write an article about autumn');
    await vi.waitFor(() => expect(panel.querySelector('.cui-apply')).not.toBeNull());
    await vi.waitFor(() => expect(panel.querySelector('.cui-send-stop')).toBeNull());
    let finishApply!: () => void;
    state.apply.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishApply = () => resolve('verified');
        }),
    );
    panel.querySelector<HTMLButtonElement>('.cui-apply')!.click();
    await vi.waitFor(() => expect(finishApply).toBeTypeOf('function'));
    state.semanticResponse = undefined;
    enterQueueDraft(panel, 'Hello');
    expect(calls).toEqual([]);
    finishApply();
    await vi.waitFor(() => expect(calls).toEqual(['Hello']));
  } finally {
    generate.mockRestore();
  }
});
it.each([
  'fresh',
  'resume',
  'send-now',
  'provider',
  'switch',
  'failed',
  'sent',
  'stop-fresh',
  'delete-current',
  'delete-all',
] as const)(
  'holds a retained native Apply through actual settlement during %s and records only verified owned execution',
  async (mode) => {
    if (mode === 'delete-all')
      state.conversationRepository = {
        load: async () => null,
        save: async (_data, revision) => revision + 1,
        clear: async () => 1,
      };
    state.nativeEndpoint = true;
    state.editorReady = true;
    state.editorKind = 'slide';
    state.toolContext = 'slide';
    const answers: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        const body = JSON.parse(String(init.body));
        const messages = body.messages as Array<{ role: string; content: unknown }>;
        const last = messages.filter((message) => message.role === 'user').at(-1)?.content;
        for (const greeting of ['Hello', 'Hi'])
          if (typeof last === 'string' && (last === greeting || last.endsWith(`User request:\n${greeting}`)))
            answers.push(greeting);
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: body.tools?.length
                  ? {
                      content: null,
                      tool_calls: [
                        {
                          id: 'original-native',
                          type: 'function',
                          function: { name: 'add_slide_text', arguments: JSON.stringify({ text: 'Original native' }) },
                        },
                      ],
                    }
                  : { content: 'Connected or answered' },
                finish_reason: body.tools?.length ? 'tool_calls' : 'stop',
              },
            ],
          }),
        );
      }),
    );
    let finishApply: (() => void) | undefined;
    try {
      const panel = createAgentPanel();
      document.body.append(panel);
      const kind = panel.querySelector<HTMLSelectElement>('.agent-endpoint-kind')!;
      kind.value = 'openai-compatible';
      kind.dispatchEvent(new Event('change'));
      for (const [selector, value] of [
        ['.agent-panel-endpoint-url', 'https://api.example.com/v1'],
        ['.agent-panel-endpoint-model', 'tool-model'],
        ['.agent-panel-endpoint-key', 'sk-test'],
      ]) {
        const field = panel.querySelector<HTMLInputElement>(selector)!;
        field.value = value;
        field.dispatchEvent(new Event('change'));
      }
      const connect = panel.querySelector<HTMLButtonElement>('.agent-panel-endpoint-connect')!;
      connect.click();
      await vi.waitFor(() => expect(connect.textContent).toBe(t('agentEndpointDisconnect')));
      enterQueueDraft(panel, 'Put a title on this slide');
      await vi.waitFor(() => expect(panel.querySelector('.agent-plan-preview[data-state=pending]')).not.toBeNull());
      const original = panel.querySelector<HTMLElement>('.agent-plan-preview')!;
      const originalOwner = activeSession();
      if (mode === 'resume') enterQueueDraft(panel, 'Hello');
      original.querySelector<HTMLElement>('.agent-plan-refine')!.click();
      await vi.waitFor(() => expect(panel.querySelector('.cui-send-stop')).toBeNull());
      panel.querySelector<HTMLButtonElement>('.agent-refinement-context button')!.click();
      let aborts = 0;
      state.apply.mockImplementationOnce(
        (signal?: AbortSignal) =>
          new Promise((resolve, reject) => {
            signal?.addEventListener('abort', () => aborts++);
            finishApply = () =>
              mode === 'failed' ? reject(new Error('Write failed')) : resolve(mode === 'sent' ? 'sent' : 'verified');
          }),
      );
      original.querySelector<HTMLElement>('.agent-plan-apply')!.click();
      await vi.waitFor(() => expect(finishApply).toBeTypeOf('function'));
      if (mode === 'stop-fresh') original.querySelector<HTMLElement>('.agent-plan-cancel')!.click();
      if (mode !== 'resume') enterQueueDraft(panel, 'Hello');
      if (mode === 'resume') panel.querySelector<HTMLButtonElement>('.agent-queue-resume')!.click();
      if (mode === 'send-now') {
        panel.querySelector<HTMLButtonElement>('.agent-queue-send-now')!.click();
        panel.querySelector<HTMLButtonElement>('.agent-queue-send-now')!.click();
      }
      if (mode === 'provider') {
        const model = panel.querySelector<HTMLInputElement>('.agent-panel-endpoint-model')!;
        model.value = 'different-model';
        model.dispatchEvent(new Event('change'));
      }
      if (mode === 'switch') {
        panel.querySelector<HTMLButtonElement>('.agent-panel-clear')!.click();
        enterQueueDraft(panel, 'Hi');
      }
      if (mode === 'delete-current' || mode === 'delete-all') {
        panel.querySelector<HTMLButtonElement>(`.agent-history-${mode}`)!.click();
        panel.querySelector<HTMLButtonElement>('.agent-history-confirm')!.click();
        await vi.waitFor(() => expect(activeSession()).not.toBe(originalOwner));
        await vi.waitFor(() =>
          expect(panel.querySelector<HTMLElement>('.agent-history-confirmation')!.hidden).toBe(true),
        );
        enterQueueDraft(panel, 'Hi');
        expect(panel.querySelector('.agent-queue-text')?.textContent).toBe('Hi');
      }
      expect(answers).toEqual([]);
      finishApply!();
      if (mode === 'failed' || mode === 'sent') {
        await vi.waitFor(() => expect(original.dataset.state).not.toBe('applying'));
        expect(answers).toEqual([]);
        panel.querySelector<HTMLButtonElement>('.agent-queue-resume')!.click();
      }
      if (mode === 'provider') {
        await vi.waitFor(() => expect(original.dataset.state).not.toBe('applying'));
        expect(answers).toEqual([]);
      } else
        await vi.waitFor(() =>
          expect(answers).toEqual([mode === 'switch' || mode.startsWith('delete-') ? 'Hi' : 'Hello']),
        );
      const history = state.conversations!.history().load();
      const blocks = history.flatMap((message) => (typeof message.content === 'string' ? [] : message.content));
      const receipts = blocks.filter(
        (block) => block.type === 'tool_result' && JSON.parse(block.content).status === 'verified',
      );
      expect(receipts).toHaveLength(mode === 'fresh' || mode === 'resume' ? 1 : 0);
      if (receipts[0]?.type === 'tool_result')
        expect(blocks).toContainEqual({
          type: 'tool_use',
          id: receipts[0].toolUseId,
          name: 'add_slide_text',
          input: { text: 'Original native' },
        });
      if (mode === 'send-now' || mode.startsWith('delete-')) expect(aborts).toBe(1);
      if (mode.startsWith('delete-')) {
        expect(state.conversations!.searchSnapshot().some((item) => item.id === originalOwner)).toBe(false);
        expect(JSON.stringify(history)).not.toContain('Original native');
      }
    } finally {
      finishApply?.();
      vi.unstubAllGlobals();
    }
  },
);

it('shows truthful unavailable actions while a queued request prepares and stops, then restores its exact text', async () => {
  state.ready = true;
  state.editorReady = true;
  state.toolContext = 'word';
  state.semanticResponse = '{"task":"chat","language":"en"}';
  let finishRouting!: () => void;
  state.semanticGate = new Promise<void>((resolve) => {
    finishRouting = resolve;
  });
  const panel = createPreparedPanel();
  document.body.append(panel);
  const text = 'Tell me a brief story';
  enterQueueDraft(panel, text);
  await vi.waitFor(() => expect(panel.querySelector('.cui-status')?.textContent).toBe(t('agentRoutingRequest')));
  expect(panel.querySelector('.agent-queue-state')?.textContent).toBe(t('agentPreparingTask'));
  for (const button of panel.querySelectorAll<HTMLButtonElement>('.agent-queue-actions button'))
    expect(button.disabled).toBe(true);
  const input = panel.querySelector<HTMLTextAreaElement>('.cui-input')!;
  expect(input.value).toBe('');
  panel.querySelector<HTMLButtonElement>('.agent-queue-edit')!.click();
  expect(panel.textContent).not.toContain(t('agentQueueComposerOccupied'));
  panel.querySelector<HTMLButtonElement>('.cui-send-stop')!.click();
  expect(panel.querySelector('.agent-queue-state')?.textContent).toBe(t('agentStopping'));
  expect(panel.querySelector<HTMLButtonElement>('.agent-queue-edit')!.disabled).toBe(true);
  finishRouting();
  await vi.waitFor(() => expect(panel.querySelector('.cui-send-stop')).toBeNull());
  const edit = panel.querySelector<HTMLButtonElement>('.agent-queue-edit')!;
  expect(edit.disabled).toBe(false);
  edit.click();
  expect(input.value).toBe(text);
});

it('distinguishes unavailable recovery from an occupied composer when an edit is refused', async () => {
  state.ready = true;
  let finish!: () => void;
  state.queueStream = () =>
    new Promise((resolve) => {
      finish = resolve;
    });
  const panel = createPreparedPanel();
  enterQueueDraft(panel, 'Hello');
  await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
  enterQueueDraft(panel, 'Hi');
  const restore = vi.spyOn(RequestQueue.prototype, 'restore').mockReturnValue(false);
  try {
    panel.querySelector<HTMLButtonElement>('.agent-queue-edit')!.click();
    expect(panel.querySelector('.agent-queue-feedback')?.textContent).toBe(t('agentQueueEditUnavailable'));
    expect(panel.textContent).not.toContain(t('agentQueueComposerOccupied'));
  } finally {
    restore.mockRestore();
    finish();
  }
});
it.each(['Hello', 'Tell me a joke'])(
  'continues conversation-only %s while the editor changes during its answer',
  async (text) => {
    state.ready = true;
    state.editorReady = true;
    state.semanticResponse = '{"task":"chat","language":"en"}';
    let finish!: () => void;
    state.queueStream = async () =>
      new Promise((resolve) => {
        finish = resolve;
      });
    const send = vi.spyOn(AgentChatController.prototype, 'send');
    const panel = createPreparedPanel();
    document.body.append(panel);
    try {
      enterQueueDraft(panel, text);
      await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
      state.targetCurrent = false;
      finish();
      await expect(send.mock.results.at(-1)!.value).resolves.toMatchObject({ status: 'success' });
      expect(panel.querySelector('.cui-msg-agent')?.textContent).toContain('answer');
      expect(send.mock.calls.at(-1)![1]?.request?.getRequestContext()).toBeUndefined();
      expect(send.mock.calls.at(-1)![1]?.request?.tools).toEqual({});
    } finally {
      send.mockRestore();
    }
  },
);
it('allows classification to finish as ordinary chat after an editor change', async () => {
  state.ready = true;
  state.editorReady = true;
  state.semanticResponse = '{"task":"chat","language":"en"}';
  let finish!: () => void;
  state.semanticGate = new Promise((resolve) => {
    finish = resolve;
  });
  const calls: string[] = [];
  state.queueStream = async (text) => {
    calls.push(text);
  };
  const panel = createPreparedPanel();
  document.body.append(panel);
  enterQueueDraft(panel, 'Tell me a joke');
  await vi.waitFor(() => expect(panel.querySelector('.cui-root')?.getAttribute('data-activity')).toBe('routing'));
  state.targetCurrent = false;
  finish();
  await vi.waitFor(() => expect(calls).toEqual(['Tell me a joke']));
});
it('keeps queued ordinary chat independent of a later sensitive spreadsheet selection', async () => {
  state.ready = true;
  state.editorReady = true;
  state.editorKind = 'cell';
  state.toolContext = 'cell';
  state.semanticResponse = '{"task":"chat","language":"en"}';
  let finish!: () => void;
  const calls: string[] = [];
  state.queueStream = async (text) => {
    calls.push(text);
    if (calls.length === 1)
      await new Promise<void>((resolve) => {
        finish = resolve;
      });
  };
  const send = vi.spyOn(AgentChatController.prototype, 'send');
  const panel = createPreparedPanel();
  document.body.append(panel);
  try {
    enterQueueDraft(panel, 'Hello');
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
    enterQueueDraft(panel, 'Tell me a joke');
    state.source = 'Sensitive later cell value';
    state.targetCurrent = false;
    finish();
    await vi.waitFor(() => expect(calls).toEqual(['Hello', 'Tell me a joke']));
    expect(send.mock.calls.at(-1)![1]?.request?.getRequestContext()).toBeUndefined();
    expect(JSON.stringify(state.conversations!.history().load())).not.toContain('Sensitive later cell value');
  } finally {
    send.mockRestore();
  }
});
it.each(['plain', 'stale-tool', 'read-then-edit'] as const)(
  'preserves native original-scope boundaries during concurrent editing: %s',
  async (mode) => {
    state.nativeEndpoint = true;
    state.editorReady = true;
    state.editorKind = 'slide';
    state.toolContext = 'slide';
    state.readText = 'Original slide source';
    let finish!: () => void;
    let nativeCalls = 0;
    const bodies: unknown[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        const body = JSON.parse(String(init.body));
        bodies.push(body);
        nativeCalls++;
        const tools = body.tools?.length;
        if ((mode !== 'read-then-edit' && tools) || (mode === 'read-then-edit' && nativeCalls === 2))
          await new Promise<void>((resolve) => {
            finish = resolve;
          });
        const tool = tools && (mode === 'stale-tool' || (mode === 'read-then-edit' && nativeCalls === 1));
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: tool
                  ? {
                      content: null,
                      tool_calls: [
                        {
                          id: 'original-read',
                          type: 'function',
                          function: { name: 'get_presentation_text', arguments: '{}' },
                        },
                      ],
                    }
                  : { content: 'A general conversation answer' },
                finish_reason: tool ? 'tool_calls' : 'stop',
              },
            ],
          }),
        );
      }),
    );
    const send = vi.spyOn(AgentChatController.prototype, 'send');
    try {
      const panel = createAgentPanel();
      document.body.append(panel);
      const kind = panel.querySelector<HTMLSelectElement>('.agent-endpoint-kind')!;
      kind.value = 'openai-compatible';
      kind.dispatchEvent(new Event('change'));
      for (const [selector, value] of [
        ['.agent-panel-endpoint-url', 'https://api.example.com/v1'],
        ['.agent-panel-endpoint-model', 'tool-model'],
        ['.agent-panel-endpoint-key', 'sk-test'],
      ]) {
        const field = panel.querySelector<HTMLInputElement>(selector)!;
        field.value = value;
        field.dispatchEvent(new Event('change'));
      }
      const connect = panel.querySelector<HTMLButtonElement>('.agent-panel-endpoint-connect')!;
      connect.click();
      await vi.waitFor(() => expect(connect.textContent).toBe(t('agentEndpointDisconnect')));
      enterQueueDraft(panel, 'Tell me a joke');
      await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
      state.targetCurrent = false;
      state.source = 'Sensitive later selection';
      finish();
      await expect(send.mock.results.at(-1)!.value).resolves.toMatchObject({
        status: mode === 'plain' ? 'success' : 'failed',
      });
      if (mode === 'plain')
        expect(panel.querySelector('.cui-msg-agent')?.textContent).toContain('A general conversation answer');
      else expect(panel.textContent).not.toContain('A general conversation answer');
      expect(state.apply).toHaveBeenCalledTimes(mode === 'read-then-edit' ? 1 : 0);
      expect(JSON.stringify(bodies)).not.toContain('Sensitive later selection');
      expect(nativeCalls).toBe(mode === 'read-then-edit' ? 2 : 1);
      expect(send.mock.calls.at(-1)![1]?.request?.getRequestContext()).toBeUndefined();
    } finally {
      finish?.();
      send.mockRestore();
      vi.unstubAllGlobals();
    }
  },
);

it('serializes only the original selected cell values after routing without recapturing later values', async () => {
  state.ready = true;
  state.editorReady = true;
  state.editorKind = 'cell';
  state.toolContext = 'cell';
  state.source = 'Original cell value';
  state.semanticResponse = '{"task":"chat","language":"en"}';
  let finish!: () => void;
  state.semanticGate = new Promise((resolve) => {
    finish = resolve;
  });
  const send = vi.spyOn(AgentChatController.prototype, 'send');
  const panel = createPreparedPanel();
  document.body.append(panel);
  try {
    enterQueueDraft(panel, 'Explain this value');
    await vi.waitFor(() => expect(panel.querySelector('.cui-root')?.getAttribute('data-activity')).toBe('routing'));
    state.source = 'Later private value';
    finish();
    await vi.waitFor(() => expect(send).toHaveBeenCalledOnce());
    const context = send.mock.calls[0][1]?.request?.getRequestContext();
    expect(context).toContain('Original cell value');
    expect(context).not.toContain('Later private value');
  } finally {
    send.mockRestore();
  }
});
it('omits a selected source for an exact greeting while retaining selection-bound ordinary answers', async () => {
  state.ready = true;
  state.editorReady = true;
  state.source = 'Private selected source';
  const send = vi.spyOn(AgentChatController.prototype, 'send');
  const panel = createPreparedPanel();
  document.body.append(panel);
  try {
    enterQueueDraft(panel, 'Hello');
    await vi.waitFor(() => expect(send).toHaveBeenCalledOnce());
    await expect(send.mock.results[0].value).resolves.toMatchObject({ status: 'success' });
    expect(send.mock.calls[0][1]?.request?.getRequestContext()).toBeUndefined();
    state.semanticResponse = '{"task":"chat","language":"en"}';
    let finish!: () => void;
    state.queueStream = async () =>
      new Promise((resolve) => {
        finish = resolve;
      });
    enterQueueDraft(panel, 'Explain this source');
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
    state.targetCurrent = false;
    finish();
    await expect(send.mock.results.at(-1)!.value).resolves.toMatchObject({ status: 'failed' });
  } finally {
    send.mockRestore();
  }
});

it('allows a queued ordinary chat through a readonly toggle without weakening queued document work', async () => {
  state.ready = true;
  state.editorReady = true;
  state.semanticResponse = '{"task":"chat","language":"en"}';
  let finish!: () => void;
  const calls: string[] = [];
  state.queueStream = async (text) => {
    calls.push(text);
    if (calls.length === 1)
      await new Promise<void>((resolve) => {
        finish = resolve;
      });
  };
  const panel = createPreparedPanel();
  document.body.append(panel);
  enterQueueDraft(panel, 'Hello');
  await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
  enterQueueDraft(panel, 'Tell me a joke');
  state.readonly = true;
  finish();
  await vi.waitFor(() => expect(calls).toEqual(['Hello', 'Tell me a joke']));
});
it('retains exact pending text when enqueue-time composer capture throws instead of assuming an empty source', async () => {
  state.ready = true;
  state.editorReady = true;
  const context = await import('../../lib/agent-plugin/ui/composer-context');
  const calls: string[] = [];
  state.queueStream = async (text) => {
    calls.push(text);
  };
  const panel = createPreparedPanel();
  document.body.append(panel);
  // Only enqueue capture is failed; idle context presentation was already mounted.
  const failure = vi.spyOn(context, 'captureComposerContext').mockImplementationOnce(() => {
    throw new Error('SDK is transitioning');
  });
  try {
    enterQueueDraft(panel, 'Hello');
    await vi.waitFor(() => expect(panel.querySelector('.agent-queue-text')?.textContent).toBe('Hello'));
    expect(calls).toEqual([]);
    expect(state.conversations!.history().load()).toEqual([]);
    panel.querySelector<HTMLButtonElement>('.agent-queue-edit')!.click();
    expect(panel.querySelector<HTMLTextAreaElement>('.cui-input')!.value).toBe('Hello');
  } finally {
    failure.mockRestore();
  }
});
it('refuses a document artifact after its original editor scope changes during composition', async () => {
  state.ready = true;
  state.editorReady = true;
  state.toolContext = 'word';
  state.semanticResponse = '{"task":"compose","language":"en"}';
  const draft = await import('../../lib/agent-plugin/ui/document-draft');
  let finish!: () => void;
  const generate = vi.spyOn(draft, 'generateDocumentDraft').mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = () => resolve('Late document artifact');
      }),
  );
  const panel = createPreparedPanel();
  document.body.append(panel);
  try {
    enterQueueDraft(panel, 'Write an article about autumn');
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
    state.targetCurrent = false;
    finish();
    await vi.waitFor(() => expect(panel.querySelector('.cui-send-stop')).toBeNull());
    expect(panel.textContent).not.toContain('Late document artifact');
    expect(panel.querySelector('.cui-msg-error')).not.toBeNull();
  } finally {
    generate.mockRestore();
  }
});
it.each(['answer', 'apply'] as const)(
  'dictates the next draft during a held %s and queues it once only after explicit Send finishes recognition',
  async (mode) => {
    class Recognition {
      static current: Recognition;
      constructor() {
        Recognition.current = this;
      }
      onstart?: () => void;
      onend?: () => void;
      onresult?: (event: unknown) => void;
      start = vi.fn();
      stop = vi.fn();
      abort = vi.fn();
    }
    vi.stubGlobal('SpeechRecognition', Recognition);
    state.ready = true;
    state.editorReady = true;
    state.toolContext = 'word';
    let finish!: () => void;
    const calls: string[] = [];
    state.queueStream = async (text) => {
      calls.push(text);
      if (mode === 'answer' && calls.length === 1)
        await new Promise<void>((resolve) => {
          finish = resolve;
        });
    };
    const draft = await import('../../lib/agent-plugin/ui/document-draft');
    const generate = vi.spyOn(draft, 'generateDocumentDraft').mockResolvedValue('Completed article');
    try {
      const panel = createPreparedPanel();
      document.body.append(panel);
      if (mode === 'answer') enterQueueDraft(panel, 'Hello');
      else {
        state.semanticResponse = '{"task":"compose","language":"en"}';
        enterQueueDraft(panel, 'Write an article about autumn');
        await vi.waitFor(() => expect(panel.querySelector('.cui-apply')).not.toBeNull());
        await vi.waitFor(() => expect(panel.querySelector('.cui-send-stop')).toBeNull());
        state.apply.mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              finish = () => resolve('verified');
            }),
        );
        panel.querySelector<HTMLButtonElement>('.cui-apply')!.click();
        state.semanticResponse = undefined;
      }
      await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
      panel.querySelector<HTMLButtonElement>('.agent-speech-mic')!.click();
      expect(Recognition.current).toBeDefined();
      Recognition.current.onstart?.();
      Recognition.current.onresult?.({ results: [{ isFinal: false, 0: { transcript: 'Hi' } }] });
      expect(panel.querySelector<HTMLTextAreaElement>('.cui-input')!.value).toBe('Hi');
      expect(calls).toEqual(mode === 'answer' ? ['Hello'] : []);
      panel.querySelector<HTMLButtonElement>('.cui-send')!.click();
      panel.querySelector<HTMLButtonElement>('.cui-send')!.click();
      expect(Recognition.current.stop).toHaveBeenCalledOnce();
      expect(panel.querySelectorAll('.agent-queue-entry')).toHaveLength(0);
      Recognition.current.onresult?.({ results: [{ isFinal: true, 0: { transcript: 'Hi' } }] });
      Recognition.current.onend?.();
      await vi.waitFor(() => expect(panel.querySelector('.agent-queue-text')?.textContent).toBe('Hi'));
      expect(panel.querySelector<HTMLTextAreaElement>('.cui-input')!.value).toBe('');
      expect(calls).toEqual(mode === 'answer' ? ['Hello'] : []);
      finish();
      await vi.waitFor(() => expect(calls).toEqual(mode === 'answer' ? ['Hello', 'Hi'] : ['Hi']));
    } finally {
      finish?.();
      generate.mockRestore();
      vi.unstubAllGlobals();
    }
  },
);
it.each(['switch', 'close', 'disable', 'delete', 'pagehide'] as const)(
  'closes next-draft dictation during a held answer on %s and ignores obsolete recognition callbacks',
  async (mode) => {
    class Recognition {
      static current: Recognition;
      constructor() {
        Recognition.current = this;
      }
      onstart?: () => void;
      onend?: () => void;
      onresult?: (event: unknown) => void;
      start = vi.fn();
      stop = vi.fn();
      abort = vi.fn();
    }
    vi.stubGlobal('SpeechRecognition', Recognition);
    state.ready = true;
    state.editorReady = true;
    let finish!: () => void;
    const calls: string[] = [];
    state.queueStream = async (text) => {
      calls.push(text);
      await new Promise<void>((resolve) => {
        finish = resolve;
      });
    };
    try {
      const panel = createPreparedPanel();
      document.body.append(panel);
      enterQueueDraft(panel, 'Hello');
      await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
      panel.querySelector<HTMLButtonElement>('.agent-speech-mic')!.click();
      expect(Recognition.current).toBeDefined();
      Recognition.current.onstart?.();
      const late = Recognition.current.onresult!;
      late({ results: [{ isFinal: false, 0: { transcript: 'Next draft' } }] });
      if (mode === 'switch') panel.querySelector<HTMLButtonElement>('.agent-panel-clear')!.click();
      else if (mode === 'close') setAgentPanelOpen(false);
      else if (mode === 'disable') await (await import('../../lib/agent-plugin/ui/panel')).setAgentPanelEnabled(false);
      else if (mode === 'delete') {
        panel.querySelector<HTMLButtonElement>('.agent-history-toggle')!.click();
        panel.querySelector<HTMLButtonElement>('.agent-history-delete-current')!.click();
        panel.querySelector<HTMLButtonElement>('.agent-history-confirm')!.click();
      } else window.dispatchEvent(new Event('pagehide'));
      expect(Recognition.current.abort).toHaveBeenCalledOnce();
      const draft = panel.querySelector<HTMLTextAreaElement>('.cui-input')!.value;
      late({ results: [{ isFinal: true, 0: { transcript: 'Obsolete next request' } }] });
      Recognition.current.onend?.();
      expect(panel.querySelector<HTMLTextAreaElement>('.cui-input')!.value).toBe(draft);
      expect(calls).toEqual(['Hello']);
      expect(panel.querySelectorAll('.agent-queue-entry')).toHaveLength(0);
    } finally {
      finish?.();
      vi.unstubAllGlobals();
    }
  },
);

it('keeps a known blocked writing request in the composer and opens settings instead of enqueueing failures', async () => {
  state.ready = true;
  state.editorReady = true;
  state.source = 'Original selected text';
  const panel = createPreparedPanel();
  await vi.waitFor(() => expect(panel.querySelector('.agent-panel-load')?.textContent).toBe(t('agentModelInUse')));
  const input = panel.querySelector<HTMLTextAreaElement>('.cui-input')!;
  input.value = 'Polish the selected text';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  const send = panel.querySelector<HTMLButtonElement>('.cui-send')!;
  expect(send.textContent).toBe(t('agentSettings'));
  send.click();
  expect(input.value).toBe('Polish the selected text');
  expect(panel.dataset.view).toBe('settings');
  expect(panel.querySelectorAll('.agent-queue-entry')).toHaveLength(0);
  expect(panel.querySelectorAll('.cui-msg-error')).toHaveLength(0);
  expect(state.writing).not.toHaveBeenCalled();
});

it('keeps artifact refinement independent of unavailable Office context and retries setup explicitly', async () => {
  const { createArtifactStore } = await import('../../lib/agent-plugin/artifacts/store');
  const artifact = await createArtifactStore().create({
    title: 'Standalone draft',
    text: 'Only artifact content',
    provenance: {},
  });
  state.editorReady = false;
  const panel = createAgentPanel();
  panel.querySelector<HTMLButtonElement>('.agent-workspace-toggle')!.click();
  await vi.waitFor(() => expect(panel.querySelector(`[data-artifact="${artifact.id}"]`)).not.toBeNull());
  panel.querySelector<HTMLButtonElement>(`[data-artifact="${artifact.id}"]`)!.click();
  await vi.waitFor(() => expect(panel.querySelector('.agent-artifact-editor textarea')).not.toBeNull());
  panel.querySelector<HTMLButtonElement>('[data-action=refine]')!.click();
  const instruction = panel.querySelector<HTMLInputElement>('.agent-artifact-workflow input')!;
  instruction.value = 'Shorten';
  const send = () =>
    panel
      .querySelector<HTMLFormElement>('.agent-artifact-workflow form')!
      .dispatchEvent(new Event('submit', { cancelable: true }));
  send();
  await vi.waitFor(() =>
    expect(panel.querySelector('.agent-artifact-workflow [role=status]')?.textContent).toBe(
      t('agentArtifactRevisionPrepare'),
    ),
  );
  expect(state.preload).not.toHaveBeenCalled();
  state.preload.mockImplementation(async () => {
    state.ready = true;
  });
  panel.querySelector<HTMLElement>('.agent-panel-load')!.click();
  await vi.waitFor(() => expect(state.ready).toBe(true));
  await vi.waitFor(() => expect(panel.querySelector('.agent-model-status')?.textContent).not.toBe(t('agentPreparing')));
  const calls: string[] = [];
  state.queueStream = async (text) => {
    calls.push(text);
  };
  send();
  await vi.waitFor(() =>
    expect(panel.querySelector('.agent-artifact-workflow [role=status]')?.textContent).toBe(
      t('agentArtifactRevisionReady'),
    ),
  );
  expect(calls).toHaveLength(1);
  expect(calls[0]).toContain('Only artifact content');
  expect(state.routing).not.toHaveBeenCalled();
  expect(state.generate).not.toHaveBeenCalled();
  expect(state.toolPlan).not.toHaveBeenCalled();
  expect(state.apply).not.toHaveBeenCalled();
  expect(panel.querySelector<HTMLTextAreaElement>('.agent-artifact-editor textarea')!.value).toBe(
    'Only artifact content',
  );
});
