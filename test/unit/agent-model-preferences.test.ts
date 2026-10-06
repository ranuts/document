import { afterEach, expect, it, vi } from 'vitest';
import { createAgentPanel } from '../../lib/agent-plugin/ui/panel';
const state = vi.hoisted(() => ({ cpu: vi.fn(), source: '', auto: vi.fn() }));
vi.mock('@ranuts/agent-core/llm/wllama', () => ({
  WllamaProvider: class {
    constructor(options: { modelUrl: string }) {
      state.source = options.modelUrl;
    }
    preload = state.cpu;
    dispose = async () => {};
    isReady = () => false;
  },
}));
vi.mock('@ranuts/agent-core/llm/local', () => ({
  DEFAULT_CPU_MODEL_URL: '/default.gguf',
  LocalInferenceProvider: class {
    preload = state.auto;
    dispose = async () => {};
    isReady = () => false;
  },
}));
vi.mock('../../lib/agent-plugin/editor-bridge', () => ({ getEditorApi: () => null }));
HTMLElement.prototype.scrollTo = vi.fn();
afterEach(() => {
  window.dispatchEvent(new Event('pagehide'));
  document.body.replaceChildren();
  localStorage.clear();
  state.cpu.mockClear();
  state.auto.mockClear();
});
it('restores the selected CPU URL and starts loading it without re-entering settings', async () => {
  localStorage.setItem('agent-panel-provider', 'wllama');
  localStorage.setItem('agent-panel-gguf-url', 'https://models.example/local.gguf');
  const panel = createAgentPanel();
  expect((panel.querySelector('.agent-panel-provider') as HTMLElement & { value: string }).value).toBe('wllama');
  expect((panel.querySelector('.agent-panel-gguf-url') as HTMLElement & { value: string }).value).toBe(
    'https://models.example/local.gguf',
  );
  await vi.waitFor(() => expect(state.cpu).toHaveBeenCalledOnce());
  expect(state.source).toBe('https://models.example/local.gguf');
  expect(state.auto).not.toHaveBeenCalled();
});
it('persists source and provider changes, and clears the remembered URL when choosing local files', () => {
  const panel = createAgentPanel();
  const provider = panel.querySelector('.agent-panel-provider') as HTMLElement & { value: string };
  provider.value = 'wllama';
  provider.dispatchEvent(new Event('change'));
  const url = panel.querySelector('.agent-panel-gguf-url') as HTMLElement & { value: string };
  url.value = 'https://models.example/local.gguf';
  url.dispatchEvent(new Event('change'));
  expect(localStorage.getItem('agent-panel-provider')).toBe('wllama');
  expect(localStorage.getItem('agent-panel-gguf-url')).toBe(url.value);
  panel.querySelector('.agent-panel-gguf-files')!.dispatchEvent(new Event('change'));
  expect(localStorage.getItem('agent-panel-gguf-url')).toBe('');
});
it('ignores invalid restored sources and unsupported providers', () => {
  localStorage.setItem('agent-panel-provider', 'remote');
  localStorage.setItem('agent-panel-gguf-url', 'javascript:alert(1)');
  const panel = createAgentPanel();
  expect((panel.querySelector('.agent-panel-provider') as HTMLElement & { value: string }).value).toBe('webllm');
  expect((panel.querySelector('.agent-panel-gguf-url') as HTMLElement & { value: string }).value).toBe('');
  expect(state.cpu).not.toHaveBeenCalled();
});

it('keeps invalid remembered CPU URLs from starting a model load', () => {
  localStorage.setItem('agent-panel-provider', 'wllama');
  localStorage.setItem('agent-panel-gguf-url', 'file:///private/model.gguf');
  const panel = createAgentPanel();
  expect((panel.querySelector('.agent-panel-provider') as HTMLElement & { value: string }).value).toBe('wllama');
  expect((panel.querySelector('.agent-panel-gguf-url') as HTMLElement & { value: string }).value).toBe('');
  expect(state.cpu).not.toHaveBeenCalled();
  expect(state.auto).not.toHaveBeenCalled();
});
