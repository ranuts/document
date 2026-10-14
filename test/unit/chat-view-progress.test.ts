import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ChatView } from '../../packages/chat-ui/src/chat-view';

let view: ChatView;
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-14T00:00:00Z'));
  vi.stubGlobal('requestAnimationFrame', vi.fn());
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  HTMLElement.prototype.scrollTo = vi.fn();
  document.body.replaceChildren();
  view = new ChatView({
    onSend: vi.fn(),
    labels: {
      routing: 'Understanding request',
      reading: 'Reading content',
      waiting: 'Generating answer',
      elapsed: (seconds) => `Waiting ${seconds}s`,
    },
  });
  document.body.append(view.el);
});
afterEach(() => {
  view.dispose();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
const phase = () => view.el.querySelector<HTMLElement>('.cui-status')!;
const elapsed = () => view.el.querySelector<HTMLElement>('.cui-elapsed')!;
const progress = () => view.el.querySelector<HTMLElement>('.cui-progress')!;

it('shows the real phase immediately and measures waiting across phases without live tick announcements', () => {
  view.setRunning(true);
  view.setActivity('routing');
  expect(phase().textContent).toBe('Understanding request');
  expect(progress().hidden).toBe(false);
  expect(elapsed().textContent).toBe('Waiting 0s');
  expect(elapsed().getAttribute('aria-hidden')).toBe('true');
  expect(elapsed().closest('[aria-live], [role="status"], [role="log"]')).toBeNull();
  const changed = vi.spyOn(phase(), 'textContent', 'set');
  vi.advanceTimersByTime(2200);
  expect(elapsed().textContent).toBe('Waiting 2s');
  expect(changed).not.toHaveBeenCalled();
  view.setActivity('reading');
  expect(phase().textContent).toBe('Reading content');
  expect(elapsed().textContent).toBe('Waiting 2s');
  view.setActivity('responding');
  expect(phase().textContent).toBe('Generating answer');
  expect(elapsed().textContent).toBe('Waiting 2s');
});

it('replaces pre-response waiting with streamed text and does not restart waiting on stream completion', () => {
  view.setRunning(true);
  vi.advanceTimersByTime(3000);
  view.appendDelta('First useful text');
  expect(progress().hidden).toBe(true);
  expect(phase().textContent).toBe('');
  expect(elapsed().textContent).toBe('');
  expect(vi.getTimerCount()).toBe(0);
  view.endStream();
  expect(view.getLastAnswer()).toBe('First useful text');
  expect(progress().hidden).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
  view.setRunning(false);
});

it('keeps human review resting without a timer and excludes review time from a later wait', () => {
  view.setRunning(true);
  vi.advanceTimersByTime(3000);
  view.setActivity('reviewing');
  expect(phase().textContent).toBe('Review the proposed change to continue.');
  expect(elapsed().hidden).toBe(true);
  expect(elapsed().textContent).toBe('');
  expect(vi.getTimerCount()).toBe(0);
  view.setRunning(true);
  expect(view.el.querySelector('.cui-messages')?.getAttribute('aria-busy')).toBe('false');
  vi.advanceTimersByTime(90_000);
  view.setActivity('responding');
  expect(elapsed().textContent).toBe('Waiting 0s');
});

it('clears elapsed state on Stop and starts the next explicit turn from zero without touching the draft', () => {
  view.setRunning(true);
  view.setInput('Next question');
  vi.advanceTimersByTime(7000);
  view.setRunning(false);
  expect(progress().hidden).toBe(true);
  expect(elapsed().textContent).toBe('');
  expect(vi.getTimerCount()).toBe(0);
  expect(view.getInput()).toBe('Next question');
  view.setRunning(true);
  expect(elapsed().textContent).toBe('Waiting 0s');
  view.dispose();
  expect(vi.getTimerCount()).toBe(0);
  vi.advanceTimersByTime(7000);
  expect(elapsed().textContent).toBe('');
});

it('preserves measured time on repeated running updates and live label changes', () => {
  view.setRunning(true);
  view.setActivity('routing');
  vi.advanceTimersByTime(4000);
  view.setRunning(true);
  expect(elapsed().textContent).toBe('Waiting 4s');
  view.setLabels({ routing: 'Checking request', elapsed: (seconds) => `${seconds} seconds elapsed` });
  expect(phase().textContent).toBe('Checking request');
  expect(elapsed().textContent).toBe('4 seconds elapsed');
  expect(vi.getTimerCount()).toBe(1);
});

it('measures elapsed waiting independently of system clock changes', () => {
  view.setRunning(true);
  vi.advanceTimersByTime(2000);
  vi.setSystemTime(new Date('2026-10-15T00:00:00Z'));
  vi.advanceTimersByTime(1000);
  expect(elapsed().textContent).toBe('Waiting 3s');
});

it('clears running presentation without stopping the backend and restarts feedback only for a new turn', () => {
  view.setRunning(true);
  view.setActivity('routing');
  view.setInput('Keep this next draft');
  vi.advanceTimersByTime(2000);
  view.clear();
  expect(vi.getTimerCount()).toBe(0);
  expect(progress().hidden).toBe(true);
  expect(phase().textContent).toBe('');
  expect(elapsed().textContent).toBe('');
  expect(view.getInput()).toBe('Keep this next draft');
  expect(view.el.querySelector<HTMLButtonElement>('.cui-send-stop')?.disabled).toBe(false);
  expect(view.el.querySelector('.cui-messages')?.getAttribute('aria-busy')).toBe('true');
  view.setRunning(true);
  view.setActivity('reading');
  view.setLabels({ elapsed: (seconds) => `${seconds}s` });
  vi.advanceTimersByTime(3000);
  expect(vi.getTimerCount()).toBe(0);
  expect(progress().hidden).toBe(true);
  view.setRunning(false);
  view.setRunning(true);
  expect(progress().hidden).toBe(false);
  expect(elapsed().textContent).toBe('0s');
  expect(vi.getTimerCount()).toBe(1);
});
