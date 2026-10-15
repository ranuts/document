import { LanguageCode, setLanguage } from '@ranuts/shared/i18n';
import { afterEach, expect, it, vi } from 'vitest';
import { createTaskEntry } from '../../lib/agent-plugin/ui/task-entry';
import type { ComposerContext } from '../../lib/agent-plugin/ui/composer-context';
import type { DocumentToolTarget } from '../../lib/agent-plugin/document-tool-action';
let context: ComposerContext;
let draft = '';
let session = 'one';
let current = true;
let readonly = false;
const focus = vi.fn();
const capture = vi.fn(() => context);
function entry() {
  context = { context: { kind: 'word', selectionCharacters: 6 }, text: 'source', truncated: false };
  const instance = createTaskEntry({
    getInput: () => draft,
    setInput: (text) => {
      draft = text;
    },
    focus,
    session: () => session,
    readonly: () => readonly,
    capture,
    captureTarget: () => ({ isCurrent: () => current }) as DocumentToolTarget,
    onStage: vi.fn(),
  });
  document.body.append(instance.el);
  instance.update(context);
  return instance;
}
afterEach(() => {
  document.body.replaceChildren();
  draft = '';
  session = 'one';
  current = true;
  readonly = false;
  focus.mockClear();
  capture.mockClear();
  setLanguage(LanguageCode.EN);
});
it('stages a host-selected task without sending and consumes it only once', () => {
  const task = entry();
  task.el.querySelector<HTMLButtonElement>('[data-task="polish"]')!.click();
  expect(draft).toContain('Polish');
  expect(focus).toHaveBeenCalledOnce();
  expect(task.check(draft)).toBe(true);
  expect(task.consume(draft)?.task).toBe('rewrite');
  expect(task.consume(draft)).toBeNull();
});
it('preserves an existing user draft', () => {
  const task = entry();
  draft = 'my work';
  task.el.querySelector<HTMLButtonElement>('[data-task="polish"]')!.click();
  expect(draft).toBe('my work');
  expect(task.consume(draft)).toBeNull();
});
it('edited requests lose host intent even when changed back', () => {
  const task = entry();
  task.el.querySelector<HTMLButtonElement>('[data-task="summarize"]')!.click();
  const original = draft;
  task.inputChanged(`${draft} differently`);
  expect(task.consume(original)).toBeNull();
});
it.each(['session', 'target', 'text', 'readonly'])('refuses stale %s and preserves staged text', (cause) => {
  const task = entry();
  task.el.querySelector<HTMLButtonElement>('[data-task="summarize"]')!.click();
  const original = draft;
  if (cause === 'session') session = 'two';
  if (cause === 'target') current = false;
  if (cause === 'text') context = { ...context, text: 'changed' };
  if (cause === 'readonly') readonly = true;
  expect(task.check(draft)).toBe(false);
  expect(draft).toBe(original);
  expect(task.el.textContent).toContain('changed');
  expect(task.consume(draft)).toBeNull();
});
it('does not grant intent to an arbitrary typed copy of a task prompt', () => {
  const task = entry();
  expect(task.consume('Polish the selected passage. Keep its meaning and make the wording clear.')).toBeNull();
});
it('offers accurate tasks for empty, read-only, oversized and other formats', () => {
  const task = entry();
  task.update({ context: { kind: 'word' }, text: '', truncated: false });
  expect(task.el.querySelector('[data-task="compose"]')).not.toBeNull();
  readonly = true;
  task.update(context);
  expect(task.el.querySelector('[data-task="polish"]')).toBeNull();
  task.update({ ...context, truncated: true });
  expect(task.el.textContent).toContain('smaller');
  for (const kind of ['cell', 'slide', 'pdf'] as const) {
    task.update({ context: { kind, page: 2, range: 'B2:C4', sheet: 'Budget' }, text: '', truncated: false });
    expect(task.el.querySelectorAll('[data-task]').length).toBeGreaterThanOrEqual(2);
    expect(task.el.querySelector('[data-task="compose"]')).toBeNull();
  }
  task.update({ context: null, text: '', truncated: false });
  expect(task.el.querySelectorAll('[data-task]')).toHaveLength(0);
});
it('revalidates eligibility when context changed between render and click', () => {
  const task = entry();
  context = { context: { kind: 'pdf', page: 1 }, text: 'source', truncated: false };
  task.el.querySelector<HTMLButtonElement>('[data-task="polish"]')!.click();
  expect(draft).toBe('');
  expect(task.consume('')).toBeNull();
});
it('invalidates target freshness even when equal text was selected elsewhere', () => {
  const task = entry();
  task.el.querySelector<HTMLButtonElement>('[data-task="polish"]')!.click();
  current = false;
  expect(task.check(draft)).toBe(false);
});

it('uses the already captured snapshot during staged context refresh', () => {
  const task = entry();
  task.el.querySelector<HTMLButtonElement>('[data-task="polish"]')!.click();
  capture.mockClear();
  task.update(context);
  expect(capture).not.toHaveBeenCalled();
});

it('normalizes the Chinese shell locale for a trusted writing intent', () => {
  setLanguage(LanguageCode.ZH);
  const task = entry();
  task.el.querySelector<HTMLButtonElement>('[data-task="polish"]')!.click();
  expect(draft).toContain('润色');
  expect(task.consume(draft)?.language).toBe('zh-CN');
});

it('issues immutable host provenance for exact read task and selection scope only once', () => {
  const task = entry();
  task.el.querySelector<HTMLButtonElement>('[data-task="summarize"]')!.click();
  const intent = task.consume(draft);
  expect(intent?.hostRead).toEqual({ taskId: 'summarize', scope: 'selection' });
  expect(Object.isFrozen(intent?.hostRead)).toBe(true);
  expect(task.consume(draft)).toBeNull();
});

it('keeps a consumed token independent of later draft typing and supports explicit revocation', async () => {
  const { isCurrentHostRead, revokeHostRead } = await import('../../lib/agent-plugin/ui/task-entry');
  const task = entry();
  task.el.querySelector<HTMLButtonElement>('[data-task="summarize"]')!.click();
  const token = task.consume(draft)!.hostRead!;
  expect(isCurrentHostRead(token)).toBe(true);
  task.inputChanged('new draft');
  expect(isCurrentHostRead(token)).toBe(true);
  expect(isCurrentHostRead({ ...token })).toBe(false);
  revokeHostRead(token);
  expect(isCurrentHostRead(token)).toBe(false);
});

it('checks a consumed read token during streaming without rereading selected content', async () => {
  const { isCurrentHostRead } = await import('../../lib/agent-plugin/ui/task-entry');
  const task = entry();
  task.el.querySelector<HTMLButtonElement>('[data-task="summarize"]')!.click();
  const token = task.consume(draft)!.hostRead!;
  capture.mockClear();
  for (let i = 0; i < 100; i++) expect(isCurrentHostRead(token)).toBe(true);
  expect(capture).not.toHaveBeenCalled();
});
