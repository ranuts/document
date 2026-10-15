import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Lexer } from 'marked';
import { ChatView } from '../../packages/chat-ui/src/chat-view';
import { renderMarkdown } from '../../packages/chat-ui/src/markdown';
import { CHAT_UI_CSS } from '../../packages/chat-ui/src/styles';
let frames: FrameRequestCallback[];
let view: ChatView;
beforeEach(() => {
  vi.useFakeTimers();
  frames = [];
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => frames.push(callback));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  HTMLElement.prototype.scrollTo = vi.fn();
});
afterEach(() => {
  view?.dispose();
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
function mount() {
  view = new ChatView({ onSend: vi.fn(), streamingMarkdown: true });
  document.body.append(view.el);
  view.setRunning(true);
  return view;
}
function flush() {
  frames.splice(0).forEach((frame) => frame(16));
}
function bubble() {
  return view.el.querySelector<HTMLElement>('.cui-msg-agent .cui-bubble')!;
}
it('omits the extra inline caret for formatted block streams while retaining the legacy caret', () => {
  mount();
  view.appendDelta(
    '**Stable heading**\n\nOne soft\nline\n\nThird block grows\n\n```ts\nconst value = 1\n```\n\n[Visit](https://example.com)',
  );
  flush();
  const style = document.createElement('style');
  style.textContent = CHAT_UI_CSS;
  document.head.append(style);
  const caretSelectors = Array.from(style.sheet!.cssRules)
    .filter((rule): rule is CSSStyleRule => rule instanceof CSSStyleRule && Boolean(rule.style.content))
    .flatMap((rule) => rule.selectorText.split(','))
    .filter((selector) => selector.includes('.cui-bubble::after'))
    .map((selector) => selector.replace('::after', ''));
  expect(caretSelectors.length).toBeGreaterThan(0);
  expect(caretSelectors.some((selector) => bubble().matches(selector))).toBe(false);
  view.el.querySelector('.cui-streaming-markdown')!.classList.remove('cui-streaming-markdown');
  expect(caretSelectors.some((selector) => bubble().matches(selector))).toBe(true);
  style.remove();
});
it('formats the first frame and preserves completed block nodes and selection while a later block grows', () => {
  mount();
  view.appendDelta('**First block**\n\nSecond block\n\nThird block');
  flush();
  const strong = bubble().querySelector('strong')!;
  expect(strong?.textContent).toBe('First block');
  const selection = window.getSelection()!;
  selection.setBaseAndExtent(strong.firstChild!, 0, strong.firstChild!, 5);
  view.appendDelta(' grows');
  flush();
  expect(bubble().querySelector('strong')).toBe(strong);
  expect(selection.anchorNode).toBe(strong.firstChild);
  expect(selection.toString()).toBe('First');
  expect(bubble().textContent).toContain('Third block grows');
  view.endStream();
  expect(bubble().querySelector('strong')).toBe(strong);
});
it('renders an open fence progressively and keeps incomplete and unsafe links inert', () => {
  mount();
  view.appendDelta('```ts\nconst value = 1');
  flush();
  expect(bubble().querySelector('pre code')?.textContent).toBe('const value = 1');
  view.appendDelta('\n```\n\n[Visit](https://exampl');
  flush();
  expect(bubble().querySelector('a')).toBeNull();
  view.appendDelta('e.com) and [bad](javascript:alert(1))');
  flush();
  expect(bubble().querySelectorAll('a')).toHaveLength(1);
  expect(bubble().querySelector('a')?.href).toBe('https://example.com/');
});
const fixtures = [
  '- first\n\n- second\n\n  continuation\n\n# Next\n\nTail',
  'Setext title\n\n===\n\nordinary\n---\n\nTail',
  'a | b\n--- | ---\n1 | **2**\n\nAfter table',
  '[Earlier][target]\n\nMiddle\n\n[target]: https://example.com\n\nTail',
  '[Earlier][target]\n\nMiddle\n\n> [target]: https://example.com\n\nTail',
  '[Earlier][target]\n\nMiddle\n\n- item\n\n  [target]: https://example.com\n\nTail',
  '# Heading\r\n\r\nEscaped \\*text\\* and `code`\r\n\r\n```js\r\nvalue\r\n```',
  '<script>alert(1)</script>\n\n![remote](https://example.com/image.png)\n\n[mail](mailto:hello@example.com)',
];
it.each(fixtures)('matches ordinary final rendering across arbitrary chunk boundaries: %s', (source) => {
  for (const width of [1, 2, 7, source.length]) {
    view?.dispose();
    document.body.replaceChildren();
    mount();
    for (let start = 0; start < source.length; start += width) {
      view.appendDelta(source.slice(start, start + width));
      flush();
    }
    view.endStream();
    const expected = document.createElement('div');
    renderMarkdown(expected, source);
    expect(bubble().innerHTML).toBe(expected.innerHTML);
    expect(view.el.querySelector<HTMLElement>('.cui-msg-agent')!.dataset.source).toBe(source);
    expect(bubble().querySelector('script,img')).toBeNull();
  }
});
it.each(['complete', 'interrupt'] as const)(
  'caps every lexer input for a huge open tail on %s while preserving the formatted prefix',
  async (ending) => {
    mount();
    view.appendDelta('**Stable**\n\nSecond\n\nThird\n\n```\nstart');
    flush();
    const stable = bubble().querySelector('strong');
    expect(stable).not.toBeNull();
    const lex = vi.spyOn(Lexer, 'lex');
    const raw = 'x'.repeat(24000);
    view.appendDelta(raw);
    flush();
    expect(bubble().querySelector('strong')).toBe(stable);
    expect(bubble().textContent).toContain(raw);
    if (ending === 'complete') view.endStream();
    else {
      view.requestStop();
      flush();
      await vi.runOnlyPendingTimersAsync();
    }
    expect(lex.mock.calls.every(([text]) => text.length <= 8000)).toBe(true);
    expect(bubble().querySelector('strong')).toBe(stable);
    expect(view.el.querySelector<HTMLElement>('.cui-msg-agent')!.dataset.source).toContain(raw);
  },
);
it('acknowledges Stop without lexing even when pending Markdown has not reached a frame', async () => {
  const stop = vi.fn();
  view = new ChatView({ onSend: vi.fn(), onStop: stop, streamingMarkdown: true });
  document.body.append(view.el);
  view.setRunning(true);
  const source = '**Partial**\n'.repeat(10000);
  view.appendDelta(source, { documentArtifact: true });
  view.setInput('Next draft');
  view.focus();
  const input = view.el.querySelector('textarea')!;
  input.setSelectionRange(2, 6);
  const lex = vi.spyOn(Lexer, 'lex');
  view.requestStop();
  expect(stop).toHaveBeenCalledOnce();
  expect(lex).not.toHaveBeenCalled();
  expect(view.el.querySelector<HTMLElement>('[data-interrupted]')!.dataset.source).toBe(source);
  expect(view.el.querySelector('.cui-apply')).toBeNull();
  expect(view.getLastDocumentBody()).toBe('');
  expect([input.selectionStart, input.selectionEnd]).toEqual([2, 6]);
  expect(document.activeElement).toBe(input);
  view.appendDelta('late');
  view.endStream();
  flush();
  await vi.runOnlyPendingTimersAsync();
  expect(lex.mock.calls.every(([text]) => text.length <= 8000)).toBe(true);
  expect(bubble().textContent).toBe(source);
});
it('does not stabilize a single CRLF as if it were a blank line', () => {
  mount();
  const source = 'First\r\n# Second\r\n# Third';
  view.appendDelta(source);
  flush();
  const lex = vi.spyOn(Lexer, 'lex');
  view.appendDelta(' grows');
  flush();
  expect(lex).toHaveBeenCalledWith(source + ' grows');
});
it.each(['complete', 'interrupt'] as const)(
  'keeps an oversized whole-reference fallback exact and raw on %s',
  async (ending) => {
    mount();
    const prefix = '[Earlier][id]\n\nSecond\n\nThird\n\n';
    view.appendDelta(prefix);
    flush();
    const lex = vi.spyOn(Lexer, 'lex');
    const suffix = '> [id]: https://example.com\n\n' + 'Exact raw\n'.repeat(2000);
    view.appendDelta(suffix);
    flush();
    if (ending === 'complete') view.endStream();
    else {
      view.requestStop();
      flush();
      await vi.runOnlyPendingTimersAsync();
    }
    expect(lex.mock.calls.every(([text]) => text.length <= 8000)).toBe(true);
    expect(bubble().textContent).toBe(prefix + suffix);
    expect(bubble().querySelector('a')).toBeNull();
  },
);
it('treats a multiline reference candidate across an oversized raw tail conservatively', () => {
  mount();
  const prefix = '[Earlier][two words]\n\nSecond\n\nThird\n\n';
  view.appendDelta(prefix);
  flush();
  const suffix = 'x'.repeat(9000) + '\n\n[two\nwords]: https://example.com';
  view.appendDelta(suffix);
  flush();
  view.endStream();
  expect(bubble().textContent).toBe(prefix + suffix);
});
it.each(['clear', 'dispose'] as const)(
  'drops formatting callbacks owned by an old interrupted stream on %s',
  async (action) => {
    mount();
    view.appendDelta('**old**');
    view.requestStop();
    const lex = vi.spyOn(Lexer, 'lex');
    view[action]();
    flush();
    await vi.runOnlyPendingTimersAsync();
    expect(lex).not.toHaveBeenCalled();
  },
);
it('formats only the captured interrupted row when a new stream has begun', async () => {
  mount();
  view.appendDelta('**old**');
  view.requestStop();
  const old = bubble();
  view.setRunning(false);
  view.setRunning(true);
  view.appendDelta('**new**');
  flush();
  await vi.runOnlyPendingTimersAsync();
  expect(old.querySelector('strong')?.textContent).toBe('old');
  expect(view.el.querySelector('.cui-streaming strong')?.textContent).toBe('new');
});
it('falls back to accurate raw tail after a lexer failure and recovers on the next update', () => {
  mount();
  view.appendDelta('**Stable**\n\nSecond\n\nThird');
  flush();
  vi.spyOn(Lexer, 'lex').mockImplementationOnce(() => {
    throw new Error('Parser unavailable');
  });
  view.appendDelta(' **partial');
  flush();
  expect(bubble().textContent).toContain('Third **partial');
  view.appendDelta('**');
  flush();
  view.endStream();
  expect(bubble().querySelector('strong')?.textContent).toBe('Stable');
  expect(bubble().querySelectorAll('strong')).toHaveLength(2);
});
it('caps automatic finished-message rendering in opted-in hosts and preserves raw line wrapping', () => {
  mount();
  const source = 'plain line\n'.repeat(1000);
  const lex = vi.spyOn(Lexer, 'lex');
  view.appendMany([{ role: 'agent', text: source }]);
  expect(lex).not.toHaveBeenCalled();
  const last = view.el.querySelector<HTMLElement>('.cui-msg-agent .cui-bubble')!;
  expect(last.textContent).toBe(source);
  expect(getComputedStyle(last).whiteSpace).toBe('pre-wrap');
});
it.each(fixtures.slice(0, 3).concat(fixtures[6]))(
  'keeps bounded provisional block semantics across every split: %s',
  (source) => {
    mount();
    let current = '';
    for (const char of source) {
      current += char;
      view.appendDelta(char);
      flush();
      const expected = document.createElement('div');
      renderMarkdown(expected, current);
      expect(bubble().innerHTML).toBe(expected.innerHTML);
    }
  },
);
it('keeps accurate raw source if first-bubble parsing or settled parsing fails', () => {
  mount();
  vi.spyOn(Lexer, 'lex').mockImplementationOnce(() => {
    throw new Error('Unavailable');
  });
  expect(() => view.appendDelta('**content**')).not.toThrow();
  flush();
  vi.mocked(Lexer.lex).mockImplementationOnce(() => {
    throw new Error('Unavailable');
  });
  view.endStream();
  expect(bubble().textContent).toBe('**content**');
});
it('preserves the reader position and a completed table scroll position without token animations', () => {
  mount();
  view.append({ role: 'user', text: 'Original request' });
  const messages = view.el.querySelector<HTMLElement>('.cui-messages')!;
  Object.defineProperty(messages, 'scrollHeight', { configurable: true, get: () => 1200 });
  Object.defineProperty(messages, 'clientHeight', { configurable: true, get: () => 200 });
  messages.scrollTop = 100;
  messages.dispatchEvent(new Event('scroll'));
  vi.advanceTimersByTime(200);
  view.appendDelta('a | b\n--- | ---\n1 | 2\n\nSecond\n\nThird');
  flush();
  const table = bubble().querySelector<HTMLElement>('.cui-table')!;
  table.scrollLeft = 40;
  vi.mocked(messages.scrollTo).mockClear();
  view.appendDelta(' grows');
  flush();
  view.endStream();
  expect(bubble().querySelector('.cui-table')).toBe(table);
  expect(table.scrollLeft).toBe(40);
  expect(messages.scrollTop).toBe(100);
  expect(messages.scrollTo).not.toHaveBeenCalled();
  expect(bubble().querySelector('[style*=animation]')).toBeNull();
});
it('appends an oversized raw tail without replacing its text node or shortening full copy/apply source', async () => {
  const clipboard = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: clipboard } });
  const apply = vi.fn().mockResolvedValue('verified');
  view = new ChatView({ onSend: vi.fn(), onApplyMessage: apply, streamingMarkdown: true });
  document.body.append(view.el);
  const first = 'x'.repeat(9000);
  view.appendDelta(first, { documentArtifact: true });
  flush();
  const node = bubble().querySelector('.cui-stream-raw')!.firstChild;
  view.appendDelta('\nlast line');
  flush();
  expect(bubble().querySelector('.cui-stream-raw')!.firstChild).toBe(node);
  view.endStream();
  view.el.querySelector<HTMLButtonElement>('.cui-copy')!.click();
  view.el.querySelector<HTMLButtonElement>('.cui-apply')!.click();
  await Promise.resolve();
  expect(clipboard).toHaveBeenCalledWith(first + '\nlast line');
  expect(apply).toHaveBeenCalledWith(first + '\nlast line');
});
it('uses Markdown whitespace during opted-in streams and preserves legacy plain-stream whitespace', () => {
  mount();
  view.appendDelta('First soft\nline');
  flush();
  expect(getComputedStyle(bubble()).whiteSpace).toBe('normal');
  const before = bubble().innerHTML;
  view.endStream();
  expect(bubble().innerHTML).toBe(before);
  expect(getComputedStyle(bubble()).whiteSpace).toBe('normal');
  view.dispose();
  document.body.replaceChildren();
  view = new ChatView({ onSend: vi.fn() });
  document.body.append(view.el);
  view.appendDelta('Legacy soft\nline');
  flush();
  expect(getComputedStyle(bubble()).whiteSpace).toBe('pre-wrap');
});
it('coalesces token deltas into the first frame without a debounce or reparsing an unchanged layout frame', () => {
  mount();
  view.appendDelta('**First');
  const lex = vi.spyOn(Lexer, 'lex');
  view.appendDelta(' formatted');
  view.appendDelta(' text**');
  expect(lex).not.toHaveBeenCalled();
  flush();
  expect(lex).toHaveBeenCalledTimes(1);
  expect(bubble().querySelector('strong')?.textContent).toBe('First formatted text');
  view.setInput('Resize composer');
  flush();
  expect(lex).toHaveBeenCalledTimes(1);
});
it('keeps many completed blocks formatted without lexing an uncapped whole reply at completion', () => {
  mount();
  const lex = vi.spyOn(Lexer, 'lex');
  const lines = Array.from(
    { length: 250 },
    (_, index) => `Paragraph ${index} with **formatted** content and text.\n\n`,
  );
  const source = lines.join('');
  for (const line of lines) {
    view.appendDelta(line);
    flush();
  }
  view.endStream();
  expect(bubble().querySelectorAll('p')).toHaveLength(250);
  expect(view.el.querySelector<HTMLElement>('.cui-msg-agent')!.dataset.source).toBe(source);
  expect(lex.mock.calls.every(([text]) => text.length <= 8000)).toBe(true);
});
it('settles bare links normally within the cap and deliberately keeps oversized frozen bare URLs inert', () => {
  mount();
  view.appendDelta('https://example.com');
  flush();
  expect(bubble().querySelector('a')).toBeNull();
  view.endStream();
  expect(bubble().querySelector('a')?.href).toBe('https://example.com/');
  view.clear();
  view.appendDelta('https://example.com\n\nSecond\n\nThird\n\nTail');
  flush();
  view.appendDelta('x'.repeat(9000));
  flush();
  view.endStream();
  expect(bubble().querySelector('a')).toBeNull();
  expect(bubble().textContent).toContain('https://example.com');
});
it('keeps a reference link inert while its definition URL can still grow', () => {
  mount();
  view.appendDelta('[Earlier][id]\n\n[id]: https://exampl');
  flush();
  expect(bubble().querySelector('a')).toBeNull();
  view.appendDelta('e.com\n');
  flush();
  expect(bubble().querySelector('a')).toBeNull();
  view.endStream();
  expect(bubble().querySelector('a')?.href).toBe('https://example.com/');
});
