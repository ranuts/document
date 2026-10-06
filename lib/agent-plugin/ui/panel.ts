/**
 * Agent sidebar panel — a thin DOM view over {@link AgentChatController}.
 *
 * Header (title + gear + close); a collapsible settings block (provider selector
 * → automatic local inference or manually imported GGUF models), hidden behind the gear so the
 * main panel is a clean chat; a toolbar (review-mode toggle + quote + clear); and
 * the reusable @ranuts/chat-ui ChatView. Form controls are ranui Web Components
 * built with the ranui `builder` (View/Div/... fluent factories). All
 * orchestration lives in the controller and the LLM factory; this file only
 * builds DOM and forwards events. Loaded behind `?agent=1`.
 */
import 'ranui/button';
import 'ranui/input';
import 'ranui/select';
import 'ranui/checkbox';
import { ButtonBuilder, Div, Label, Span, View, createEffect, signal } from 'ranui/builder';
import { localStorageGetItem, localStorageSetItem } from 'ranuts/utils';
import { getLanguage, type I18nMessages, t } from '@ranuts/shared/i18n';
import { getReadonlyMode } from '../../onlyoffice/readonly';
import { getEditorApi, type EditorApi } from '../editor-bridge';
import { agentTools } from '../tools';
import { parseDirectDocumentIntent } from '../direct-intent';
import { captureDocumentContext, resolveContextCommand } from '../document-context';
import type { LLMMessage, LLMResponse } from '@ranuts/agent-core/llm/types';
import type { ProviderId } from '@ranuts/agent-core/llm/factory';
import { DEFAULT_CPU_MODEL_URL, LocalInferenceProvider } from '@ranuts/agent-core/llm/local';
import { DEFAULT_WEBLLM_MODEL, isModelCached, WEBLLM_MODELS } from '@ranuts/agent-core/llm/webllm';
import type { LocalLLMProvider } from '@ranuts/agent-core/llm/types';
import { resolveModelArtifactUrl } from '@ranuts/agent-core/llm/model-source';
import { WllamaProvider } from '@ranuts/agent-core/llm/wllama';
import {
  generateWriting,
  WRITING_LANGUAGES,
  type WritingTask,
  type WritingLanguage,
} from '@ranuts/agent-core/llm/writing-task';
import { captureActionTarget, ReviewedAction } from '../reviewed-action';
import { generateDocumentToolSequence } from '../document-tool-sequence';
import { captureDocumentToolTarget, DocumentToolAction } from '../document-tool-action';
import { ChatView, type ChatViewLabels } from '@ranuts/chat-ui';
import { AgentChatController, type ChatTurn } from './controller';
import { displayError } from './presentation';
import { historyToTurns } from './storage';
import { createConversationStore } from './sessions';
import { createHistoryControls } from './history-controls';
import { createGenerationControls } from './generation-controls';
import { createSidebarEntry, scheduleIdleLoad } from './sidebar-entry';
import { mountPanelResize } from './panel-resize';
import { mountPanelViewport } from './panel-viewport';

/** ranui custom elements expose a `value` accessor (r-select / r-input). */
type ValueEl = HTMLElement & { value: string };
type InputEl = ValueEl & { placeholder: string };
function rememberedModelUrl(value: string | null): string {
  if (!value?.trim()) return '';
  try {
    return resolveModelArtifactUrl(value.trim());
  } catch {
    return '';
  }
}

/** The r-checkbox `change` event detail (a real boolean). */
type CheckedDetail = CustomEvent<{ checked: boolean }>;

function compactSelect(
  className: string,
  options: Array<{ value: string; label: string }>,
  value: string,
): HTMLSelectElement {
  const select = document.createElement('select');
  select.className = className;
  for (const item of options) {
    const option = document.createElement('option');
    option.value = item.value;
    option.textContent = item.label;
    select.append(option);
  }
  select.value = value;
  return select;
}

const PROVIDER_LABEL_KEY: Record<ProviderId, keyof I18nMessages> = {
  anthropic: 'agentProviderClaude',
  openai: 'agentProviderOpenAI',
  gemini: 'agentProviderGemini',
  webllm: 'agentProviderLocal',
  wllama: 'agentProviderWllama',
  ollama: 'agentProviderOllama',
};
const PROVIDER_IDS: ProviderId[] = ['webllm', 'wllama'];

/** An r-button (ranui builder) with a label and class. */
const ranButton = (text: string, className: string): HTMLElement =>
  View('r-button').class(className).text(text).build();

/** An r-select with r-option children and an initial value (ranui builder). */
const ranSelect = (className: string, options: Array<{ value: string; label: string }>, value: string): ValueEl =>
  View('r-select')
    .class(className)
    .attr('value', value)
    .children(options.map((o) => View('r-option').attr('value', o.value).text(o.label).build()))
    .build() as ValueEl;

/** An r-input of the given type (ranui builder). */
const ranInput = (className: string, type: string): InputEl =>
  View('r-input').class(className).attr('type', type).build() as InputEl;

/**
 * Singleton handle to the live panel, so external triggers (the AI button
 * mounted in the editor's right rail, posting `agent:toggle`) can open/close
 * it without building a second panel. Set on first {@link createAgentPanel}.
 */
let panelHandle: { setOpen: (open: boolean) => void; isOpen: () => boolean } | null = null;

/** Open the panel (creating it on first use), close it, or flip it. */
export function toggleAgentPanel(): void {
  if (panelHandle) panelHandle.setOpen(!panelHandle.isOpen());
  else createAgentPanel(); // first call creates the panel already open
}

/** Build the Agent panel, append it to the body, and return its root element. */
export function createAgentPanel(options: { background?: boolean } = {}): HTMLElement {
  // Idempotent: a second call just reveals the existing panel.
  const existing = document.querySelector('.agent-panel');
  if (existing) {
    if (!options.background) panelHandle?.setOpen(true);
    return existing as HTMLElement;
  }

  const panel = Div().class('agent-panel').build();
  let disposeResize = mountPanelResize(panel);
  let disposeViewport = mountPanelViewport(panel);
  window.addEventListener('pagehide', () => disposeViewport());
  window.addEventListener('pageshow', (event) => {
    if (!event.persisted || !panel.isConnected) return;
    disposeResize();
    disposeResize = mountPanelResize(panel);
    disposeViewport();
    disposeViewport = mountPanelViewport(panel);
    sidebar.dispose();
    sidebar = mountSidebar();
    syncSidebar();
    clearInterval(scopeTimer);
    scopeTimer = setInterval(updateScope, 1000);
    updateScope();
    syncReviewControl();
    syncProviderUi();
    syncRuntimeStatus();
  });
  window.addEventListener('pagehide', () => disposeResize());

  let open = true;
  const mountSidebar = () =>
    createSidebarEntry(
      () => setOpen(!open),
      () => t('agentOpenTip'),
    );
  let sidebar = mountSidebar();
  // Configuration, loading progress and retry remain reachable even without a ready model.
  const syncSidebar = (): void => sidebar.update(panel.isConnected, open);
  const setOpen = (next: boolean): void => {
    const returnToDocument = !next && panel.contains(document.activeElement);
    open = next;
    panel.classList.toggle('agent-panel-hidden', !next);
    syncSidebar();
    // Dock mode: shrink the editor so the panel takes layout space instead of
    // overlaying the document. CSS keys off this body class.
    document.body.classList.toggle('agent-docked', next);
    // Tell the editor iframe so the injected AI button can show active state.
    // DocsAPI replaces the placeholder with an iframe (name="frameEditor") in #app.
    const frame = document.querySelector<HTMLIFrameElement>('#app iframe');
    frame?.contentWindow?.postMessage({ type: 'agent:state', open: next }, location.origin);
    if (returnToDocument && !sidebar.focus()) frame?.focus();
    if (next)
      queueMicrotask(() => {
        if (open) chat.focus();
      });
  };
  panelHandle = { setOpen, isOpen: () => open };

  // ── Header ──────────────────────────────────────────────────────────────
  const title = Span().class('agent-panel-title').text(t('agentTitle')).build();
  // Gear toggles the settings block (provider / key / model), hidden by default
  // so the main panel stays a clean chat surface.
  const settingsBtn = ButtonBuilder()
    .class('agent-panel-settings-toggle')
    .attr('type', 'button')
    .aria('label', t('agentSettings'))
    .attr('aria-expanded', 'false')
    .attr('aria-controls', 'agent-settings')
    .on('click', () => {
      const collapsed = settings.classList.toggle('agent-panel-settings-hidden');
      settingsBtn.setAttribute('aria-expanded', String(!collapsed));
      if (!collapsed) providerSelect.focus();
    })
    .build();
  const closeBtn = ButtonBuilder()
    .class('agent-panel-close')
    .attr('type', 'button')
    .aria('label', t('agentClose'))
    .on('click', () => setOpen(false))
    .build();
  settingsBtn.innerHTML =
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="2.5" fill="var(--ran-color-bg-elevated)"/><circle cx="15" cy="17" r="2.5" fill="var(--ran-color-bg-elevated)"/></svg>';
  closeBtn.innerHTML =
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6"><path d="m6 6 12 12M18 6 6 18"/></svg>';
  const loadingStatus = Span().class('agent-model-status').attr('role', 'status').build();
  const loadProgress = View<HTMLProgressElement>('progress')
    .class('agent-model-progress')
    .attr('max', '1')
    .attr('hidden', '')
    .aria('label', t('agentPreparing'))
    .build();
  const runtimeRow = Div()
    .class('agent-runtime-row')
    .attr('hidden', '')
    .children(Div().class('agent-runtime-main').children(loadingStatus, loadProgress).build())
    .build();
  const generationStats = Span().class('agent-generation-stats').attr('role', 'status').build();
  const generationDetails = Span().class('agent-generation-details').build();
  const header = Div().class('agent-panel-header').children(title, settingsBtn, closeBtn).build();

  // ── Settings (collapsed by default; opened via the gear) ──────────────────
  const providerSelect = ranSelect(
    'agent-panel-provider',
    PROVIDER_IDS.map((id) => ({ value: id, label: t(PROVIDER_LABEL_KEY[id]) })),
    localStorageGetItem('agent-panel-provider') === 'wllama' ? 'wllama' : 'webllm',
  );
  providerSelect.setAttribute('aria-label', t('agentProviderLabel'));

  const ggufUrl = ranInput('agent-panel-gguf-url', 'text');
  ggufUrl.placeholder = 'https://…/model.gguf';
  ggufUrl.value = rememberedModelUrl(localStorageGetItem('agent-panel-gguf-url'));
  const ggufFiles = document.createElement('input');
  ggufFiles.type = 'file';
  ggufFiles.multiple = true;
  ggufFiles.accept = '.gguf';
  ggufFiles.className = 'agent-panel-gguf-files';
  const ggufChooseText = document.createElement('span');
  const ggufChoose = document.createElement('label');
  ggufChoose.className = 'agent-panel-gguf-choose';
  ggufChoose.append(ggufChooseText, ggufFiles);
  const ggufNames = document.createElement('span');
  ggufNames.className = 'agent-panel-gguf-filenames';
  ggufNames.setAttribute('aria-live', 'polite');
  const syncFileChoice = () => {
    ggufChooseText.textContent = t('agentChooseModelFiles');
    ggufFiles.setAttribute('aria-label', t('agentChooseModelFiles'));
    ggufNames.textContent = Array.from(ggufFiles.files ?? [])
      .map((file) => file.name)
      .join(', ');
    ggufNames.title = ggufNames.textContent;
  };
  syncFileChoice();
  const ggufLoad = ranButton(t('agentLoadModel'), 'agent-panel-gguf-load');
  ggufLoad.addEventListener('click', () => void loadModel());
  const ggufCpu = document.createElement('input');
  ggufCpu.type = 'checkbox';
  ggufCpu.checked = true;
  ggufCpu.className = 'agent-panel-gguf-cpu';
  const cpuLabel = document.createElement('label');
  cpuLabel.append(ggufCpu, ' CPU');
  const ggufStop = ranButton(t('agentStop'), 'agent-panel-gguf-stop');
  ggufStop.hidden = true;
  ggufStop.addEventListener('click', () => {
    resetController();
    note.textContent = t('agentStopped');
    chat.focus();
  });
  const ggufRow = Div()
    .class('agent-panel-gguf-row')
    .children(ggufUrl, ggufChoose, ggufNames, cpuLabel, ggufLoad)
    .build();

  // Public artifact URLs and API endpoint preferences; never store a key here.
  const sourceInput = (className: string, placeholder: string): InputEl => {
    const input = ranInput(className, 'text');
    input.placeholder = placeholder;
    input.setAttribute('aria-label', placeholder);
    input.value =
      localStorageGetItem(className) ||
      (
        {
          'agent-local-model-id': import.meta.env.VITE_LOCAL_MODEL_ID,
          'agent-local-model-url': import.meta.env.VITE_LOCAL_MODEL_URL,
          'agent-local-model-lib': import.meta.env.VITE_LOCAL_MODEL_LIB_URL,
        } as Record<string, string | undefined>
      )[className] ||
      '';
    input.addEventListener('change', () => {
      localStorageSetItem(className, input.value.trim());
      resetController();
    });
    return input;
  };
  const localModelId = sourceInput('agent-local-model-id', 'Custom MLC model ID (optional)');
  const localModelUrl = sourceInput('agent-local-model-url', 'MLC model directory URL (/models/…)');
  const localModelLib = sourceInput('agent-local-model-lib', 'Compatible model WASM URL (/models/…/model.wasm)');
  const modelSources = document.createElement('details');
  modelSources.className = 'agent-model-sources';
  const modelSourcesLabel = document.createElement('summary');
  modelSourcesLabel.textContent = t('agentCustomModel');
  modelSources.append(modelSourcesLabel, localModelId, localModelUrl, localModelLib);
  modelSources.open = [localModelId, localModelUrl, localModelLib].some((input) => !!input.value.trim());
  const localSource = () => ({
    modelUrl: localModelUrl.value.trim() || undefined,
    modelLibUrl: localModelLib.value.trim() || undefined,
  });
  const selectedLocalModel = () => localModelId.value.trim() || modelSelect.value;

  // Local: model picker + load button
  const modelSelect = ranSelect(
    'agent-panel-model',
    WEBLLM_MODELS.map((model) => ({
      value: model.id,
      label: `${model.label} (${t('agentModelMemory').replace('{memory}', (model.vramMB / 1000).toFixed(2))})`,
    })),
    DEFAULT_WEBLLM_MODEL,
  );
  const savedPreset = localStorageGetItem('agent-local-preset');
  if (WEBLLM_MODELS.some((model) => model.id === savedPreset)) modelSelect.value = savedPreset!;
  modelSelect.setAttribute('aria-label', t('agentModelLabel'));
  const loadBtn = ranButton(t('agentLoadModel'), 'agent-panel-load');
  loadBtn.addEventListener('click', () => void loadModel());
  const modelRow = Div().class('agent-panel-model-row').children(modelSelect, loadBtn).build();
  const loadStop = ranButton(t('agentStop'), 'agent-panel-load-stop');
  loadStop.hidden = true;
  loadStop.addEventListener('click', () => {
    resetController();
    note.textContent = t('agentStopped');
    chat.focus();
  });
  runtimeRow.append(loadStop, ggufStop);

  // Detailed cache and download hints remain in settings; the compact runtime
  // row exposes progress and cancellation in the main conversation view.
  const note = Div().class('agent-panel-note').build();
  note.setAttribute('role', 'status');

  const settings = Div()
    .class('agent-panel-settings agent-panel-settings-hidden')
    .id('agent-settings')
    .children(providerSelect, modelRow, modelSources, ggufRow)
    .build();
  settings.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || event.isComposing || event.keyCode === 229) return;
    event.stopPropagation();
    settings.classList.add('agent-panel-settings-hidden');
    settingsBtn.setAttribute('aria-expanded', 'false');
    settingsBtn.focus();
  });

  // ── Compose actions (mounted into ChatView's slot above the input) ────────
  const reviewCheck = View('r-checkbox').build();
  const reviewText = Span().text(t('agentReviewMode')).build();
  const reviewLabel = Label().class('agent-panel-review').children(reviewCheck, reviewText).build();
  const quoteBtn = ButtonBuilder().class('agent-panel-quote').attr('type', 'button').build();
  quoteBtn.innerHTML =
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M6 8h12M6 12h8M6 16h10M3 3h18v18H3z"/></svg>';
  quoteBtn.title = t('agentQuoteTip');
  const clearBtn = ButtonBuilder().class('agent-panel-clear').attr('type', 'button').build();
  clearBtn.innerHTML =
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';
  settings.append(reviewLabel, note);

  // ── Conversation + input (reusable chat UI) ──────────────────────────────
  // The message list, streaming, and input box are the framework-free
  // @ranuts/chat-ui ChatView. This panel only wires it to the agent controller.
  let proposalMode = false;
  let modelLoading = false;
  let runtimeCleanup: Promise<void> | null = null;
  let runtimeCleanupFailed = false;
  let loadingFraction: number | undefined;
  let loadingBackend: 'webllm' | 'wllama' | undefined;
  const chatLabels = (): ChatViewLabels => ({
    conversation: t('agentTitle'),
    send: t('agentSend'),
    stop: t('agentStop'),
    placeholder: t(proposalMode && writingSelect.value !== 'tools' ? 'agentWritingHint' : 'agentComposeHint'),
    empty: t('agentWelcome'),
    copy: t('agentCopy'),
    copied: t('agentCopied'),
    copyFailed: t('agentCopyFailed'),
    restore: t('agentRestoreRequest'),
    waiting: t('agentWaiting'),
    scrollLatest: t('agentScrollLatest'),
    applyMessage: t('agentWriteReply'),
    applyTip: t('agentWriteReplyTip'),
    applying: t('agentWritingReply'),
    applied: t('agentReplyWritten'),
    checkDocument: t('agentCheckDocument'),
  });
  const directIntent = (text: string) => {
    const intent = parseDirectDocumentIntent(resolveContextCommand(text, captureDocumentContext()));
    return writingSelect.value === 'tools' && intent?.kind === 'clarify' ? null : intent;
  };
  const chat = new ChatView({
    canSend: (text) => !modelLoading || webllmProvider?.isReady() || !!directIntent(text.trim()),
    onSend: (text) => void submit(text),
    onApplyMessage: (text) => applyReply(text),
    onStop: () => {
      restoreAfterStop = true;
      latestUsage = undefined;
      syncGenerationStats();
      controller?.stop();
      invalidatePlans();
    },
    labels: chatLabels(),
  });
  const configureBtn = ButtonBuilder()
    .class('agent-configure')
    .attr('type', 'button')
    .on('click', () => {
      settings.classList.remove('agent-panel-settings-hidden');
      settingsBtn.setAttribute('aria-expanded', 'true');
      providerSelect.focus();
    })
    .build();
  chat.emptyActionsEl.append(configureBtn);
  const appendTurn = (turn: ChatTurn): void => {
    chat.append(turn.role === 'error' ? { ...turn, text: displayError(turn.text) } : turn);
  };
  let planning: AbortController | null = null;
  let restoreAfterStop = false;
  const writingSelect = compactSelect(
    'agent-writing-task',
    [
      { value: 'chat', label: t('agentTaskChat') },
      { value: 'tools', label: t('agentTaskTools') },
      { value: 'rewrite', label: t('agentTaskRewrite') },
      { value: 'summarize', label: t('agentTaskSummarize') },
      { value: 'translate', label: t('agentTaskTranslate') },
    ],
    'chat',
  );
  writingSelect.setAttribute('aria-label', t('agentTaskLabel'));
  writingSelect.hidden = false;
  const languageSelect = compactSelect(
    'agent-writing-language',
    WRITING_LANGUAGES.map((value) => ({
      value,
      label: {
        'zh-CN': '中文',
        en: 'English',
        ja: '日本語',
        ko: '한국어',
        de: 'Deutsch',
        es: 'Español',
        pt: 'Português',
      }[value],
    })),
    'en',
  );
  languageSelect.setAttribute('aria-label', t('agentTaskLanguage'));
  languageSelect.hidden = true;
  chat.actionsEl.append(writingSelect, languageSelect, quoteBtn);
  writingSelect.addEventListener('change', () => {
    proposalMode = writingSelect.value !== 'chat';
    invalidatePlans();
    languageSelect.hidden = !proposalMode || writingSelect.value !== 'translate';
    chat.setLabels(chatLabels());
  });
  languageSelect.addEventListener('change', () => invalidatePlans());
  const starterTasks = [
    ['rewrite', 'agentTaskRewrite'],
    ['summarize', 'agentTaskSummarize'],
    ['translate', 'agentTaskTranslate'],
  ] as const;
  const starters = Div().class('agent-writing-starters').build();
  const starterButtons = starterTasks.map(([task, label]) => {
    const button = ButtonBuilder()
      .attr('type', 'button')
      .attr('data-writing-starter', task)
      .text(t(label))
      .on('click', () => {
        writingSelect.value = task;
        writingSelect.dispatchEvent(new Event('change'));
        chat.focus();
      })
      .build();
    starters.append(button);
    return button;
  });
  chat.emptyActionsEl.prepend(starters);

  const invalidatePlans = (): void => {
    planning?.abort();
    planning = null;
  };
  // Persist the conversation so a reload keeps it (model context + display).
  const sessionSelect = document.createElement('select');
  sessionSelect.className = 'agent-session-select';
  const sessionRow = Div().class('agent-session-row').children(sessionSelect, clearBtn).build();
  const sessionBar = Div().class('agent-session-bar').children(sessionRow).build();
  const scopeLabel = Span().class('agent-document-scope').build();
  scopeLabel.setAttribute('role', 'note');
  sessionBar.append(scopeLabel);
  const updateScope = (): void => {
    const context = captureDocumentContext();
    const label = context
      ? context.kind === 'cell'
        ? `Excel · ${context.sheet ?? ''} ${context.range ?? ''}`
        : context.kind === 'slide'
          ? `PPT · ${context.page ?? ''}`
          : 'DOCX'
      : '';
    if (scopeLabel.textContent !== label) scopeLabel.textContent = label;
  };
  let scopeTimer = setInterval(updateScope, 1000);
  window.addEventListener('pagehide', () => clearInterval(scopeTimer));
  updateScope();
  let historyControls: ReturnType<typeof createHistoryControls> | undefined;
  const conversations = createConversationStore(
    () => {
      renderSessions();
      historyControls?.sync();
    },
    { onError: (error) => historyControls?.showError(error) },
  );
  let historyStorage = conversations.history();
  function renderSessions(): void {
    sessionSelect.replaceChildren(
      ...conversations.list().map((session) => {
        const option = document.createElement('option');
        option.value = session.id;
        option.textContent = session.title || t('agentNewConversation');
        return option;
      }),
    );
    sessionSelect.value = conversations.activeId;
    sessionSelect.setAttribute('aria-label', t('agentConversations'));
    sessionSelect.title = t('agentConversations');
  }
  renderSessions();

  // Streaming: ChatView owns the live bubble; just forward deltas and the end.
  // The editor tools must be passed explicitly now that the (editor-agnostic)
  // runtime no longer defaults to them.
  const controllerOptions = {
    tools: agentTools,
    onAgentDelta: (delta: string): void => chat.appendDelta(delta),
    onAgentStreamEnd: (): void => chat.endStream(),
    storage: historyStorage,
  };

  // Restore a previous conversation into the view on load.
  for (const turn of historyToTurns(historyStorage.load())) chat.append(turn);

  // ── Controller wiring ───────────────────────────────────────────────────
  const currentProvider = (): 'webllm' | 'wllama' => (providerSelect.value === 'wllama' ? 'wllama' : 'webllm');

  let controller: AgentChatController | null = null;
  let controllerKind = '';
  let controllerGeneration = 0;
  let conversationRevision = 0;
  let loadAttempt = 0;
  let webllmProvider: LocalLLMProvider | null = null;
  let runtimeDescription = '';
  let latestUsage: LLMResponse['usage'];
  const syncGenerationStats = (): void => {
    const values: string[] = [];
    const decodeSpeed =
      latestUsage?.decodeTokensPerSecond !== undefined
        ? `${t('agentDecodeSpeed')}: ${latestUsage.decodeTokensPerSecond.toFixed(1)} token/s`
        : '';
    if (decodeSpeed) values.push(decodeSpeed);
    if (latestUsage?.timeToFirstTokenMs !== undefined)
      values.push(`${t('agentFirstToken')}: ${(latestUsage.timeToFirstTokenMs / 1000).toFixed(2)} s`);
    if (latestUsage?.timeToFirstTextMs !== undefined)
      values.push(`${t('agentFirstText')}: ${(latestUsage.timeToFirstTextMs / 1000).toFixed(2)} s`);
    if (latestUsage?.endToEndTokensPerSecond !== undefined)
      values.push(`${t('agentResponseRate')}: ${latestUsage.endToEndTokensPerSecond.toFixed(2)} token/s`);
    if (latestUsage?.completionTokens !== undefined) values.push(`${latestUsage.completionTokens} tokens`);
    generationStats.textContent = decodeSpeed;
    generationDetails.textContent = values.join(' · ');
  };
  const modelName = (url: string): string => {
    try {
      return decodeURIComponent(new URL(url, location.href).pathname.split('/').pop() || url);
    } catch {
      return url;
    }
  };
  const cpuModelLabel = (url: string): string => {
    const name = modelName(url);
    return url === DEFAULT_CPU_MODEL_URL && name === 'Qwen_Qwen3-0.6B-Q4_K_M.gguf' ? 'Qwen3 · 0.6B' : name;
  };
  const syncRuntimeStatus = (): void => {
    configureBtn.hidden = webllmProvider?.isReady() ?? false;
    chat.refreshSendAvailability();
    loadingStatus.textContent = modelLoading
      ? [
          t('agentPreparing'),
          runtimeDescription,
          loadingFraction === undefined ? '' : `${Math.round(loadingFraction * 100)}%`,
        ]
          .filter(Boolean)
          .join(' · ')
      : webllmProvider?.isReady()
        ? runtimeDescription
        : '';
    runtimeRow.hidden = !loadingStatus.textContent;
    loadProgress.hidden = !modelLoading;
    if (loadingFraction === undefined) loadProgress.removeAttribute('value');
    else loadProgress.value = loadingFraction;
  };
  const updateLoadProgress = (fraction?: number): void => {
    loadingFraction =
      typeof fraction === 'number' && Number.isFinite(fraction) && fraction >= 0 && fraction <= 1
        ? fraction
        : undefined;
    syncRuntimeStatus();
  };
  const updateFileProgress = (loaded: number, total: number): void => {
    // Finishing file reads does not finish native model initialization.
    updateLoadProgress(Number.isFinite(total) && total > 0 && loaded < total ? loaded / total : undefined);
  };
  const generationControls = createGenerationControls((value) => webllmProvider?.setGenerationOptions?.(value));
  generationControls.el.append(generationDetails);
  settings.append(generationControls.el);
  const resetController = (): void => {
    configureBtn.hidden = false;
    syncSidebar();
    modelLoading = false;
    runtimeDescription = '';
    latestUsage = undefined;
    syncGenerationStats();
    loadingStatus.textContent = '';
    loadingStatus.title = '';
    runtimeRow.hidden = true;
    loadProgress.hidden = true;
    loadProgress.removeAttribute('value');
    loadingFraction = undefined;
    loadingBackend = undefined;
    loadAttempt++;
    invalidatePlans();
    chat.setRunning(false);
    controllerGeneration++;
    loadBtn.removeAttribute('disabled');
    ggufLoad.removeAttribute('disabled');
    ggufStop.hidden = true;
    loadStop.hidden = true;
    controller?.dispose();
    controller = null;
    const previous = webllmProvider;
    webllmProvider = null;
    if (previous) {
      const cleanup = previous.dispose();
      runtimeCleanup = cleanup;
      void cleanup.then(
        () => {
          if (runtimeCleanup === cleanup) runtimeCleanup = null;
        },
        () => {
          runtimeCleanupFailed = true;
          note.textContent = t('agentModelCleanupFailed');
        },
      );
    }
  };
  window.addEventListener('pagehide', resetController);
  window.addEventListener('pagehide', () => sidebar.dispose());
  window.addEventListener('document:content-ready', invalidatePlans);
  ggufUrl.addEventListener('change', () => {
    localStorageSetItem('agent-panel-gguf-url', rememberedModelUrl(ggufUrl.value));
    ggufFiles.value = '';
    ggufNames.textContent = '';
    ggufNames.title = '';
    resetController();
  });
  ggufFiles.addEventListener('change', () => {
    syncFileChoice();
    localStorageSetItem('agent-panel-gguf-url', '');
    ggufUrl.value = '';
    resetController();
  });
  ggufCpu.addEventListener('change', resetController);

  // Reflect whether the selected local model is already cached (no re-download).
  const updateLocalHint = async (): Promise<void> => {
    if (runtimeCleanupFailed) {
      note.textContent = t('agentModelCleanupFailed');
      return;
    }
    if (currentProvider() !== 'webllm' || modelLoading) return;
    const id = selectedLocalModel();
    const attempt = loadAttempt;
    note.textContent = t('agentCheckingCache');
    const cached = await isModelCached(id, localSource());
    if (runtimeCleanupFailed) {
      note.textContent = t('agentModelCleanupFailed');
      return;
    }
    if (currentProvider() !== 'webllm' || selectedLocalModel() !== id || attempt !== loadAttempt) return;
    // The note carries only the cache/download status.
    note.textContent = cached ? t('agentModelCached') : t('agentModelFirstDownload');
  };

  // Writing and document-operation modes are available for browser-local engines.
  const syncChatOnlyHint = (): void => {
    const local = currentProvider() === 'wllama' || currentProvider() === 'webllm';
    writingSelect.hidden = !local;
    languageSelect.hidden = !local || !proposalMode || writingSelect.value !== 'translate';
  };

  const syncProviderUi = (): void => {
    const id = currentProvider();
    modelSources.hidden = id !== 'webllm';
    modelRow.style.display = id === 'webllm' ? '' : 'none';
    ggufRow.style.display = id === 'wllama' ? '' : 'none';
    syncChatOnlyHint();
    if (runtimeCleanupFailed) {
      note.textContent = t('agentModelCleanupFailed');
    } else if (id === 'wllama') {
      note.textContent = t('agentWllamaHint');
    } else {
      void updateLocalHint();
    }
  };
  providerSelect.addEventListener('change', () => {
    localStorageSetItem('agent-panel-provider', currentProvider());
    resetController();
    syncProviderUi();
  });
  modelSelect.addEventListener('change', () => {
    for (const input of [localModelId, localModelUrl, localModelLib]) {
      input.value = '';
      localStorageSetItem(input.className, '');
    }
    localStorageSetItem('agent-local-preset', modelSelect.value);
    resetController();
    void updateLocalHint();
  });
  syncProviderUi();

  const buildController = (): AgentChatController | null => {
    if (runtimeCleanup) return null;
    const id = currentProvider();
    const generation = controllerGeneration;
    const conversation = conversationRevision;
    const emit = (turn: ChatTurn): void => {
      if (generation === controllerGeneration && conversation === conversationRevision) appendTurn(turn);
    };
    const options = {
      ...controllerOptions,
      onUsage: (usage: NonNullable<LLMResponse['usage']>): void => {
        if (generation !== controllerGeneration || conversation !== conversationRevision) return;
        latestUsage = usage;
        syncGenerationStats();
      },
      storage: historyStorage,
      getRequestContext: (): string | undefined => {
        const context = captureDocumentContext();
        return context ? JSON.stringify(context) : undefined;
      },
      onContextTrimmed: (): void => {
        if (generation === controllerGeneration && conversation === conversationRevision)
          appendTurn({ role: 'tool', text: t('agentContextTrimmed') });
      },
      onAgentDelta: (delta: string): void => {
        if (generation === controllerGeneration && conversation === conversationRevision) chat.appendDelta(delta);
      },
      onAgentStreamEnd: (): void => {
        if (generation === controllerGeneration && conversation === conversationRevision) chat.endStream();
      },
    };
    if (id === 'wllama') {
      if (!controller) {
        webllmProvider ??= new WllamaProvider({
          generation: generationControls.value(),
          modelUrl: ggufUrl.value.trim(),
          modelFiles: Array.from(ggufFiles.files ?? []),
          cpuOnly: ggufCpu.checked,
          onProgress: ({ loaded, total }) => {
            if (generation !== controllerGeneration || !modelLoading) return;
            note.textContent = `${(loaded / 1e6).toFixed(1)} / ${(total / 1e6).toFixed(1)} MB`;
            updateFileProgress(loaded, total);
          },
        });
        controller = new AgentChatController(webllmProvider, emit, options);
        controllerKind = 'wllama';
      }
      return controller;
    }
    if (id === 'webllm') {
      const kind = `webllm:${selectedLocalModel()}`;
      if (!controller || controllerKind !== kind) {
        // Local writing candidates use text generation; the app owns any future
        // preview/apply workflow instead of exposing native model tools.
        if (!webllmProvider || controllerKind !== kind)
          webllmProvider = new LocalInferenceProvider({
            generation: generationControls.value(),
            webllm: {
              model: selectedLocalModel(),
              ...localSource(),
              chatOnly: true,
              onProgress: (p) => {
                if (
                  generation === controllerGeneration &&
                  modelLoading &&
                  currentProvider() === 'webllm' &&
                  loadingBackend !== 'wllama'
                ) {
                  note.textContent = p.text;
                  updateLoadProgress(p.progress);
                }
              },
            },
            wllama: {
              modelUrl: ggufUrl.value.trim() || undefined,
              onProgress: ({ loaded, total }) => {
                if (generation === controllerGeneration && modelLoading && loadingBackend !== 'webllm') {
                  note.textContent = `${(loaded / 1e6).toFixed(1)} / ${(total / 1e6).toFixed(1)} MB`;
                  updateFileProgress(loaded, total);
                }
              },
            },
            onBackend: (backend) => {
              if (generation === controllerGeneration && modelLoading) {
                loadingBackend = backend;
                note.textContent = t('agentPreparing');
                runtimeDescription =
                  backend === 'wllama'
                    ? `CPU · ${cpuModelLabel(ggufUrl.value.trim() || DEFAULT_CPU_MODEL_URL)}`
                    : `WebGPU · ${WEBLLM_MODELS.find((model) => model.id === selectedLocalModel())?.label ?? selectedLocalModel()}`;
                loadingStatus.title =
                  backend === 'wllama'
                    ? modelName(ggufUrl.value.trim() || DEFAULT_CPU_MODEL_URL)
                    : selectedLocalModel();
                updateLoadProgress();
              }
            },
          });
        controller = new AgentChatController(webllmProvider, emit, options);
        controllerKind = kind;
      }
      return controller;
    }
    return null;
  };

  // Load (download + warm) the selected WebLLM model. Used by the Load button and
  // auto-triggered on open when the default provider is local.
  const loadModel = async (): Promise<void> => {
    if (modelLoading) return;
    const generation = controllerGeneration;
    let loading: typeof webllmProvider = null;
    modelLoading = true;
    loadingBackend = currentProvider() === 'wllama' ? 'wllama' : undefined;
    chat.refreshSendAvailability();
    runtimeDescription =
      currentProvider() === 'wllama'
        ? `${ggufCpu.checked ? 'CPU' : 'wllama'} · ${
            Array.from(ggufFiles.files ?? [])
              .map((file) => file.name)
              .join(', ') || modelName(ggufUrl.value.trim())
          }`
        : '';
    syncSidebar();
    loadingFraction = undefined;
    syncRuntimeStatus();
    note.textContent = t('agentPreparing');
    loadAttempt++;
    loadBtn.setAttribute('disabled', '');
    ggufLoad.setAttribute('disabled', '');
    ggufStop.hidden = currentProvider() !== 'wllama';
    loadStop.hidden = currentProvider() !== 'webllm';
    try {
      if (runtimeCleanup) await runtimeCleanup;
      if (generation !== controllerGeneration) return;
      buildController();
      loading = webllmProvider;
      if (!loading) return;
      await loading.preload();
      if (loading === webllmProvider && generation === controllerGeneration) {
        note.textContent = t('agentModelLoaded');
        syncSidebar();
      }
    } catch (error) {
      if (generation === controllerGeneration && loading === webllmProvider) {
        const invalidSource = error instanceof Error && error.name === 'ModelSourceError';
        note.textContent = t(
          runtimeCleanupFailed
            ? 'agentModelCleanupFailed'
            : invalidSource
              ? 'agentModelSourceInvalid'
              : 'agentModelLoadFailed',
        );
        appendTurn({
          role: 'error',
          text: runtimeCleanupFailed
            ? t('agentModelCleanupFailed')
            : invalidSource
              ? t('agentModelSourceInvalid')
              : (typeof error === 'object' &&
                    error !== null &&
                    'name' in error &&
                    error.name === 'QuotaExceededError') ||
                  String(error).includes('QuotaExceededError')
                ? t('agentModelQuota')
                : t('agentModelLoadFailed'),
        });
      }
    } finally {
      if (generation === controllerGeneration) {
        modelLoading = false;
        syncRuntimeStatus();
        loadBtn.removeAttribute('disabled');
        ggufLoad.removeAttribute('disabled');
        ggufStop.hidden = true;
        loadStop.hidden = true;
      }
    }
  };

  let writingReply = false;
  const applyReply = async (text: string): Promise<'verified' | 'sent' | 'retry' | 'failed'> => {
    if (writingReply) return 'retry';
    const revision = conversationRevision;
    let attempted = false;
    writingReply = true;
    try {
      const target = captureActionTarget();
      if (target.editor !== 'word') throw new Error(t('agentWordOnly'));
      invalidatePlans();
      const action = new ReviewedAction(target, { tool: 'insert_text', input: { text } });
      attempted = true;
      const outcome = await action.apply();
      if (revision === conversationRevision && outcome === 'sent')
        appendTurn({ role: 'tool', text: t('agentPlanApplied') });
      return outcome;
    } catch (error) {
      if (revision === conversationRevision)
        appendTurn({ role: 'error', text: attempted ? t('agentPlanUnverified') : displayError(error) });
      return attempted ? 'failed' : 'retry';
    } finally {
      writingReply = false;
    }
  };

  // ChatView owns the Send/Stop button, Enter-to-send, and the input lock; this
  // just runs a turn. `submit` is passed to ChatView's onSend above.
  const submit = async (text: string): Promise<void> => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const intent = directIntent(trimmed);
    if (intent) {
      const answer = chat.getLastAnswer();
      const chinese = getLanguage().startsWith('zh');
      const messages: (LLMMessage & { hostGuidance?: 'tool' | 'status' | 'error' })[] = [
        { role: 'user', content: trimmed },
      ];
      const revision = conversationRevision;
      const directGeneration = controllerGeneration;
      const originStorage = historyStorage;
      const originSession = conversations.activeId;
      appendTurn({ role: 'user', text: trimmed });
      latestUsage = undefined;
      syncGenerationStats();
      chat.setRunning(true);
      let directAbort: AbortController | undefined;
      try {
        if (intent.kind === 'clarify') {
          const guidance = chinese
            ? '请明确操作范围。文字可选中后加粗或对齐；Excel 可说“将 A1:C10 按 B 列升序排序，首行为表头”“计算 B2:B10 的总和”或“将 B2:B10 的总和写入 B11”；PPT 可说“新增一页幻灯片”“复制当前幻灯片”或“切换到第 3 页幻灯片”。'
            : 'Specify the scope: select text to bold or align; Excel: “sort A1:C10 by B ascending with header”, “sum B2:B10” or “sum B2:B10 into B11”; presentations: “add a slide”, “duplicate current slide” or “go to slide 3”.';
          appendTurn({ role: 'tool', text: guidance });
          messages.push({ role: 'assistant', content: guidance, hostGuidance: 'tool' });
        } else {
          invalidatePlans();
          directAbort = new AbortController();
          planning = directAbort;
          restoreAfterStop = false;
          let name: string;
          let input: Record<string, unknown>;
          let result: unknown;
          if (intent.kind === 'write_reply') {
            if (!answer.trim()) throw new Error('agentNoCompletedAnswer');
            const target = captureActionTarget();
            if (target.editor !== 'word') throw new Error(t('agentWordOnly'));
            if (intent.requireSelection && !target.selectedText.trim()) throw new Error(t('agentNoSelection'));
            name = 'insert_text';
            input = { text: answer };
            result = {
              outcome: await new ReviewedAction(target, { tool: 'insert_text', input: { text: answer } }).apply(
                directAbort.signal,
              ),
            };
          } else if (intent.kind === 'sum_range' || intent.kind === 'sort_range' || intent.kind === 'slide') {
            name = intent.kind === 'slide' ? 'slide_action' : intent.kind;
            const { kind: _kind, ...parameters } = intent;
            input = parameters;
            result = await agentTools[name].execute(input);
          } else {
            name = intent.kind === 'bold' ? 'set_bold' : 'set_paragraph_alignment';
            input = intent.kind === 'bold' ? { enabled: intent.enabled } : { alignment: intent.alignment };
            if (
              intent.kind === 'align' &&
              /当前段落|current paragraph/i.test(trimmed) &&
              getEditorApi()?.pluginMethod_GetSelectedText().trim()
            )
              throw new Error('agentParagraphSelectionConflict');
            result = await agentTools[name].execute(input);
          }
          const id = `direct-${crypto.randomUUID()}`;
          messages.push(
            { role: 'assistant', content: [{ type: 'tool_use', id, name, input }] },
            { role: 'user', content: [{ type: 'tool_result', toolUseId: id, content: JSON.stringify(result) }] },
          );
          if (intent.kind === 'sum_range' && !intent.target)
            messages.push({
              role: 'assistant',
              content: `${intent.range}: ${(result as { sum: number }).sum}`,
              hostGuidance: 'tool',
            });
          if (revision === conversationRevision)
            appendTurn({
              role: 'tool',
              text:
                intent.kind === 'sum_range' && !intent.target
                  ? `${intent.range}: ${(result as { sum: number }).sum}`
                  : intent.kind === 'slide' && intent.action === 'navigate'
                    ? chinese
                      ? `已切换到第 ${intent.page} 页幻灯片`
                      : `Opened slide ${intent.page}`
                    : intent.kind === 'write_reply' && (result as { outcome?: string }).outcome !== 'verified'
                      ? t('agentPlanApplied')
                      : t('agentPlanVerified'),
            });
        }
      } catch (error) {
        const stopped = error instanceof Error && error.name === 'AbortError';
        const role = stopped ? 'status' : 'error';
        const guidance = stopped ? t('agentStopped') : displayError(error);
        if (revision === conversationRevision) appendTurn({ role, text: guidance });
        messages.push({ role: 'assistant', content: guidance, hostGuidance: role });
      } finally {
        if (planning === directAbort) planning = null;
        const owner = conversations.activeId === originSession ? controller : null;
        if (owner) owner.recordExternalMessages(messages);
        else originStorage.save([...originStorage.load(), ...messages]);
        if (revision === conversationRevision) {
          if (directGeneration === controllerGeneration) {
            chat.setRunning(false);
            chat.focus();
          }
        }
      }
      return;
    }
    const ctl = buildController();
    if ((currentProvider() === 'wllama' || currentProvider() === 'webllm') && !webllmProvider?.isReady()) {
      chat.setInput(text);
      settings.classList.remove('agent-panel-settings-hidden');
      settingsBtn.setAttribute('aria-expanded', 'true');
      note.textContent = t(runtimeCleanupFailed ? 'agentModelCleanupFailed' : 'agentModelFirstDownload');
      return;
    }
    if (!ctl) {
      chat.setInput(text);
      chat.append({
        role: 'error',
        text: currentProvider() === 'webllm' ? t('agentNoWebGPU') : t('agentNeedKey'),
      });
      return;
    }
    latestUsage = undefined;
    syncGenerationStats();
    restoreAfterStop = false;
    chat.setRunning(true);
    const generation = controllerGeneration;
    const conversation = conversationRevision;
    const operationHistory: Array<LLMMessage & { hostGuidance?: 'tool' | 'status' | 'error' }> = [];
    const operationStorage = historyStorage;
    const operationSession = conversations.activeId;
    try {
      if (writingSelect.value === 'tools') {
        operationHistory.push({ role: 'user', content: text });
        invalidatePlans();
        const target = captureDocumentToolTarget();
        const abort = new AbortController();
        planning = abort;
        appendTurn({ role: 'user', text });
        const plans = await generateDocumentToolSequence(webllmProvider!, text, target.context, abort.signal, {
          stableCapabilityPrefix:
            webllmProvider instanceof WllamaProvider ||
            (webllmProvider instanceof LocalInferenceProvider && webllmProvider.backend === 'wllama'),
        });
        if (!plans.length || plans.length > 4 || plans.slice(0, -1).some((plan) => !plan.readOnly))
          throw new Error('agentToolNotChosen');
        for (const [index, plan] of plans.entries()) {
          // Let the result render and process Stop/session/editor events before the next operation.
          if (index > 0) await new Promise<void>((resolve) => setTimeout(resolve, 0));
          abort.signal.throwIfAborted();
          if (generation !== controllerGeneration || conversation !== conversationRevision)
            throw new Error(t('agentPlanExpired'));
          const action = new DocumentToolAction(target, plan);
          const outcome = await action.apply(abort.signal);
          const result = action.result as
            { text?: string; cell?: string; sum?: number; range?: string; page?: number; count?: number } | undefined;
          const resultText = plan.readOnly
            ? typeof result?.text === 'string'
              ? `${result.cell ? result.cell + '\n' : ''}${result.text.trim() ? result.text : t('agentNoReadableText')}`
              : typeof result?.sum === 'number'
                ? `${result.range ?? ''}: ${result.sum}`
                : `${target.label} → ${result?.page ?? ''} / ${result?.count ?? ''}`
            : t(outcome === 'verified' ? 'agentPlanVerified' : 'agentPlanApplied');
          operationHistory.push({ role: 'assistant', content: resultText, hostGuidance: 'tool' });
          if (generation === controllerGeneration && conversation === conversationRevision)
            appendTurn({ role: 'tool', text: resultText });
        }
      } else if (proposalMode && (currentProvider() === 'webllm' || currentProvider() === 'wllama')) {
        operationHistory.push({ role: 'user', content: trimmed });
        invalidatePlans();
        const target = captureActionTarget();
        const abort = new AbortController();
        planning = abort;
        appendTurn({ role: 'user', text: trimmed });
        if (target.editor !== 'word' || !target.selectedText.trim()) throw new Error(t('agentNoSelection'));
        const body = await generateWriting(
          webllmProvider!,
          {
            task: writingSelect.value as WritingTask,
            text: target.selectedText,
            instruction: trimmed,
            targetLanguage: languageSelect.value as WritingLanguage,
          },
          abort.signal,
        );
        const plan = { tool: 'insert_text' as const, input: { text: body } };
        abort.signal.throwIfAborted();
        if (generation !== controllerGeneration || conversation !== conversationRevision || !target.isCurrent())
          throw new Error(t('agentPlanExpired'));
        const outcome = await new ReviewedAction(target, plan).apply(abort.signal);
        operationHistory.push({
          role: 'assistant',
          content: t(outcome === 'verified' ? 'agentPlanVerified' : 'agentPlanApplied'),
          hostGuidance: 'tool',
        });
        if (generation === controllerGeneration && conversation === conversationRevision)
          appendTurn({ role: 'tool', text: t(outcome === 'verified' ? 'agentPlanVerified' : 'agentPlanApplied') });
      } else {
        invalidatePlans();
        await ctl.send(trimmed);
      }
    } catch (error) {
      const stopped = error instanceof Error && error.name === 'AbortError';
      const role = stopped ? 'status' : 'error';
      if (operationHistory.length)
        operationHistory.push({
          role: 'assistant',
          content: stopped ? t('agentStopped') : displayError(error),
          hostGuidance: role,
        });
      if (generation === controllerGeneration && conversation === conversationRevision)
        appendTurn({
          role,
          text: stopped ? t('agentStopped') : error instanceof Error ? error.message : String(error),
        });
    } finally {
      if (operationHistory.length) {
        const owner = conversations.activeId === operationSession ? controller : null;
        if (owner) owner.recordExternalMessages(operationHistory);
        else operationStorage.save([...operationStorage.load(), ...operationHistory]);
      }
      if (generation === controllerGeneration && conversation === conversationRevision) {
        planning = null;
        chat.setRunning(false);
        chat.focus();
        if (webllmProvider && !webllmProvider.isReady()) {
          syncRuntimeStatus();
          note.textContent = t('agentLoadModel');
          if (restoreAfterStop) void loadModel();
        }
      }
    }
  };
  const switchConversation = (id: string, focus = true): void => {
    latestUsage = undefined;
    syncGenerationStats();
    conversationRevision++;
    invalidatePlans();
    controller?.dispose();
    controller = null;
    conversations.select(id);
    historyStorage = conversations.history();
    chat.clear();
    chat.setRunning(false);
    chat.setInput('');
    for (const turn of historyToTurns(historyStorage.load())) chat.append(turn);
    renderSessions();
    if (focus) chat.focus();
  };
  clearBtn.addEventListener('click', () => switchConversation(conversations.create().id));
  sessionSelect.addEventListener('change', () => switchConversation(sessionSelect.value));
  historyControls = createHistoryControls({
    store: conversations,
    onBeforeRestore: () => {
      conversationRevision++;
      invalidatePlans();
      controller?.dispose();
      controller = null;
      chat.setRunning(false);
    },
    onRestore: () => {
      const draft = chat.getInput();
      switchConversation(conversations.activeId, false);
      chat.setInput(draft);
    },
  });
  settings.append(historyControls.el);

  // Quote the current selection (Word text / Excel cells / PPT shape text) into
  // the input so the user can ask about it. Works across editor types because
  // pluginMethod_GetSelectedText is part of the shared plugin command API.
  quoteBtn.addEventListener('click', () => {
    const selected = getEditorApi()?.pluginMethod_GetSelectedText() ?? '';
    if (!selected.trim()) {
      appendTurn({ role: 'error', text: t('agentNoSelection') });
      return;
    }
    const quoted = `${t('agentQuotePrefix')}\n"""\n${selected.replace(/\r\n/g, '\n')}\n"""\n\n`;
    chat.setInput(quoted + chat.getInput());
    chat.focus();
  });

  // Review-mode toggle reads/sets track-changes directly on the editor. r-checkbox
  // reports the new state via the change event's detail (a real boolean), and its
  // initial state is set through the `checked` attribute.
  // Persistent track-changes is Word-only; detect the runtime settings APIs.
  let syncingReview = false;
  let reviewApi: EditorApi | undefined;
  const detachReview = (): void => {
    reviewApi?.asc_unregisterCallback?.('asc_onOnTrackRevisionsChange', syncReviewControl);
    reviewApi = undefined;
  };
  const syncReviewControl = (): void => {
    const api = getEditorApi();
    if (api !== reviewApi) {
      detachReview();
      if (
        api?.isDocumentLoadComplete &&
        api.isLoadFullApi &&
        typeof api.asc_registerCallback === 'function' &&
        typeof api.asc_unregisterCallback === 'function'
      ) {
        reviewApi = api;
        api.asc_registerCallback('asc_onOnTrackRevisionsChange', syncReviewControl);
      }
    }
    const canReview =
      !!api &&
      api.isDocumentLoadComplete &&
      api.isLoadFullApi &&
      !api.isViewMode &&
      !getReadonlyMode() &&
      typeof api.asc_IsTrackRevisions === 'function' &&
      typeof api.asc_SetGlobalTrackRevisions === 'function' &&
      typeof api.asc_GetGlobalTrackRevisions === 'function' &&
      typeof api.asc_SetLocalTrackRevisions === 'function';
    reviewCheck.toggleAttribute('disabled', !canReview);
    const checked = String(typeof api?.asc_IsTrackRevisions === 'function' && !!api.asc_IsTrackRevisions());
    syncingReview = true;
    try {
      if (reviewCheck.getAttribute('checked') !== checked) reviewCheck.setAttribute('checked', checked);
    } finally {
      syncingReview = false;
    }
  };
  syncReviewControl();
  window.addEventListener('document:content-ready', syncReviewControl);
  window.addEventListener('pagehide', detachReview);
  reviewCheck.addEventListener('change', async (e: Event) => {
    if (syncingReview) return;
    try {
      await agentTools.set_review_mode.execute({ enabled: (e as CheckedDetail).detail.checked });
    } catch (error) {
      appendTurn({ role: 'error', text: displayError(error) });
    } finally {
      syncReviewControl();
    }
  });

  // Reactive labels: a `lang` signal bumped on languagechange drives one effect
  // that re-applies every translatable label — replacing a manual re-render pass.
  const [lang, setLang] = signal(getLanguage());
  window.addEventListener('languagechange', () => setLang(getLanguage()));
  createEffect(() => {
    lang(); // subscribe: re-run whenever the language changes
    syncSidebar();
    title.textContent = t('agentTitle');
    configureBtn.textContent = t('agentConfigure');
    starterButtons.forEach((button, index) => {
      button.textContent = t(starterTasks[index][1]);
    });
    syncRuntimeStatus();
    syncGenerationStats();
    settingsBtn.title = t('agentSettings');
    settingsBtn.setAttribute('aria-label', t('agentSettings'));
    providerSelect.setAttribute('aria-label', t('agentProviderLabel'));
    modelSelect.setAttribute('aria-label', t('agentModelLabel'));
    modelSourcesLabel.textContent = t('agentCustomModel');
    closeBtn.title = t('agentClose');
    closeBtn.setAttribute('aria-label', t('agentClose'));
    const selected = providerSelect.value;
    for (const opt of providerSelect.querySelectorAll('r-option')) {
      opt.textContent = t(PROVIDER_LABEL_KEY[(opt.getAttribute('value') as ProviderId) ?? 'anthropic']);
    }
    providerSelect.setAttribute('value', selected); // nudge the closed label to retranslate
    syncFileChoice();
    loadBtn.textContent = t('agentLoadModel');
    loadStop.textContent = t('agentStop');
    ggufStop.textContent = t('agentStop');
    loadProgress.setAttribute('aria-label', t('agentPreparing'));
    for (const opt of modelSelect.querySelectorAll('r-option')) {
      const model = WEBLLM_MODELS.find((m) => m.id === opt.getAttribute('value'));
      if (model)
        opt.textContent = `${model.label} (${t('agentModelMemory').replace('{memory}', (model.vramMB / 1000).toFixed(2))})`;
    }
    reviewText.textContent = t('agentReviewMode');
    reviewCheck.setAttribute('aria-label', t('agentReviewMode'));
    quoteBtn.setAttribute('aria-label', t('agentQuote'));
    quoteBtn.title = t('agentQuoteTip');
    clearBtn.title = t('agentNewConversation');
    clearBtn.setAttribute('aria-label', t('agentNewConversation'));
    renderSessions();
    historyControls?.sync();
    generationControls.sync();
    const keys = {
      chat: 'agentTaskChat',
      tools: 'agentTaskTools',
      rewrite: 'agentTaskRewrite',
      summarize: 'agentTaskSummarize',
      translate: 'agentTaskTranslate',
    } as const;
    for (const option of writingSelect.querySelectorAll('option'))
      option.textContent = t(keys[option.getAttribute('value') as keyof typeof keys]);
    writingSelect.setAttribute('aria-label', t('agentTaskLabel'));
    languageSelect.setAttribute('aria-label', t('agentTaskLanguage'));
    chat.setLabels(chatLabels()); // Send/Stop/placeholder/empty + role chips
    syncProviderUi(); // refresh key placeholder / model hint in the new language
  });

  clearBtn.title = t('agentNewConversation');
  clearBtn.setAttribute('aria-label', t('agentNewConversation'));
  panel.append(header, runtimeRow, generationStats, sessionBar, settings, chat.el);
  document.body.append(panel);
  setOpen(!options.background);
  void historyControls.start();

  // Opening restores the selected URL model, or loads the automatic default.
  // The user can cancel/retry from settings; CPU is the local fallback.
  const hasStartupModel = () => currentProvider() === 'webllm' || !!ggufUrl.value.trim();
  if (hasStartupModel()) {
    if (options.background) {
      const cancel = scheduleIdleLoad(
        () => {
          const api = getEditorApi();
          return !!api?.isDocumentLoadComplete && !!api.isLoadFullApi;
        },
        () => {
          if (hasStartupModel() && !webllmProvider?.isReady()) void loadModel();
        },
      );
      window.addEventListener('pagehide', cancel, { once: true });
    } else void loadModel();
  }

  return panel;
}
