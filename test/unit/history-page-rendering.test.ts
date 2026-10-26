import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const store = vi.hoisted(() => ({ listDocs: vi.fn(), historyUsage: vi.fn(), pruneExpired: vi.fn() }));
vi.mock('../../lib/history/store', () => ({
  ...store,
  clearAllHistory: vi.fn(),
  deleteDoc: vi.fn(),
  getLatestSnapshot: vi.fn(),
}));
vi.mock('../../lib/pending-open', () => ({ stashPendingFile: vi.fn() }));
vi.mock('../../lib/confirm-dialog', () => ({ confirmDialog: vi.fn() }));
vi.mock('@ranuts/shared/i18n', () => ({
  applyDocumentLanguage: vi.fn(),
  getLanguage: () => 'en',
  localeHomePath: () => '/',
  t: (key: string) => key,
  withLocale: (url: string) => url,
}));
const result = (title: string) => ({
  items: [{ id: title, title, ext: 'docx', updatedAt: Date.now(), size: 10 }],
  total: 1,
  page: 1,
  pageSize: 20,
});
let removeListeners = () => {};
beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  localStorage.clear();
  document.body.innerHTML = '<div id="history-root"></div>';
  window.history.replaceState(null, '', '/history');
  store.listDocs.mockReset().mockResolvedValue(result('Initial.docx'));
  store.historyUsage.mockReset().mockResolvedValue(10);
  store.pruneExpired.mockReset().mockResolvedValue(undefined);
  const listenerSpy = vi.spyOn(window, 'addEventListener');
  removeListeners = () => {
    for (const [name, handler] of listenerSpy.mock.calls) window.removeEventListener(name, handler);
    listenerSpy.mockRestore();
  };
});
afterEach(() => {
  removeListeners();
  vi.clearAllTimers();
  vi.useRealTimers();
});
async function load() {
  await import('../../lib/history-page');
  await vi.advanceTimersByTimeAsync(0);
}
function input(value: string) {
  const el = document.getElementById('history-search')!;
  el.dispatchEvent(new CustomEvent('input', { detail: { value } }));
  return el;
}
it('keeps the focused search host mounted across debounced results', async () => {
  await load();
  const search = input('Budget');
  search.focus();
  store.listDocs.mockResolvedValue(result('Budget.docx'));
  await vi.advanceTimersByTimeAsync(200);
  expect(document.getElementById('history-search')).toBe(search);
  expect(document.activeElement).toBe(search);
  expect(document.querySelector('.history-row-title')?.textContent).toBe('Budget.docx');
  expect(store.pruneExpired).toHaveBeenCalledOnce();
});
it('invalidates an older result as soon as another query is typed, before debounce', async () => {
  await load();
  let finish!: (value: ReturnType<typeof result>) => void;
  store.listDocs.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  input('Old');
  await vi.advanceTimersByTimeAsync(200);
  input('New');
  finish(result('Old.docx'));
  await vi.advanceTimersByTimeAsync(0);
  expect(document.querySelector('.history-row-title')?.textContent).toBe('Initial.docx');
  store.listDocs.mockResolvedValue(result('New.docx'));
  await vi.advanceTimersByTimeAsync(200);
  expect(document.querySelector('.history-row-title')?.textContent).toBe('New.docx');
  expect(window.location.search).toBe('?q=New');
});
it('throttles expiry cleanup while refreshing it when the page returns', async () => {
  await load();
  input('A');
  await vi.advanceTimersByTimeAsync(200);
  input('B');
  await vi.advanceTimersByTimeAsync(200);
  expect(store.pruneExpired).toHaveBeenCalledOnce();
  window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
  await vi.advanceTimersByTimeAsync(0);
  expect(store.pruneExpired).toHaveBeenCalledTimes(2);
  await vi.advanceTimersByTimeAsync(60000);
  input('C');
  await vi.advanceTimersByTimeAsync(200);
  expect(store.pruneExpired).toHaveBeenCalledTimes(3);
});

it('keeps the toolbar and settings interactive after filter and clear-search changes', async () => {
  await load();
  const toolbar = document.querySelector('.history-toolbar');
  const toggle = document.querySelector<HTMLInputElement>('#history-autosave')!;
  toggle.checked = false;
  toggle.dispatchEvent(new Event('change'));
  await vi.advanceTimersByTimeAsync(0);
  expect(document.querySelector('#history-autosave')).toBe(toggle);
  expect(document.querySelector('.history-note-warn')).not.toBeNull();
  document.getElementById('history-filter-unsaved')!.click();
  await vi.advanceTimersByTimeAsync(0);
  expect(document.getElementById('history-filter-unsaved')!.getAttribute('aria-pressed')).toBe('true');
  store.listDocs.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });
  input('Missing');
  await vi.advanceTimersByTimeAsync(200);
  document.querySelector<HTMLElement>('.history-empty-action')!.click();
  await vi.advanceTimersByTimeAsync(0);
  expect(document.querySelector('.history-toolbar')).toBe(toolbar);
  expect(document.getElementById('history-search')!.getAttribute('value')).toBe('');
  expect(document.getElementById('history-filter-unsaved')!.getAttribute('aria-pressed')).toBe('false');
  expect(window.location.search).toBe('');
});
