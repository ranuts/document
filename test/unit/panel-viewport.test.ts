import { afterEach, expect, it, vi } from 'vitest';
import { mountPanelViewport } from '../../lib/agent-plugin/ui/panel-viewport';
const original = Object.getOwnPropertyDescriptor(window, 'visualViewport');
afterEach(() => {
  vi.unstubAllGlobals();
  if (original) Object.defineProperty(window, 'visualViewport', original);
  else Reflect.deleteProperty(window, 'visualViewport');
});
it('tracks narrow visual viewport resize and scroll, releases overrides on zoom, and detaches on disposal', () => {
  vi.stubGlobal('innerWidth', 390);
  const viewport = Object.assign(new EventTarget(), { height: 780, offsetTop: 0, scale: 1 });
  Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });
  const panel = document.createElement('div');
  const dispose = mountPanelViewport(panel);
  viewport.height = 400;
  viewport.offsetTop = 80;
  viewport.dispatchEvent(new Event('resize'));
  expect(panel.style.height).toBe('400px');
  expect(panel.style.top).toBe('80px');
  viewport.offsetTop = 100;
  viewport.dispatchEvent(new Event('scroll'));
  expect(panel.style.top).toBe('100px');
  viewport.scale = 2;
  viewport.dispatchEvent(new Event('resize'));
  expect(panel.style.height).toBe('');
  expect(panel.style.top).toBe('');
  viewport.scale = 1;
  viewport.dispatchEvent(new Event('resize'));
  expect(panel.style.height).toBe('400px');
  dispose();
  viewport.height = 300;
  viewport.dispatchEvent(new Event('resize'));
  expect(panel.style.height).toBe('');
});
it('keeps desktop layout and browsers without the API on the CSS fallback', () => {
  vi.stubGlobal('innerWidth', 1280);
  Object.defineProperty(window, 'visualViewport', {
    configurable: true,
    value: Object.assign(new EventTarget(), { height: 400, offsetTop: 80, scale: 1 }),
  });
  const panel = document.createElement('div');
  const dispose = mountPanelViewport(panel);
  expect(panel.style.height).toBe('');
  dispose();
  Object.defineProperty(window, 'visualViewport', { configurable: true, value: undefined });
  expect(() => mountPanelViewport(panel)()).not.toThrow();
});
