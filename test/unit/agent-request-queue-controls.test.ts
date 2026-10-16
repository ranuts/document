import { afterEach, expect, it, vi } from 'vitest';
import { createRequestQueueControls } from '../../lib/agent-plugin/ui/request-queue-controls';
import { RequestQueue } from '../../lib/agent-plugin/ui/request-queue';

afterEach(() => document.body.replaceChildren());
it('preserves an occupied composer and binds recovery to the selected conversation', () => {
  const queue = new RequestQueue({ execute: vi.fn(), cancel: vi.fn(), revoke: vi.fn(), changed: vi.fn() });
  const restore = vi.spyOn(queue, 'restore').mockImplementation((_session, _id, _remove, receive) => {
    receive('Original request');
    return true;
  });
  let draft = 'Unsent draft';
  const focus = vi.fn();
  const view = createRequestQueueControls({
    queue: () => queue,
    conversation: () => 'chat',
    getDraft: () => draft,
    setDraft: (text) => {
      draft = text;
    },
    focus,
    prepare: () => false,
  });
  view.update({ entries: [{ id: 'one', text: 'Original request', binding: {} }], paused: true });
  document.body.append(view.el);
  view.el.querySelector<HTMLButtonElement>('.agent-queue-toggle')!.click();
  view.el.querySelector<HTMLButtonElement>('.agent-queue-edit')!.click();
  expect(restore).not.toHaveBeenCalled();
  expect(draft).toBe('Unsent draft');
  expect(view.el.querySelector('.agent-queue-feedback')?.textContent).not.toBe('');
  draft = '';
  view.el.querySelector<HTMLButtonElement>('.agent-queue-edit')!.click();
  expect(restore).toHaveBeenCalledWith('chat', 'one', true, expect.any(Function));
  expect(draft).toBe('Original request');
  expect(focus).toHaveBeenCalledOnce();
});

it('prepares the queued text rather than a different composer draft and never resumes before preparation', () => {
  const queue = new RequestQueue({ execute: vi.fn(), cancel: vi.fn(), revoke: vi.fn(), changed: vi.fn() });
  vi.spyOn(queue, 'state').mockReturnValue({
    entries: [
      { id: 'recovery', text: 'Stopped', binding: {}, recoverOnly: true },
      { id: 'one', text: 'Polish selection', binding: {} },
    ],
    paused: true,
  });
  const resume = vi.spyOn(queue, 'resume');
  const send = vi.spyOn(queue, 'sendNow');
  const prepare = vi.fn(() => true);
  const view = createRequestQueueControls({
    queue: () => queue,
    conversation: () => 'chat',
    getDraft: () => 'Different draft',
    setDraft: vi.fn(),
    focus: vi.fn(),
    prepare,
  });
  view.update(queue.state('chat'));
  view.el.querySelector<HTMLButtonElement>('.agent-queue-resume')!.click();
  expect(prepare).toHaveBeenCalledWith('Polish selection', expect.objectContaining({ id: 'one', binding: {} }));
  expect(resume).not.toHaveBeenCalled();
  view.el.querySelectorAll<HTMLButtonElement>('.agent-queue-send-now')[1]!.click();
  expect(send).not.toHaveBeenCalled();
  prepare.mockReturnValue(false);
  view.el.querySelector<HTMLButtonElement>('.agent-queue-resume')!.click();
  expect(resume).toHaveBeenCalledWith('chat');
});
it('lets origin-aware recovery intercept an entry before generic chat restoration', () => {
  const restore = vi.fn(() => true),
    setDraft = vi.fn(),
    prepare = vi.fn(() => false);
  const queue = new RequestQueue<any>({
    execute: async (entry) => ({ turnId: entry.id, status: 'failed' }),
    cancel: vi.fn(),
    revoke: vi.fn(),
    changed: vi.fn(),
  });
  const entry = queue.enqueue('origin', 'Artifact only', { origin: 'artifact' });
  const view = createRequestQueueControls({
    queue: () => queue,
    conversation: () => 'origin',
    getDraft: () => '',
    setDraft,
    focus: vi.fn(),
    prepare,
    restore,
  });
  view.update(queue.state('origin'), 'origin');
  (view.el.querySelector('.agent-queue-edit') as HTMLButtonElement).click();
  expect(restore).toHaveBeenCalledWith(entry);
  expect(setDraft).not.toHaveBeenCalled();
  (view.el.querySelector('.agent-queue-send-now') as HTMLButtonElement).click();
  expect(prepare).toHaveBeenCalledWith('Artifact only', entry);
});
