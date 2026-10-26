import 'ranui/button';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

vi.mock('../../lib/prefetch', () => ({ prefetchOnIntent: vi.fn() }));
vi.mock('../../lib/document', () => ({ onCreateNew: vi.fn(), onOpenDocument: vi.fn() }));
vi.mock('../../lib/loading', () => ({ showLoading: () => ({ removeLoading: vi.fn() }) }));
vi.mock('@ranuts/shared/i18n', () => ({ t: (key: string) => key }));

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  document.body.replaceChildren();
  document.body.className = '';
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  document.body.replaceChildren();
});

it('restores the editor opening controls without activating a missing landing hero', async () => {
  const ui = await import('../../lib/ui');
  document.body.classList.add('opening-document');
  ui.hideControlPanel();
  vi.advanceTimersByTime(300);
  ui.showControlPanel();
  vi.advanceTimersByTime(10);
  const panel = document.getElementById('control-panel-container')!;
  expect(document.body.classList.contains('landing-active')).toBe(false);
  expect(document.body.classList.contains('opening-document')).toBe(false);
  expect(panel.style.display).toBe('flex');
  expect(panel.style.opacity).toBe('1');
  expect(panel.inert).toBe(false);
  expect(panel.style.pointerEvents).not.toBe('none');
  expect(document.activeElement).toBe(document.getElementById('upload-button'));
});

it('does not let an earlier hide timer hide controls after a quick open failure', async () => {
  const ui = await import('../../lib/ui');
  ui.hideControlPanel();
  vi.advanceTimersByTime(100);
  ui.showControlPanel();
  vi.advanceTimersByTime(300);
  expect(document.getElementById('control-panel-container')!.style.display).toBe('flex');
});

it('keeps hidden controls inert and ignores a superseded show transition', async () => {
  const ui = await import('../../lib/ui');
  ui.showControlPanel();
  ui.hideControlPanel();
  vi.advanceTimersByTime(20);
  const panel = document.getElementById('control-panel-container')!;
  expect(panel.style.opacity).toBe('0');
  expect(panel.inert).toBe(true);
  vi.advanceTimersByTime(300);
  expect(panel.style.display).toBe('none');
});

it('restores a real landing hero without exposing or focusing duplicate controls', async () => {
  const hero = document.createElement('main');
  hero.id = 'landing-hero';
  document.body.append(hero);
  const ui = await import('../../lib/ui');
  ui.hideControlPanel();
  ui.showControlPanel();
  vi.advanceTimersByTime(400);
  expect(document.body.classList.contains('landing-active')).toBe(true);
  expect(hero.style.display).toBe('');
  expect(document.getElementById('control-panel-container')!.inert).toBe(true);
  expect(document.activeElement).not.toBe(document.getElementById('upload-button'));
});
