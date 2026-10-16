import { afterEach, expect, it, vi } from 'vitest';
import { createConversationStore } from '../../lib/agent-plugin/ui/sessions';
import { createConversationList } from '../../lib/agent-plugin/ui/history-list';

const rows = (el: HTMLElement) => Array.from(el.querySelectorAll<HTMLButtonElement>('.agent-conversation-open'));

it('accepts canonical whitespace search results instead of leaving the list pending', async () => {
  const store = createConversationStore();
  store.history().save([{ role: 'user', content: 'Alpha  \n beta' }]);
  const list = createConversationList({ store, onSelect: vi.fn(), onDelete: vi.fn() });
  document.body.append(list.el);
  const input = list.el.querySelector<HTMLInputElement>('input')!;
  input.value = ' ALPHA   beta ';
  input.dispatchEvent(new Event('input'));
  await vi.waitFor(() => expect(list.el.querySelector('ul')?.getAttribute('aria-busy')).toBe('false'));
  expect(rows(list.el)).toHaveLength(1);
  list.dispose();
});
afterEach(() => document.body.replaceChildren());

it('searches titles and message content locally and opens the matching conversation', async () => {
  const store = createConversationStore();
  const original = store.activeId;
  store.history().save([
    { role: 'user', content: 'Quarterly plan' },
    { role: 'assistant', content: 'Revenue forecast' },
  ]);
  store.create();
  store.history().save([{ role: 'user', content: 'Travel notes' }]);
  const select = vi.fn();
  const list = createConversationList({ store, onSelect: select, onDelete: vi.fn() });
  document.body.append(list.el);
  const search = list.el.querySelector<HTMLInputElement>('input')!;
  search.value = ' FORECAST ';
  search.dispatchEvent(new Event('input'));
  await vi.waitFor(() => expect(rows(list.el)).toHaveLength(1));
  expect(rows(list.el)[0].textContent).toContain('Quarterly plan');
  rows(list.el)[0].click();
  expect(select).toHaveBeenCalledWith(original);
  search.value = 'missing phrase';
  search.dispatchEvent(new Event('input'));
  await vi.waitFor(() => expect(rows(list.el)).toHaveLength(0));
  expect(list.el.querySelector('.agent-history-empty')?.textContent).toBeTruthy();
  search.value = '';
  search.dispatchEvent(new Event('input'));
  expect(rows(list.el)).toHaveLength(2);
});

it('marks the current conversation and requests deletion of a different row without changing selection', () => {
  const store = createConversationStore();
  const original = store.activeId;
  store.history().save([{ role: 'user', content: '<script>unsafe title</script>' }]);
  store.create();
  store.history().save([{ role: 'user', content: 'Current conversation' }]);
  const remove = vi.fn();
  const select = vi.fn();
  const list = createConversationList({ store, onSelect: select, onDelete: remove });
  expect(
    rows(list.el)
      .find((row) => row.dataset.id === store.activeId)
      ?.getAttribute('aria-current'),
  ).toBe('true');
  expect(list.el.querySelector('script')).toBeNull();
  const trigger = Array.from(list.el.querySelectorAll<HTMLButtonElement>('.agent-conversation-delete')).find(
    (row) => row.dataset.id === original,
  )!;
  trigger.click();
  expect(remove).toHaveBeenCalledWith(original, trigger);
  expect(select).not.toHaveBeenCalled();
  expect(store.history(original).load()).toHaveLength(1);
});

it('keeps keyboard focus on the matching row when titles refresh', () => {
  const store = createConversationStore();
  store.history().save([{ role: 'user', content: 'Original' }]);
  const list = createConversationList({ store, onSelect: vi.fn(), onDelete: vi.fn() });
  document.body.append(list.el);
  rows(list.el)[0].focus();
  store.history().save([{ role: 'user', content: 'Updated title' }]);
  list.sync();
  expect(document.activeElement).toBe(rows(list.el)[0]);
  expect(document.activeElement?.textContent).toContain('Updated title');
});

it('renders forty rows at a time and preserves unchanged row and focus identity', () => {
  const store = createConversationStore();
  store.history().save([{ role: 'user', content: 'First' }]);
  for (let index = 0; index < 85; index++) {
    store.create();
    store.history().save([{ role: 'user', content: `Conversation ${index}` }]);
  }
  const list = createConversationList({ store, onSelect: vi.fn(), onDelete: vi.fn() });
  document.body.append(list.el);
  expect(rows(list.el)).toHaveLength(40);
  const first = rows(list.el)[0];
  first.focus();
  list.sync();
  expect(rows(list.el)[0]).toBe(first);
  expect(document.activeElement).toBe(first);
  list.el.querySelector<HTMLButtonElement>('.agent-history-more')!.click();
  expect(rows(list.el)).toHaveLength(80);
  list.el.querySelector<HTMLButtonElement>('.agent-history-more')!.click();
  expect(rows(list.el)).toHaveLength(86);
});

it('does no hidden DOM work and refreshes when reactivated, then ignores disposed work', async () => {
  const store = createConversationStore();
  const list = createConversationList({ store, onSelect: vi.fn(), onDelete: vi.fn() });
  store.history().save([{ role: 'user', content: 'Before hiding' }]);
  list.sync();
  const first = rows(list.el)[0];
  list.setActive(false);
  store.history().save([{ role: 'user', content: 'While hidden' }]);
  list.sync();
  expect(first.textContent).not.toContain('While hidden');
  list.setActive(true);
  expect(rows(list.el)[0]).toBe(first);
  expect(first.textContent).toContain('While hidden');
  list.dispose();
  store.history().save([{ role: 'user', content: 'After disposal' }]);
  list.sync();
  expect(first.textContent).not.toContain('After disposal');
});

it('shows a distinct empty state for an untouched draft', () => {
  const store = createConversationStore();
  const list = createConversationList({ store, onSelect: vi.fn(), onDelete: vi.fn() });
  expect(rows(list.el)).toHaveLength(0);
  expect(list.el.querySelector('.agent-history-empty')?.textContent).toBe('No conversations yet');
  list.dispose();
});

it('announces pending search while preserving the search focus and existing row nodes', async () => {
  const store = createConversationStore();
  store.history().save([{ role: 'user', content: 'Find this conversation' }]);
  const list = createConversationList({ store, onSelect: vi.fn(), onDelete: vi.fn() });
  document.body.append(list.el);
  const first = rows(list.el)[0];
  const input = list.el.querySelector<HTMLInputElement>('input')!;
  input.focus();
  input.value = 'Find';
  input.dispatchEvent(new Event('input'));
  const status = list.el.querySelector<HTMLElement>('.agent-history-search-status');
  expect(status?.getAttribute('role')).toBe('status');
  expect(status?.textContent).toBe('Searching…');
  expect(rows(list.el)[0]).toBe(first);
  expect(document.activeElement).toBe(input);
  await vi.waitFor(() => expect(list.el.querySelector('ul')?.getAttribute('aria-busy')).toBe('false'));
  expect(list.el.querySelector('.agent-history-search-status')).toBe(status);
  expect(status?.textContent).toBe('');
  expect(document.activeElement).toBe(input);
  list.dispose();
});
it('includes only queue-backed empty sessions and refreshes their visibility without mutating stored metadata', () => {
  const store = createConversationStore();
  const first = store.activeId;
  store.create();
  const second = store.activeId;
  let pending: string[] = [first];
  const list = createConversationList({
    store,
    onSelect: vi.fn(),
    onDelete: vi.fn(),
    pendingConversations: () => pending,
  });
  document.body.append(list.el);
  const snapshot = store.searchSnapshot();
  expect(rows(list.el).map((row) => row.dataset.id)).toEqual([first]);
  expect(store.history(first).load()).toEqual([]);
  pending = [second];
  list.sync();
  expect(rows(list.el).map((row) => row.dataset.id)).toEqual([second]);
  expect(store.searchSnapshot()).toBe(snapshot);
  pending = [];
  list.sync();
  expect(rows(list.el)).toHaveLength(0);
  list.dispose();
});

it.each(['refers', '中文', '.*[x]', '<img>'])(
  'highlights every literal %s match safely in titles and snippets',
  async (query) => {
    const store = createConversationStore();
    const content = `${query.toUpperCase()} then ${query}`;
    store.history().save([{ role: 'user', content }]);
    const list = createConversationList({ store, onSelect: vi.fn(), onDelete: vi.fn() });
    document.body.append(list.el);
    const input = list.el.querySelector<HTMLInputElement>('input')!;
    input.value = query;
    input.dispatchEvent(new Event('input'));
    await vi.waitFor(() => expect(list.el.querySelector('ul')?.getAttribute('aria-busy')).toBe('false'));
    for (const selector of ['.agent-conversation-title', '.agent-conversation-snippet']) {
      const text = list.el.querySelector(selector)!;
      expect(Array.from(text.querySelectorAll('mark.agent-search-match')).map((mark) => mark.textContent)).toEqual([
        query.toUpperCase(),
        query,
      ]);
      expect(text.textContent).toBe(content);
    }
    expect(list.el.querySelector('img')).toBeNull();
    const first = rows(list.el)[0];
    first.focus();
    const mark = first.querySelector('mark');
    list.sync();
    expect(first.querySelector('mark')).toBe(mark);
    expect(document.activeElement).toBe(first);
    input.value = 'then';
    input.dispatchEvent(new Event('input'));
    await vi.waitFor(() => expect(list.el.querySelector('ul')?.getAttribute('aria-busy')).toBe('false'));
    expect(Array.from(first.querySelectorAll('mark')).map((node) => node.textContent)).toEqual(['then', 'then']);
    input.value = '';
    input.dispatchEvent(new Event('input'));
    expect(rows(list.el)[0]).toBe(first);
    expect(first.querySelector('mark')).toBeNull();
    list.dispose();
  },
);

it('maps canonical whitespace and lowercase expansion matches back to displayed text', async () => {
  const store = createConversationStore();
  store.history().save([{ role: 'user', content: 'İ prefix Alpha  \n beta ALPHA beta' }]);
  const list = createConversationList({ store, onSelect: vi.fn(), onDelete: vi.fn() });
  const input = list.el.querySelector<HTMLInputElement>('input')!;
  input.value = ' ALPHA   beta ';
  input.dispatchEvent(new Event('input'));
  await vi.waitFor(() => expect(list.el.querySelector('ul')?.getAttribute('aria-busy')).toBe('false'));
  expect(
    Array.from(list.el.querySelectorAll('.agent-conversation-title mark')).map((node) => node.textContent),
  ).toEqual(['Alpha beta', 'ALPHA beta']);
  expect(
    Array.from(list.el.querySelectorAll('.agent-conversation-snippet mark')).map((node) => node.textContent),
  ).toEqual(['Alpha beta', 'ALPHA beta']);
  list.dispose();
});
