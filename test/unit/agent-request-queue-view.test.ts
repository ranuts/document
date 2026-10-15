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
