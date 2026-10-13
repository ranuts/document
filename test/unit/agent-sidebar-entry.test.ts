import { afterEach, expect, it, vi } from 'vitest';
import { createSidebarEntry } from '../../lib/agent-plugin/ui/sidebar-entry';
afterEach(() => {
  document.body.replaceChildren();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function frameMedia(frame: HTMLIFrameElement) {
  const media = new EventTarget() as MediaQueryList;
  Object.defineProperty(media, 'matches', { value: false, writable: true });
  frame.contentWindow!.matchMedia = () => media;
  return (compact: boolean) => {
    Object.defineProperty(media, 'matches', { value: compact });
    media.dispatchEvent(new Event('change'));
  };
}

async function flushMutations() {
  await Promise.resolve();
  await Promise.resolve();
}
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
  iframe.contentWindow!.matchMedia = vi.fn(
    () =>
      ({
        get matches() {
          return compact;
        },
      }) as MediaQueryList,
  );
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
  iframe.contentWindow!.matchMedia = vi.fn(
    () =>
      ({
        get matches() {
          return compact;
        },
      }) as MediaQueryList,
  );
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
  vi.spyOn(doc, 'activeElement', 'get').mockReturnValue(button);
  expect(doc.activeElement).toBe(button);
  const refocus = vi.spyOn(button, 'focus');
  compact = true;
  entry.update(true, true);
  expect(document.activeElement).toBe(composer);
  expect(refocus).not.toHaveBeenCalled();
  entry.dispose();
});

it('uses the left rail when a desktop PDF has no right rail', () => {
  const frame = document.createElement('iframe');
  document.body.append(frame);
  frame.contentDocument!.body.innerHTML = '<div id="left-menu"><div class="tool-menu-btns"></div></div>';
  const entry = createSidebarEntry(
    () => {},
    () => 'AI Assistant',
  );
  entry.update(true, false);
  expect(frame.contentDocument!.querySelector('#left-menu .agent-sidebar-entry')).not.toBeNull();
  entry.dispose();
});

it('mounts when the iframe and its rail arrive after readiness without a timer', async () => {
  vi.useFakeTimers();
  const entry = createSidebarEntry(
    () => {},
    () => 'AI',
  );
  entry.update(true, false);
  expect(vi.getTimerCount()).toBe(0);
  const wrapper = document.createElement('div');
  const frame = document.createElement('iframe');
  wrapper.append(frame);
  document.body.append(wrapper);
  await flushMutations();
  const doc = frame.contentDocument!;
  doc.body.innerHTML = '<div id="right-menu"></div>';
  await flushMutations();
  doc.querySelector('#right-menu')!.innerHTML = '<div class="tool-menu-btns"></div>';
  await flushMutations();
  expect(doc.querySelector('#right-menu .agent-sidebar-entry')).not.toBeNull();
  entry.dispose();
});

it('follows media query crossings while preserving the focused entry', () => {
  const frame = document.createElement('iframe');
  document.body.append(frame);
  const setCompact = frameMedia(frame);
  const doc = frame.contentDocument!;
  doc.body.innerHTML =
    '<div id="right-menu"><div class="tool-menu-btns"></div></div><div id="left-menu"><div class="tool-menu-btns"></div></div>';
  const entry = createSidebarEntry(
    () => {},
    () => 'AI',
  );
  entry.update(true, false);
  const button = doc.querySelector<HTMLButtonElement>('.agent-sidebar-entry')!;
  button.focus();
  setCompact(true);
  expect(doc.querySelector('#left-menu .agent-sidebar-entry')).toBe(button);
  expect(doc.activeElement).toBe(button);
  setCompact(false);
  expect(doc.querySelector('#right-menu .agent-sidebar-entry')).toBe(button);
  expect(doc.activeElement).toBe(button);
  entry.dispose();
});

it('rebinds replaced frames and rails without refreshing for editor text or its own insertion', async () => {
  const frame = document.createElement('iframe');
  document.body.append(frame);
  const doc = frame.contentDocument!;
  doc.body.innerHTML = '<div id="right-menu"><div class="tool-menu-btns"></div></div><div id="editor"></div>';
  const label = vi.fn(() => 'AI');
  const entry = createSidebarEntry(() => {}, label);
  entry.update(true, false);
  const initialCalls = label.mock.calls.length;
  await flushMutations();
  expect(label.mock.calls.length).toBe(initialCalls);
  doc.querySelector('#editor')!.append(doc.createTextNode('typing'));
  document.body.append(document.createElement('textarea'));
  await flushMutations();
  expect(label.mock.calls.length).toBe(initialCalls);
  const rail = doc.createElement('div');
  rail.className = 'tool-menu-btns';
  doc.querySelector('#right-menu .tool-menu-btns')!.replaceWith(rail);
  await flushMutations();
  expect(rail.querySelector('.agent-sidebar-entry')).not.toBeNull();
  const replacement = document.createElement('iframe');
  frame.replaceWith(replacement);
  const replacementDoc = replacement.contentDocument!;
  replacementDoc.body.innerHTML = '<div id="left-menu"><div class="tool-menu-btns"></div></div>';
  await flushMutations();
  expect(replacementDoc.querySelector('.agent-sidebar-entry')).not.toBeNull();
  expect(doc.querySelector('.agent-sidebar-entry')).toBeNull();
  entry.dispose();
});

it('rebinds a frame document on load and ignores late callbacks after disabling or disposal', async () => {
  const frame = document.createElement('iframe');
  document.body.append(frame);
  const oldDoc = frame.contentDocument!;
  oldDoc.body.innerHTML = '<div id="right-menu"><div class="tool-menu-btns"></div></div>';
  const setCompact = frameMedia(frame);
  const entry = createSidebarEntry(
    () => {},
    () => 'AI',
  );
  entry.update(true, false);
  const nextDoc = document.implementation.createHTMLDocument();
  nextDoc.body.innerHTML =
    '<div id="right-menu"><div class="tool-menu-btns"></div></div><div id="left-menu"><div class="tool-menu-btns"></div></div>';
  vi.spyOn(frame, 'contentDocument', 'get').mockReturnValue(nextDoc);
  frame.dispatchEvent(new Event('load'));
  expect(nextDoc.querySelector('.agent-sidebar-entry')).not.toBeNull();
  expect(oldDoc.querySelector('.agent-sidebar-entry')).toBeNull();
  const queuedRail = nextDoc.createElement('div');
  queuedRail.className = 'tool-menu-btns';
  nextDoc.querySelector('#right-menu')!.append(queuedRail);
  entry.update(false, false);
  setCompact(true);
  frame.dispatchEvent(new Event('load'));
  await flushMutations();
  expect(nextDoc.querySelector('.agent-sidebar-entry')).toBeNull();
  entry.update(true, false);
  expect(nextDoc.querySelector('.agent-sidebar-entry')).not.toBeNull();
  nextDoc.querySelector('#left-menu')!.append(queuedRail);
  entry.dispose();
  entry.update(true, false);
  setCompact(false);
  frame.dispatchEvent(new Event('load'));
  await flushMutations();
  expect(nextDoc.querySelector('.agent-sidebar-entry')).toBeNull();
});
