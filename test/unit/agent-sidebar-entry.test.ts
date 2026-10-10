import { afterEach, expect, it, vi } from 'vitest';
import { createSidebarEntry } from '../../lib/agent-plugin/ui/sidebar-entry';
afterEach(() => {
  document.body.replaceChildren();
  vi.useRealTimers();
});
it('only mounts a native rail entry when ready and removes it when unavailable', () => {
  const iframe = document.createElement('iframe');
  iframe.name = 'frameEditor';
  document.body.append(iframe);
  const doc = iframe.contentDocument!;
  doc.body.innerHTML =
    '<div id="right-menu"><div class="tool-menu-btns"><button class="btn-category">existing</button></div></div>';
  const toggle = vi.fn();
  const entry = createSidebarEntry(toggle, () => 'AI Assistant');
  entry.update(false, false);
  expect(doc.querySelector('.agent-sidebar-entry')).toBeNull();
  entry.update(true, false);
  const button = doc.querySelector<HTMLButtonElement>('.agent-sidebar-entry')!;
  button.click();
  expect(toggle).toHaveBeenCalledOnce();
  entry.update(false, false);
  expect(doc.querySelector('.agent-sidebar-entry')).toBeNull();
  entry.dispose();
});
it('moves the same entry to the left rail in compact layouts and restores it on widening', () => {
  const iframe = document.createElement('iframe');
  document.body.append(iframe);
  const doc = iframe.contentDocument!;
  doc.body.innerHTML =
    '<div id="right-menu"><div class="tool-menu-btns"></div></div><div id="left-menu"><div class="tool-menu-btns"></div></div>';
  let compact = false;
  iframe.contentWindow!.matchMedia = vi.fn(() => ({ matches: compact }) as MediaQueryList);
  const toggle = vi.fn();
  const entry = createSidebarEntry(toggle, () => 'AI Assistant');
  entry.update(true, false);
  const button = doc.querySelector<HTMLButtonElement>('.agent-sidebar-entry')!;
  expect(button.closest('#right-menu')).not.toBeNull();
  button.focus();
  compact = true;
  entry.update(true, true);
  expect(doc.activeElement).toBe(button);
  expect(doc.querySelectorAll('.agent-sidebar-entry')).toHaveLength(1);
  expect(doc.querySelector('#left-menu .agent-sidebar-entry')).toBe(button);
  expect(button.getAttribute('aria-pressed')).toBe('true');
  button.click();
  expect(toggle).toHaveBeenCalledOnce();
  compact = false;
  entry.update(true, false);
  expect(doc.querySelector('#right-menu .agent-sidebar-entry')).toBe(button);
  entry.dispose();
  expect(doc.querySelector('.agent-sidebar-entry')).toBeNull();
});

it('does not steal parent composer focus when moving an inactive remembered rail button', () => {
  const iframe = document.createElement('iframe');
  document.body.append(iframe);
  let compact = false;
  iframe.contentWindow!.matchMedia = vi.fn(() => ({ matches: compact }) as MediaQueryList);
  const doc = iframe.contentDocument!;
  doc.body.innerHTML =
    '<div id="right-menu"><div class="tool-menu-btns"></div></div><div id="left-menu"><div class="tool-menu-btns"></div></div>';
  const entry = createSidebarEntry(
    () => {},
    () => 'AI',
  );
  entry.update(true, true);
  const button = doc.querySelector<HTMLButtonElement>('.agent-sidebar-entry')!;
  button.focus();
  const composer = document.createElement('textarea');
  document.body.append(composer);
  composer.focus();
  // jsdom reports only the iframe's remembered activeElement; model browser focus ownership.
  vi.spyOn(doc, 'hasFocus').mockReturnValue(false);
  expect(doc.activeElement).toBe(button);
  const refocus = vi.spyOn(button, 'focus');
  compact = true;
  entry.update(true, true);
  expect(document.activeElement).toBe(composer);
  expect(refocus).not.toHaveBeenCalled();
  entry.dispose();
});
