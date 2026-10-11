import { createDocumentAgentTools } from '../document-agent-tools';
import { mountSpeechInput } from './speech-input';
/**
 * Agent sidebar panel — a thin DOM view over {@link AgentChatController}.
 *
 * Header (title + gear + close); a collapsible settings block (provider selector
 * → automatic local inference or manually imported GGUF models), hidden behind the gear so the
 * main panel is a clean chat; a toolbar (review-mode toggle + quote + clear); and
 * the reusable @ranuts/chat-ui ChatView. Form controls are ranui Web Components
 * built with the ranui `builder` (View/Div/... fluent factories). All
 * orchestration lives in the controller and the LLM factory; this file only
 * builds DOM and forwards events. Loaded after an explicit product opt-in.
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
import type { LLMMessage, LLMProvider } from '@ranuts/agent-core/llm/types';
import type { ProviderId } from '@ranuts/agent-core/llm/factory';
import { DEFAULT_CPU_MODEL_URL, LocalInferenceProvider } from '@ranuts/agent-core/llm/local';
import {
  DEFAULT_WEBLLM_MODEL,
  isModelCached,
  RETIRED_WEBLLM_MODELS,
  WEBLLM_MODELS,
} from '@ranuts/agent-core/llm/webllm';
import type { LocalLLMProvider } from '@ranuts/agent-core/llm/types';
import { resolveModelArtifactUrl } from '@ranuts/agent-core/llm/model-source';
import { resolveTaskModel, type ModelTask } from '@ranuts/agent-core/llm/task-model';
import { resolveWritingRoute, type WritingRoute } from '@ranuts/agent-core/llm/writing-route';
import {
  DEFAULT_LOOPBACK_ENDPOINT,
  createEndpointProvider,
  type WritingEndpointKind,
} from '@ranuts/agent-core/llm/endpoint';
import { clearEndpointKey, getEndpointKey, setEndpointKey } from '@ranuts/agent-core/llm/keys';
import { readTaskModelPreferences } from './task-model-preferences';
import {
  ENDPOINT_SETTINGS_KEY,
  configuredEndpoint,
  isCloudEndpointKind,
  readEndpointSettings,
  writeEndpointSettings,
  type EndpointSettings,
} from './endpoint-settings';
import { WllamaProvider } from '@ranuts/agent-core/llm/wllama';
import {
  generateWriting,
  WRITING_LANGUAGES,
  type WritingTask,
  type WritingLanguage,
} from '@ranuts/agent-core/llm/writing-task';
import { captureActionTarget, ReviewedAction } from '../reviewed-action';
import { generateDocumentToolSequence, isModelFreeToolRequest } from '../document-tool-sequence';
import { captureDocumentToolTarget, DocumentToolAction } from '../document-tool-action';
import { documentTools, isLiteralDocumentToolRequest } from '../document-tool-plan';
import { ChatView, type ChatViewLabels } from '@ranuts/chat-ui';
import { AgentChatController, type ChatTurn } from './controller';
import { displayError } from './presentation';
import { historyToTurns } from './storage';
import { createConversationStore } from './sessions';
import { createHistoryControls } from './history-controls';
import { normalizeGenerationOptions } from '@ranuts/agent-core/llm/generation';
import { createSidebarEntry } from './sidebar-entry';
import { mountPanelResize } from './panel-resize';
import { mountPanelViewport } from './panel-viewport';
import { ActionPreview } from './action-preview';
import { ProposalContext } from './proposal-context';
import { captureComposerContext } from './composer-context';
import { captureRequestContext } from './request-context';
import { classifyRequest, resolveRequestIntent } from './request-intent';
import { generateDocumentDraft } from './document-draft';
import {
  deleteCachedModel,
  listCachedGGUF,
  deleteCachedGGUF,
  rememberedModelSources,
  rememberModelSource,
} from '@ranuts/agent-core/llm/model-cache';

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
  loopback: 'agentProviderLoopback',
};
// The loopback service is not a browser engine: it has its own settings block
// rather than a slot in the provider dropdown.
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
let panelHandle: {
  setOpen: (open: boolean) => void;
  isOpen: () => boolean;
  setEnabled: (enabled: boolean) => Promise<void>;
} | null = null;
export const setAgentPanelOpen = (open: boolean): void => panelHandle?.setOpen(open);
export const setAgentPanelEnabled = async (enabled: boolean): Promise<void> => {
  await panelHandle?.setEnabled(enabled);
};

/** Open the panel (creating it on first use), close it, or flip it. */
export function toggleAgentPanel(): void {
  if (panelHandle) panelHandle.setOpen(!panelHandle.isOpen());
  else createAgentPanel(); // first call creates the panel already open
}

/** Build the Agent panel, append it to the body, and return its root element. */
export function createAgentPanel(
  options: {
    background?: boolean;
    externalEntry?: boolean;
    onDisable?: () => Promise<void>;
    onClose?: () => void;
  } = {},
): HTMLElement {
  // Idempotent: a second call just reveals the existing panel.
  const existing = document.querySelector('.agent-runtime-panel');
  if (existing) {
    if (!options.background) panelHandle?.setOpen(true);
    return existing as HTMLElement;
  }

  const panel = Div()
    .class('agent-panel agent-runtime-panel')
    .attr('role', 'complementary')
    .attr('aria-label', t('agentTitle'))
    .build();
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
    scopeTimer = setInterval(syncContext, 1000);
    syncContext();
    syncReviewControl();
    syncProviderUi();
    syncRuntimeStatus();
  });
  window.addEventListener('pagehide', () => disposeResize());

  let open = true;
  let enabled = true;
  const mountSidebar = () =>
    createSidebarEntry(
      () => setOpen(!open),
      () => t('agentOpenTip'),
      () => !options.externalEntry,
    );
  let sidebar = mountSidebar();
  // Configuration, loading progress and retry remain reachable even without a ready model.
  const syncSidebar = (): void => sidebar.update(panel.isConnected, open);
  let speech: ReturnType<typeof mountSpeechInput> | undefined;
  const setOpen = (next: boolean): void => {
    if (!next) speech?.close();
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
        if (open) {
          if (panel.dataset.view === 'settings') settingsHeading.focus();
          else if (panel.dataset.view === 'history') sessionSelect.focus();
          else chat.focus();
        }
      });
  };
  panelHandle = {
    setOpen,
    isOpen: () => open,
    setEnabled: async (next) => {
      if (next && runtimeCleanup) {
        try {
          await runtimeCleanup;
        } catch {
          throw new Error(t('agentModelCleanupFailed'));
        }
      }
      enabled = next;
      if (!next) {
        resetController();
        disconnectEndpoint();
        setOpen(false);
        if (runtimeCleanup) await runtimeCleanup;
      }
      syncRuntimeStatus();
    },
  };

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
      showView(panel.dataset.view === 'settings' ? 'chat' : 'settings');
    })
    .build();
  const closeBtn = ButtonBuilder()
    .class('agent-panel-close')
    .attr('type', 'button')
    .aria('label', t('agentClose'))
    .on('click', () => {
      if (options.onClose) options.onClose();
      else setOpen(false);
    })
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
  const ggufStop = ranButton(t('agentStop'), 'agent-panel-gguf-stop');
  ggufStop.hidden = true;
  ggufStop.addEventListener('click', () => {
    resetController();
    note.textContent = t('agentStopped');
    chat.focus();
  });
  const ggufRow = Div().class('agent-panel-gguf-row').children(ggufUrl, ggufChoose, ggufNames, ggufLoad).build();

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
  const localSource = () =>
    activeTaskModel().source !== 'default'
      ? {}
      : {
          modelUrl: localModelUrl.value.trim() || undefined,
          modelLibUrl: localModelLib.value.trim() || undefined,
        };
  const selectedLocalModel = () => activeTaskModel().binding.model;

  // Local: model picker + load button
  const modelSelect = ranSelect(
    'agent-panel-model',
    WEBLLM_MODELS.map((model) => ({
      value: model.id,
      label: model.label,
    })),
    DEFAULT_WEBLLM_MODEL,
  );
  const presetIds = WEBLLM_MODELS.map((model) => model.id);
  const taskPreferences = readTaskModelPreferences(localStorageGetItem('agent-task-models'), presetIds);
  const savedPreset = localStorageGetItem('agent-local-preset');
  if (WEBLLM_MODELS.some((model) => model.id === savedPreset)) modelSelect.value = savedPreset!;
  else if (savedPreset) localStorageSetItem('agent-local-preset', DEFAULT_WEBLLM_MODEL);
  modelSelect.setAttribute('aria-label', t('agentModelLabel'));
  const loadBtn = ranButton(t('agentLoadModel'), 'agent-panel-load');
  loadBtn.addEventListener('click', () => void loadModel());
  const modelRow = Div().class('agent-panel-model-row').children(modelSelect, loadBtn).build();
  const modelMemory = document.createElement('p');
  modelMemory.className = 'agent-model-memory';
  modelMemory.id = 'agent-model-memory';
  modelSelect.setAttribute('aria-describedby', 'agent-model-memory');
  const syncModelMemory = () => {
    modelMemory.hidden = providerSelect.value === 'wllama';
    const model = WEBLLM_MODELS.find((item) => item.id === modelSelect.value);
    modelMemory.textContent = model ? t('agentModelMemory').replace('{memory}', (model.vramMB / 1000).toFixed(2)) : '';
  };
  modelSelect.addEventListener('change', syncModelMemory);
  providerSelect.addEventListener('change', syncModelMemory);
  syncModelMemory();
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

  // ── Writing destination ──────────────────────────────────────────────────
  // Writing into a document is high-stakes, and the browser-local engines never
  // reached seven-language quality acceptance. The user may instead point the
  // assistant at a model server: a loopback service on this machine (the text
  // stays on the device) or a cloud endpoint with their own key (the selected
  // text is sent there). The resolved destination is always shown, because the
  // two are not equivalent and the choice belongs to the user.
  let endpointSettings: EndpointSettings = readEndpointSettings(localStorageGetItem(ENDPOINT_SETTINGS_KEY));
  const endpointKind = ranSelect(
    'agent-endpoint-kind',
    [
      { value: 'loopback', label: t('agentEndpointLoopback') },
      { value: 'openai-compatible', label: t('agentEndpointOpenAICompatible') },
      { value: 'anthropic', label: t('agentEndpointAnthropic') },
      { value: 'gemini', label: t('agentEndpointGemini') },
    ],
    endpointSettings.kind,
  );
  endpointKind.setAttribute('aria-label', t('agentEndpointKind'));
  const endpointBaseUrl = ranInput('agent-panel-endpoint-url', 'text');
  endpointBaseUrl.value =
    endpointSettings.baseUrl || (endpointSettings.kind === 'loopback' ? DEFAULT_LOOPBACK_ENDPOINT : '');
  endpointBaseUrl.placeholder =
    endpointSettings.kind === 'loopback' ? DEFAULT_LOOPBACK_ENDPOINT : 'https://api.example.com/v1';
  endpointBaseUrl.setAttribute('aria-label', t('agentEndpointUrl'));
  const endpointModel = ranInput('agent-panel-endpoint-model', 'text');
  endpointModel.value = endpointSettings.model;
  endpointModel.placeholder = 'qwen3:8b';
  endpointModel.setAttribute('aria-label', t('agentEndpointModel'));
  const endpointKey = ranInput('agent-panel-endpoint-key', 'password');
  endpointKey.placeholder = t('agentEndpointKey');
  endpointKey.setAttribute('aria-label', t('agentEndpointKey'));
  const endpointConnect = ranButton(t('agentEndpointConnect'), 'agent-panel-endpoint-connect');
  const endpointStatus = Span()
    .class('agent-panel-endpoint-status')
    .attr('role', 'status')
    .id('agent-endpoint-status')
    .build();
  for (const control of [endpointKind, endpointBaseUrl, endpointModel, endpointKey])
    control.setAttribute('aria-describedby', 'agent-endpoint-status');
  const writeDestination = Span().class('agent-panel-write-destination').attr('role', 'status').build();
  const writePreference = ranSelect(
    'agent-write-preference',
    [
      { value: 'device-first', label: t('agentWritePreferDevice') },
      { value: 'remote-first', label: t('agentWritePreferRemote') },
    ],
    endpointSettings.preference,
  );
  writePreference.setAttribute('aria-label', t('agentWritePreference'));
  const localWritingConsent = document.createElement('input');
  localWritingConsent.type = 'checkbox';
  localWritingConsent.className = 'agent-panel-local-writing';
  localWritingConsent.checked = endpointSettings.localWritingConsent;
  const consentLabel = document.createElement('label');
  consentLabel.className = 'agent-panel-local-writing-label';
  consentLabel.append(localWritingConsent, t('agentLocalWritingConsent'));
  const endpointRow = Div()
    .class('agent-panel-endpoint')
    .children(
      Span().class('agent-panel-endpoint-title').text(t('agentWriteDestinationTitle')).build(),
      endpointKind,
      endpointBaseUrl,
      endpointModel,
      endpointKey,
      endpointConnect,
      endpointStatus,
      writePreference,
      writeDestination,
      consentLabel,
    )
    .build();

  const settings = Div()
    .class('agent-panel-settings agent-panel-settings-hidden')
    .id('agent-settings')
    .children(providerSelect, modelRow, ggufRow, endpointRow)
    .build();
  settings.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || event.defaultPrevented || event.isComposing || event.keyCode === 229) return;
    event.stopPropagation();
    showView('chat');
    settingsBtn.focus();
  });

  // ── Compose actions (mounted into ChatView's slot above the input) ────────
  const reviewCheck = View('r-checkbox').build();
  const reviewText = Span().text(t('agentReviewMode')).build();
  const reviewLabel = Label().class('agent-panel-review').children(reviewCheck, reviewText).build();

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
  let cacheBusy = false;
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
    const provider = useEndpointForChat() ? endpointProvider : webllmProvider;
    return intent?.kind === 'clarify' && (writingSelect.value === 'tools' || provider?.isReady()) ? null : intent;
  };
  const chat = new ChatView({
    canSend: (text) => {
      if (!enabled || runtimeCleanup || cacheBusy || speech?.isBusy()) return false;
      if (parseDirectDocumentIntent(resolveContextCommand(text.trim(), captureDocumentContext()))) return true;
      const request = classifyRequest(text);
      if (['rewrite', 'summarize', 'translate'].includes(request.task)) return true;
      if (request.task === 'tools')
        return (
          !!webllmProvider?.isReady() || useEndpointForChat() || isModelFreeToolRequest(text, captureDocumentContext())
        );
      if (directIntent(text.trim())) return true;
      return (
        !!webllmProvider?.isReady() ||
        (!!endpointProvider?.isReady() && (endpointSettings.kind === 'loopback' || navigator.onLine !== false))
      );
    },
    onSend: (text) => void submit(text),
    requireDocumentArtifact: true,
    canApplyMessage: () => captureDocumentContext()?.kind === 'word' && !getReadonlyMode(),
    onApplyMessage: (text) => applyReply(text),
    onStop: () => {
      controller?.stop();
      if (refiningPreview) planning?.abort();
      else invalidatePlans();
    },
    labels: chatLabels(),
  });
  const readiness = document.createElement('p');
  readiness.className = 'agent-readiness';
  readiness.setAttribute('role', 'status');
  chat.el.append(readiness);
  let preview = new ActionPreview();
  let refiningPreview: ActionPreview | undefined;
  const previews = new Set([preview]);
  const clearPreviews = (): void => {
    for (const item of previews) item.dispose();
    previews.clear();
  };
  window.addEventListener('pagehide', clearPreviews);
  const appendTurn = (turn: ChatTurn): void => {
    chat.append(turn.role === 'error' ? { ...turn, text: displayError(turn.text) } : turn);
  };
  let planning: AbortController | null = null;

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
  writingSelect.hidden = true;
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
  const taskRequest = () => ({
    task: writingSelect.value as ModelTask,
    ...(writingSelect.value === 'translate' ? { targetLanguage: languageSelect.value as WritingLanguage } : {}),
  });
  const activeTaskModel = () =>
    resolveTaskModel(taskRequest(), taskPreferences, {
      backend: 'webllm',
      model: localModelId.value.trim() || modelSelect.value,
    });
  chat.actionsEl.append(writingSelect, languageSelect);
  writingSelect.addEventListener('change', () => {
    proposalMode = writingSelect.value !== 'chat';
    invalidatePlans();
    languageSelect.hidden = true;
    chat.setLabels(chatLabels());
    syncRuntimeStatus();
  });
  languageSelect.addEventListener('change', () => {
    invalidatePlans();
    syncRuntimeStatus();
  });
  speech = mountSpeechInput(chat, () => enabled && !planning && !controller?.isRunning() && !replyAbort);
  const welcomeHint = document.createElement('p');
  welcomeHint.className = 'agent-welcome-hint';
  welcomeHint.textContent = t('agentWelcomeHint');
  chat.emptyActionsEl.prepend(welcomeHint);
  let quotedSelection = '';
  const quoteContext = document.createElement('div');
  quoteContext.className = 'agent-quote-context';
  quoteContext.hidden = true;
  const quoteDetails = document.createElement('details');
  const quoteSummary = document.createElement('summary');
  const quoteText = document.createElement('pre');
  quoteText.className = 'agent-quoted-text';
  quoteDetails.append(quoteSummary, quoteText);
  quoteContext.append(quoteDetails);
  chat.contextEl.append(quoteContext);
  const refinement = new ProposalContext();
  const refinementRow = Div().class('agent-refinement-context').build();
  const refinementLabel = Span().build();
  const refinementCancel = ButtonBuilder().attr('type', 'button').build();
  refinementRow.append(refinementLabel, refinementCancel);
  refinementRow.hidden = true;
  chat.contextEl.append(refinementRow);
  const clearRefinement = (): void => {
    refinement.clear();
    refinementRow.hidden = true;
  };
  refinementCancel.addEventListener('click', () => {
    clearRefinement();
    chat.focus();
  });
  const selectRefinement = (card: ActionPreview): void => {
    if (!card.pending()) return;
    refinement.select(() => card.pending()?.plan);
    refinementLabel.textContent = t('agentRefiningProposal');
    refinementCancel.textContent = t('agentPlanCancel');
    refinementRow.hidden = false;
    chat.focus();
  };
  const clearQuote = () => {
    quotedSelection = '';
    quoteText.textContent = '';
    quoteContext.hidden = true;
  };
  window.addEventListener('document:content-ready', clearQuote);

  const invalidatePlans = (): void => {
    clearRefinement();
    preview.invalidate();
    replyAbort?.abort();
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

  const updateScope = (): void => {
    const context = captureDocumentContext();
    const label = context
      ? context.kind === 'cell'
        ? `Excel · ${context.sheet ?? ''} ${context.range ?? ''}`
        : context.kind === 'slide'
          ? `PPT · ${context.page ?? ''}`
          : context.kind === 'pdf'
            ? 'PDF'
            : 'DOCX'
      : '';
    if (scopeLabel.textContent !== label) scopeLabel.textContent = label;
  };
  const syncContext = () => {
    updateScope();
    const snapshot = captureComposerContext();
    const context = snapshot.context;
    quoteContext.hidden = !context || !snapshot.text.trim();
    const label =
      context?.kind === 'cell'
        ? `${context.sheet ?? 'Excel'} · ${context.range ?? ''}`
        : context?.kind === 'slide'
          ? `${t('agentSlideContext').replace('{page}', String(context.page ?? ''))}`
          : snapshot.text
            ? t('agentSelectionContext').replace('{count}', String(snapshot.text.length))
            : t('agentCurrentDocument');
    if (quoteSummary.textContent !== label) quoteSummary.textContent = label;
    quoteSummary.setAttribute('aria-label', `${t('agentReadSelection')} · ${label}`);
    if (quoteText.textContent !== snapshot.text) quoteText.textContent = snapshot.text;
    const releaseControl = settings.querySelector<HTMLElement>('.agent-release-memory');
    if (releaseControl) releaseControl.hidden = !webllmProvider?.isReady();
    const welcome =
      context?.kind === 'cell'
        ? 'agentWelcomeCell'
        : context?.kind === 'pdf'
          ? 'agentWelcomePdf'
          : context?.kind === 'slide'
            ? 'agentWelcomeSlide'
            : 'agentWelcomeWord';
    if (welcomeHint.textContent !== t(welcome)) welcomeHint.textContent = t(welcome);
  };
  let scopeTimer = setInterval(syncContext, 1000);
  window.addEventListener('pagehide', () => clearInterval(scopeTimer));
  syncContext();
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
  const currentProvider = (): 'webllm' | 'wllama' =>
    activeTaskModel().source !== 'default' ? 'webllm' : providerSelect.value === 'wllama' ? 'wllama' : 'webllm';

  let controller: AgentChatController | null = null;
  let controllerKind = '';
  let localProviderKey = '';
  let controllerGeneration = 0;
  let conversationRevision = 0;
  let loadAttempt = 0;
  let webllmProvider: LocalLLMProvider | null = null;
  // Independent of the browser-local lifecycle: switching or unloading a browser
  // model must not disconnect a writing endpoint the user deliberately connected.
  let endpointProvider: LLMProvider | null = null;
  let pendingEndpoint: LLMProvider | null = null;
  let endpointAttempt = 0;
  const endpointKindValue = (): WritingEndpointKind => endpointKind.value as WritingEndpointKind;
  const endpointKeySlot = (kind: WritingEndpointKind): string =>
    kind === 'openai-compatible' ? endpointBaseUrl.value.trim() : kind;
  const rememberEndpoint = (): void => {
    const next: EndpointSettings = {
      kind: endpointKindValue(),
      baseUrl: endpointBaseUrl.value.trim(),
      model: endpointModel.value.trim(),
      preference: writePreference.value === 'remote-first' ? 'remote-first' : 'device-first',
      localWritingConsent: localWritingConsent.checked,
    };
    endpointSettings = next;
    try {
      localStorageSetItem(ENDPOINT_SETTINGS_KEY, writeEndpointSettings(next));
    } catch {
      // An endpoint the route would refuse is never persisted.
    }
    if (isCloudEndpointKind(next.kind)) {
      const slot = endpointKeySlot(next.kind);
      // No address yet means no slot to address; the key is simply not stored.
      // Clearing the field removes the stored key: a secret the user cannot
      // delete is worse than one they have to retype.
      if (slot) {
        if (endpointKey.value.trim()) setEndpointKey(slot, endpointKey.value.trim());
        else clearEndpointKey(slot);
      }
    }
  };
  const useEndpointForChat = (): boolean => {
    if (!endpointProvider?.isReady() || (endpointSettings.kind !== 'loopback' && navigator.onLine === false))
      return false;
    return (
      endpointSettings.kind === 'loopback' ||
      endpointSettings.preference === 'remote-first' ||
      !webllmProvider?.isReady()
    );
  };
  const resolveRoute = (): WritingRoute => {
    const endpoint = endpointProvider?.isReady() ? configuredEndpoint(endpointSettings) : null;
    return resolveWritingRoute({
      loopback: endpoint?.kind === 'loopback' ? endpoint : null,
      remote: endpoint && endpoint.kind !== 'loopback' ? endpoint : null,
      preference: endpointSettings.preference,
      // Offline the only workable destinations are on this device, so a cloud
      // endpoint is dropped here rather than attempted and then failed.
      offline: navigator.onLine === false,
      localWritingConsent: localWritingConsent.checked,
      local: { backend: currentProvider(), model: selectedLocalModel() },
    });
  };
  const syncWriteDestination = (): void => {
    writeDestination.hidden = false;
    if (writingSelect.value === 'chat' || writingSelect.value === 'tools') {
      const endpoint = useEndpointForChat();
      const ready = endpoint || !!webllmProvider?.isReady();
      const where =
        endpoint && endpointSettings.kind !== 'loopback'
          ? 'agentWriteDestinationRemote'
          : 'agentWriteDestinationDevice';
      const unavailable =
        endpointProvider?.isReady() && endpointSettings.kind !== 'loopback' && navigator.onLine === false;
      writeDestination.hidden = !ready && !unavailable;
      writeDestination.textContent = `${t('agentWriteDestinationTitle')}: ${t(ready ? where : unavailable ? 'agentWriteDestinationOfflineUnavailable' : 'agentWriteNeedsDestination')}`;
      return;
    }
    let route: WritingRoute | null = null;
    try {
      route = resolveRoute();
    } catch {
      route = null;
    }
    const title = t('agentWriteDestinationTitle');
    const offlineNote = navigator.onLine === false ? ` · ${t('agentEndpointOfflineHint')}` : '';
    if (!route || route.kind === 'blocked') {
      // "not configured" would be false when a cloud endpoint is configured but
      // cannot be used right now; say what is actually configured.
      const configured = endpointProvider?.isReady() ? configuredEndpoint(endpointSettings) : null;
      writeDestination.hidden = !configured;
      if (configured && configured.kind !== 'loopback')
        writeDestination.textContent = `${title}: ${t('agentWriteDestinationOfflineUnavailable')} · ${configured.model}`;
      else writeDestination.textContent = `${title}: ${t('agentWriteNeedsDestination')}${offlineNote}`;
      return;
    }
    const where = route.dataPath === 'device' ? t('agentWriteDestinationDevice') : t('agentWriteDestinationRemote');
    writeDestination.textContent = `${title}: ${where}${offlineNote}`;
  };
  // Filling the key field is a deliberate act (mount, or a different endpoint
  // kind). Rendering status must not do it: it would overwrite a key the user is
  // in the middle of typing, before it has been stored.
  const loadStoredKeyIntoForm = (): void => {
    const kind = endpointKindValue();
    const slot = isCloudEndpointKind(kind) ? endpointKeySlot(kind) : '';
    endpointKey.value = slot ? (getEndpointKey(slot) ?? '') : '';
  };
  const syncEndpointForm = (status = ''): void => {
    const kind = endpointKindValue();
    const cloud = isCloudEndpointKind(kind);
    endpointBaseUrl.hidden = kind === 'anthropic' || kind === 'gemini';
    endpointKey.hidden = !cloud;
    endpointStatus.textContent = endpointProvider?.isReady()
      ? t(cloud ? 'agentEndpointConfigured' : 'agentEndpointConnected')
      : status;
    endpointConnect.textContent = endpointProvider ? t('agentEndpointDisconnect') : t('agentEndpointConnect');
    syncRuntimeStatus();
  };
  const disconnectEndpoint = (): void => {
    endpointAttempt++;
    if (controllerKind.startsWith('endpoint:')) {
      controller?.dispose();
      controller = null;
      chat.setRunning(false);
    }
    invalidatePlans();
    const pending = pendingEndpoint;
    pendingEndpoint = null;
    if (pending && 'dispose' in pending && typeof pending.dispose === 'function') void pending.dispose();
    const previous = endpointProvider;
    endpointProvider = null;
    if (previous && 'dispose' in previous && typeof previous.dispose === 'function') void previous.dispose();
    syncEndpointForm();
  };
  const connectEndpoint = async (): Promise<void> => {
    if (!enabled) return;
    if (endpointProvider || pendingEndpoint) {
      disconnectEndpoint();
      return;
    }
    const kind = endpointKindValue();
    if (!endpointModel.value.trim()) {
      endpointStatus.textContent = t('agentEndpointModelRequired');
      return;
    }
    if (kind === 'openai-compatible' && !endpointBaseUrl.value.trim()) {
      endpointStatus.textContent = t('agentEndpointUrlRequired');
      return;
    }
    if (isCloudEndpointKind(kind) && !endpointKey.value.trim()) {
      const slot = endpointKeySlot(kind);
      if (!slot || !getEndpointKey(slot)) {
        // A cloud endpoint without a key is not "failed", it is incomplete.
        endpointStatus.textContent = t('agentEndpointKeyRequired');
        return;
      }
    }
    const attempt = ++endpointAttempt;
    endpointStatus.textContent = t('agentEndpointConnecting');
    let failure = '';
    try {
      rememberEndpoint();
      const endpoint = configuredEndpoint(endpointSettings);
      if (!endpoint) throw new Error('Incomplete writing endpoint');
      const stored = isCloudEndpointKind(kind) ? getEndpointKey(endpointKeySlot(kind)) : undefined;
      const provider = createEndpointProvider(endpoint, endpointKey.value.trim() || stored);
      pendingEndpoint = provider;
      // Only the loopback service has a real connection check; a cloud endpoint
      // reports "configured" because readiness is not reachability.
      if ('preload' in provider && typeof provider.preload === 'function') await provider.preload();
      if (attempt !== endpointAttempt) return;
      if (!provider.isReady()) throw new Error('Writing endpoint is not ready');
      endpointProvider = provider;
    } catch {
      if (attempt !== endpointAttempt) return;
      disconnectEndpoint();
      failure = t('agentEndpointFailed');
      note.textContent = failure;
    }
    pendingEndpoint = null;
    syncEndpointForm(failure);
    syncRuntimeStatus();
  };
  endpointConnect.addEventListener('click', () => void connectEndpoint());
  // A field that defines the destination invalidates the connected provider.
  // Without this the panel would report the new destination while requests still
  // went to the old one -- including a different origin, and the old key.
  endpointBaseUrl.addEventListener('change', () => {
    // A different address is a different service, so the old secret does not
    // travel to the new origin with it.
    disconnectEndpoint();
    endpointKey.value = '';
    rememberEndpoint();
    syncEndpointForm();
  });
  for (const input of [endpointModel, endpointKey])
    input.addEventListener('change', () => {
      // Store what was typed first: disconnecting re-renders the form.
      rememberEndpoint();
      disconnectEndpoint();
    });
  // These two do not define where the text goes, so they keep the connection.
  for (const input of [localWritingConsent, writePreference])
    input.addEventListener('change', () => {
      rememberEndpoint();
      syncEndpointForm();
    });
  endpointKind.addEventListener('change', () => {
    // A different kind is a different destination: never keep the old provider.
    disconnectEndpoint();
    endpointBaseUrl.value = endpointKindValue() === 'loopback' ? DEFAULT_LOOPBACK_ENDPOINT : '';
    loadStoredKeyIntoForm();
    rememberEndpoint();
    syncEndpointForm();
  });
  loadStoredKeyIntoForm();
  syncEndpointForm();
  const modelName = (url: string): string => {
    try {
      return decodeURIComponent(new URL(url, location.href).pathname.split('/').pop() || url);
    } catch {
      return url;
    }
  };
  function syncRuntimeStatus(): void {
    const localReady = !!webllmProvider?.isReady();
    for (const button of [loadBtn, ggufLoad]) {
      button.textContent = t(modelLoading ? 'agentPreparing' : localReady ? 'agentModelInUse' : 'agentLoadModel');
      button.toggleAttribute('disabled', modelLoading || localReady || !enabled || cacheBusy);
    }
    const ready = localReady || useEndpointForChat();
    readiness.textContent = ready ? '' : t('agentPrepareRequired');
    if (proposalMode && writingSelect.value !== 'tools') {
      try {
        const route = resolveRoute();
        if (route.kind === 'blocked')
          readiness.textContent = t(
            route.reason === 'offline-needs-device-destination'
              ? 'agentWritingOfflineNeedsDevice'
              : 'agentWritingNeedsLocalService',
          );
      } catch {
        readiness.textContent = t('agentPrepareRequired');
      }
    }
    chat.refreshSendAvailability();
    loadingStatus.textContent = modelLoading
      ? [
          t('agentPreparing'),
          t('agentUseDevice'),
          loadingFraction === undefined ? '' : `${Math.round(loadingFraction * 100)}%`,
        ]
          .filter(Boolean)
          .join(' · ')
      : webllmProvider?.isReady()
        ? t('agentUseDevice')
        : '';
    syncWriteDestination();
    runtimeRow.hidden = !loadingStatus.textContent || (panel.dataset.view === 'settings' && !modelLoading);
    note.hidden = modelLoading && panel.dataset.view === 'settings';
    loadProgress.hidden = !modelLoading;
    if (loadingFraction === undefined) loadProgress.removeAttribute('value');
    else loadProgress.value = loadingFraction;
  }
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
  const generationOptions = normalizeGenerationOptions();
  const resetController = (): void => {
    syncSidebar();
    modelLoading = false;

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
    localProviderKey = '';
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
    syncRuntimeStatus();
  };
  window.addEventListener('pagehide', resetController);
  window.addEventListener('pagehide', disconnectEndpoint);
  // Losing the connection changes which destinations can work at all, so the
  // reported destination has to follow it.
  window.addEventListener('online', () => syncEndpointForm());
  window.addEventListener('offline', () => syncEndpointForm());
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
    if (webllmProvider?.isReady()) {
      note.textContent = t('agentModelLoaded');
      return;
    }
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
    writingSelect.hidden = true;

    languageSelect.hidden = true;
  };

  const syncProviderUi = (): void => {
    const id = currentProvider();
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
    localStorageSetItem('agent-panel-provider', providerSelect.value === 'wllama' ? 'wllama' : 'webllm');
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

  const routeKey = () => JSON.stringify([currentProvider(), selectedLocalModel(), localSource()]);
  let previousRoute = routeKey();
  const taskRouteChanged = () => {
    const next = routeKey();
    if (next !== previousRoute) resetController();
    previousRoute = next;
    syncProviderUi();
    syncRuntimeStatus();
  };
  writingSelect.addEventListener('change', taskRouteChanged);
  languageSelect.addEventListener('change', taskRouteChanged);
  const buildController = (localOnly = false): AgentChatController | null => {
    if (runtimeCleanup) return null;
    const id = currentProvider();
    const generation = controllerGeneration;
    const conversation = conversationRevision;
    const emit = (turn: ChatTurn): void => {
      if (generation === controllerGeneration && conversation === conversationRevision) appendTurn(turn);
    };
    const options = {
      ...controllerOptions,
      tools: {},
      getTools: () => {
        if (!endpointProvider?.isReady() || endpointProvider.toolCallingMode !== 'native' || !useEndpointForChat())
          return {};
        const target = captureDocumentToolTarget();
        return createDocumentAgentTools({
          target,
          readonly: getReadonlyMode(),
          review: (action) => {
            if (generation !== controllerGeneration || conversation !== conversationRevision)
              throw new Error(t('agentPlanExpired'));
            const card = new ActionPreview();
            preview = card;
            previews.add(card);
            card.show(
              action,
              (outcome, appliedAction) => {
                if (generation === controllerGeneration && conversation === conversationRevision) {
                  const receipt = {
                    role: 'assistant' as const,
                    content: JSON.stringify({
                      status: outcome,
                      tool: appliedAction.plan.tool,
                      input: appliedAction.plan.input,
                      result: appliedAction.result,
                    }),
                    hostGuidance: 'tool' as const,
                  };
                  controller?.recordExternalMessages([receipt]);
                }
              },
              () => selectRefinement(card),
            );
            chat.appendContent(card.el);
          },
          receipt: (_name, result) => {
            if (generation !== controllerGeneration || conversation !== conversationRevision) return;
            const value = result as { text?: string; page?: number } | undefined;
            appendTurn({
              role: 'tool',
              text:
                _name === 'get_pdf_text' && !value?.text?.trim()
                  ? t('agentPdfTextUnavailable')
                  : typeof value?.text === 'string'
                    ? value.text.trim() || t('agentNoReadableText')
                    : JSON.stringify(result) || t('agentNoReadableText'),
            });
          },
        });
      },
      storage: historyStorage,
      getRequestContext: (): string | undefined => {
        const reference = captureRequestContext();
        return reference.editor
          ? JSON.stringify({
              ...reference,
              availableOperations: documentTools(reference.editor)
                .filter((tool) => !getReadonlyMode() || tool.readOnlyHint)
                .map((tool) => ({
                  name: tool.name,
                  description: tool.description,
                  requiresReview: !tool.readOnlyHint,
                })),
            })
          : undefined;
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
    if (
      !localOnly &&
      (!proposalMode || endpointProvider?.toolCallingMode === 'native') &&
      useEndpointForChat() &&
      endpointProvider
    ) {
      const kind = `endpoint:${endpointAttempt}`;
      if (!controller || controllerKind !== kind) {
        controller?.dispose();
        controller = new AgentChatController(endpointProvider, emit, { ...options, tools: {} });
        controllerKind = kind;
      }
      return controller;
    }
    if (id === 'wllama') {
      if (!controller || controllerKind !== 'wllama') {
        controller?.dispose();
        localProviderKey = 'wllama';
        webllmProvider ??= new WllamaProvider({
          generation: generationOptions,
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
        controller?.dispose();
        if (!webllmProvider || localProviderKey !== kind) {
          localProviderKey = kind;
          webllmProvider = new LocalInferenceProvider({
            generation: generationOptions,
            webllm: {
              model: selectedLocalModel(),
              ...localSource(),
              chatOnly: true,
              onUnavailable: () => {
                if (generation !== controllerGeneration || modelLoading) return;
                syncRuntimeStatus();
                note.textContent = t('agentLoadModel');
                syncSidebar();
              },
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
                loadingStatus.title =
                  backend === 'wllama'
                    ? modelName(ggufUrl.value.trim() || DEFAULT_CPU_MODEL_URL)
                    : selectedLocalModel();
                updateLoadProgress();
              }
            },
          });
        }
        controller = new AgentChatController(webllmProvider, emit, options);
        controllerKind = kind;
      }
      return controller;
    }
    return null;
  };

  // Load (download + warm) the selected WebLLM model. Used by the Load button and
  // only triggered by a deliberate preparation action.
  const loadModel = async (): Promise<void> => {
    if (
      !enabled ||
      cacheBusy ||
      modelLoading ||
      webllmProvider?.isReady() ||
      planning ||
      controller?.isRunning() ||
      replyAbort
    )
      return;
    const generation = controllerGeneration;
    let loading: typeof webllmProvider = null;
    modelLoading = true;
    loadingBackend = currentProvider() === 'wllama' ? 'wllama' : undefined;
    chat.refreshSendAvailability();
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
      buildController(true);
      loading = webllmProvider;
      if (!loading) return;
      await loading.preload();
      if (loading === webllmProvider && generation === controllerGeneration) {
        note.textContent = t('agentModelLoaded');
        if (currentProvider() === 'webllm')
          rememberModelSource({
            id: selectedLocalModel(),
            label: WEBLLM_MODELS.find((item) => item.id === selectedLocalModel())?.label ?? selectedLocalModel(),
            ...localSource(),
          });
        syncSidebar();
        void refreshCache();
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
        ggufStop.hidden = true;
        loadStop.hidden = true;
      }
    }
  };

  let writingReply = false;
  let replyAbort: AbortController | null = null;
  const applyReply = async (text: string): Promise<'verified' | 'sent' | 'retry' | 'failed'> => {
    if (!enabled || writingReply) return 'retry';
    const revision = conversationRevision;
    let attempted = false;
    writingReply = true;
    try {
      const target = captureActionTarget();
      if (target.editor !== 'word') throw new Error(t('agentWordOnly'));
      invalidatePlans();
      const action = new ReviewedAction(target, { tool: 'insert_text', input: { text } });
      attempted = true;
      replyAbort = new AbortController();
      const outcome = await action.apply(replyAbort.signal);
      if (revision === conversationRevision && outcome === 'sent')
        appendTurn({ role: 'tool', text: t('agentPlanApplied') });
      return outcome;
    } catch (error) {
      if (revision === conversationRevision)
        appendTurn({ role: 'error', text: attempted ? t('agentPlanUnverified') : displayError(error) });
      return attempted ? 'failed' : 'retry';
    } finally {
      writingReply = false;
      replyAbort = null;
    }
  };

  // ChatView owns the Send/Stop button, Enter-to-send, and the input lock; this
  // just runs a turn. `submit` is passed to ChatView's onSend above.
  const submit = async (text: string): Promise<void> => {
    const trimmed = text.trim();
    if (!enabled || !trimmed) return;
    const refinementContext = refinement.capture();
    if (refinementContext.kind === 'expired') {
      clearRefinement();
      appendTurn({ role: 'status', text: t('agentPlanExpired') });
      chat.setInput(trimmed);
      chat.focus();
      return;
    }
    // Snapshot before mode changes invalidate the previous action. This is reference
    // data only: a fresh target is still captured before the next model request.
    const previousPreview = preview.pending() ? preview : undefined;
    const pendingProposal = refinementContext.kind === 'selected' ? refinementContext.plan : preview.pending()?.plan;
    let request = classifyRequest(trimmed);
    if (refinementContext.kind === 'selected') request.task = 'tools';
    writingSelect.value = request.task;
    languageSelect.value = request.language;
    proposalMode = writingSelect.value !== 'chat';
    languageSelect.hidden = true;
    chat.setLabels(chatLabels());
    const snapshot = captureComposerContext();
    const literalToolRequest = isLiteralDocumentToolRequest(trimmed, snapshot.context);
    if (literalToolRequest || isModelFreeToolRequest(trimmed, snapshot.context)) {
      request.task = 'tools';
      writingSelect.value = 'tools';
      proposalMode = true;
      chat.setLabels(chatLabels());
    }
    quotedSelection = snapshot.text;
    const intentProvider = useEndpointForChat() ? endpointProvider : webllmProvider;
    if (
      (!intentProvider || (!intentProvider.generateJSON && typeof intentProvider.chat !== 'function')) &&
      ['rewrite', 'summarize', 'translate'].includes(request.task) &&
      (!snapshot.text.trim() || snapshot.truncated)
    ) {
      appendTurn({ role: 'user', text: trimmed });
      appendTurn({
        role: 'status',
        text: t(
          snapshot.truncated
            ? 'agentContextTooLarge'
            : snapshot.context?.kind === 'cell'
              ? 'agentSelectCells'
              : snapshot.context?.kind === 'slide'
                ? 'agentSelectSlideText'
                : 'agentSelectText',
        ),
      });
      chat.setInput(trimmed);
      chat.focus();
      return;
    }
    const intent = refinementContext.kind === 'selected' ? null : directIntent(trimmed);
    if (intent) {
      const answer = chat.getLastDocumentBody();
      const chinese = getLanguage().startsWith('zh');
      const messages: (LLMMessage & { hostGuidance?: 'tool' | 'status' | 'error' })[] = [
        { role: 'user', content: trimmed },
      ];
      const revision = conversationRevision;
      const directGeneration = controllerGeneration;
      const originStorage = historyStorage;
      const originSession = conversations.activeId;
      appendTurn({ role: 'user', text: trimmed });

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
            result = await agentTools[name].execute(input, directAbort.signal);
          } else {
            name = intent.kind === 'bold' ? 'set_bold' : 'set_paragraph_alignment';
            input = intent.kind === 'bold' ? { enabled: intent.enabled } : { alignment: intent.alignment };
            if (
              intent.kind === 'align' &&
              /当前段落|current paragraph/i.test(trimmed) &&
              getEditorApi()?.pluginMethod_GetSelectedText().trim()
            )
              throw new Error('agentParagraphSelectionConflict');
            result = await agentTools[name].execute(input, directAbort.signal);
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
            syncContext();
            chat.setRunning(false);
            chat.focus();
          }
        }
      }
      return;
    }
    const ctl = buildController();
    // Which requests actually need the browser-local model: a connected endpoint
    // serves the writing tasks, the fixed tool phrases need no model at all, and
    // chat or an open-ended tool request still does. Asking this is what keeps a
    // model download from standing in front of work that would never use it.
    const localModelNeeded = ((): boolean => {
      if (writingSelect.value === 'tools')
        return !useEndpointForChat() && !isModelFreeToolRequest(text, captureDocumentContext());
      if (!proposalMode)
        return !endpointProvider?.isReady() || (endpointSettings.kind !== 'loopback' && navigator.onLine === false);
      try {
        return resolveRoute().kind === 'local';
      } catch {
        return false;
      }
    })();
    if (
      localModelNeeded &&
      (currentProvider() === 'wllama' || currentProvider() === 'webllm') &&
      !webllmProvider?.isReady()
    ) {
      chat.setInput(text);
      showView('settings');
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

    chat.setRunning(true);
    const generation = controllerGeneration;
    const conversation = conversationRevision;
    const operationHistory: Array<LLMMessage & { hostGuidance?: 'tool' | 'status' | 'error'; copyOnly?: true }> = [];
    const operationStorage = historyStorage;
    const operationSession = conversations.activeId;
    // Bind the request before any model await: selection changes must never retarget a write.
    const requestTarget = (() => {
      try {
        return captureDocumentToolTarget();
      } catch {
        return null;
      }
    })();
    let routingStarted = false;
    if (previousPreview) {
      refiningPreview = previousPreview;
      previousPreview.setRefining(true);
    }
    try {
      const routingProvider = useEndpointForChat() ? endpointProvider : webllmProvider;
      if (refinementContext.kind === 'selected') {
        request = { task: 'tools', language: request.language, refinement: true };
        writingSelect.value = 'tools';
      } else if (
        routingProvider?.isReady() &&
        routingProvider.toolCallingMode === 'native' &&
        !pendingProposal &&
        !['rewrite', 'summarize', 'translate'].includes(request.task) &&
        !literalToolRequest &&
        !isModelFreeToolRequest(trimmed, snapshot.context)
      ) {
        await ctl.send(trimmed);
        return;
      }
      if (
        refinementContext.kind !== 'selected' &&
        routingProvider?.isReady() &&
        !literalToolRequest &&
        !isModelFreeToolRequest(trimmed, snapshot.context) &&
        (routingProvider.generateJSON || typeof routingProvider.chat === 'function')
      ) {
        const abort = new AbortController();
        planning = abort;
        routingStarted = true;
        request = await resolveRequestIntent(routingProvider, trimmed, snapshot.context, abort.signal, {
          hasSelection: !!snapshot.text.trim() && !snapshot.truncated,
          pendingProposal,
        });
        abort.signal.throwIfAborted();
        if (generation !== controllerGeneration || conversation !== conversationRevision)
          throw new Error(t('agentPlanExpired'));
        if (request.task !== 'chat' && (!requestTarget || !requestTarget.isCurrent(false)))
          throw new Error(t('agentPlanExpired'));
        writingSelect.value = request.task === 'compose' ? 'chat' : request.task;
        languageSelect.value = request.language;
        proposalMode = !['chat', 'compose'].includes(request.task);
        if (planning === abort) planning = null;
        if (
          ['rewrite', 'summarize', 'translate'].includes(request.task) &&
          (!snapshot.text.trim() || snapshot.truncated)
        )
          throw new Error(
            t(
              snapshot.truncated
                ? 'agentContextTooLarge'
                : snapshot.context?.kind === 'cell'
                  ? 'agentSelectCells'
                  : snapshot.context?.kind === 'slide'
                    ? 'agentSelectSlideText'
                    : 'agentSelectText',
            ),
          );
      }
      if (previousPreview && !request.refinement) invalidatePlans();
      if (request.task === 'compose') {
        if (snapshot.context?.kind !== 'word') throw new Error(t('agentWordOnly'));
        if (!routingProvider?.isReady()) throw new Error(t('agentLoadModel'));
        operationHistory.push({ role: 'user', content: trimmed });
        appendTurn({ role: 'user', text: trimmed });
        const abort = new AbortController();
        planning = abort;
        const body = await generateDocumentDraft(routingProvider, trimmed, abort.signal);
        abort.signal.throwIfAborted();
        if (generation !== controllerGeneration || conversation !== conversationRevision)
          throw new Error(t('agentPlanExpired'));
        operationHistory.push({ role: 'assistant', content: body, documentArtifact: true });
        appendTurn({ role: 'agent', text: body, documentArtifact: true });
        return;
      }
      if (writingSelect.value === 'tools') {
        operationHistory.push({ role: 'user', content: text });
        if (!request.refinement) invalidatePlans();
        const target = requestTarget;
        if (!target || !target.isCurrent(false)) throw new Error(t('agentPlanExpired'));
        const abort = new AbortController();
        planning = abort;
        appendTurn({ role: 'user', text });
        const plans = await generateDocumentToolSequence(
          useEndpointForChat() ? endpointProvider! : webllmProvider!,
          text,
          target.context,
          abort.signal,
          {
            pendingProposal: request.refinement ? pendingProposal : undefined,
            stableCapabilityPrefix:
              webllmProvider instanceof WllamaProvider ||
              (webllmProvider instanceof LocalInferenceProvider && webllmProvider.backend === 'wllama'),
          },
        );
        if (!plans.length || plans.length > 4 || plans.slice(0, -1).some((plan) => !plan.readOnly))
          throw new Error('agentToolNotChosen');
        for (const [index, plan] of plans.entries()) {
          // Let the result render and process Stop/session/editor events before the next operation.
          if (index > 0) await new Promise<void>((resolve) => setTimeout(resolve, 0));
          abort.signal.throwIfAborted();
          if (generation !== controllerGeneration || conversation !== conversationRevision)
            throw new Error(t('agentPlanExpired'));
          const action = new DocumentToolAction(target, plan);
          if (!plan.readOnly) {
            if (request.refinement && !previousPreview?.pending()) throw new Error(t('agentPlanExpired'));
            preview = new ActionPreview();
            previews.add(preview);
            preview.show(
              action,
              (outcome, appliedAction) => {
                if (generation === controllerGeneration && conversation === conversationRevision) {
                  const id = crypto.randomUUID();
                  const feedback: LLMMessage[] = [
                    {
                      role: 'assistant',
                      content: [
                        { type: 'tool_use', id, name: appliedAction.plan.tool, input: { ...appliedAction.plan.input } },
                      ],
                    },
                    {
                      role: 'user',
                      content: [
                        {
                          type: 'tool_result',
                          toolUseId: id,
                          content: JSON.stringify({ outcome, result: appliedAction.result }),
                        },
                      ],
                    },
                  ];
                  if (controller && conversations.activeId === operationSession)
                    controller.recordExternalMessages(feedback);
                  else operationStorage.save([...operationStorage.load(), ...feedback]);
                }
              },
              () => selectRefinement(preview),
            );
            if (request.refinement) {
              previousPreview?.supersede();
              clearRefinement();
            }
            chat.appendContent(preview.el);
            break;
          }
          const outcome = await action.apply(abort.signal);
          const exchangeId = crypto.randomUUID();
          operationHistory.push(
            {
              role: 'assistant',
              content: [{ type: 'tool_use', id: exchangeId, name: plan.tool, input: { ...plan.input } }],
            },
            {
              role: 'user',
              content: [
                {
                  type: 'tool_result',
                  toolUseId: exchangeId,
                  content: JSON.stringify({ outcome, result: action.result }),
                },
              ],
            },
          );
          const result = action.result as
            | {
                text?: string;
                unavailable?: boolean;
                cell?: string;
                sum?: number;
                range?: string;
                page?: number;
                count?: number;
              }
            | undefined;
          const resultText = plan.readOnly
            ? plan.tool === 'get_pdf_text' && (result?.unavailable || !result?.text?.trim())
              ? t('agentPdfTextUnavailable')
              : typeof result?.text === 'string'
                ? `${plan.tool === 'get_pdf_text' ? t('agentPdfPageContext', { page: result.page ?? '' }) + '\n' : result.cell ? result.cell + '\n' : ''}${result.text.trim() ? result.text : t('agentNoReadableText')}`
                : typeof result?.sum === 'number'
                  ? `${result.range ?? ''}: ${result.sum}`
                  : `${target.label} → ${result?.page ?? ''} / ${result?.count ?? ''}`
            : `${result?.range ? result.range + ' · ' : ''}${t(outcome === 'verified' ? 'agentPlanVerified' : 'agentPlanApplied')}`;
          operationHistory.push({ role: 'assistant', content: resultText, hostGuidance: 'tool' });
          if (generation === controllerGeneration && conversation === conversationRevision)
            appendTurn({ role: 'tool', text: resultText });
        }
      } else if (proposalMode) {
        operationHistory.push({ role: 'user', content: trimmed });
        invalidatePlans();
        const readonly = getReadonlyMode();
        const target =
          readonly || request.task === 'summarize' || snapshot.context?.kind !== 'word' ? null : captureActionTarget();
        const officeTarget =
          !readonly && (request.task === 'summarize' || snapshot.context?.kind !== 'word')
            ? captureDocumentToolTarget()
            : null;
        const source = target?.selectedText ?? snapshot.text ?? '';
        const abort = new AbortController();
        planning = abort;
        appendTurn({ role: 'user', text: trimmed });
        if (!source.trim()) throw new Error(t('agentNoSelection'));
        if (quotedSelection && source.replace(/\r\n/g, '\n') !== quotedSelection)
          throw new Error(t('agentPlanExpired'));
        // The writing destination: a connected endpoint (loopback keeps the text on
        // this machine, a cloud endpoint sends it there), otherwise the browser-local
        // engines only with an explicit opt-in, because they never passed quality
        // acceptance and a document write is high-stakes.
        let route: WritingRoute | null = null;
        try {
          route = resolveRoute();
        } catch {
          route = null;
        }
        if (!route || route.kind === 'blocked')
          throw new Error(
            route?.kind === 'blocked' && route.reason === 'offline-needs-device-destination'
              ? 'agentWritingOfflineNeedsDevice'
              : 'agentWritingNeedsLocalService',
          );
        const writingProvider = route.kind === 'endpoint' ? endpointProvider : webllmProvider;
        // The gate above normally covers an unready browser-local model; this stays
        // as a guard for readiness that flipped between the gate and here.
        if (!writingProvider || !writingProvider.isReady()) throw new Error('agentWritingNeedsLocalService');
        const body = await generateWriting(
          writingProvider,
          {
            task: writingSelect.value as WritingTask,
            text: source,
            instruction: trimmed,
            targetLanguage: languageSelect.value as WritingLanguage,
          },
          abort.signal,
        );
        const plan = { tool: 'insert_text' as const, input: { text: body } };
        abort.signal.throwIfAborted();
        if (
          generation !== controllerGeneration ||
          conversation !== conversationRevision ||
          (target && !target.isCurrent()) ||
          (officeTarget && !officeTarget.isCurrent())
        )
          throw new Error(t('agentPlanExpired'));
        operationHistory.push({ role: 'assistant', content: body, copyOnly: true });
        if (request.task === 'summarize' || snapshot.context?.kind === 'pdf') {
          appendTurn({ role: 'agent', text: body, copyOnly: true });
          return;
        }
        const singleCell =
          snapshot.context?.kind === 'cell' && snapshot.context.range && !snapshot.context.range.includes(':');
        if (!target && (!officeTarget || (snapshot.context?.kind === 'cell' && !singleCell))) {
          appendTurn({ role: 'agent', text: body, copyOnly: true });
          appendTurn({ role: 'status', text: t(readonly ? 'agentDocumentReadOnly' : 'agentRangeCopyOnly') });
          return;
        }
        preview = new ActionPreview();
        previews.add(preview);
        const action = target
          ? new ReviewedAction(target, plan)
          : new DocumentToolAction(
              { ...officeTarget!, selectedText: source },
              {
                tool: singleCell ? 'set_cell' : 'replace_selection',
                input: singleCell ? { cell: snapshot.context!.range!, value: body, valueType: 'text' } : { text: body },
                readOnly: false,
              },
            );
        preview.show(
          action,
          (outcome) => {
            if (!enabled || generation !== controllerGeneration || conversation !== conversationRevision) return;
            const text = t(outcome === 'verified' ? 'agentPlanVerified' : 'agentPlanApplied');
            const messages: LLMMessage[] = [{ role: 'assistant', content: text, hostGuidance: 'tool' } as LLMMessage];
            if (controller && conversations.activeId === operationSession) controller.recordExternalMessages(messages);
            else operationStorage.save([...operationStorage.load(), ...messages]);
          },
          () => selectRefinement(preview),
        );
        chat.appendContent(preview.el);
        operationHistory.push({ role: 'assistant', content: t('agentPlanReady'), hostGuidance: 'tool' });
      } else {
        invalidatePlans();
        await ctl.send(trimmed);
      }
    } catch (caughtError) {
      const error =
        caughtError instanceof Error && caughtError.message === 'agentProposalUnchanged' && !previousPreview?.pending()
          ? new Error(t('agentPlanExpired'))
          : caughtError;
      const stopped = error instanceof Error && error.name === 'AbortError';
      const role =
        stopped || (error instanceof Error && error.message === 'agentProposalUnchanged') ? 'status' : 'error';
      // Routing happens before any branch records the request. Preserve failed
      // requests too, without duplicating a chat/controller-owned user turn.
      if (routingStarted && !operationHistory.length) {
        operationHistory.push({ role: 'user', content: trimmed });
        if (generation === controllerGeneration && conversation === conversationRevision)
          appendTurn({ role: 'user', text: trimmed });
      }
      if (operationHistory.length)
        operationHistory.push({
          role: 'assistant',
          content: stopped ? t('agentStopped') : displayError(error),
          hostGuidance: role,
        });
      if (generation === controllerGeneration && conversation === conversationRevision)
        appendTurn({
          role,
          text: stopped ? t('agentStopped') : displayError(error),
        });
    } finally {
      previousPreview?.setRefining(false);
      if (refiningPreview === previousPreview) refiningPreview = undefined;
      if (operationHistory.length) {
        const owner = conversations.activeId === operationSession ? controller : null;
        if (owner) owner.recordExternalMessages(operationHistory);
        else operationStorage.save([...operationStorage.load(), ...operationHistory]);
      }
      if (generation === controllerGeneration && conversation === conversationRevision) {
        planning = null;
        chat.setRunning(false);
        chat.focus();
        syncRuntimeStatus();
        if (webllmProvider && !webllmProvider.isReady()) {
          note.textContent = t('agentLoadModel');
          // A stopped task never restarts preparation on its own.
        }
      }
    }
  };
  const switchConversation = (id: string, focus = true): void => {
    conversationRevision++;
    invalidatePlans();
    controller?.dispose();
    controller = null;
    conversations.select(id);
    clearPreviews();
    clearQuote();
    historyStorage = conversations.history();
    chat.clear();
    chat.setRunning(false);
    chat.setInput('');
    for (const turn of historyToTurns(historyStorage.load())) chat.append(turn);
    renderSessions();
    if (focus) chat.focus();
  };
  clearBtn.addEventListener('click', () => {
    speech?.close();
    switchConversation(conversations.create().id);
  });
  sessionSelect.addEventListener('change', () => {
    speech?.close();
    switchConversation(sessionSelect.value);
  });
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
      captureDocumentContext()?.kind === 'word' &&
      api.isDocumentLoadComplete &&
      api.isLoadFullApi &&
      !api.isViewMode &&
      !getReadonlyMode() &&
      typeof api.asc_IsTrackRevisions === 'function' &&
      typeof api.asc_SetGlobalTrackRevisions === 'function' &&
      typeof api.asc_GetGlobalTrackRevisions === 'function' &&
      typeof api.asc_SetLocalTrackRevisions === 'function';
    reviewCheck.toggleAttribute('disabled', !canReview);
    reviewLabel.hidden = !canReview;
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
    panel.setAttribute('aria-label', t('agentTitle'));
    welcomeHint.textContent = t('agentWelcomeHint');
    syncRuntimeStatus();
    settingsBtn.title = t('agentSettings');
    settingsBtn.setAttribute('aria-label', t('agentSettings'));
    providerSelect.setAttribute('aria-label', t('agentProviderLabel'));
    modelSelect.setAttribute('aria-label', t('agentModelLabel'));
    closeBtn.title = t('agentClose');
    closeBtn.setAttribute('aria-label', t('agentClose'));
    const selected = providerSelect.value;
    for (const opt of providerSelect.querySelectorAll('r-option')) {
      opt.textContent = t(PROVIDER_LABEL_KEY[(opt.getAttribute('value') as ProviderId) ?? 'anthropic']);
    }
    providerSelect.setAttribute('value', selected); // nudge the closed label to retranslate
    syncFileChoice();
    loadStop.textContent = t('agentStop');
    ggufStop.textContent = t('agentStop');
    loadProgress.setAttribute('aria-label', t('agentPreparing'));
    for (const opt of modelSelect.querySelectorAll('r-option')) {
      const model = WEBLLM_MODELS.find((m) => m.id === opt.getAttribute('value'));
      if (model) opt.textContent = model.label;
    }
    syncModelMemory();
    reviewText.textContent = t('agentReviewMode');
    reviewCheck.setAttribute('aria-label', t('agentReviewMode'));
    clearBtn.title = t('agentNewConversation');
    clearBtn.setAttribute('aria-label', t('agentNewConversation'));
    renderSessions();
    historyControls?.sync();
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

  const historyBtn = document.createElement('button');
  historyBtn.type = 'button';
  historyBtn.className = 'agent-history-toggle';
  historyBtn.innerHTML =
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 11a9 9 0 1 1 3 8M3 5v6h6M12 7v6l4 2"/></svg>';
  const settingsHeading = View('h2').build();
  settingsHeading.tabIndex = -1;
  const localCard = View('section').build();
  localCard.className = 'agent-use-card agent-device-section';
  const modelChoice = Div().build();
  modelChoice.className = 'agent-model-choice';
  modelChoice.append(modelSelect, modelMemory);
  modelRow.replaceChildren(modelChoice, loadBtn);
  localCard.append(modelRow, ggufRow);
  const serviceCard = View<HTMLDetailsElement>('details').build();
  serviceCard.className = 'agent-use-card agent-service-section';
  const serviceHint = View('p').build();
  const fieldLabels: Array<{ title: HTMLElement; key: keyof I18nMessages }> = [];
  const field = (control: HTMLElement, key: keyof I18nMessages) => {
    const wrapper = Label().build();
    wrapper.className = 'agent-settings-field';
    const title = Span().build();
    fieldLabels.push({ title, key });
    wrapper.append(title, control);
    return wrapper;
  };
  endpointRow.replaceChildren(
    field(endpointKind, 'agentEndpointKind'),
    field(endpointBaseUrl, 'agentEndpointUrl'),
    field(endpointModel, 'agentEndpointModel'),
    field(endpointKey, 'agentEndpointKey'),
    endpointConnect,
    endpointStatus,
  );
  serviceCard.open = true;
  serviceCard.append(endpointRow, serviceHint);
  const advanced = View<HTMLDetailsElement>('details').build();
  advanced.className = 'agent-preferences';
  const advancedSummary = View('summary').build();
  const advancedTitle = Span().build();
  advancedSummary.append(advancedTitle);
  advanced.append(
    advancedSummary,
    field(providerSelect, 'agentProviderLabel'),
    consentLabel,
    field(writePreference, 'agentWritePreference'),
    reviewLabel,
  );
  const customSources = View<HTMLDetailsElement>('details')
    .class('agent-custom-sources')
    .children(
      View('summary').text(t('agentCustomModel')).build(),
      field(localModelId, 'agentModelId'),
      field(localModelUrl, 'agentModelUrl'),
      field(localModelLib, 'agentModelRuntimeUrl'),
    )
    .build();
  advanced.append(customSources);
  const settingsHero = Div().build();
  settingsHero.className = 'agent-settings-hero';
  settingsHero.append(settingsHeading);
  const sourcePicker = ranSelect(
    'agent-source-picker',
    [
      { value: 'local', label: t('agentSourceLocal') },
      { value: 'service', label: t('agentSourceService') },
    ],
    configuredEndpoint(endpointSettings) ? 'service' : 'local',
  );
  sourcePicker.setAttribute('aria-label', t('agentSourceLabel'));
  const syncSource = () => {
    localCard.hidden = sourcePicker.value !== 'local';
    serviceCard.hidden = sourcePicker.value !== 'service';
    cacheList.hidden = sourcePicker.value !== 'local';
  };
  sourcePicker.addEventListener('change', syncSource);
  const cacheList = View<HTMLDetailsElement>('details').class('agent-model-cache').build();
  const cacheSummary = View('summary')
    .attr('tabindex', '0')
    .text(t('agentDownloadedModels').replace('{count}', '…'))
    .build();
  const cacheRows = Div().class('agent-model-cache-rows').build();
  const cacheStatus = Span().attr('role', 'status').build();
  cacheList.append(cacheSummary, cacheRows, cacheStatus);
  let cacheRevision = 0;
  const refreshCache = async () => {
    const revision = ++cacheRevision;
    const sources = [...WEBLLM_MODELS, ...RETIRED_WEBLLM_MODELS, ...rememberedModelSources()];
    const unique = sources.filter(
      (model, index) =>
        sources.findIndex(
          (item) =>
            item.id === model.id &&
            ('modelUrl' in item ? item.modelUrl : undefined) === ('modelUrl' in model ? model.modelUrl : undefined),
        ) === index,
    );
    const cached = await Promise.all(
      unique.map(async (model) => ({ model, cached: await isModelCached(model.id, 'modelUrl' in model ? model : {}) })),
    );

    let ggufs: Awaited<ReturnType<typeof listCachedGGUF>> = [];
    try {
      ggufs = await listCachedGGUF();
    } catch {
      cacheStatus.textContent = t('agentCacheUnavailable');
    }
    if (revision !== cacheRevision) return;
    cacheSummary.textContent = t('agentDownloadedModels').replace(
      '{count}',
      String(cached.filter((item) => item.cached).length + ggufs.length),
    );
    cacheRows.replaceChildren();
    for (const { model, cached: exists } of cached) {
      if (!exists) continue;
      const row = Div().class('agent-model-cache-row').attr('role', 'group').build();
      const active =
        !!webllmProvider?.isReady() &&
        selectedLocalModel() === model.id &&
        !(webllmProvider instanceof LocalInferenceProvider && webllmProvider.backend === 'wllama');
      const name = Span()
        .text(model.label + (active ? ' · ' + t('agentModelInUse') : ''))
        .build();
      const use = ranButton(t(active ? 'agentModelInUse' : 'agentUseModel'), 'agent-cache-use');
      use.toggleAttribute('disabled', active);
      use.addEventListener('click', () => {
        if (cacheBusy || active) return;
        providerSelect.value = 'webllm';
        providerSelect.dispatchEvent(new Event('change'));
        if (WEBLLM_MODELS.some((item) => item.id === model.id)) {
          localModelId.value = '';
          localModelUrl.value = '';
          localModelLib.value = '';
          localModelId.dispatchEvent(new Event('change'));
          modelSelect.value = model.id;
          modelSelect.dispatchEvent(new Event('change'));
        } else {
          localModelId.value = model.id;
          localModelUrl.value = 'modelUrl' in model ? String(model.modelUrl ?? '') : '';
          localModelLib.value = 'modelLibUrl' in model ? String(model.modelLibUrl ?? '') : '';
          localModelId.dispatchEvent(new Event('change'));
        }
        void loadModel();
      });
      const remove = ranButton(t('agentDeleteDownload'), 'agent-cache-delete');
      let confirming = false;
      const cancel = ranButton(t('agentPlanCancel'), 'agent-cache-cancel');
      cancel.hidden = true;
      cancel.addEventListener('click', () => {
        confirming = false;
        cancel.hidden = true;
        remove.textContent = t('agentDeleteDownload');
        remove.focus();
      });
      remove.addEventListener('click', () => {
        if (cacheBusy) return;
        if (!confirming) {
          confirming = true;
          remove.textContent = t('agentConfirmDeleteDownload');
          cancel.hidden = false;
          cacheStatus.textContent = t('agentDeleteDownloadHint');
          return;
        }
        void (async () => {
          remove.setAttribute('disabled', '');
          cacheBusy = true;
          chat.refreshSendAvailability();
          try {
            if (selectedLocalModel() === model.id) {
              resetController();
              if (runtimeCleanup) await runtimeCleanup;
              if (runtimeCleanupFailed) throw new Error(t('agentModelCleanupFailed'));
            }
            await deleteCachedModel(model.id, 'modelUrl' in model ? model : {});
            cacheStatus.textContent = t('agentDownloadDeleted');
            await refreshCache();
            cacheSummary.focus();
          } catch {
            cacheStatus.textContent = t(runtimeCleanupFailed ? 'agentModelCleanupFailed' : 'agentCacheDeleteFailed');
            remove.removeAttribute('disabled');
          } finally {
            cacheBusy = false;
            chat.refreshSendAvailability();
          }
        })();
      });
      row.setAttribute('aria-label', name.textContent ?? '');
      row.append(name);
      if (!RETIRED_WEBLLM_MODELS.some((item) => item.id === model.id)) row.append(use);
      row.append(remove, cancel);
      cacheRows.append(row);
    }
    for (const item of ggufs) {
      const active = currentProvider() === 'wllama' && !!webllmProvider?.isReady() && ggufUrl.value.trim() === item.url;
      const row = Div().class('agent-model-cache-row').attr('role', 'group').build();
      const name = Span()
        .text(
          `${new URL(item.url).pathname.split('/').pop() ?? item.name} · ${(item.size / 1e9).toFixed(2)} GB${item.complete ? '' : ' · ' + t('agentDownloadIncomplete')}`,
        )
        .build();
      const use = ranButton(t(active ? 'agentModelInUse' : 'agentUseModel'), 'agent-cache-use');
      use.toggleAttribute('disabled', active);
      use.addEventListener('click', () => {
        if (cacheBusy || active) return;
        providerSelect.value = 'wllama';
        providerSelect.dispatchEvent(new Event('change'));
        ggufUrl.value = item.url;
        ggufUrl.dispatchEvent(new Event('change'));
        void loadModel();
      });
      const remove = ranButton(t('agentDeleteDownload'), 'agent-cache-delete');
      const cancel = ranButton(t('agentPlanCancel'), 'agent-cache-cancel');
      cancel.hidden = true;
      let confirming = false;
      cancel.addEventListener('click', () => {
        confirming = false;
        cancel.hidden = true;
        remove.textContent = t('agentDeleteDownload');
        remove.focus();
      });
      remove.addEventListener('click', () => {
        if (cacheBusy) return;
        if (!confirming) {
          confirming = true;
          remove.textContent = t('agentConfirmDeleteDownload');
          cacheStatus.textContent = t('agentDeleteDownloadHint');
          cancel.hidden = false;
          return;
        }
        remove.setAttribute('disabled', '');
        cacheBusy = true;
        chat.refreshSendAvailability();
        void (async () => {
          try {
            // Automatic CPU fallback may own this GGUF even when the GPU picker is selected.
            resetController();
            if (runtimeCleanup) await runtimeCleanup;
            if (runtimeCleanupFailed) throw new Error(t('agentModelCleanupFailed'));
            await deleteCachedGGUF(item.name);
            await refreshCache();
            cacheStatus.textContent = t('agentDownloadDeleted');
            cacheSummary.focus();
          } catch {
            cacheStatus.textContent = t(runtimeCleanupFailed ? 'agentModelCleanupFailed' : 'agentCacheDeleteFailed');
            remove.removeAttribute('disabled');
          } finally {
            cacheBusy = false;
            chat.refreshSendAvailability();
          }
        })();
      });
      row.setAttribute('aria-label', name.textContent ?? '');
      row.append(name, use, remove, cancel);
      cacheRows.append(row);
    }
  };
  cacheList.addEventListener('toggle', () => {
    if (cacheList.open) void refreshCache();
  });
  const release = ranButton(t('agentReleaseMemory'), 'agent-release-memory');
  release.hidden = true;
  release.addEventListener('click', () => {
    if (cacheBusy) return;
    resetController();
    void (async () => {
      try {
        if (runtimeCleanup) await runtimeCleanup;
        note.textContent = t('agentMemoryReleased');
      } catch (error) {
        note.textContent = displayError(error);
      }
    })();
  });
  localCard.append(release);
  syncSource();
  void refreshCache();
  settings.replaceChildren(settingsHero, sourcePicker, localCard, serviceCard, cacheList, note, advanced);
  const disableRow = document.createElement('div');
  disableRow.className = 'agent-enable-row';
  const disableLabel = document.createElement('span');
  const disableHint = document.createElement('p');
  disableHint.className = 'agent-entry-note';
  const disable = document.createElement('button');
  disable.type = 'button';
  disable.className = 'agent-enable-switch agent-disable-switch';
  disable.setAttribute('role', 'switch');
  disable.setAttribute('aria-checked', 'true');
  disable.addEventListener('click', () => {
    if (options.onDisable) void options.onDisable();
    else void panelHandle?.setEnabled(false);
  });
  disableRow.append(disableLabel, disable);
  advanced.append(disableRow, disableHint);
  const historyView = document.createElement('section');
  historyView.className = 'agent-history-view';
  historyView.hidden = true;
  historyView.append(sessionBar, historyControls.el);
  header.insertBefore(historyBtn, settingsBtn);
  header.insertBefore(clearBtn, settingsBtn);
  sessionRow.replaceChildren(sessionSelect);

  chat.el.append(writeDestination);
  function showView(view: 'chat' | 'settings' | 'history'): void {
    speech?.close();
    panel.dataset.view = view;
    if (view === 'settings') settings.insertBefore(runtimeRow, note);
    else panel.insertBefore(runtimeRow, settings);
    settings.classList.toggle('agent-panel-settings-hidden', view !== 'settings');
    chat.el.hidden = view !== 'chat';
    historyView.hidden = view !== 'history';
    settingsBtn.setAttribute('aria-expanded', String(view === 'settings'));
    syncRuntimeStatus();
    historyBtn.setAttribute('aria-expanded', String(view === 'history'));
    if (view === 'settings') settingsHeading.focus();
    else if (view === 'history') sessionSelect.focus();
    else chat.focus();
  }
  historyBtn.addEventListener('click', () => showView(panel.dataset.view === 'history' ? 'chat' : 'history'));
  historyView.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !event.isComposing) {
      event.stopPropagation();
      showView('chat');
      historyBtn.focus();
    }
  });
  const syncProductLabels = () => {
    fieldLabels.forEach(({ title, key }) => {
      title.textContent = t(key);
    });
    refinementLabel.textContent = t('agentRefiningProposal');
    refinementCancel.textContent = t('agentPlanCancel');
    settingsHeading.textContent = t('agentSettings');
    serviceHint.textContent = t('agentUseServiceHint');
    advancedTitle.textContent = t('agentPreferences');
    disableLabel.textContent = t('agentEnable');
    disableHint.textContent = t('agentOffNote');
    disable.setAttribute('aria-label', t('agentEnable'));
    historyBtn.title = t('agentConversations');
    historyBtn.setAttribute('aria-label', t('agentConversations'));
  };
  syncProductLabels();
  window.addEventListener('languagechange', syncProductLabels);
  clearBtn.addEventListener('click', () => showView('chat'));
  sessionSelect.addEventListener('change', () => showView('chat'));
  clearBtn.title = t('agentNewConversation');
  clearBtn.setAttribute('aria-label', t('agentNewConversation'));
  panel.append(header, runtimeRow, settings, historyView, chat.el);
  document.body.append(panel);
  setOpen(!options.background);
  void historyControls.start();
  showView(options.externalEntry ? 'settings' : 'chat');

  // Opening only restores preferences, never starts a download or connection.

  return panel;
}
