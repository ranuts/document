import { afterEach, expect, it, vi } from 'vitest';
import { ChatView } from '../../packages/chat-ui/src/chat-view';
let view: ChatView;
HTMLElement.prototype.scrollTo = vi.fn();
afterEach(() => {
  view?.dispose();
  document.body.replaceChildren();
});
it('opts into separate Queue and Stop controls and exposes an editor-independent pending slot', () => {
  const send = vi.fn(),
    queue = vi.fn(),
    stop = vi.fn();
  view = new ChatView({ onSend: send, onQueue: queue, onStop: stop, labels: { queue: 'Queue request' } });
  document.body.append(view.el);
  view.setRunning(true);
  view.setInput('next');
  view.focus();
  const input = view.el.querySelector('textarea')!;
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  expect(queue).toHaveBeenCalledExactlyOnceWith('next');
  expect(send).not.toHaveBeenCalled();
  expect(view.getInput()).toBe('');
  expect(document.activeElement).toBe(input);
  view.setInput('draft');
  const sendButton = view.el.querySelector<HTMLButtonElement>('.cui-send')!;
  expect(sendButton.getAttribute('aria-label')).toBe('Queue request');
  expect(sendButton.matches('.cui-send-stop')).toBe(false);
  view.el.querySelector<HTMLButtonElement>('.cui-send-stop')!.click();
  view.el.querySelector<HTMLButtonElement>('.cui-send-stop')!.click();
  expect(stop).toHaveBeenCalledOnce();
  expect(view.getInput()).toBe('draft');
  expect(view.pendingEl.parentElement).toBe(view.el.querySelector('.cui-footer'));
  expect(view.el.querySelector('.cui-composer')!.contains(view.pendingEl)).toBe(false);
});
it('keeps legacy Send-as-Stop without a queue hook', () => {
  const stop = vi.fn();
  view = new ChatView({ onSend: vi.fn(), onStop: stop });
  view.setRunning(true);
  view.setInput('next');
  view.el.querySelector<HTMLButtonElement>('.cui-send')!.click();
  expect(stop).toHaveBeenCalledOnce();
  expect(view.getInput()).toBe('next');
});
it('prepares queued dictation once and guards async revisions, readiness and IME', async () => {
  let finish!: (ready: boolean) => void;
  const queue = vi.fn();
  view = new ChatView({
    onSend: vi.fn(),
    onQueue: queue,
    beforeSend: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  });
  view.setRunning(true);
  view.setInput('draft');
  const input = view.el.querySelector('textarea')!;
  input.dispatchEvent(new Event('compositionstart'));
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  expect(finish).toBeUndefined();
  input.dispatchEvent(new Event('compositionend'));
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  input.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, inputType: 'insertText', data: 'x' }));
  view.setInput('new draft');
  finish(true);
  await Promise.resolve();
  expect(queue).not.toHaveBeenCalled();
  expect(view.getInput()).toBe('new draft');
  view.el.querySelector<HTMLButtonElement>('.cui-send')!.click();
  finish(true);
  await Promise.resolve();
  expect(queue).toHaveBeenCalledExactlyOnceWith('new draft');
});
it('returns focus to the draft when clearing disables and blurs the clicked Queue button', () => {
  const queue = vi.fn();
  view = new ChatView({ onSend: vi.fn(), onQueue: queue });
  document.body.append(view.el);
  view.setRunning(true);
  view.setInput('Queued draft');
  const send = view.el.querySelector<HTMLButtonElement>('.cui-send')!;
  let disabled = send.disabled;
  Object.defineProperty(send, 'disabled', {
    configurable: true,
    get: () => disabled,
    set: (value) => {
      disabled = value;
      if (value) send.blur();
    },
  });
  send.focus();
  send.click();
  expect(queue).toHaveBeenCalledExactlyOnceWith('Queued draft');
  expect(document.activeElement).toBe(view.el.querySelector('.cui-input'));
  const external = document.createElement('button');
  document.body.append(external);
  view.setInput('Other draft');
  external.focus();
  view.el.querySelector('textarea')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  expect(document.activeElement).toBe(external);
});
