import 'ranui/button';
import 'ranui/input';
import 'ranui/select';
import { Div, Span, View } from 'ranui/builder';
import { localStorageGetItem, localStorageSetItem } from 'ranuts/utils';
import { t, type I18nMessages } from '@ranuts/shared/i18n';
import type { ProviderId } from '@ranuts/agent-core/llm/factory';
import { DEFAULT_WEBLLM_MODEL, WEBLLM_MODELS } from '@ranuts/agent-core/llm/webllm';
import { clearEndpointKey, getEndpointKey, setEndpointKey } from '@ranuts/agent-core/llm/keys';
import { DEFAULT_LOOPBACK_ENDPOINT, type WritingEndpointKind } from '@ranuts/agent-core/llm/endpoint';
import { resolveModelArtifactUrl } from '@ranuts/agent-core/llm/model-source';
import { readTaskModelPreferences } from './task-model-preferences';
import {
  ENDPOINT_SETTINGS_KEY,
  isCloudEndpointKind,
  writeEndpointSettings,
  type EndpointSettings,
} from './endpoint-settings';

/** ranui custom elements expose a `value` accessor (r-select / r-input). */
type ValueEl = HTMLElement & { value: string };
type InputEl = ValueEl & { placeholder: string };
export function rememberedModelUrl(value: string | null): string {
  if (!value?.trim()) return '';
  try {
    return resolveModelArtifactUrl(value.trim());
  } catch {
    return '';
  }
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

/** Programmatic focus on a ranui host must retain keyboard activation. */
const focusableAction = (button: HTMLElement): void => {
  button.tabIndex = -1;
  button.addEventListener('keydown', (event) => {
    // The component's inner button already handles ordinary tab navigation.
    if (event.defaultPrevented || button.hasAttribute('disabled') || !['Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    button.click();
  });
};

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

/** Form controls, public model preferences and accessible feedback; never activates a runtime. */
export function createModelConfigurationForm(options: {
  endpointSettings: EndpointSettings;
  load: () => void;
  stop: (loadControl: HTMLElement) => void;
  sourceChanged: () => void;
}) {
  let endpointSettings = options.endpointSettings;
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
  focusableAction(ggufLoad);
  ggufLoad.addEventListener('click', () => options.load());
  const ggufCpu = document.createElement('input');
  ggufCpu.type = 'checkbox';
  ggufCpu.checked = true;
  ggufCpu.className = 'agent-panel-gguf-cpu';
  const ggufStop = ranButton(t('agentStop'), 'agent-panel-gguf-stop');
  ggufStop.setAttribute('type', 'text');
  focusableAction(ggufStop);
  ggufStop.hidden = true;
  ggufStop.addEventListener('click', () => {
    options.stop(ggufLoad);
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
      options.sourceChanged();
    });
    return input;
  };
  const localModelId = sourceInput('agent-local-model-id', 'Custom MLC model ID (optional)');
  const localModelUrl = sourceInput('agent-local-model-url', 'MLC model directory URL (/models/…)');
  const localModelLib = sourceInput('agent-local-model-lib', 'Compatible model WASM URL (/models/…/model.wasm)');
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
  focusableAction(loadBtn);
  loadBtn.addEventListener('click', () => options.load());
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
  loadStop.setAttribute('type', 'text');
  focusableAction(loadStop);
  loadStop.hidden = true;
  loadStop.addEventListener('click', () => {
    options.stop(loadBtn);
  });

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

  // Filling the key field is a deliberate act (mount, or a different endpoint
  // kind). Rendering status must not do it: it would overwrite a key the user is
  // in the middle of typing, before it has been stored.
  const loadStoredKeyIntoForm = (): void => {
    const kind = endpointKindValue();
    const slot = isCloudEndpointKind(kind) ? endpointKeySlot(kind) : '';
    endpointKey.value = slot ? (getEndpointKey(slot) ?? '') : '';
  };

  const syncLabels = (): void => {
    providerSelect.setAttribute('aria-label', t('agentProviderLabel'));
    modelSelect.setAttribute('aria-label', t('agentModelLabel'));
    const selected = providerSelect.value;
    for (const option of providerSelect.querySelectorAll('r-option'))
      option.textContent = t(PROVIDER_LABEL_KEY[(option.getAttribute('value') as ProviderId) ?? 'anthropic']);
    providerSelect.setAttribute('value', selected);
    syncFileChoice();
    loadStop.textContent = t('agentStop');
    ggufStop.textContent = t('agentStop');
    for (const option of modelSelect.querySelectorAll('r-option')) {
      const model = WEBLLM_MODELS.find((item) => item.id === option.getAttribute('value'));
      if (model) option.textContent = model.label;
    }
    syncModelMemory();
  };
  return {
    providerSelect,
    ggufUrl,
    ggufFiles,
    ggufNames,
    ggufLoad,
    ggufCpu,
    ggufStop,
    ggufRow,
    localModelId,
    localModelUrl,
    localModelLib,
    modelSelect,
    taskPreferences,
    savedPreset,
    loadBtn,
    modelRow,
    modelMemory,
    loadStop,
    note,
    endpointKind,
    endpointBaseUrl,
    endpointModel,
    endpointKey,
    endpointConnect,
    endpointStatus,
    writeDestination,
    writePreference,
    localWritingConsent,
    consentLabel,
    endpointRow,
    syncFileChoice,
    syncLabels,
    endpointKindValue,
    endpointKeySlot,
    rememberEndpoint,
    loadStoredKeyIntoForm,
    get endpointSettings() {
      return endpointSettings;
    },
  };
}
