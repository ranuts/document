import { afterEach, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { installUnloadPagehide } from '../../lib/onlyoffice/guards/unload-pagehide';
const frames: HTMLIFrameElement[] = [];
afterEach(() => {
  for (const frame of frames) frame.remove();
  frames.length = 0;
  vi.useRealTimers();
});
function editorWindow() {
  const frame = document.createElement('iframe');
  document.body.append(frame);
  frames.push(frame);
  return frame.contentWindow!;
}
it('moves current and late handlers to pagehide exactly once with window binding', () => {
  const win = editorWindow();
  const original = vi.fn();
  win.onunload = original;
  expect(installUnloadPagehide(win)).toBe(true);
  expect(installUnloadPagehide(win)).toBe(true);
  win.dispatchEvent(new Event('unload'));
  expect(original).not.toHaveBeenCalled();
  win.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
  expect(original).toHaveBeenCalledTimes(1);
  expect(original.mock.contexts[0]).toBe(win);
  const later = vi.fn();
  win.onunload = later;
  win.dispatchEvent(new PageTransitionEvent('pagehide'));
  expect(original).toHaveBeenCalledTimes(1);
  expect(later).toHaveBeenCalledTimes(1);
  win.onunload = null;
  win.dispatchEvent(new PageTransitionEvent('pagehide'));
  expect(later).toHaveBeenCalledTimes(1);
});
it('preserves actual timer cancellation cleanup', () => {
  vi.useFakeTimers();
  const win = editorWindow();
  const continued = vi.fn();
  const timer = setTimeout(continued, 500);
  win.onunload = () => clearTimeout(timer);
  installUnloadPagehide(win);
  win.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
  vi.advanceTimersByTime(1000);
  expect(continued).not.toHaveBeenCalled();
});
it.each(['documenteditor', 'spreadsheeteditor', 'presentationeditor'])(
  'audits the shipped %s cleanup contract',
  (app) => {
    const source = readFileSync(`public/web-apps/apps/${app}/main/app.js`, 'utf8');
    expect(source).toContain('onUnload:function(){this.continueSavingTimer&&clearTimeout(this.continueSavingTimer)},');
  },
);
