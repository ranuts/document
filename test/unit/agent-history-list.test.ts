import { afterEach, expect, it, vi } from 'vitest';
import { createConversationStore } from '../../lib/agent-plugin/ui/sessions';
import { createConversationList } from '../../lib/agent-plugin/ui/history-list';

const rows = (el: HTMLElement) => Array.from(el.querySelectorAll<HTMLButtonElement>('.agent-conversation-open'));
afterEach(() => document.body.replaceChildren());

it('searches titles and message content locally and opens the matching conversation', () => {
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
  expect(rows(list.el)).toHaveLength(1);
  expect(rows(list.el)[0].textContent).toContain('Quarterly plan');
  rows(list.el)[0].click();
  expect(select).toHaveBeenCalledWith(original);
  search.value = 'missing phrase';
  search.dispatchEvent(new Event('input'));
  expect(rows(list.el)).toHaveLength(0);
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
  const list = createConversationList({ store, onSelect: vi.fn(), onDelete: vi.fn() });
  document.body.append(list.el);
  rows(list.el)[0].focus();
  store.history().save([{ role: 'user', content: 'Updated title' }]);
  list.sync();
  expect(document.activeElement).toBe(rows(list.el)[0]);
  expect(document.activeElement?.textContent).toContain('Updated title');
});
