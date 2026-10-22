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

it('temporarily expands without overwriting dock preference and restores it on collapse', () => {
  const original = window.innerWidth;
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1600 });
  localStorage.setItem('agent-panel-width', '504');
  const panel = document.createElement('div');
  const expand = document.createElement('button');
  document.body.append(panel, expand);
  const dispose = mountPanelResize(panel, { expandButton: expand });
  try {
    expand.click();
    expect(expand.getAttribute('aria-expanded')).toBe('true');
    expect(document.documentElement.style.getPropertyValue('--agent-panel-width')).toBe('1040px');
    expect(localStorage.getItem('agent-panel-width')).toBe('504');
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1200 });
    window.dispatchEvent(new Event('resize'));
    expect(document.documentElement.style.getPropertyValue('--agent-panel-width')).toBe('840px');
    expand.click();
    expect(document.documentElement.style.getPropertyValue('--agent-panel-width')).toBe('504px');
    expect(localStorage.getItem('agent-panel-width')).toBe('504');
  } finally {
    dispose();
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: original });
  }
});

it.each([1040, 1200])('does not offer expansion that would shrink or retain a %ipx dock', (preferred) => {
  const original = window.innerWidth;
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1920 });
  localStorage.setItem('agent-panel-width', String(preferred));
  const panel = document.createElement('div');
  const expand = document.createElement('button');
  document.body.append(panel, expand);
  const dispose = mountPanelResize(panel, { expandButton: expand });
  try {
    expect(expand.hidden).toBe(true);
    expect(document.documentElement.style.getPropertyValue('--agent-panel-width')).toBe(`${preferred}px`);
  } finally {
    dispose();
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: original });
  }
});
