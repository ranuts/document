import { t } from '@ranuts/shared/i18n';
import type { EditorApi } from '../../lib/agent-plugin/editor-bridge';
import { afterEach, expect, it, vi } from 'vitest';
import { createAgentPanel } from '../../lib/agent-plugin/ui/panel';
HTMLElement.prototype.scrollTo = vi.fn();
const editorState = vi.hoisted(() => ({ api: null as null | Partial<EditorApi> }));
vi.mock('@ranuts/agent-core/llm/local', () => ({
  LocalInferenceProvider: class {
    preload = async () => {};
    dispose = async () => {};
    isReady = () => false;
  },
}));
vi.mock('../../lib/agent-plugin/editor-bridge', () => ({
  getEditorApi: () => editorState.api,
  requireEditorApi: () => editorState.api,
  requireEditorContext: () => ({ api: editorState.api, AscCommon: { changestype_Document_Settings: 42 } }),
}));

vi.mock('@ranuts/agent-core/llm/webllm', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@ranuts/agent-core/llm/webllm')>()),
  isWebGPUAvailable: () => true,
  isModelCached: async () => false,
  WebLLMProvider: class {
    preload = async () => {};
    dispose = async () => {};
    isReady = () => false;
  },
}));

afterEach(() => {
  localStorage.removeItem('agent-panel-provider');
  localStorage.removeItem('agent-panel-gguf-url');
  window.dispatchEvent(new Event('pagehide'));
  document.body.innerHTML = '';
  editorState.api = null;
});

it('opens a writing task from the welcome screen without sending or changing the draft', () => {
  const panel = createAgentPanel();
  const input = panel.querySelector<HTMLTextAreaElement>('.cui-input')!;
  input.value = 'Keep this draft';
  const chatPlaceholder = input.placeholder;
  const action = panel.querySelector<HTMLButtonElement>('[data-writing-starter="translate"]');
  expect(action).not.toBeNull();
  action!.click();
  expect((panel.querySelector('.agent-writing-task') as HTMLSelectElement).value).toBe('translate');
  expect((panel.querySelector('.agent-writing-language') as HTMLElement).hidden).toBe(false);
  expect(input.value).toBe('Keep this draft');
  expect(input.placeholder).not.toBe(chatPlaceholder);
  expect(input.placeholder).toBeTruthy();
  expect(document.activeElement).toBe(input);
  expect(panel.querySelector('.cui-msg-user')).toBeNull();
  const mode = panel.querySelector<HTMLSelectElement>('.agent-writing-task')!;
  mode.value = 'chat';
  mode.dispatchEvent(new Event('change'));
  expect(input.placeholder).toBe(chatPlaceholder);
});

it('offers only browser-local backends and keeps remote credentials out of the product', () => {
  const panel = createAgentPanel();
  const mode = panel.querySelector('.agent-writing-task');
  expect(mode).not.toBeNull();
  expect((mode as HTMLElement).hidden).toBe(false);
  const select = panel.querySelector('.agent-panel-provider') as HTMLElement & { value: string };
  expect(Array.from(select.querySelectorAll('r-option')).map((option) => option.getAttribute('value'))).toEqual([
    'webllm',
    'wllama',
  ]);
  expect(panel.querySelector('.agent-panel-key-input')).toBeNull();
  expect(panel.querySelector('.agent-api-base')).toBeNull();
  expect(panel.querySelector('.agent-panel-link')).toBeNull();
});

it('groups conversation switching and creation ahead of the transcript', () => {
  const panel = createAgentPanel();
  const bar = panel.querySelector('.agent-session-bar')!;
  expect(bar.querySelector('.agent-session-select')).not.toBeNull();
  expect(bar.querySelector('.agent-panel-clear')).not.toBeNull();
  expect(panel.querySelector('.agent-panel-header .agent-panel-clear')).toBeNull();
  expect(bar.querySelector('.agent-document-scope')?.getAttribute('role')).toBe('note');
  expect(bar.querySelector('.agent-document-scope')?.hasAttribute('aria-live')).toBe(false);
});

it('labels provider and model controls in settings', () => {
  const panel = createAgentPanel();
  expect(panel.querySelector('.agent-panel-provider')?.getAttribute('aria-label')).toBeTruthy();
  expect(panel.querySelector('.agent-panel-model')?.getAttribute('aria-label')).toBeTruthy();
});

it.each([{ isComposing: true }, { keyCode: 229 }])(
  'keeps settings and its draft open when Escape cancels IME composition (%j)',
  (composition) => {
    const panel = createAgentPanel();
    panel.querySelector<HTMLButtonElement>('.agent-panel-settings-toggle')!.click();
    const settings = panel.querySelector<HTMLElement>('.agent-panel-settings')!;
    const field = settings.querySelector<HTMLInputElement>('input:not([type="file"])')!;
    field.value = '中文草稿';
    field.focus();
    field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', ...composition, bubbles: true }));
    expect(settings.classList.contains('agent-panel-settings-hidden')).toBe(false);
    expect(document.activeElement).toBe(field);
    expect(field.value).toBe('中文草稿');
  },
);
it('returns focus to settings control when Escape closes the settings surface', () => {
  const panel = createAgentPanel();
  const settingsButton = panel.querySelector<HTMLButtonElement>('.agent-panel-settings-toggle')!;
  settingsButton.click();
  const settings = panel.querySelector<HTMLElement>('.agent-panel-settings')!;
  expect(settings.classList.contains('agent-panel-settings-hidden')).toBe(false);
  settings.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  expect(settings.classList.contains('agent-panel-settings-hidden')).toBe(true);
  expect(document.activeElement).toBe(settingsButton);
});

it('enables review controls when the editor finishes loading after the panel', () => {
  const panel = createAgentPanel();
  const checkbox = panel.querySelector('r-checkbox')!;
  expect(checkbox.hasAttribute('disabled')).toBe(true);
  editorState.api = {
    isDocumentLoadComplete: true,
    isLoadFullApi: true,
    asc_IsTrackRevisions: () => true,
    asc_SetGlobalTrackRevisions: () => {},
    asc_GetGlobalTrackRevisions: () => true,
    asc_SetLocalTrackRevisions: () => {},
  };
  window.dispatchEvent(new Event('document:content-ready'));
  expect(checkbox.hasAttribute('disabled')).toBe(false);
  expect(checkbox.getAttribute('checked')).toBe('true');
});

it('preserves the composer draft when local inference has not been loaded', async () => {
  const panel = createAgentPanel();
  const input = panel.querySelector<HTMLTextAreaElement>('.cui-input')!;
  input.value = '请润色选中的段落';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await Promise.resolve();
  expect(input.value).toBe('请润色选中的段落');
});

it('offers an explicit GGUF backend without changing the default provider', () => {
  const panel = createAgentPanel();
  const select = panel.querySelector('.agent-panel-provider')!;
  expect(select.getAttribute('value')).toBe('webllm');
  expect(select.querySelector('r-option[value="wllama"]')).not.toBeNull();
  expect(panel.querySelector('.agent-panel-gguf-files')).not.toBeNull();
});

it('retains local model settings if an invalid remote provider value is injected', () => {
  const panel = createAgentPanel();
  const provider = panel.querySelector('.agent-panel-provider') as HTMLElement & { value: string };
  const artifact = panel.querySelector('.agent-local-model-url') as HTMLElement;
  expect(artifact.style.display).toBe('');
  provider.value = 'openai';
  provider.dispatchEvent(new Event('change'));
  expect(artifact.style.display).toBe('');
  expect(panel.querySelector('.agent-api-model')).toBeNull();
});

it('shows GGUF settings only for wllama and retains a draft until explicit loading', async () => {
  const panel = createAgentPanel();
  const select = panel.querySelector('.agent-panel-provider') as HTMLElement & { value: string };
  select.value = 'wllama';
  select.dispatchEvent(new Event('change'));
  expect((panel.querySelector('.agent-panel-gguf-row') as HTMLElement).style.display).toBe('');
  expect((panel.querySelector('.agent-panel-model-row') as HTMLElement).style.display).toBe('none');
  const textarea = panel.querySelector<HTMLTextAreaElement>('.cui-input')!;
  textarea.value = '我的草稿';
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(textarea.value).toBe('我的草稿');
  select.value = 'webllm';
  select.dispatchEvent(new Event('change'));
  expect((panel.querySelector('.agent-panel-gguf-row') as HTMLElement).style.display).toBe('none');
});

it('clears a previous URL when local GGUF files are selected', () => {
  const panel = createAgentPanel();
  const url = panel.querySelector('.agent-panel-gguf-url') as HTMLElement & { value: string };
  url.value = 'https://example.com/old.gguf';
  panel.querySelector('.agent-panel-gguf-files')!.dispatchEvent(new Event('change'));
  expect(url.value).toBe('');
});

it('exposes explicit writing tasks and hides them for cloud backends', () => {
  const panel = createAgentPanel();

  const tasks = panel.querySelector('.agent-writing-task') as HTMLElement & { value: string };
  const language = panel.querySelector('.agent-writing-language') as HTMLElement;
  expect(tasks.hidden).toBe(false);
  expect([...tasks.querySelectorAll('option')].map((o) => o.getAttribute('value'))).toEqual([
    'chat',
    'tools',
    'rewrite',
    'summarize',
    'translate',
  ]);
  tasks.value = 'translate';
  tasks.dispatchEvent(new Event('change'));
  expect(language.hidden).toBe(false);
  const provider = panel.querySelector('.agent-panel-provider') as HTMLElement & { value: string };
  provider.value = 'anthropic';
  provider.dispatchEvent(new Event('change'));
  expect(tasks.hidden).toBe(false);
  expect(language.hidden).toBe(false);
});

it('names the review-mode checkbox with its visible localized label', () => {
  const panel = createAgentPanel();
  const checkbox = panel.querySelector('.agent-panel-review r-checkbox')!;
  const label = panel.querySelector('.agent-panel-review span')!.textContent;
  expect(label).toBeTruthy();
  expect(checkbox.getAttribute('aria-label')).toBe(label);
});

it('syncs native tracking changes without writing settings and detaches on pagehide', () => {
  let enabled = false;
  let callback: (() => void) | undefined;
  const setter = vi.fn();
  const unregister = vi.fn();
  editorState.api = {
    isDocumentLoadComplete: true,
    isLoadFullApi: true,
    asc_IsTrackRevisions: () => enabled,
    asc_GetGlobalTrackRevisions: () => enabled,
    asc_SetGlobalTrackRevisions: setter,
    asc_SetLocalTrackRevisions: vi.fn(),
    asc_registerCallback: (_event, handler) => {
      callback = handler;
    },
    asc_unregisterCallback: unregister,
  };
  const panel = createAgentPanel();
  const checkbox = panel.querySelector('.agent-panel-review r-checkbox')!;
  expect(checkbox.getAttribute('checked')).toBe('false');
  enabled = true;
  callback?.();
  expect(checkbox.getAttribute('checked')).toBe('true');
  expect(setter).not.toHaveBeenCalled();
  window.dispatchEvent(new Event('pagehide'));
  expect(unregister).toHaveBeenCalledWith('asc_onOnTrackRevisionsChange', callback);
});

it('groups custom GPU sources in a disclosure and exposes stored overrides', () => {
  localStorage.setItem('agent-panel-provider', 'webllm');
  localStorage.setItem('agent-local-model-id', 'custom-model');
  const panel = createAgentPanel();
  const sources = panel.querySelector<HTMLDetailsElement>('.agent-model-sources')!;
  expect(sources).not.toBeNull();
  expect(sources.open).toBe(true);
  expect(sources.querySelectorAll('r-input')).toHaveLength(3);
  sources.open = false;
  expect((sources.querySelector('.agent-local-model-id') as HTMLElement & { value: string }).value).toBe(
    'custom-model',
  );
  const provider = panel.querySelector('.agent-panel-provider') as HTMLElement & { value: string };
  provider.value = 'wllama';
  provider.dispatchEvent(new Event('change'));
  expect(sources.hidden).toBe(true);
  provider.value = 'webllm';
  provider.dispatchEvent(new Event('change'));
  expect(sources.hidden).toBe(false);
  expect((sources.querySelector('.agent-local-model-id') as HTMLElement & { value: string }).value).toBe(
    'custom-model',
  );
  localStorage.removeItem('agent-local-model-id');
  localStorage.removeItem('agent-panel-provider');
});

it('returns keyboard focus to the document rail when closing a focused panel', async () => {
  const app = document.createElement('div');
  app.id = 'app';
  const frame = document.createElement('iframe');
  app.append(frame);
  document.body.append(app);
  const doc = frame.contentDocument!;
  doc.body.innerHTML = '<div id="right-menu"><div class="tool-menu-btns"></div></div>';
  const panel = createAgentPanel();
  await Promise.resolve();
  const close = panel.querySelector<HTMLButtonElement>('.agent-panel-close')!;
  close.focus();
  close.click();
  expect(panel.classList.contains('agent-panel-hidden')).toBe(true);
  expect(doc.activeElement).toBe(doc.querySelector('.agent-sidebar-entry'));
});

it('keeps an external control focused when the panel is closed programmatically', async () => {
  const panel = createAgentPanel();
  await Promise.resolve();
  const external = document.createElement('button');
  document.body.append(external);
  external.focus();
  panel.querySelector<HTMLButtonElement>('.agent-panel-close')!.click();
  expect(document.activeElement).toBe(external);
});

it('falls back to the editor frame when the native rail is unavailable', async () => {
  const app = document.createElement('div');
  app.id = 'app';
  const frame = document.createElement('iframe');
  app.append(frame);
  document.body.append(app);
  const panel = createAgentPanel();
  await Promise.resolve();
  const close = panel.querySelector<HTMLButtonElement>('.agent-panel-close')!;
  close.focus();
  close.click();
  expect(document.activeElement).toBe(frame);
});

it('executes an explicit slide command directly in tools mode without a ready model', async () => {
  const { agentTools } = await import('../../lib/agent-plugin/tools');
  const execute = vi.spyOn(agentTools.slide_action, 'execute').mockResolvedValue({ verified: true, count: 2, page: 2 });
  try {
    const panel = createAgentPanel();
    document.body.append(panel);
    const mode = panel.querySelector<HTMLSelectElement>('.agent-writing-task')!;
    mode.value = 'tools';
    mode.dispatchEvent(new Event('change'));
    const input = panel.querySelector<HTMLTextAreaElement>('.cui-input')!;
    input.value = 'Add a slide';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await vi.waitFor(() => expect(execute).toHaveBeenCalledExactlyOnceWith({ action: 'add' }));
    await vi.waitFor(() => expect(panel.querySelector('.cui-activity')?.textContent).toContain(t('agentPlanVerified')));
  } finally {
    execute.mockRestore();
  }
});

it('remounts viewport tracking when the panel returns from the back-forward cache', () => {
  const original = Object.getOwnPropertyDescriptor(window, 'visualViewport');
  const width = Object.getOwnPropertyDescriptor(window, 'innerWidth');
  const viewport = Object.assign(new EventTarget(), { height: 700, offsetTop: 0, scale: 1 });
  Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
  try {
    const panel = createAgentPanel();
    expect(panel.style.height).toBe('700px');
    window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
    expect(panel.style.height).toBe('');
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    viewport.height = 400;
    viewport.dispatchEvent(new Event('resize'));
    expect(panel.style.height).toBe('400px');
  } finally {
    window.dispatchEvent(new PageTransitionEvent('pagehide'));
    if (original) Object.defineProperty(window, 'visualViewport', original);
    else Reflect.deleteProperty(window, 'visualViewport');
    if (width) Object.defineProperty(window, 'innerWidth', width);
  }
});

it('restores resizing and the editor AI entry on repeated cached returns without duplicate handles', () => {
  const frame = document.createElement('iframe');
  document.body.append(frame);
  frame.contentDocument!.body.innerHTML = '<div id="right-menu"><div class="tool-menu-btns"></div></div>';
  const panel = createAgentPanel();
  for (let cycle = 0; cycle < 2; cycle++) {
    window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
    expect(panel.querySelector('[role="separator"]')).toBeNull();
    expect(frame.contentDocument!.querySelector('.agent-sidebar-entry')).toBeNull();
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    expect(panel.querySelectorAll('[role="separator"]')).toHaveLength(1);
    expect(frame.contentDocument!.querySelectorAll('.agent-sidebar-entry')).toHaveLength(1);
    const handle = panel.querySelector('[role="separator"]')!;
    const oldWidth = Number(handle.getAttribute('aria-valuenow'));
    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    expect(Number(handle.getAttribute('aria-valuenow'))).toBeGreaterThan(oldWidth);
    panel.querySelector<HTMLButtonElement>('.agent-panel-close')!.click();
    expect(panel.classList.contains('agent-panel-hidden')).toBe(true);
    frame.contentDocument!.querySelector<HTMLButtonElement>('.agent-sidebar-entry')!.click();
    expect(panel.classList.contains('agent-panel-hidden')).toBe(false);
  }
});

it('refreshes stale loaded guidance after a cached return without claiming model readiness', () => {
  localStorage.setItem('agent-panel-provider', 'wllama');
  const panel = createAgentPanel();
  const note = panel.querySelector<HTMLElement>('.agent-panel-note')!;
  note.textContent = t('agentModelLoaded');
  window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
  window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
  expect(note.textContent).toBe(t('agentWllamaHint'));
});

it('shows selected local model filenames safely and clears them when switching to a URL', () => {
  localStorage.setItem('agent-panel-provider', 'wllama');
  const panel = createAgentPanel();
  const input = panel.querySelector<HTMLInputElement>('.agent-panel-gguf-files')!;
  const names = panel.querySelector<HTMLElement>('.agent-panel-gguf-filenames');
  expect(names).not.toBeNull();
  Object.defineProperty(input, 'files', { configurable: true, value: [new File(['x'], '<model>.gguf')] });
  input.dispatchEvent(new Event('change'));
  expect(names!.textContent).toBe('<model>.gguf');
  expect(names!.querySelector('model')).toBeNull();
  const url = panel.querySelector<HTMLElement & { value: string }>('.agent-panel-gguf-url')!;
  url.value = 'https://example.com/model.gguf';
  url.dispatchEvent(new Event('change'));
  expect(names!.textContent).toBe('');
});
