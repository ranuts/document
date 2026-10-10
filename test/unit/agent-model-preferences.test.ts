import { afterEach, expect, it, vi } from 'vitest';
import { createAgentPanel } from '../../lib/agent-plugin/ui/panel';
const state = vi.hoisted(() => ({ cpu: vi.fn(), source: '', model: '', auto: vi.fn() }));
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
    constructor(options: { webllm: { model: string } }) {
      state.model = options.webllm.model;
    }
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
it('restores the selected file URL but prepares only after the user starts it', async () => {
  localStorage.setItem('agent-panel-provider', 'wllama');
  localStorage.setItem('agent-panel-gguf-url', 'https://models.example/local.gguf');
  const panel = createAgentPanel();
  expect((panel.querySelector('.agent-panel-provider') as HTMLElement & { value: string }).value).toBe('wllama');
  expect((panel.querySelector('.agent-panel-gguf-url') as HTMLElement & { value: string }).value).toBe(
    'https://models.example/local.gguf',
  );
  expect(state.cpu).not.toHaveBeenCalled();
  panel.querySelector<HTMLElement>('.agent-panel-gguf-load')!.click();
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

it('persists a task preset without overwriting the global preset', () => {
  localStorage.setItem('agent-local-preset', 'Qwen3-1.7B-q4f16_1-MLC');
  const panel = createAgentPanel();
  const task = panel.querySelector('.agent-writing-task') as HTMLSelectElement;
  task.value = 'rewrite';
  task.dispatchEvent(new Event('change'));
  const selected = panel.querySelector('.agent-task-model') as HTMLSelectElement;
  expect(selected).not.toBeNull();
  selected.value = 'Qwen3-4B-q4f16_1-MLC';
  selected.dispatchEvent(new Event('change'));
  expect(JSON.parse(localStorage.getItem('agent-task-models')!).tasks.rewrite).toEqual({
    backend: 'webllm',
    model: 'Qwen3-4B-q4f16_1-MLC',
  });
  expect(localStorage.getItem('agent-local-preset')).toBe('Qwen3-1.7B-q4f16_1-MLC');
  task.value = 'chat';
  task.dispatchEvent(new Event('change'));
  expect(selected.value).toBe('');
});
it('loads the configured writing model and restores the default for chat', async () => {
  localStorage.setItem(
    'agent-task-models',
    JSON.stringify({ version: 1, tasks: { rewrite: { backend: 'webllm', model: 'Qwen3-4B-q4f16_1-MLC' } } }),
  );
  const panel = createAgentPanel();
  panel.querySelector<HTMLElement>('.agent-panel-load')!.click();
  await vi.waitFor(() => expect(state.model).toBe('Qwen3-1.7B-q4f16_1-MLC'));
  const task = panel.querySelector('.agent-writing-task') as HTMLSelectElement;
  task.value = 'rewrite';
  task.dispatchEvent(new Event('change'));
  await new Promise((resolve) => setTimeout(resolve, 0));
  panel.querySelector('.agent-panel-load')!.dispatchEvent(new Event('click'));
  await vi.waitFor(() => expect(state.model).toBe('Qwen3-4B-q4f16_1-MLC'));
  task.value = 'chat';
  task.dispatchEvent(new Event('change'));
  await new Promise((resolve) => setTimeout(resolve, 0));
  panel.querySelector('.agent-panel-load')!.dispatchEvent(new Event('click'));
  await vi.waitFor(() => expect(state.model).toBe('Qwen3-1.7B-q4f16_1-MLC'));
});

it('keeps the global engine choice when a task-specific GPU model is selected', () => {
  localStorage.setItem(
    'agent-task-models',
    JSON.stringify({ version: 1, tasks: { chat: { backend: 'webllm', model: 'Qwen3-4B-q4f16_1-MLC' } } }),
  );
  const panel = createAgentPanel();
  const provider = panel.querySelector('.agent-panel-provider') as HTMLElement & { value: string };
  provider.value = 'wllama';
  provider.dispatchEvent(new Event('change'));
  expect(localStorage.getItem('agent-panel-provider')).toBe('wllama');
});
