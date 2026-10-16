import { beforeEach, expect, it, vi } from 'vitest';
import { ChatView } from '../../packages/chat-ui/src/chat-view';
beforeEach(() => {
  document.body.replaceChildren();
  HTMLElement.prototype.scrollTo = vi.fn();
});
it.each(['saved', 'failed', 'cancelled'] as const)(
  'reports an explicit %s outcome beside the save action',
  async (outcome) => {
    const view = new ChatView({
      onSend: vi.fn(),
      onSaveMessage: async () => outcome,
      labels: { saveMessage: 'Save', savedMessage: 'Saved', saveFailed: 'Try save again' },
    });
    document.body.append(view.el);
    view.append({ role: 'agent', text: 'answer' });
    const button = view.el.querySelector<HTMLButtonElement>('.cui-save')!;
    button.click();
    await vi.waitFor(() => expect(button.disabled).toBe(false));
    expect(button.textContent).toBe(outcome === 'saved' ? 'Saved' : outcome === 'failed' ? 'Try save again' : 'Save');
    view.setLabels({ saveMessage: 'Speichern', savedMessage: 'Gespeichert', saveFailed: 'Erneut versuchen' });
    expect(button.textContent).toBe(
      outcome === 'saved' ? 'Gespeichert' : outcome === 'failed' ? 'Erneut versuchen' : 'Speichern',
    );
    view.dispose();
  },
);
it('does not turn a legacy void save into a saved receipt or alter cleared rows after late settlement', async () => {
  let resolve!: (result: 'saved') => void;
  const view = new ChatView({
    onSend: vi.fn(),
    onSaveMessage: () =>
      new Promise((r) => {
        resolve = r;
      }),
  });
  document.body.append(view.el);
  view.append({ role: 'agent', text: 'answer' });
  const button = view.el.querySelector<HTMLButtonElement>('.cui-save')!;
  button.click();
  const pendingLabel = button.textContent;
  view.clear();
  resolve('saved');
  await Promise.resolve();
  expect(button.textContent).toBe(pendingLabel);
  view.dispose();
});
it('offers at most two host actions and passes original source only on explicit activation', () => {
  const run = vi.fn();
  const send = vi.fn();
  const view = new ChatView({
    onSend: send,
    getMessageActions: () => [1, 2, 3].map((i) => ({ id: String(i), label: `Next ${i}`, run })),
  });
  document.body.append(view.el);
  view.append({ role: 'agent', text: '**original**' });
  const actions = view.el.querySelectorAll<HTMLButtonElement>('.cui-follow-up');
  expect(actions).toHaveLength(2);
  actions[0].click();
  expect(run).toHaveBeenCalledWith('**original**');
  expect(send).not.toHaveBeenCalled();
  view.dispose();
});
it('keeps legacy void outcomes neutral and blocks staged actions during composition and after interruption', async () => {
  const run = vi.fn();
  const view = new ChatView({
    onSend: vi.fn(),
    onSaveMessage: async () => {},
    getMessageActions: () => [{ id: 'x', label: 'Next', run }],
  });
  document.body.append(view.el);
  view.append({ role: 'agent', text: 'answer' });
  const save = view.el.querySelector<HTMLButtonElement>('.cui-save')!;
  save.click();
  await vi.waitFor(() => expect(save.disabled).toBe(false));
  expect(save.textContent).toBe('Save result');
  const input = view.el.querySelector('textarea')!;
  input.dispatchEvent(new CompositionEvent('compositionstart'));
  view.el.querySelector<HTMLButtonElement>('.cui-follow-up')!.click();
  expect(run).not.toHaveBeenCalled();
  input.dispatchEvent(new CompositionEvent('compositionend'));
  view.setRunning(true);
  view.appendDelta('partial');
  view.requestStop();
  expect(view.el.querySelector('[data-interrupted] .cui-follow-up')).toBeNull();
  expect(view.el.querySelector('[data-interrupted] .cui-save')).toBeNull();
  view.dispose();
});
