import { afterEach, describe, expect, it, vi } from 'vitest';
import { t } from '@ranuts/shared/i18n';
import { createModelConfigurationForm } from '../../lib/agent-plugin/ui/model-configuration-form';
import { createRequestRouting } from '../../lib/agent-plugin/ui/request-routing';
import { createPanelWorkspace } from '../../lib/agent-plugin/ui/panel-workspace';
import { getEndpointKey } from '@ranuts/agent-core/llm/keys';
import {
  ENDPOINT_SETTINGS_KEY,
  readEndpointSettings,
  type EndpointSettings,
} from '../../lib/agent-plugin/ui/endpoint-settings';

// These owner tests exercise their observable contract independently of panel assembly.
afterEach(() => {
  document.body.replaceChildren();
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('model configuration form', () => {
  it('persists public source edits, resets their model and never starts a load while mounting', () => {
    localStorage.setItem('agent-local-model-url', '/models/old/');
    const load = vi.fn();
    const sourceChanged = vi.fn();
    const form = createModelConfigurationForm({
      endpointSettings: readEndpointSettings(null),
      load,
      sourceChanged,
      stop: vi.fn(),
    });
    expect(load).not.toHaveBeenCalled();
    expect(form.localModelUrl.value).toBe('/models/old/');
    form.localModelUrl.value = ' /models/new/ ';
    form.localModelUrl.dispatchEvent(new Event('change'));
    expect(localStorage.getItem('agent-local-model-url')).toBe('/models/new/');
    expect(sourceChanged).toHaveBeenCalledOnce();
    form.loadBtn.click();
    expect(load).toHaveBeenCalledOnce();
  });

  it('owns endpoint preferences and keeps secrets in their destination slot', () => {
    const form = createModelConfigurationForm({
      endpointSettings: readEndpointSettings(null),
      load: vi.fn(),
      sourceChanged: vi.fn(),
      stop: vi.fn(),
    });
    form.endpointKind.value = 'openai-compatible';
    form.endpointBaseUrl.value = ' https://service.example/v1 ';
    form.endpointModel.value = ' model ';
    form.endpointKey.value = ' secret ';
    form.rememberEndpoint();
    expect(form.endpointSettings).toMatchObject({
      kind: 'openai-compatible',
      baseUrl: 'https://service.example/v1',
      model: 'model',
    });
    expect(localStorage.getItem(ENDPOINT_SETTINGS_KEY)).not.toContain('secret');
    expect(getEndpointKey('https://service.example/v1')).toBe('secret');
    form.endpointKey.value = '';
    form.loadStoredKeyIntoForm();
    expect(form.endpointKey.value).toBe('secret');
    form.endpointBaseUrl.value = 'https://other.example/v1';
    form.loadStoredKeyIntoForm();
    expect(form.endpointKey.value).toBe('');
    form.endpointBaseUrl.value = 'https://service.example/v1';
    form.rememberEndpoint();
    expect(getEndpointKey('https://service.example/v1')).toBeUndefined();
  });

  it('reports chosen files and routes each keyboard stop action back to its matching load control', () => {
    const stop = vi.fn();
    const form = createModelConfigurationForm({
      endpointSettings: readEndpointSettings(null),
      load: vi.fn(),
      sourceChanged: vi.fn(),
      stop,
    });
    Object.defineProperty(form.ggufFiles, 'files', {
      value: [new File(['a'], 'first.gguf'), new File(['b'], 'second.gguf')],
    });
    form.syncLabels();
    expect(form.ggufNames.textContent).toBe('first.gguf, second.gguf');
    expect(form.ggufFiles.getAttribute('aria-label')).toBe(t('agentChooseModelFiles'));
    form.ggufStop.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true }));
    expect(stop).toHaveBeenCalledWith(form.ggufLoad);
    form.loadStop.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', cancelable: true }));
    expect(stop).toHaveBeenCalledWith(form.loadBtn);
  });
});

describe('request routing', () => {
  it('keeps loopback available offline but drops cloud connections before executing a request', () => {
    const state = {
      settings: {
        ...readEndpointSettings(null),
        kind: 'openai-compatible' as const,
        baseUrl: 'https://api.example.com/v1',
        model: 'test',
        preference: 'remote-first',
      } as EndpointSettings,
      endpointReady: true,
      localReady: true,
      offline: true,
      local: { backend: 'webllm' as const, model: 'local' },
      localWritingConsent: false,
    };
    const routing = createRequestRouting(() => state);
    expect(routing.useEndpointForChat()).toBe(false);
    expect(routing.writingRoute().kind).toBe('blocked');
    state.settings = { ...state.settings, kind: 'loopback' };
    state.settings.baseUrl = 'http://localhost:11434';
    expect(routing.useEndpointForChat()).toBe(true);
    expect(routing.writingRoute()).toMatchObject({ kind: 'endpoint', dataPath: 'device' });
  });

  it('requires a browser model only for routes that execute locally', () => {
    const state = {
      settings: {
        ...readEndpointSettings(null),
        kind: 'openai-compatible' as const,
        baseUrl: 'https://api.example.com/v1',
        model: 'test',
      },
      endpointReady: true,
      localReady: false,
      offline: false,
      local: { backend: 'webllm' as const, model: 'local' },
      localWritingConsent: false,
    };
    const routing = createRequestRouting(() => state);
    expect(routing.needsLocalModel('chat', false)).toBe(false);
    expect(routing.needsLocalModel('tools', true)).toBe(false);
    state.endpointReady = false;
    expect(routing.needsLocalModel('tools', true)).toBe(false);
    expect(routing.needsLocalModel('tools', false)).toBe(true);
    expect(routing.needsLocalModel('chat', false)).toBe(true);
    expect(routing.needsLocalModel('rewrite', false)).toBe(false);
    state.localWritingConsent = true;
    expect(routing.needsLocalModel('rewrite', false)).toBe(true);
  });
});

it('coordinates workspace visibility, capture, focus, runtime placement and Escape return', () => {
  const panel = document.createElement('div');
  const chat = { el: document.createElement('div'), focus: vi.fn() };
  const row = document.createElement('div');
  const settings = document.createElement('div');
  const modelRow = document.createElement('div');
  const modelActions = document.createElement('div');
  modelRow.append(modelActions);
  settings.append(modelRow);
  panel.append(row, settings, chat.el);
  document.body.append(panel);
  const focus = vi.fn();
  const trigger = document.createElement('button');
  panel.append(trigger);
  const navigation = { capture: vi.fn(), restore: vi.fn(() => false) };
  const changed = vi.fn();
  const beforeChange = vi.fn();
  const workspace = createPanelWorkspace({
    panel,
    chat,
    navigation,
    conversation: () => 'session',
    isOpen: () => true,
    runtime: { row, settings, modelRow, modelActions },
    views: {
      settings: { el: settings, trigger, focus },
      history: { el: document.createElement('div'), trigger: document.createElement('button'), focus: vi.fn() },
      sources: { el: document.createElement('div'), trigger: document.createElement('button'), focus: vi.fn() },
      artifacts: { el: document.createElement('div'), trigger: document.createElement('button'), focus: vi.fn() },
    },
    beforeChange,
    changed,
  });
  workspace.show('chat');
  workspace.show('settings');
  expect(navigation.capture).toHaveBeenCalledWith('session');
  expect(chat.el.hidden).toBe(true);
  expect(settings.classList.contains('agent-panel-settings-hidden')).toBe(false);
  expect(trigger.getAttribute('aria-expanded')).toBe('true');
  expect(row.parentElement).toBe(modelRow);
  expect(focus).toHaveBeenCalledOnce();
  settings.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  expect(chat.el.hidden).toBe(false);
  expect(row.parentElement).toBe(panel);
  expect(document.activeElement).toBe(trigger);
  expect(beforeChange).toHaveBeenCalledWith('chat');
  expect(changed).toHaveBeenCalledWith('chat');
});
