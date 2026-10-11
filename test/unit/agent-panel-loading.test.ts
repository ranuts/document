import { afterEach, expect, it, vi } from 'vitest';
import { createAgentPanel } from '../../lib/agent-plugin/ui/panel';
import { t } from '@ranuts/shared/i18n';
import { getEndpointKey } from '@ranuts/agent-core/llm/keys';
import { AgentChatController } from '../../lib/agent-plugin/ui/controller';
import { createHistoryStorage } from '../../lib/agent-plugin/ui/storage';
HTMLElement.prototype.scrollTo = vi.fn();
// Runtime tests explicitly prepare, as a user must now do from settings.
function createPreparedPanel() {
  const panel = createAgentPanel();
  panel.querySelector<HTMLElement>('.agent-panel-load')!.click();
  return panel;
}

const state = vi.hoisted(() => ({
  preload: vi.fn(),
  dispose: vi.fn().mockResolvedValue(undefined),
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
  targetCurrent: true,
  toolContext: 'slide' as 'slide' | 'cell',
  apply: vi.fn().mockResolvedValue('verified'),
  writing: vi.fn(),
  source: '',
  readText: undefined as string | undefined,
  readAnswer: vi.fn().mockResolvedValue('120'),
  editorReady: false,
  backend: undefined as undefined | ((backend: 'webllm' | 'wllama') => void),
  cpuProgress: undefined as undefined | ((value: { loaded: number; total: number }) => void),
  usage: undefined as import('@ranuts/agent-core/llm/types').LLMResponse['usage'],
}));
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
      return state.semanticResponse === undefined
        ? undefined
        : async () => ({ text: state.semanticResponse!, toolCalls: [], stopReason: 'stop' });
    }
    async chatStream(_messages: unknown, _tools: unknown, delta: (text: string) => void, signal?: AbortSignal) {
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
vi.mock('../../lib/agent-plugin/document-read-answer', () => ({ generateReadAnswer: state.readAnswer }));
vi.mock('../../lib/agent-plugin/document-tool-action', () => ({
  captureDocumentToolTarget: () => ({
    context: state.toolContext === 'cell' ? { kind: 'cell' } : { kind: 'slide', page: 1 },
    label: 'PPT · 1',
    selectedText: '',
    isCurrent: () => state.targetCurrent,
  }),
  DocumentToolAction: class {
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
}));
afterEach(() => {
  localStorage.removeItem('agent-panel-provider');
  localStorage.removeItem('agent-panel-gguf-url');
  localStorage.removeItem('agent-writing-endpoint');
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
  window.dispatchEvent(new Event('pagehide'));
  document.body.replaceChildren();
  state.preload.mockReset();
  state.dispose.mockClear();
  state.progress.length = 0;
  state.ready = false;
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
  state.generate.mockReset();
  state.toolPlan.mockReset();
  state.readAnswer.mockReset().mockResolvedValue('120');
  state.toolContext = 'slide';
  state.apply.mockClear();
  state.routing.mockReset();
  state.semanticResponse = undefined;
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
  (panel.querySelector('.agent-panel-clear') as HTMLElement).click();
  expect(state.dispose).not.toHaveBeenCalled();
  expect(panel.querySelectorAll('.agent-session-select option').length).toBeGreaterThan(1);
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
  await vi.waitFor(() => expect(input.disabled).toBe(false));
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
  await vi.waitFor(() => expect(input.disabled).toBe(false));
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
  await vi.waitFor(() => expect(input.disabled).toBe(false));
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
  await vi.waitFor(() => expect(input.disabled).toBe(false));
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
  await vi.waitFor(() => expect(input.disabled).toBe(false));
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
  await vi.waitFor(() => expect(input.disabled).toBe(false));
  const task = panel.querySelector<HTMLSelectElement>('.agent-writing-task')!;
  task.value = 'rewrite';
  task.dispatchEvent(new Event('change'));
  input.value = 'Polish this';
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await vi.waitFor(() => expect(input.disabled).toBe(false));
  // It asks for the model rather than telling the user to enable the switch they
  // already enabled, and it does not pretend to have run anything.
  expect(state.writing).not.toHaveBeenCalled();
  expect(panel.textContent).toContain(t('agentModelFirstDownload'));
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
  await vi.waitFor(() => expect(input.disabled).toBe(false));
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
  await vi.waitFor(() => expect(input.disabled).toBe(false));
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
  await vi.waitFor(() => expect(input.disabled).toBe(false));
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
  await vi.waitFor(() => expect(input.disabled).toBe(false));
  input.value = 'Create another slide using this layout';
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await vi.waitFor(() => expect(state.routing).toHaveBeenCalled());
  state.targetCurrent = false;
  resolveRouting({ task: 'tools', language: 'en' });
  await vi.waitFor(() => expect(input.disabled).toBe(false));
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
  await vi.waitFor(() => expect(input.disabled).toBe(false));
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
    await vi.waitFor(() => expect(input.disabled).toBe(false));
    expect(record.mock.calls.flatMap(([messages]) => messages)).toEqual([
      { role: 'user', content: 'Rewrite it more clearly' },
      { role: 'assistant', content: 'Private rewritten body', copyOnly: true },
      { role: 'assistant', content: t('agentPlanReady'), hostGuidance: 'tool' },
      { role: 'assistant', content: t('agentPlanVerified'), hostGuidance: 'tool' },
    ]);
    const sessions = panel.querySelector<HTMLSelectElement>('.agent-session-select')!;
    const originalSession = sessions.value;
    panel.querySelector<HTMLButtonElement>('.agent-panel-clear')!.click();
    expect(panel.querySelector('.cui-messages')?.textContent ?? '').not.toContain('Rewrite it more clearly');
    sessions.value = originalSession;
    sessions.dispatchEvent(new Event('change'));
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
    await vi.waitFor(() => expect(input.disabled).toBe(false));
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
    const sessions = panel.querySelector<HTMLSelectElement>('.agent-session-select')!;
    const originalSession = sessions.value;
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
    sessions.value = originalSession;
    sessions.dispatchEvent(new Event('change'));
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
  const sessions = panel.querySelector<HTMLSelectElement>('.agent-session-select')!;
  const original = sessions.value;
  const task = panel.querySelector<HTMLSelectElement>('.agent-writing-task')!;
  task.value = mode;
  task.dispatchEvent(new Event('change'));
  const input = panel.querySelector<HTMLTextAreaElement>('.cui-input')!;
  input.value = mode === 'rewrite' ? 'Rewrite pending original request' : 'Create a slide from this request';
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await vi.waitFor(() => expect(mode === 'rewrite' ? state.writing : state.toolPlan).toHaveBeenCalledOnce());
  panel.querySelector<HTMLButtonElement>('.agent-panel-clear')!.click();
  sessions.value = original;
  sessions.dispatchEvent(new Event('change'));
  task.value = 'chat';
  task.dispatchEvent(new Event('change'));
  input.value = 'Subsequent message';
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await vi.waitFor(() => expect(input.disabled).toBe(false));
  reject(new Error('agentToolNotChosen'));
  await new Promise((done) => setTimeout(done, 0));
  input.value = 'After settlement';
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await vi.waitFor(() => expect(input.disabled).toBe(false));
  panel.querySelector<HTMLButtonElement>('.agent-panel-clear')!.click();
  sessions.value = original;
  sessions.dispatchEvent(new Event('change'));
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
  const sessions = panel.querySelector<HTMLSelectElement>('.agent-session-select')!;
  const original = sessions.value;
  const mode = panel.querySelector<HTMLSelectElement>('.agent-writing-task')!;
  mode.value = 'tools';
  mode.dispatchEvent(new Event('change'));
  const input = panel.querySelector<HTMLTextAreaElement>('.cui-input')!;
  input.value = 'Read cell A1';
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await vi.waitFor(() => expect(input.disabled).toBe(false));
  panel.querySelector<HTMLButtonElement>('.agent-panel-clear')!.click();
  sessions.value = original;
  sessions.dispatchEvent(new Event('change'));
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
  await vi.waitFor(() => expect(input.disabled).toBe(false));
  expect(panel.querySelector('.cui-activity')?.textContent).toContain('No readable text was found.');
  const sessions = panel.querySelector<HTMLSelectElement>('.agent-session-select')!;
  const original = sessions.value;
  panel.querySelector<HTMLButtonElement>('.agent-panel-clear')!.click();
  sessions.value = original;
  sessions.dispatchEvent(new Event('change'));
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
  await vi.waitFor(() => expect(input.disabled).toBe(false));
  panel.querySelector<HTMLElement>('.agent-plan-apply')!.click();
  await Promise.resolve();

  input.value = 'Rewrite second';
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await vi.waitFor(() => expect(input.disabled).toBe(false));
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
  await vi.waitFor(() => expect(panel.querySelector('.cui-msg-agent')?.textContent).toBe('answer'));
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
  await vi.waitFor(() => expect(input.disabled).toBe(true));
  panel.querySelector<HTMLButtonElement>('.cui-send-stop')!.click();
  await vi.waitFor(() => expect(input.disabled).toBe(false));
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
  await vi.waitFor(() => expect(input.disabled).toBe(false));
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
  await vi.waitFor(() => expect(input.disabled).toBe(false));
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
    await vi.waitFor(() => expect(input.disabled).toBe(false));
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
    const sessions = panel.querySelector<HTMLSelectElement>('.agent-session-select')!;
    const originalSession = sessions.value;
    if (interruption === 'switch conversation') {
      panel.querySelector<HTMLButtonElement>('.agent-panel-clear')!.click();
    }
    const operationSession = sessions.value;
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
      sessions.value = originalSession;
      sessions.dispatchEvent(new Event('change'));
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
      expect(panel.querySelectorAll('.cui-msg-user, .cui-activity, .cui-msg-status')).toHaveLength(0);
      sessions.value = operationSession;
      sessions.dispatchEvent(new Event('change'));
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
    if (!panel.querySelector('.cui-activity')) return;
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
    await vi.waitFor(() => expect(input.disabled).toBe(false));
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
  const sessions = panel.querySelector<HTMLSelectElement>('.agent-session-select')!;
  const originalSession = sessions.value;
  const mode = panel.querySelector<HTMLSelectElement>('.agent-writing-task')!;
  mode.value = 'tools';
  mode.dispatchEvent(new Event('change'));
  const input = panel.querySelector<HTMLTextAreaElement>('.cui-input')!;
  input.value = '读取 A1:B4 的内容，然后将 B2 设置为 "00123"。';
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await vi.waitFor(() => expect(input.disabled).toBe(false));
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
  sessions.value = originalSession;
  sessions.dispatchEvent(new Event('change'));
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
  await vi.waitFor(() => expect(input.disabled).toBe(false));
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

it('keeps the endpoint connection failure visible in settings', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Unavailable')));
  try {
    const panel = createPreparedPanel();
    const model = panel.querySelector<HTMLInputElement>('.agent-panel-endpoint-model')!;
    model.value = 'model';
    model.dispatchEvent(new Event('change'));
    panel.querySelector<HTMLButtonElement>('.agent-panel-endpoint-connect')!.click();
    await vi.waitFor(() =>
      expect(panel.querySelector('.agent-panel-note')?.textContent).toBe(t('agentEndpointFailed')),
    );
    expect(panel.querySelector('.agent-panel-endpoint-status')?.textContent).toBe(t('agentEndpointFailed'));
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
  await vi.waitFor(() => expect(input.disabled).toBe(false));
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
    await vi.waitFor(() => expect(input.disabled).toBe(false));
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
  await vi.waitFor(() => expect(input.disabled).toBe(false));
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
  await vi.waitFor(() => expect(input.disabled).toBe(false));
  input.value = 'What can you do?';
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await vi.waitFor(() => expect(panel.querySelector('.cui-msg-error')).not.toBeNull());
  expect(panel.querySelector('.cui-msg-user')?.textContent).toBe('What can you do?');
  expect(panel.querySelector('.cui-msg-error')?.textContent).not.toContain(t('agentWordOnly'));
  expect(state.apply).not.toHaveBeenCalled();
  state.semanticResponse = '{"task":"chat","language":"en"}';
  input.value = '你好';
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await vi.waitFor(() => expect(panel.querySelector('.cui-msg-agent')?.textContent).toBe('answer'));
  expect(panel.querySelectorAll('.cui-msg-user')).toHaveLength(2);
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
  input.value = 'Shorten this suggestion';
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await vi.waitFor(() => expect(state.toolPlan).toHaveBeenCalledTimes(2));
  state.targetCurrent = false;
  reject(new Error('agentProposalUnchanged'));
  await vi.waitFor(() => expect(input.disabled).toBe(false));
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
  const readiness = panel.querySelector('.agent-readiness')!;
  expect(readiness.textContent).toBe('');
  const input = panel.querySelector<HTMLTextAreaElement>('.cui-input')!;
  input.value = 'Hello';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  expect(panel.querySelector('.cui-send')?.hasAttribute('disabled')).toBe(false);
  Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
  window.dispatchEvent(new Event('offline'));
  expect(readiness.textContent).toBe(t('agentPrepareRequired'));
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
  await vi.waitFor(() => expect(input.disabled).toBe(false));
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
  await vi.waitFor(() => expect(input.disabled).toBe(false));
  expect(panel.querySelector('.cui-msg-agent .cui-bubble')?.textContent).toBe('120');
});
