/**
 * Agent sidebar panel — a thin DOM view over {@link AgentChatController}.
 *
 * Header (title + gear + close); a collapsible settings block (provider selector
 * → cloud API key for Claude/OpenAI/Gemini, a local model picker + load button
 * for WebLLM, or a model-name input for Ollama), hidden behind the gear so the
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
import { getEditorApi } from '../editor-bridge';
import { agentTools } from '../tools';
import { createProvider, defaultProviderId, type ProviderId } from '@ranuts/agent-core/llm/factory';
import { getApiKey, setApiKey } from '@ranuts/agent-core/llm/keys';
import {
  DEFAULT_WEBLLM_MODEL,
  isModelCached,
  isWebGPUAvailable,
  WEBLLM_MODELS,
  WebLLMProvider,
} from '@ranuts/agent-core/llm/webllm';
import { ChatView, type ChatViewLabels } from '@ranuts/chat-ui';
import { AgentChatController, type ChatTurn } from './controller';
import { createHistoryStorage, historyToTurns } from './storage';

/** ranui custom elements expose a `value` accessor (r-select / r-input). */
type ValueEl = HTMLElement & { value: string };
type InputEl = ValueEl & { placeholder: string };

/** The r-checkbox `change` event detail (a real boolean). */
type CheckedDetail = CustomEvent<{ checked: boolean }>;

const TURN_LABEL_KEY: Record<ChatTurn['role'], keyof I18nMessages | null> = {
  user: 'agentRoleUser',
  agent: null, // "Agent" — same in every language
  tool: 'agentRoleTool',
  error: 'agentRoleError',
};
const turnLabel = (role: ChatTurn['role']): string => {
  const key = TURN_LABEL_KEY[role];
  return key ? t(key) : 'Agent';
};

const PROVIDER_LABEL_KEY: Record<ProviderId, keyof I18nMessages> = {
  anthropic: 'agentProviderClaude',
  openai: 'agentProviderOpenAI',
  gemini: 'agentProviderGemini',
  webllm: 'agentProviderLocal',
  ollama: 'agentProviderOllama',
};
const PROVIDER_IDS: ProviderId[] = ['anthropic', 'openai', 'gemini', 'webllm', 'ollama'];

const OLLAMA_MODEL_STORAGE_KEY = 'agent_ollama_model';

/** Providers configured with a cloud API key (vs. local WebLLM/Ollama). */
const CLOUD_PROVIDERS: ReadonlySet<ProviderId> = new Set<ProviderId>(['anthropic', 'openai', 'gemini']);

const KEY_PLACEHOLDER: Partial<Record<ProviderId, string>> = {
  anthropic: 'sk-ant-...',
  openai: 'sk-...',
  gemini: 'AIza...',
};

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
 * injected into OnlyOffice's left menu, posting `agent:toggle`) can open/close
 * it without building a second panel. Set on first {@link createAgentPanel}.
 */
let panelHandle: { setOpen: (open: boolean) => void; isOpen: () => boolean } | null = null;

/** Open the panel (creating it on first use), close it, or flip it. */
export function toggleAgentPanel(): void {
  if (panelHandle) panelHandle.setOpen(!panelHandle.isOpen());
  else createAgentPanel(); // first call creates the panel already open
}

/** Build the Agent panel, append it to the body, and return its root element. */
export function createAgentPanel(): HTMLElement {
  // Idempotent: a second call just reveals the existing panel.
  const existing = document.querySelector('.agent-panel');
  if (existing) {
    panelHandle?.setOpen(true);
    return existing as HTMLElement;
  }

  const panel = Div().class('agent-panel').build();

  // Floating launcher — shown when the panel is closed, reopens it on click.
  const launcher = ButtonBuilder()
    .class('agent-launcher agent-launcher-hidden')
    .attr('type', 'button')
    .text('AI')
    .on('click', () => setOpen(true))
    .build();
  let open = true;
  const setOpen = (next: boolean): void => {
    open = next;
    panel.classList.toggle('agent-panel-hidden', !next);
    launcher.classList.toggle('agent-launcher-hidden', next);
    // Dock mode: shrink the editor so the panel takes layout space instead of
    // overlaying the document. CSS keys off this body class.
    document.body.classList.toggle('agent-docked', next);
    // Tell the editor iframe so the injected AI button can show active state.
    // DocsAPI replaces the placeholder with an iframe (name="frameEditor") in #app.
    const frame = document.querySelector<HTMLIFrameElement>('#app iframe');
    frame?.contentWindow?.postMessage({ type: 'agent:state', open: next }, '*');
  };
  panelHandle = { setOpen, isOpen: () => open };

  // ── Header ──────────────────────────────────────────────────────────────
  const title = Span().class('agent-panel-title').text(t('agentTitle')).build();
  // Gear toggles the settings block (provider / key / model), hidden by default
  // so the main panel stays a clean chat surface.
  const settingsBtn = ButtonBuilder()
    .class('agent-panel-settings-toggle')
    .attr('type', 'button')
    .text('⚙')
    .on('click', () => settings.classList.toggle('agent-panel-settings-hidden'))
    .build();
  const closeBtn = ButtonBuilder()
    .class('agent-panel-close')
    .attr('type', 'button')
    .text('×')
    .on('click', () => setOpen(false))
    .build();
  const header = Div().class('agent-panel-header').children(title, settingsBtn, closeBtn).build();

  // ── Settings (collapsed by default; opened via the gear) ──────────────────
  const providerSelect = ranSelect(
    'agent-panel-provider',
    PROVIDER_IDS.map((id) => ({ value: id, label: t(PROVIDER_LABEL_KEY[id]) })),
    defaultProviderId(),
  );

  // Cloud: API key input
  const keyInput = ranInput('agent-panel-key-input', 'password');

  // Ollama: local model name input (no key needed)
  const ollamaModelInput = ranInput('agent-panel-ollama-model', 'text');
  ollamaModelInput.value = localStorageGetItem(OLLAMA_MODEL_STORAGE_KEY) || '';
  ollamaModelInput.addEventListener('change', () => {
    controller = null; // different model → rebuild
    localStorageSetItem(OLLAMA_MODEL_STORAGE_KEY, ollamaModelInput.value.trim());
  });

  // Local: model picker + load button
  const modelSelect = ranSelect(
    'agent-panel-model',
    WEBLLM_MODELS.map((model) => ({ value: model.id, label: `${model.label} (${model.size})` })),
    DEFAULT_WEBLLM_MODEL,
  );
  const loadBtn = ranButton(t('agentLoadModel'), 'agent-panel-load');
  loadBtn.addEventListener('click', () => void loadModel());
  const modelRow = Div().class('agent-panel-model-row').children(modelSelect, loadBtn).build();

  // Model-load progress / hints. Lives in the MAIN view (not settings) so the
  // auto-load progress is visible; `:empty` collapses it when idle.
  const note = Div().class('agent-panel-note').build();

  // Chat-only banner for WebLLM: explains the local model can't edit, with a
  // clickable shortcut that flips the provider to cloud (and opens settings so the
  // API-key field is right there). Separate from `note` so `note`'s transient
  // status text (download progress, cache state) never wipes the shortcut.
  const switchCloudLink = Span().class('agent-panel-link').text(t('agentSwitchCloud')).build();
  switchCloudLink.setAttribute('role', 'button');
  switchCloudLink.setAttribute('tabindex', '0');
  const chatOnlyHint = Div()
    .class('agent-panel-note agent-panel-chatonly')
    .children(Span().text(t('agentLocalChatOnly')).build(), switchCloudLink)
    .build();
  chatOnlyHint.style.display = 'none';

  const settings = Div()
    .class('agent-panel-settings agent-panel-settings-hidden')
    .children(providerSelect, keyInput, ollamaModelInput, modelRow)
    .build();

  // ── Compose actions (mounted into ChatView's slot above the input) ────────
  const reviewCheck = View('r-checkbox').build();
  const reviewText = Span().text(t('agentReviewMode')).build();
  const reviewLabel = Label().class('agent-panel-review').children(reviewCheck, reviewText).build();
  const quoteBtn = ranButton(t('agentQuote'), 'agent-panel-quote');
  quoteBtn.title = t('agentQuoteTip');
  const clearBtn = ranButton(t('agentClear'), 'agent-panel-clear');

  // ── Conversation + input (reusable chat UI) ──────────────────────────────
  // The message list, streaming, and input box are the framework-free
  // @ranuts/chat-ui ChatView. This panel only wires it to the agent controller.
  const chatLabels = (): ChatViewLabels => ({
    send: t('agentSend'),
    stop: t('agentStop'),
    placeholder: t('agentInputPlaceholder'),
    empty: t('agentInputPlaceholder'),
    role: (role) => turnLabel(role),
  });
  const chat = new ChatView({
    onSend: (text) => void submit(text),
    onStop: () => controller?.stop(),
    labels: chatLabels(),
  });
  const appendTurn = (turn: ChatTurn): void => {
    chat.append(turn);
  };
  // IM-style compose toolbar: review/quote/clear sit just above the input.
  chat.actionsEl.append(reviewLabel, quoteBtn, clearBtn);

  // Persist the conversation so a reload keeps it (model context + display).
  const historyStorage = createHistoryStorage();

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
  const currentProvider = (): ProviderId => providerSelect.value as ProviderId;

  let controller: AgentChatController | null = null;
  let controllerKind = '';
  let webllmProvider: WebLLMProvider | null = null;

  // Reflect whether the selected local model is already cached (no re-download).
  const updateLocalHint = async (): Promise<void> => {
    if (currentProvider() !== 'webllm') return;
    if (!isWebGPUAvailable()) {
      note.textContent = t('agentNoWebGPU');
      return;
    }
    const model = WEBLLM_MODELS.find((m) => m.id === modelSelect.value);
    const size = model?.size ?? '';
    const id = modelSelect.value;
    note.textContent = t('agentCheckingCache');
    const cached = await isModelCached(id);
    if (currentProvider() !== 'webllm' || modelSelect.value !== id) return; // changed meanwhile
    // The chat-only banner (shown via syncProviderUi) already says the local model
    // can't edit; `note` just carries the cache/download status.
    note.textContent = cached ? t('agentModelCached') : t('agentModelFirstDownload').replace('{size}', size);
  };

  // The chat-only banner only makes sense when WebLLM is actually usable (selected
  // + WebGPU present); every other provider/state hides it.
  const syncChatOnlyHint = (): void => {
    chatOnlyHint.style.display = currentProvider() === 'webllm' && isWebGPUAvailable() ? '' : 'none';
  };

  // "Switch to cloud" shortcut: flip the provider to Claude, drop the stale
  // controller, and reveal settings so the API-key field is visible immediately.
  const switchToCloud = (): void => {
    providerSelect.value = 'anthropic';
    providerSelect.setAttribute('value', 'anthropic'); // reflect in the r-select UI too
    controller = null;
    settings.classList.remove('agent-panel-settings-hidden');
    syncProviderUi();
  };
  switchCloudLink.addEventListener('click', switchToCloud);
  switchCloudLink.addEventListener('keydown', (event) => {
    const key = (event as KeyboardEvent).key;
    if (key === 'Enter' || key === ' ') {
      event.preventDefault();
      switchToCloud();
    }
  });

  const syncProviderUi = (): void => {
    const id = currentProvider();
    const isCloud = CLOUD_PROVIDERS.has(id);
    keyInput.style.display = isCloud ? '' : 'none';
    modelRow.style.display = id === 'webllm' ? '' : 'none';
    ollamaModelInput.style.display = id === 'ollama' ? '' : 'none';
    syncChatOnlyHint();
    if (isCloud) {
      keyInput.placeholder = KEY_PLACEHOLDER[id] ?? '';
      keyInput.value = getApiKey(id) ?? '';
      note.textContent = '';
    } else if (id === 'ollama') {
      ollamaModelInput.placeholder = t('agentOllamaModelPlaceholder');
      note.textContent = t('agentOllamaHint');
    } else {
      void updateLocalHint();
    }
  };
  providerSelect.addEventListener('change', () => {
    controller = null;
    syncProviderUi();
  });
  modelSelect.addEventListener('change', () => {
    controller = null; // different model → rebuild
    void updateLocalHint();
  });
  keyInput.addEventListener('change', () => {
    const id = currentProvider();
    if (CLOUD_PROVIDERS.has(id)) setApiKey(id, keyInput.value.trim());
  });
  syncProviderUi();

  const buildController = (): AgentChatController | null => {
    const id = currentProvider();
    if (id === 'webllm') {
      if (!isWebGPUAvailable()) return null;
      const kind = `webllm:${modelSelect.value}`;
      if (!controller || controllerKind !== kind) {
        // Local 7–8B models can't reliably drive tool calls (they crash or mangle
        // the tool-call format), so WebLLM runs chat-only: a plain assistant that
        // never errors but can't edit the document. Tool-driven editing is what the
        // cloud/Ollama providers are for.
        webllmProvider = new WebLLMProvider({
          model: modelSelect.value,
          chatOnly: true,
          onProgress: (p) => (note.textContent = p.text),
        });
        controller = new AgentChatController(webllmProvider, appendTurn, controllerOptions);
        controllerKind = kind;
      }
      return controller;
    }
    if (id === 'ollama') {
      const model = ollamaModelInput.value.trim() || undefined;
      const kind = `ollama:${model ?? ''}`;
      if (!controller || controllerKind !== kind) {
        controller = new AgentChatController(
          createProvider('ollama', { ollamaModel: model }),
          appendTurn,
          controllerOptions,
        );
        controllerKind = kind;
        webllmProvider = null;
      }
      return controller;
    }
    const key = keyInput.value.trim();
    if (!key) return null;
    const kind = `${id}:${key}`;
    if (!controller || controllerKind !== kind) {
      controller = new AgentChatController(createProvider(id, { apiKey: key }), appendTurn, controllerOptions);
      controllerKind = kind;
      webllmProvider = null;
    }
    return controller;
  };

  // Load (download + warm) the selected WebLLM model. Used by the Load button and
  // auto-triggered on open when the default provider is local.
  const loadModel = async (): Promise<void> => {
    if (!isWebGPUAvailable()) {
      note.textContent = t('agentNoWebGPU');
      return;
    }
    buildController();
    loadBtn.setAttribute('disabled', '');
    try {
      await webllmProvider?.preload();
      note.textContent = t('agentModelLoaded');
    } catch (error) {
      appendTurn({ role: 'error', text: error instanceof Error ? error.message : String(error) });
    } finally {
      loadBtn.removeAttribute('disabled');
    }
  };

  // ChatView owns the Send/Stop button, Enter-to-send, and the input lock; this
  // just runs a turn. `submit` is passed to ChatView's onSend above.
  const submit = async (text: string): Promise<void> => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const ctl = buildController();
    if (!ctl) {
      chat.append({
        role: 'error',
        text: currentProvider() === 'webllm' ? t('agentNoWebGPU') : t('agentNeedKey'),
      });
      return;
    }
    chat.setRunning(true);
    try {
      await ctl.send(trimmed);
    } finally {
      chat.setRunning(false);
      chat.focus();
    }
  };
  clearBtn.addEventListener('click', () => {
    controller?.reset();
    historyStorage.clear(); // also clear when no controller has been built yet
    chat.clear();
  });

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
  const api = getEditorApi();
  // Track-changes is a Word/Spreadsheet API; the presentation editor has no
  // asc_IsTrackRevisions, so feature-detect before using it (calling a missing
  // method would otherwise abort the whole panel build).
  const canReview = !!api && typeof api.asc_IsTrackRevisions === 'function';
  if (!canReview) reviewCheck.setAttribute('disabled', '');
  if (canReview) reviewCheck.setAttribute('checked', String(!!api!.asc_IsTrackRevisions()));
  reviewCheck.addEventListener('change', (e: Event) => {
    getEditorApi()?.asc_SetTrackRevisions?.((e as CheckedDetail).detail.checked);
  });

  // Reactive labels: a `lang` signal bumped on languagechange drives one effect
  // that re-applies every translatable label — replacing a manual re-render pass.
  const [lang, setLang] = signal(getLanguage());
  window.addEventListener('languagechange', () => setLang(getLanguage()));
  createEffect(() => {
    lang(); // subscribe: re-run whenever the language changes
    launcher.title = t('agentOpenTip');
    title.textContent = t('agentTitle');
    settingsBtn.title = t('agentSettings');
    const selected = providerSelect.value;
    for (const opt of providerSelect.querySelectorAll('r-option')) {
      opt.textContent = t(PROVIDER_LABEL_KEY[(opt.getAttribute('value') as ProviderId) ?? 'anthropic']);
    }
    providerSelect.setAttribute('value', selected); // nudge the closed label to retranslate
    loadBtn.textContent = t('agentLoadModel');
    reviewText.textContent = t('agentReviewMode');
    quoteBtn.textContent = t('agentQuote');
    quoteBtn.title = t('agentQuoteTip');
    clearBtn.textContent = t('agentClear');
    chat.setLabels(chatLabels()); // Send/Stop/placeholder/empty + role chips
    syncProviderUi(); // refresh key placeholder / model hint in the new language
  });

  panel.append(header, settings, note, chatOnlyHint, chat.el);
  document.body.append(panel, launcher);
  setOpen(true); // start open + docked

  // Auto-load the default local model on open — but only when it's already
  // cached, so opening the panel never triggers a surprise ~4 GB download. If
  // it's not cached, the note hints at the download and the user clicks Load.
  if (currentProvider() === 'webllm' && isWebGPUAvailable()) {
    void isModelCached(modelSelect.value).then((cached) => {
      if (cached) void loadModel();
    });
  }

  return panel;
}
