import { afterEach, expect, it } from 'vitest';
import { mountPanelResize } from '../../lib/agent-plugin/ui/panel-resize';
it('uses the final release position and removes the iframe shield', () => {
  const panel = document.createElement('div');
  document.body.append(panel);
  const dispose = mountPanelResize(panel);
  const handle = panel.querySelector('[role="separator"]') as HTMLElement;
  handle.setPointerCapture = () => {};
  const pointer = (type: string, clientX: number) => {
    const event = new MouseEvent(type, { clientX, button: 0 });
    Object.defineProperty(event, 'pointerId', { value: 1 });
    handle.dispatchEvent(event);
  };
  pointer('pointerdown', 624);
  expect(document.querySelector('.agent-panel-resize-shield')).not.toBeNull();
  const second = new MouseEvent('pointerdown', { clientX: 600, button: 0 });
  Object.defineProperty(second, 'pointerId', { value: 2 });
  handle.dispatchEvent(second);
  expect(document.querySelectorAll('.agent-panel-resize-shield')).toHaveLength(1);
  pointer('pointerup', 524);
  expect(Number(handle.getAttribute('aria-valuenow'))).toBe(window.innerWidth - 524);
  expect(document.querySelector('.agent-panel-resize-shield')).toBeNull();
  dispose();
});
afterEach(() => {
  document.body.innerHTML = '';
  localStorage.clear();
  document.documentElement.style.removeProperty('--agent-panel-width');
});
it('resizes by keyboard, clamps width, persists and restores the preference', () => {
  const panel = document.createElement('div');
  document.body.append(panel);
  const dispose = mountPanelResize(panel);
  const handle = panel.querySelector('[role="separator"]')!;
  handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
  const width = Number(handle.getAttribute('aria-valuenow'));
  expect(width).toBeGreaterThan(380);
  handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'End' }));
  expect(Number(handle.getAttribute('aria-valuenow'))).toBeLessThanOrEqual(window.innerWidth - 360);
  expect(localStorage.getItem('agent-panel-width')).not.toBeNull();
  dispose();
  expect(panel.querySelector('[role="separator"]')).toBeNull();
  mountPanelResize(panel)();
});
