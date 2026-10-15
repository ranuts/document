import { afterEach, expect, it, vi } from 'vitest';
import { createRequestQueueView } from '../../lib/agent-plugin/ui/request-queue-view';
afterEach(() => document.body.replaceChildren());
it('keeps pending text out of messages and restores focus to the composer when the last item is removed', () => {
  const focus = vi.fn(),
    edit = vi.fn(),
    remove = vi.fn(),
    sendNow = vi.fn(),
    resume = vi.fn();
  const view = createRequestQueueView({ focus, edit, remove, sendNow, resume });
  document.body.append(view.el);
  view.update({ entries: [{ id: 'first', text: 'Original <request>', binding: {} }], paused: true });
  expect(view.el.querySelector('.cui-msg')).toBeNull();
  expect(view.el.querySelector('.agent-queue-text')?.textContent).toBe('Original <request>');
  expect(view.el.querySelector('.agent-queue-text')?.querySelector('request')).toBeNull();
  const button = view.el.querySelector<HTMLButtonElement>('.agent-queue-remove')!;
  expect(button.getAttribute('aria-label')).toBe('Remove: Original <request>');
  button.focus();
  button.click();
  expect(remove).toHaveBeenCalledExactlyOnceWith('first');
  view.update({ entries: [], paused: true });
  expect(focus).toHaveBeenCalledOnce();
  expect(view.el.hidden).toBe(true);
});
it('keeps focus on a stable action through updates and provides localized occupied-draft feedback', () => {
  const view = createRequestQueueView({
    focus: vi.fn(),
    edit: vi.fn(),
    remove: vi.fn(),
    sendNow: vi.fn(),
    resume: vi.fn(),
  });
  document.body.append(view.el);
  const state = { entries: [{ id: 'first', text: 'Request', binding: {} }], paused: false };
  view.update(state);
  view.el.querySelector<HTMLButtonElement>('.agent-queue-edit')!.focus();
  view.update({ ...state, paused: true });
  expect(document.activeElement).toBe(view.el.querySelector('.agent-queue-edit'));
  view.occupied();
  expect(view.el.querySelector('[role=status]')?.textContent).toContain('Your draft is not empty');
});

it.each([false, true])(
  'disables unavailable preparation actions and reports stopping=%s beside the original text',
  (stopping) => {
    const view = createRequestQueueView({
      focus: vi.fn(),
      edit: vi.fn(),
      remove: vi.fn(),
      sendNow: vi.fn(),
      resume: vi.fn(),
    });
    document.body.append(view.el);
    view.update({
      entries: [
        { id: 'first', text: 'Original request', binding: {}, ...(stopping ? { recoverOnly: true as const } : {}) },
      ],
      paused: stopping,
      preparing: { id: 'first', stopping },
    });
    expect(view.el.querySelector('.agent-queue-state')?.textContent).toBe(
      stopping ? 'Stopping…' : 'Preparing your request…',
    );
    for (const button of view.el.querySelectorAll<HTMLButtonElement>('.agent-queue-actions button'))
      expect(button.disabled).toBe(true);
    view.update({ entries: [{ id: 'first', text: 'Original request', binding: {}, recoverOnly: true }], paused: true });
    expect(view.el.querySelector<HTMLButtonElement>('.agent-queue-edit')!.disabled).toBe(false);
    expect(view.el.querySelector<HTMLButtonElement>('.agent-queue-remove')!.disabled).toBe(false);
  },
);
it('clears transient occupied feedback when the queue changes or another conversation is displayed', () => {
  const view = createRequestQueueView({
    focus: vi.fn(),
    edit: vi.fn(),
    remove: vi.fn(),
    sendNow: vi.fn(),
    resume: vi.fn(),
  });
  document.body.append(view.el);
  view.update({ entries: [{ id: 'first', text: 'Request', binding: {} }], paused: false });
  view.occupied();
  expect(view.el.querySelector('.agent-queue-feedback')?.textContent).not.toBe('');
  view.update({ entries: [{ id: 'other', text: 'Other conversation', binding: {} }], paused: true });
  expect(view.el.querySelector('.agent-queue-feedback')?.textContent).toBe('');
});

it('returns focus to the composer when preparation disables the previously focused request action', () => {
  const focus = vi.fn();
  const view = createRequestQueueView({ focus, edit: vi.fn(), remove: vi.fn(), sendNow: vi.fn(), resume: vi.fn() });
  document.body.append(view.el);
  const entries = [{ id: 'first', text: 'Request', binding: {} }];
  view.update({ entries, paused: true });
  view.el.querySelector<HTMLButtonElement>('.agent-queue-edit')!.focus();
  view.update({ entries, paused: false, preparing: { id: 'first', stopping: false } });
  expect(focus).toHaveBeenCalledOnce();
});
