import * as chatUi from '@ranuts/chat-ui';
import { expect, it, vi } from 'vitest';
import { createArtifactPresentation } from '../../lib/agent-plugin/ui/artifact-presentation';
const labels = {
  export: 'Export',
  import: 'Import',
  importHint: 'Invalid structured data',
  preview: 'Preview',
  next: 'Next',
  previous: 'Previous',
  structuredHint: 'Export to use elsewhere',
};
it('keeps malformed and changed-kind JSON drafts recoverable and prevents export', () => {
  const text = document.createElement('textarea');
  text.value = JSON.stringify({ kind: 'table', columns: ['A'], rows: [['one']] });
  const view = createArtifactPresentation(text, labels, { kind: 'table', columns: ['A'], rows: [['one']] });
  document.body.append(text, view.el);
  const create = vi.fn();
  vi.stubGlobal('URL', { createObjectURL: create, revokeObjectURL: vi.fn() });
  text.value = JSON.stringify({ kind: 'slides', slides: [{ title: 'wrong kind', body: 'body' }] });
  text.dispatchEvent(new Event('input'));
  expect(view.el.textContent).toContain(labels.importHint);
  expect(() => view.payload()).toThrow('Changed artifact kind');
  Array.from(view.el.querySelectorAll('button'))
    .find((b) => b.textContent === 'JSON')!
    .click();
  expect(create).not.toHaveBeenCalled();
  expect(text.value).toContain('wrong kind');
  view.dispose();
  vi.unstubAllGlobals();
});
it('updates canonical slide fields without replacing the active editor', () => {
  const text = document.createElement('textarea');
  const initial = {
    kind: 'slides' as const,
    slides: [
      { title: 'One', body: 'First' },
      { title: 'Two', body: 'Second' },
    ],
  };
  text.value = JSON.stringify(initial);
  const view = createArtifactPresentation(text, labels, initial);
  document.body.append(view.el);
  view.setEditing(true);
  const field = view.el.querySelector('textarea')!;
  field.focus();
  field.value = 'Updated';
  field.setSelectionRange(3, 3);
  field.dispatchEvent(new Event('input'));
  expect(document.activeElement).toBe(field);
  expect(field.selectionStart).toBe(3);
  expect(view.payload()).toEqual({ ...initial, slides: [{ title: 'Updated', body: 'First' }, initial.slides[1]] });
  view.dispose();
});
it('localizes an invalid preserved source safely and clamps pages after shrinking rows', () => {
  const text = document.createElement('textarea');
  const p = { kind: 'table' as const, columns: ['A'], rows: Array.from({ length: 25 }, (_, i) => [String(i)]) };
  text.value = JSON.stringify(p);
  const view = createArtifactPresentation(text, labels, p);
  document.body.append(view.el);
  const next = () =>
    Array.from(view.el.querySelectorAll('button'))
      .find((b) => b.textContent === 'Next')!
      .click();
  next();
  next();
  expect(view.el.textContent).toContain('3 / 3');
  text.value = JSON.stringify({ ...p, rows: [['only']] });
  text.dispatchEvent(new Event('input'));
  expect(view.el.textContent).toContain('1 / 1');
  expect(view.el.querySelector('td')?.textContent).toBe('only');
  text.value = 'broken source';
  text.dispatchEvent(new Event('input'));
  expect(() => view.setLabels({ ...labels, importHint: 'Repair this data' })).not.toThrow();
  expect(view.el.textContent).toContain('Repair this data');
  expect(text.value).toBe('broken source');
  view.dispose();
});

it('renders structured previews without writable fields until Edit is explicit', () => {
  const text = document.createElement('textarea');
  const initial = { kind: 'table' as const, columns: ['Name'], rows: [['one']] };
  text.value = JSON.stringify(initial);
  const view = createArtifactPresentation(text, labels, initial);
  expect(view.el.querySelector('td')?.textContent).toBe('one');
  expect(view.el.querySelector('textarea')).toBeNull();
  view.setEditing(true);
  expect(view.el.querySelector('td textarea')).not.toBeNull();
  view.setEditing(false);
  expect(view.el.querySelector('textarea')).toBeNull();
  expect(text.value).toBe(JSON.stringify(initial));
  view.dispose();
});

it('disables exported toolbar controls during a pending save after relocation', () => {
  const text = document.createElement('textarea');
  text.value = 'draft';
  const view = createArtifactPresentation(text, labels);
  const toolbar = document.createElement('div');
  toolbar.append(view.exportEl);
  view.setDisabled(true);
  expect(Array.from(toolbar.querySelectorAll('button')).every((button) => button.disabled)).toBe(true);
  view.setDisabled(false);
  expect(Array.from(toolbar.querySelectorAll('button')).every((button) => !button.disabled)).toBe(true);
  view.dispose();
});

it('preserves the hidden reader while typing and renders the latest source only on Preview', () => {
  const text = document.createElement('textarea');
  text.value = '**Saved**';
  const view = createArtifactPresentation(text, labels);
  const reader = view.el.querySelector<HTMLElement>('[data-artifact-reader]')!;
  const paragraph = reader.firstElementChild;
  const render = vi.spyOn(chatUi, 'renderChatMarkdown');
  view.setEditing(true);
  expect(reader.hidden).toBe(true);
  expect(reader.firstElementChild).toBe(paragraph);
  text.value = '**First edit**';
  text.dispatchEvent(new Event('input'));
  text.value = '**Latest edit**';
  text.dispatchEvent(new Event('input'));
  expect(render).not.toHaveBeenCalled();
  expect(reader.firstElementChild).toBe(paragraph);
  expect(reader.textContent).toBe('Saved');
  view.setEditing(false);
  expect(render).toHaveBeenCalledTimes(1);
  expect(reader.hidden).toBe(false);
  expect(reader.querySelector('strong')?.textContent).toBe('Latest edit');
  view.dispose();
  render.mockRestore();
});

it('owns localized code copy and table styles without a ChatView and preserves the reader on locale changes', async () => {
  const source = '```unknown\n  literal <img src=x>\n\tend\n```\n\n| Cost |\n| ---: |\n| 1200 |';
  const text = document.createElement('textarea');
  text.value = source;
  const view = createArtifactPresentation(text, { ...labels, copy: 'Copy', table: 'Table' });
  document.body.append(view.el);
  expect(document.getElementById('cui-markdown-styles')).not.toBeNull();
  const code = view.el.querySelector('code')!;
  const copy = view.el.querySelector<HTMLButtonElement>('.cui-code-copy')!;
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  copy.click();
  await Promise.resolve();
  expect(writeText).toHaveBeenCalledWith('  literal <img src=x>\n\tend');
  expect(copy.textContent).toContain('Copied');
  view.setLabels({ ...labels, copy: 'Copiar', copied: 'Copiado', table: 'Tabela' });
  expect(view.el.querySelector('code')).toBe(code);
  expect(view.el.querySelector('.cui-code-copy')).toBe(copy);
  expect(copy.textContent).toContain('Copiado');
  expect(view.el.querySelector('.cui-table')?.getAttribute('aria-label')).toBe('Tabela');
  expect(view.el.querySelector('td')?.style.textAlign).toBe('right');
  expect(view.el.querySelector('img')).toBeNull();
  expect(text.value).toBe(source);
  expect(view.payload()).toEqual({ kind: 'text', text: source });
  view.dispose();
});

it('keeps a code copy pending while unrelated artifact save controls unlock', async () => {
  const text = document.createElement('textarea');
  text.value = '```unknown\ncode\n```';
  const view = createArtifactPresentation(text, labels);
  document.body.append(view.el);
  let resolve!: () => void;
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: {
      writeText: () =>
        new Promise<void>((r) => {
          resolve = r;
        }),
    },
  });
  const copy = view.el.querySelector<HTMLButtonElement>('.cui-code-copy')!;
  copy.click();
  view.setDisabled(true);
  view.setDisabled(false);
  expect(copy.disabled).toBe(true);
  resolve();
  await Promise.resolve();
  expect(copy.disabled).toBe(false);
  view.dispose();
});
