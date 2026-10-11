import { beforeEach, expect, it, vi } from 'vitest';
import { historyToTurns } from '../../lib/agent-plugin/ui/storage';
import { ChatView } from '../../packages/chat-ui/src/chat-view';

beforeEach(() => {
  document.body.replaceChildren();
  HTMLElement.prototype.scrollTo = vi.fn();
});
function mount() {
  const onSend = vi.fn();
  const view = new ChatView({
    onSend,
    labels: { copy: 'Copy', copied: 'Copied', restore: 'Restore', waiting: 'Thinking' },
  });
  document.body.append(view.el);
  return { view, onSend, input: view.el.querySelector('textarea')! };
}
it('offers document writes only for explicit artifacts when the host requires them', async () => {
  const apply = vi.fn().mockResolvedValue('verified');
  const view = new ChatView({ onSend: vi.fn(), onApplyMessage: apply, requireDocumentArtifact: true });
  view.append({ role: 'agent', text: 'I will write it into your document.' });
  expect(view.el.querySelector('.cui-apply')).toBeNull();
  view.append({ role: 'agent', text: 'The actual body', documentArtifact: true });
  view.append({ role: 'agent', text: 'What else can I do?' });
  expect(view.getLastDocumentBody()).toBe('The actual body');
  const button = view.el.querySelector<HTMLButtonElement>('.cui-apply')!;
  button.click();
  await vi.waitFor(() => expect(apply).toHaveBeenCalledWith('The actual body'));
});
it('applies the finished streamed answer only on click and prevents duplicate writes', async () => {
  const apply = vi.fn().mockResolvedValue('verified');
  const view = new ChatView({
    onSend: vi.fn(),
    onApplyMessage: apply,
    labels: { applyMessage: 'Write', applied: 'Written' },
  });
  document.body.append(view.el);
  view.appendDelta('First');
  view.appendDelta(' paragraph');
  view.endStream();
  expect(apply).not.toHaveBeenCalled();
  const button = view.el.querySelector<HTMLButtonElement>('.cui-apply')!;
  expect(button).not.toBeNull();
  button.click();
  button.click();
  await vi.waitFor(() => expect(button.textContent).toBe('Written'));
  expect(apply).toHaveBeenCalledExactlyOnceWith('First paragraph');
  expect(button.disabled).toBe(true);
});
it('renders useful Markdown safely and leaves user text literal', () => {
  const { view } = mount();
  view.append({
    role: 'agent',
    text: '**Result**\n\n- First\n- Second\n\n```js\nalert(1)\n```\n\n<img src=x onerror=alert(1)>\n[bad](javascript:alert(1))',
  });
  expect(view.el.querySelector('strong')?.textContent).toBe('Result');
  expect(view.el.querySelectorAll('li')).toHaveLength(2);
  expect(view.el.querySelector('pre code')?.textContent).toContain('alert(1)');
  expect(view.el.querySelector('img,script,a[href^="javascript:"]')).toBeNull();
  view.append({ role: 'user', text: '**literal**' });
  expect(view.el.querySelector('.cui-msg-user strong')).toBeNull();
  expect(view.el.querySelector('.cui-role')).toBeNull();
});
it('shows one execution result directly without a duplicate or empty disclosure', () => {
  const { view } = mount();
  view.append({ role: 'tool', text: 'A1\n12 <script>literal</script>' });
  expect(view.el.querySelector('details')).toBeNull();
  expect(view.el.querySelector('.cui-activity')?.textContent).toBe('A1\n12 <script>literal</script>');
  expect(view.el.querySelector('script')).toBeNull();
});
it.each([
  '<svg onload="window.__chatInjected=1"><a href="javascript:alert(1)">x</a></svg>',
  '<iframe srcdoc="<script>alert(1)</script>"></iframe>',
  '<form action="https://attacker.invalid"><input autofocus onfocus="alert(1)"></form>',
  '<style>body{background:url(https://attacker.invalid/pixel)}</style>',
  '[run](JaVaScRiPt:alert%281%29)',
  '[run](data:text/html;base64,PHNjcmlwdD4=)',
  '[run](vbscript:msgbox%281%29)',
  '[run](//attacker.invalid/path)',
  '[run](/private/path)',
  '![pixel](https://attacker.invalid/pixel)',
  '| Payload |\n| --- |\n| <img src=x onerror=alert(1)> |',
  '> **[run](javascript:alert%281%29)**\n\n- <video src=x onerror=alert(1)>',
])('keeps hostile markup inert in final, streamed and literal messages: %s', (payload) => {
  const { view } = mount();
  view.append({ role: 'agent', text: payload });
  view.append({ role: 'user', text: payload });
  view.append({ role: 'tool', text: payload });
  // Exercise incomplete tokens before the final complete Markdown parse.
  const split = Math.floor(payload.length / 2);
  view.appendDelta(payload.slice(0, split));
  view.appendDelta(payload.slice(split));
  view.endStream();
  expect(
    view.el.querySelector(
      '.cui-bubble :is(script,style,svg,iframe,form,input,img,video,object,embed), .cui-activity :is(script,style,svg,iframe,form,input,img,video,object,embed)',
    ),
  ).toBeNull();
  expect(view.el.querySelector('a')).toBeNull();
  for (const element of view.el.querySelectorAll('*')) {
    expect([...element.attributes].some((attribute) => /^on/i.test(attribute.name))).toBe(false);
  }
  expect(view.el.querySelector('.cui-msg-user')?.textContent).toContain(payload);
  expect(view.el.querySelector('.cui-activity')?.textContent).toContain(payload);
});

it('isolates allowed Markdown links without fetching remote images', () => {
  const { view } = mount();
  view.append({
    role: 'agent',
    text: '[Web](https://example.com/path) [Email](mailto:test@example.com) ![remote](https://example.com/pixel)',
  });
  const links = [...view.el.querySelectorAll('a')];
  expect(links.map((link) => link.href)).toEqual(['https://example.com/path', 'mailto:test@example.com']);
  for (const link of links) {
    expect(link.target).toBe('_blank');
    expect(link.rel).toBe('noopener noreferrer');
  }
  expect(view.el.querySelector('img')).toBeNull();
});

it('groups consecutive execution activities in a collapsed disclosure inside the conversation', () => {
  const { view } = mount();
  view.append({ role: 'tool', text: 'Read selection' });
  view.append({ role: 'tool', text: 'Read document' });
  expect(view.el.querySelectorAll('details.cui-activity')).toHaveLength(1);
  expect(view.el.querySelector('details')?.hasAttribute('open')).toBe(false);
  expect(view.el.querySelectorAll('.cui-activity li')).toHaveLength(1);
  expect(view.el.querySelector('.cui-activity summary')?.textContent).toBe('Read document');
  expect(view.el.querySelector('.cui-activity')?.textContent).toBe('Read documentRead selection');
  view.append({ role: 'tool', text: 'Updated document' });
  expect(view.el.querySelectorAll('.cui-activity li')).toHaveLength(2);
  expect(view.el.querySelector('.cui-activity summary')?.textContent).toBe('Updated document');
  expect([...view.el.querySelectorAll('.cui-activity li')].map((item) => item.textContent)).toEqual([
    'Read selection',
    'Read document',
  ]);
});
it('does not submit Enter during IME composition or legacy composition key events', () => {
  const { input, onSend } = mount();
  input.value = '中文';
  input.dispatchEvent(new CompositionEvent('compositionstart'));
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  expect(onSend).not.toHaveBeenCalled();
  input.dispatchEvent(new CompositionEvent('compositionend'));
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 229, bubbles: true }));
  expect(onSend).not.toHaveBeenCalled();
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  expect(onSend).toHaveBeenCalledWith('中文');
});
it('copies exact message text and reports clipboard failures without executing anything', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  const { view } = mount();
  view.append({ role: 'agent', text: '<b>plain text</b>' });
  const copy = view.el.querySelector<HTMLButtonElement>('.cui-copy')!;
  expect(copy).not.toBeNull();
  copy.click();
  await vi.waitFor(() => expect(copy.textContent).toBe('Copied'));
  expect(writeText).toHaveBeenCalledWith('<b>plain text</b>');
  writeText.mockRejectedValue(new Error('Denied'));
  copy.click();
  await vi.waitFor(() => expect(copy.textContent).toBe('Could not copy'));
});
it('restores failed requests into the draft without sending and preserves an existing draft', () => {
  const { view, input, onSend } = mount();
  view.append({ role: 'user', text: 'Write B2' });
  view.append({ role: 'error', text: 'Failed' });
  const restore = view.el.querySelector<HTMLButtonElement>('.cui-restore')!;
  expect(restore).not.toBeNull();
  view.setInput('My draft');
  expect(restore.disabled).toBe(true);
  view.setInput('');
  restore.click();
  expect(input.value).toBe('Write B2');
  expect(onSend).not.toHaveBeenCalled();
});
it('shows waiting and busy state and clears streaming state when a turn stops', () => {
  const { view } = mount();
  view.setRunning(true);
  expect(view.el.querySelector('.cui-messages')?.getAttribute('aria-busy')).toBe('true');
  expect(view.el.hasAttribute('aria-busy')).toBe(false);
  expect(view.el.querySelector('[role="status"]')?.textContent).toBe('Thinking');
  view.appendDelta('Partial');
  view.setRunning(false);
  expect(view.el.querySelector('.cui-streaming')).toBeNull();
  expect(view.el.querySelector('.cui-messages')?.getAttribute('aria-busy')).toBe('false');
});

it('sends document payload whitespace unchanged while ignoring whitespace-only drafts', () => {
  const { input, onSend } = mount();
  input.value = '  Replace exactly:\n  Alex  \n';
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  expect(onSend).toHaveBeenCalledWith('  Replace exactly:\n  Alex  \n');
  input.value = ' \t\n';
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  expect(onSend).toHaveBeenCalledTimes(1);
});

it('keeps the unnecessary jump-to-latest control hidden and out of keyboard navigation', () => {
  const { view } = mount();
  const jump = view.el.querySelector<HTMLButtonElement>('.cui-scroll-bottom')!;
  expect(jump.hidden).toBe(true);
});

it('offers jump-to-latest while reading earlier messages and hides it again at the bottom', async () => {
  const { view } = mount();
  const messages = view.el.querySelector<HTMLElement>('.cui-messages')!;
  const jump = view.el.querySelector<HTMLButtonElement>('.cui-scroll-bottom')!;
  view.append({ role: 'agent', text: 'Earlier reply' });
  Object.defineProperties(messages, { scrollHeight: { value: 1000 }, clientHeight: { value: 200 } });
  messages.scrollTop = 0;
  messages.dispatchEvent(new Event('scroll'));
  await vi.waitFor(() => expect(jump.hidden).toBe(false));
  vi.mocked(messages.scrollTo).mockClear();
  view.appendDelta('A new reply while reading earlier messages');
  expect(messages.scrollTo).not.toHaveBeenCalled();
  expect(jump.hidden).toBe(false);
  jump.focus();
  messages.scrollTop = 800;
  messages.dispatchEvent(new Event('scroll'));
  await vi.waitFor(() => expect(jump.hidden).toBe(true));
  expect(document.activeElement).toBe(messages);
});

it('returns the jump control to its hidden state when the conversation is cleared', async () => {
  const { view } = mount();
  const messages = view.el.querySelector<HTMLElement>('.cui-messages')!;
  const jump = view.el.querySelector<HTMLButtonElement>('.cui-scroll-bottom')!;
  view.append({ role: 'agent', text: 'Earlier reply' });
  // The welcome content can itself overflow a short viewport.
  Object.defineProperties(messages, { scrollHeight: { value: 1000 }, clientHeight: { value: 200 } });
  messages.dispatchEvent(new Event('scroll'));
  await vi.waitFor(() => expect(jump.hidden).toBe(false));
  view.clear();
  expect(jump.hidden).toBe(true);
});

it('keeps a stopped status out of document answers while allowing the request to be restored', () => {
  const { view, input, onSend } = mount();
  view.append({ role: 'user', text: 'Original request' });
  view.append({ role: 'agent', text: 'Partial answer' });
  view.append({ role: 'status', text: 'Stopped.' });
  expect(view.getLastAnswer()).toBe('Partial answer');
  expect(view.el.querySelector('.cui-msg-error')).toBeNull();
  expect(view.el.querySelector('.cui-msg-status .cui-apply')).toBeNull();
  const restore = view.el.querySelector<HTMLButtonElement>('.cui-msg-status .cui-restore')!;
  restore.click();
  expect(input.value).toBe('Original request');
  expect(onSend).not.toHaveBeenCalled();
  view.setInput('New draft');
  expect(restore.disabled).toBe(true);
});

it('keeps drafts editable while sending is unavailable and never queues them for later', () => {
  let available = false;
  const onSend = vi.fn();
  const view = new ChatView({ onSend, canSend: () => available });
  document.body.append(view.el);
  view.setInput('My pending request');
  const input = view.el.querySelector<HTMLTextAreaElement>('.cui-input')!;
  const send = view.el.querySelector<HTMLButtonElement>('.cui-send')!;
  expect(input.disabled).toBe(false);
  expect(send.disabled).toBe(true);
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  expect(view.getInput()).toBe('My pending request');
  expect(onSend).not.toHaveBeenCalled();
  available = true;
  view.refreshSendAvailability();
  expect(send.disabled).toBe(false);
  expect(onSend).not.toHaveBeenCalled();
  send.click();
  expect(onSend).toHaveBeenCalledExactlyOnceWith('My pending request');
  view.setRunning(true);
  available = false;
  view.refreshSendAvailability();
  expect(send.disabled).toBe(false);
});

it.each([true, false])(
  'final Markdown follows the bottom only when already reading the latest reply: %s',
  (atBottom) => {
    const { view } = mount();
    const messages = view.el.querySelector<HTMLElement>('.cui-messages')!;
    view.appendDelta('**Final reply**');
    Object.defineProperties(messages, { scrollHeight: { value: 1000 }, clientHeight: { value: 200 } });
    messages.scrollTop = atBottom ? 800 : 100;
    vi.mocked(messages.scrollTo).mockClear();
    view.endStream();
    expect(view.el.querySelector('.cui-bubble strong')?.textContent).toBe('Final reply');
    if (atBottom) expect(messages.scrollTo).toHaveBeenCalledWith({ top: 1000, behavior: 'auto' });
    else expect(messages.scrollTo).not.toHaveBeenCalled();
  },
);

it.each([true, false])('jump-to-latest respects reduced motion: %s', (reduced) => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: reduced })),
  );
  try {
    const { view } = mount();
    const messages = view.el.querySelector<HTMLElement>('.cui-messages')!;
    Object.defineProperties(messages, { scrollHeight: { value: 1000 }, clientHeight: { value: 200 } });
    messages.scrollTop = 0;
    view.el.querySelector<HTMLButtonElement>('.cui-scroll-bottom')!.click();
    expect(window.matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
    expect(messages.scrollTo).toHaveBeenCalledWith({ top: 1000, behavior: reduced ? 'auto' : 'smooth' });
  } finally {
    vi.unstubAllGlobals();
  }
});

it('exposes a named conversation log and keeps streamed updates busy until completion', () => {
  const view = new ChatView({ onSend: vi.fn(), labels: { conversation: 'AI 对话' } });
  document.body.append(view.el);
  const log = view.el.querySelector('[role="log"]')!;
  expect(log).not.toBeNull();
  expect(log.getAttribute('aria-label')).toBe('AI 对话');
  expect(log.getAttribute('aria-busy')).toBe('false');
  view.setRunning(true);
  view.appendDelta('回答');
  expect(log.getAttribute('aria-busy')).toBe('true');
  view.endStream();
  view.setRunning(false);
  expect(log.getAttribute('aria-busy')).toBe('false');
  view.setLabels({ conversation: 'Conversation' });
  expect(log.getAttribute('aria-label')).toBe('Conversation');
});

it('finishes streamed Markdown before releasing the conversation busy state', () => {
  const { view } = mount();
  view.setRunning(true);
  view.appendDelta('**Final answer**');
  const log = view.el.querySelector<HTMLElement>('[role="log"]')!;
  const original = log.setAttribute.bind(log);
  const release = vi.spyOn(log, 'setAttribute');
  let contentAtRelease = '';
  let streamingAtRelease = true;
  release.mockImplementation((name, value) => {
    if (name === 'aria-busy' && value === 'false') {
      contentAtRelease = log.querySelector('strong')?.textContent ?? '';
      streamingAtRelease = !!log.querySelector('.cui-streaming');
    }
    original(name, value);
  });
  view.setRunning(false);
  expect(contentAtRelease).toBe('Final answer');
  expect(streamingAtRelease).toBe(false);
  expect(log.getAttribute('aria-busy')).toBe('false');
});

it('keeps interrupted streamed text readable but excludes it from writing and the last completed answer', () => {
  const view = new ChatView({ onSend: vi.fn(), onApplyMessage: vi.fn() });
  view.append({ role: 'agent', text: 'completed answer' });
  view.setRunning(true);
  view.appendDelta('unfinished fragment');
  view.append({ role: 'status', text: 'Stopped.' });
  view.setRunning(false);
  expect(view.getLastAnswer()).toBe('completed answer');
  const partial = view.el.querySelector('[data-interrupted]')!;
  expect(partial.textContent).toContain('unfinished fragment');
  expect(partial.querySelector('.cui-copy')).not.toBeNull();
  expect(partial.querySelector('.cui-apply')).toBeNull();
});

it('does not offer a restored interrupted answer for insertion', () => {
  const view = new ChatView({ onSend: vi.fn(), onApplyMessage: vi.fn() });
  view.append({ role: 'agent', text: 'restored fragment', interrupted: true });
  expect(view.getLastAnswer()).toBe('');
  expect(view.el.querySelector('.cui-apply')).toBeNull();
  expect(view.el.querySelector('.cui-copy')).not.toBeNull();
});

it('preserves interrupted block-array protection through history restoration into the view', () => {
  const view = new ChatView({ onSend: vi.fn(), onApplyMessage: vi.fn() });
  for (const turn of historyToTurns([
    { role: 'assistant', interrupted: true, content: [{ type: 'text', text: 'imported partial' }] },
  ]))
    view.append(turn);
  expect(view.getLastAnswer()).toBe('');
  expect(view.el.querySelector('.cui-apply')).toBeNull();
  expect(view.el.querySelector('.cui-copy')).not.toBeNull();
});
