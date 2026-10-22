import { afterEach, expect, it, vi } from 'vitest';
import { ChatView } from '../../packages/chat-ui/src/chat-view';
import { renderMarkdown } from '../../packages/chat-ui/src/markdown';
import { MarkdownPresentation } from '../../packages/chat-ui/src/markdown-presentation';
import { StreamingMarkdown } from '../../packages/chat-ui/src/streaming-markdown';
import { highlightCode } from '../../packages/chat-ui/src/markdown-highlight';
vi.mock('../../packages/chat-ui/src/markdown-highlight', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../packages/chat-ui/src/markdown-highlight')>();
  return { ...actual, highlightCode: vi.fn() };
});
const highlight = vi.mocked(highlightCode);
const owners: MarkdownPresentation[] = [];
afterEach(() => {
  for (const owner of owners.splice(0)) owner.dispose();
  document.body.replaceChildren();
  vi.clearAllMocks();
  vi.useRealTimers();
});
function mount(source = '```ts\nconst x = 1;\n```') {
  const target = document.createElement('div');
  document.body.append(target);
  const owner = new MarkdownPresentation(target);
  owners.push(owner);
  renderMarkdown(target, source, owner);
  return { target, owner };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}
const tokens = [
  [{ content: 'const x = 1;', offset: 0, htmlStyle: { '--shiki-light': '#123456', '--shiki-dark': '#abcdef' } }],
];
it('preserves exact code and horizontal scroll when dual-theme token colors arrive', async () => {
  const pending = deferred<Awaited<ReturnType<typeof highlightCode>>>();
  highlight.mockReturnValue(pending.promise);
  const { target } = mount();
  await Promise.resolve();
  const pre = target.querySelector('pre')!;
  pre.scrollLeft = 80;
  pre.scrollTop = 10;
  pending.resolve(tokens);
  await Promise.resolve();
  await Promise.resolve();
  expect(target.querySelector('code')!.textContent).toBe('const x = 1;');
  expect(target.querySelector('.cui-code-token')?.getAttribute('style')).toContain('--cui-token-dark: #abcdef');
  expect([pre.scrollLeft, pre.scrollTop]).toEqual([80, 10]);
});
it.each(['removed', 'replaced', 'disposed', 'selected'] as const)('ignores late highlight when %s', async (mode) => {
  const pending = deferred<Awaited<ReturnType<typeof highlightCode>>>();
  highlight.mockReturnValue(pending.promise);
  const { target, owner } = mount();
  await Promise.resolve();
  const code = target.querySelector('code')!;
  if (mode === 'removed') target.remove();
  if (mode === 'replaced') renderMarkdown(target, 'replacement', owner);
  if (mode === 'disposed') owner.dispose();
  if (mode === 'selected') window.getSelection()!.setBaseAndExtent(code.firstChild!, 0, code.firstChild!, 5);
  pending.resolve(tokens);
  await Promise.resolve();
  await Promise.resolve();
  expect(code.querySelector('.cui-code-token')).toBeNull();
  if (mode === 'selected') {
    expect(window.getSelection()!.toString()).toBe('const');
    window.getSelection()!.removeAllRanges();
  }
});
it('skips unknown, oversized and unfinished fences, including stream completion', async () => {
  highlight.mockResolvedValue(tokens);
  const { target, owner } = mount('```../../unknown\nconst x = 1;\n```');
  await Promise.resolve();
  expect(highlight).not.toHaveBeenCalled();
  renderMarkdown(target, '```ts\n' + 'x'.repeat(8001) + '\n```', owner);
  await Promise.resolve();
  expect(highlight).not.toHaveBeenCalled();
  const stream = new StreamingMarkdown(target, owner);
  stream.update('```ts\nconst x = 1;');
  stream.update('```ts\nconst x = 1;', true);
  await Promise.resolve();
  expect(highlight).not.toHaveBeenCalled();
  expect(target.querySelector('code')?.textContent).toBe('const x = 1;');
});
it.each(['replace', 'dispose'] as const)('ignores clipboard resolution and removes timers after %s', async (mode) => {
  vi.useFakeTimers();
  highlight.mockResolvedValue(tokens);
  const pending = deferred<void>();
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: vi.fn(() => pending.promise) },
  });
  const { target, owner } = mount();
  const button = target.querySelector<HTMLButtonElement>('button')!;
  button.click();
  if (mode === 'replace') renderMarkdown(target, 'replacement', owner);
  else owner.dispose();
  pending.resolve();
  await Promise.resolve();
  expect(button.textContent).not.toContain('Copied');
  expect(vi.getTimerCount()).toBe(0);
});
it('updates labels and feedback in place, keeping focus and selected source', async () => {
  vi.useFakeTimers();
  highlight.mockResolvedValue(tokens);
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
  const { target, owner } = mount('```\nliteral <img src=x>\n```\n\n| A |\n| --- |\n| 1 |');
  const button = target.querySelector<HTMLButtonElement>('button')!;
  button.click();
  await Promise.resolve();
  button.focus();
  const code = target.querySelector('code')!;
  window.getSelection()!.setBaseAndExtent(code.firstChild!, 0, code.firstChild!, 7);
  owner.setLabels({ copy: 'Copiar', copied: 'Copiado', codeBlock: 'Código', table: 'Tabela' });
  expect(target.querySelector('code')).toBe(code);
  expect(document.activeElement).toBe(button);
  expect(window.getSelection()!.toString()).toBe('literal');
  expect(button.textContent).toContain('Copiado');
  expect(target.querySelector('.cui-code-language')!.textContent).toBe('Código');
  expect(target.querySelector('.cui-table')!.getAttribute('aria-label')).toBe('Tabela');
  await vi.advanceTimersByTimeAsync(2000);
  expect(button.textContent).toContain('Copiar');
  owner.dispose();
  expect(vi.getTimerCount()).toBe(0);
  window.getSelection()!.removeAllRanges();
});
it('wires copy and labels for a newly appended Chat answer before its async presentation settles', async () => {
  highlight.mockResolvedValue(tokens);
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  HTMLElement.prototype.scrollTo = vi.fn();
  const view = new ChatView({ onSend() {}, labels: { copy: 'Copiar', copied: 'Copiado' } });
  document.body.append(view.el);
  view.append({ role: 'agent', text: '```ts\nconst x = 1;\n```' });
  await Promise.resolve();
  const copy = view.el.querySelector<HTMLButtonElement>('.cui-code-copy')!;
  copy.click();
  await Promise.resolve();
  expect(writeText).toHaveBeenCalledWith('const x = 1;');
  expect(copy.textContent).toContain('Copiado');
  view.setLabels({ copied: 'Done' });
  expect(copy.textContent).toContain('Done');
  view.dispose();
});
it('keeps an already highlighted closed fence, selection and code scroll across stream completion', async () => {
  highlight.mockResolvedValue(tokens);
  const { target, owner } = mount('');
  const stream = new StreamingMarkdown(target, owner);
  const source = '```ts\nconst x = 1;\n```\n\nAnother paragraph';
  stream.update(source);
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  const code = target.querySelector('code')!;
  const pre = target.querySelector('pre')!;
  pre.scrollLeft = 60;
  expect(code.querySelector('.cui-code-token')).not.toBeNull();
  window.getSelection()!.setBaseAndExtent(code.firstChild!.firstChild!, 0, code.firstChild!.firstChild!, 5);
  stream.update(source + ' grows');
  stream.update(source + ' grows', true);
  expect(target.querySelector('code')).toBe(code);
  expect(pre.scrollLeft).toBe(60);
  expect(window.getSelection()!.toString()).toBe('const');
  expect(highlight).toHaveBeenCalledOnce();
  window.getSelection()!.removeAllRanges();
});
it.each([
  '> ```ts\n> const x = 1;\n> ```\n\nAnother paragraph',
  '- Example\n\n  ```ts\n  const x = 1;\n  ```\n\nAnother paragraph',
])('retains a highlighted nested closed fence at finalization: %s', async (source) => {
  highlight.mockResolvedValue(tokens);
  const { target, owner } = mount('');
  const stream = new StreamingMarkdown(target, owner);
  stream.update(source);
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  const code = target.querySelector('code')!;
  const pre = target.querySelector('pre')!;
  pre.scrollLeft = 60;
  expect(code.querySelector('.cui-code-token')).not.toBeNull();
  window.getSelection()!.setBaseAndExtent(code.firstChild!.firstChild!, 0, code.firstChild!.firstChild!, 5);
  stream.update(source, true);
  expect(target.querySelector('code')).toBe(code);
  expect(pre.scrollLeft).toBe(60);
  expect(window.getSelection()!.toString()).toBe('const');
  expect(highlight).toHaveBeenCalledOnce();
  window.getSelection()!.removeAllRanges();
});

it.each(['resolve', 'reject'] as const)(
  'does not attach delayed clipboard %s feedback to a changed streaming fence',
  async (outcome) => {
    vi.useFakeTimers();
    highlight.mockResolvedValue(tokens);
    let finish!: () => void;
    const writeText = vi.fn(
      () =>
        new Promise<void>((resolve, reject) => {
          finish = () => (outcome === 'resolve' ? resolve() : reject(new Error('denied')));
        }),
    );
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    const { target, owner } = mount('');
    const stream = new StreamingMarkdown(target, owner);
    stream.update('```text\nfirst\n');
    const first = target.querySelector<HTMLButtonElement>('.cui-code-copy')!;
    first.click();
    expect(writeText).toHaveBeenCalledWith('first');
    stream.update('```text\nfirst\n\tsecond\n\n```');
    const current = target.querySelector<HTMLButtonElement>('.cui-code-copy')!;
    expect(current).not.toBe(first);
    finish();
    await Promise.resolve();
    expect(current.dataset.state).toBe('idle');
    expect(current.disabled).toBe(false);
    expect(first.dataset.state).toBe('idle');
    expect(vi.getTimerCount()).toBe(0);
    current.click();
    expect(writeText).toHaveBeenLastCalledWith('first\n\tsecond\n');
    finish();
    await Promise.resolve();
    expect(current.dataset.state).toBe(outcome === 'resolve' ? 'copied' : 'failed');
    expect(vi.getTimerCount()).toBe(1);
  },
);

it.each(['resolve', 'reject'] as const)(
  'keeps clipboard %s feedback with an unchanged fence while the following answer streams',
  async (outcome) => {
    vi.useFakeTimers();
    highlight.mockResolvedValue(tokens);
    let finish!: () => void;
    const writeText = vi.fn(
      () =>
        new Promise<void>((resolve, reject) => {
          finish = () => (outcome === 'resolve' ? resolve() : reject(new Error('denied')));
        }),
    );
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    const { target, owner } = mount('');
    const stream = new StreamingMarkdown(target, owner);
    const source = '```text\n\texact\n\n```\n\nFollowing answer';
    stream.update(source);
    const button = target.querySelector<HTMLButtonElement>('.cui-code-copy')!;
    button.focus();
    button.click();
    stream.update(source + ' continues');
    stream.update(source + ' continues', true);
    expect(target.querySelector('.cui-code-copy')).toBe(button);
    finish();
    await Promise.resolve();
    expect(writeText).toHaveBeenCalledWith('\texact\n');
    expect(button.dataset.state).toBe(outcome === 'resolve' ? 'copied' : 'failed');
    expect(document.activeElement).toBe(button);
    expect(button.disabled).toBe(false);
    await vi.advanceTimersByTimeAsync(2000);
    expect(button.dataset.state).toBe('idle');
    expect(vi.getTimerCount()).toBe(0);
  },
);

it('names keyboard-scrollable code with its language and updates translated names without replacing source', () => {
  highlight.mockResolvedValue(tokens);
  const { target, owner } = mount('```ts\nconst x = 1;\n```\n\n```\nplain\n```');
  const regions = target.querySelectorAll('pre');
  expect(regions[0].getAttribute('role')).toBe('region');
  expect(regions[0].getAttribute('aria-label')).toBe('Code: TypeScript');
  expect(regions[1].getAttribute('aria-label')).toBe('Code');
  regions[0].focus();
  const code = regions[0].querySelector('code')!;
  window.getSelection()!.setBaseAndExtent(code.firstChild!, 0, code.firstChild!, 5);
  owner.setLabels({ codeBlock: 'Código' });
  expect(regions[0].getAttribute('aria-label')).toBe('Código: TypeScript');
  expect(regions[1].getAttribute('aria-label')).toBe('Código');
  expect(document.activeElement).toBe(regions[0]);
  expect(window.getSelection()!.toString()).toBe('const');
  expect(regions[0].querySelector('code')).toBe(code);
  window.getSelection()!.removeAllRanges();
});
