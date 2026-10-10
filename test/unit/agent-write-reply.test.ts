import { afterEach, expect, it, vi } from 'vitest';
import { createAgentPanel } from '../../lib/agent-plugin/ui/panel';
import { createHistoryStorage } from '../../lib/agent-plugin/ui/storage';
import { t } from '@ranuts/shared/i18n';
const state = vi.hoisted(() => ({
  text: '',
  valid: true,
  execute: vi.fn(),
  capture: vi.fn(),
}));
vi.mock('@ranuts/agent-core/llm/webllm', async (original) => ({
  ...(await original<typeof import('@ranuts/agent-core/llm/webllm')>()),
  isWebGPUAvailable: () => true,
  isModelCached: async () => false,
  WebLLMProvider: class {
    preload = async () => {};
    dispose = async () => {};
    isReady = () => true;
  },
}));
vi.mock('@ranuts/agent-core/llm/local', () => ({
  LocalInferenceProvider: class {
    preload = async () => {};
    dispose = async () => {};
    isReady = () => true;
  },
}));
vi.mock('../../lib/agent-plugin/tools', () => ({ agentTools: { insert_text: { execute: state.execute } } }));
vi.mock('../../lib/agent-plugin/reviewed-action', async (original) => ({
  ...(await original<typeof import('../../lib/agent-plugin/reviewed-action')>()),
  captureActionTarget: state.capture,
}));
vi.mock('../../lib/agent-plugin/editor-bridge', () => ({
  getEditorApi: () => ({ isDocumentLoadComplete: true, isLoadFullApi: true, pluginMethod_GetSelectedText: () => '' }),
}));
HTMLElement.prototype.scrollTo = vi.fn();
afterEach(() => {
  window.dispatchEvent(new Event('pagehide'));
  document.body.replaceChildren();
  createHistoryStorage().clear();
  localStorage.removeItem('agent_sessions_v1');
  state.execute.mockReset();
  state.capture.mockReset();
  state.text = '';
  state.valid = true;
});
it('saves a completed direct write to its originating conversation after switching sessions', async () => {
  const panel = await mount();
  document.body.append(panel);
  let finish!: () => void;
  state.execute.mockImplementation(
    (input: { text: string }) =>
      new Promise<void>((resolve) => {
        finish = () => {
          state.text = input.text;
          resolve();
        };
      }),
  );
  const input = panel.querySelector<HTMLTextAreaElement>('.cui-input')!;
  input.value = '写到当前的文档上';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
  const original = (panel.querySelector('.agent-session-select') as HTMLSelectElement).value;
  (panel.querySelector('.agent-panel-clear') as HTMLElement).click();
  finish();
  await vi.waitFor(() => expect(state.text).toBe('秋日的天空明净。'));
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(panel.querySelectorAll('.cui-msg')).toHaveLength(0);
  const sessions = panel.querySelector<HTMLSelectElement>('.agent-session-select')!;
  sessions.value = original;
  sessions.dispatchEvent(new Event('change'));
  const exported = await exportHistory(panel);
  const messages = exported.sessions.find((item: { id: string }) => item.id === original).messages;
  expect(messages).toHaveLength(4);
  expect(messages.at(-1).content[0].content).toContain('verified');
  expect(panel.textContent).toContain('秋日的天空明净。');
  expect(createHistoryStorage().load()).toHaveLength(1);
});
async function exportHistory(panel: HTMLElement) {
  const anchor = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  try {
    panel.querySelector<HTMLButtonElement>('.agent-history-export')!.click();
    const blob = vi.mocked(URL.createObjectURL).mock.calls.at(-1)![0] as Blob;
    return JSON.parse(
      await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.readAsText(blob);
      }),
    );
  } finally {
    anchor.mockRestore();
  }
}
async function mount() {
  state.capture.mockImplementation(() => ({
    editor: 'word',
    label: 'DOCX',
    selectedText: '',
    isCurrent: () => state.valid,
    verify: async (plan: { input: { text: string } }) => state.text === plan.input.text,
  }));
  state.execute.mockImplementation(async (input: { text: string }) => {
    state.text = input.text;
  });
  createHistoryStorage().save([{ role: 'assistant', content: '秋日的天空明净。' }]);
  const panel = createAgentPanel();
  panel.querySelector<HTMLButtonElement>('.agent-history-import')!.click();
  await vi.waitFor(() => expect(panel.querySelector('.cui-apply')).not.toBeNull());
  return panel;
}
it('writes the exact answer through the editor only after an explicit click and verifies the result', async () => {
  const panel = await mount();
  expect(state.execute).not.toHaveBeenCalled();
  const button = panel.querySelector<HTMLButtonElement>('.cui-apply')!;
  expect(button).not.toBeNull();
  button.click();
  button.click();
  await vi.waitFor(() => expect(button.textContent).toBe(t('agentReplyWritten')));
  expect(state.execute).toHaveBeenCalledExactlyOnceWith({ text: '秋日的天空明净。' }, expect.any(AbortSignal));
  expect(state.capture).toHaveBeenCalledTimes(1);
});
it('routes an explicit write instruction to the previous answer without asking a model', async () => {
  const panel = await mount();
  document.body.append(panel);
  const input = panel.querySelector<HTMLTextAreaElement>('.cui-input')!;
  input.value = '写到当前的文档上';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await vi.waitFor(() =>
    expect(state.execute).toHaveBeenCalledExactlyOnceWith({ text: '秋日的天空明净。' }, expect.any(AbortSignal)),
  );
  expect(createHistoryStorage().load()).toHaveLength(1);
  await vi.waitFor(() => expect(panel.querySelector('.cui-activity')?.textContent).toContain(t('agentPlanVerified')));
});
it('does not claim success or allow a duplicate write if read-back fails after execution', async () => {
  const panel = await mount();
  state.execute.mockImplementation(async () => {});
  const button = panel.querySelector<HTMLButtonElement>('.cui-apply')!;
  button.click();
  await vi.waitFor(() => expect(button.textContent).toBe(t('agentCheckDocument')));
  expect(button.disabled).toBe(true);
  expect(panel.querySelector('.cui-msg-error')?.textContent).toContain(t('agentPlanUnverified'));
});
it('keeps the operation retryable when the editor is not ready and nothing was executed', async () => {
  const panel = await mount();
  state.capture.mockImplementation(() => {
    throw new Error('Editor is still loading');
  });
  const button = panel.querySelector<HTMLButtonElement>('.cui-apply')!;
  button.click();
  await vi.waitFor(() => expect(panel.querySelector('.cui-msg-error')?.textContent).toContain(t('agentEditorLoading')));
  expect(state.execute).not.toHaveBeenCalled();
  expect(button.disabled).toBe(false);
});

it('explains a missing completed answer without trying to write', async () => {
  const panel = createAgentPanel();
  const input = panel.querySelector<HTMLTextAreaElement>('.cui-input')!;
  input.value = 'write the previous answer into the document';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await vi.waitFor(() =>
    expect(panel.querySelector('.cui-msg-error')?.textContent).toContain('Generate a complete answer'),
  );
  expect(state.execute).not.toHaveBeenCalled();
});
