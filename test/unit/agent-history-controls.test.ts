import 'fake-indexeddb/auto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createConversationStore } from '../../lib/agent-plugin/ui/sessions';
import { createHistoryControls } from '../../lib/agent-plugin/ui/history-controls';
import { t } from '@ranuts/shared/i18n';

beforeEach(async () => {
  localStorage.clear();
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase('document-ai-conversations');
    request.onsuccess = () => resolve();
  });
});
afterEach(() => document.body.replaceChildren());

it('does not offer cancellation after confirmed deletion has started', async () => {
  let finish!: () => void;
  const store = createConversationStore(undefined, { repository: {
    load: async () => null,
    save: async () => 1,
    clear: () => new Promise<number>((resolve) => { finish = () => resolve(1); }),
  } });
  const controls = createHistoryControls({ store, onRestore: vi.fn() });
  document.body.append(controls.el);
  controls.el.querySelector<HTMLButtonElement>('.agent-history-delete-all')!.click();
  controls.el.querySelector<HTMLButtonElement>('.agent-history-confirm')!.click();
  await vi.waitFor(() => expect(finish).toBeDefined());
  const cancel = controls.el.querySelector<HTMLButtonElement>('.agent-history-cancel')!;
  expect(cancel.disabled).toBe(true);
  cancel.click();
  expect(controls.el.querySelector<HTMLElement>('.agent-history-confirmation')!.hidden).toBe(false);
  finish();
  await vi.waitFor(() => expect(controls.el.querySelector<HTMLElement>('.agent-history-confirmation')!.hidden).toBe(true));
  expect(cancel.disabled).toBe(false);
});

it('requires explicit opt-in to save and restores after a previously enabled preference', async () => {
  const store = createConversationStore();
  const controls = createHistoryControls({ store, onRestore: vi.fn() });
  document.body.append(controls.el);
  await controls.start();
  expect(store.saving).toBe(false);
  store.history().save([{ role: 'user', content: 'my local conversation' }]);
  const toggle = controls.el.querySelector<HTMLInputElement>('.agent-history-save')!;
  toggle.checked = true;
  toggle.dispatchEvent(new Event('change'));
  await vi.waitFor(() => expect(store.saving).toBe(true));
  const restored = createConversationStore();
  const restore = vi.fn();
  const next = createHistoryControls({ store: restored, onRestore: restore });
  await next.start();
  expect(restored.history().load()[0].content).toBe('my local conversation');
  expect(restore).toHaveBeenCalledOnce();
});

it('requires an explicit second action to delete all history and supports cancellation', async () => {
  const store = createConversationStore();
  store.history().save([{ role: 'user', content: 'keep until confirmed' }]);
  const controls = createHistoryControls({ store, onRestore: vi.fn() });
  document.body.append(controls.el);
  controls.el.querySelector<HTMLButtonElement>('.agent-history-delete-all')!.click();
  expect(store.history().load()).toHaveLength(1);
  controls.el.querySelector<HTMLButtonElement>('.agent-history-cancel')!.click();
  expect(store.history().load()).toHaveLength(1);
  controls.el.querySelector<HTMLButtonElement>('.agent-history-delete-all')!.click();
  controls.el.querySelector<HTMLButtonElement>('.agent-history-confirm')!.click();
  await vi.waitFor(() => expect(store.history().load()).toEqual([]));
});

it.each(['.agent-history-delete-current', '.agent-history-delete-all'])(
  'returns focus to %s after canceling deletion',
  (selector) => {
    const store = createConversationStore();
    const controls = createHistoryControls({ store, onRestore: vi.fn() });
    document.body.append(controls.el);
    const trigger = controls.el.querySelector<HTMLButtonElement>(selector)!;
    trigger.click();
    const cancel = controls.el.querySelector<HTMLButtonElement>('.agent-history-cancel')!;
    expect(document.activeElement).toBe(cancel);
    cancel.click();
    expect(document.activeElement).toBe(trigger);
    expect(controls.el.querySelector<HTMLElement>('.agent-history-confirmation')!.hidden).toBe(true);
  },
);

it('shows a storage failure without losing the in-memory conversation', async () => {
  const store = createConversationStore(undefined, {
    repository: {
      clear: async () => 1,
      load: async () => null,
      save: async () => {
        throw new DOMException('Full', 'QuotaExceededError');
      },
    },
  });
  store.history().save([{ role: 'user', content: 'still here' }]);
  const controls = createHistoryControls({ store, onRestore: vi.fn() });
  const toggle = controls.el.querySelector<HTMLInputElement>('.agent-history-save')!;
  toggle.checked = true;
  toggle.dispatchEvent(new Event('change'));
  await vi.waitFor(() =>
    expect(controls.el.querySelector('.agent-history-status')?.textContent).toBe(t('agentHistorySaveFailed')),
  );
  expect(toggle.checked).toBe(false);
  expect(store.history().load()[0].content).toBe('still here');
});

it('keeps the requested checkbox state visible while storage initializes', async () => {
  let finish!: () => void;
  const store = createConversationStore(undefined, {
    repository: {
      clear: async () => 1,
      load: async () => {
        await new Promise<void>((resolve) => {
          finish = resolve;
        });
        return null;
      },
      save: async () => 1,
    },
  });
  const controls = createHistoryControls({ store, onRestore: vi.fn() });
  const toggle = controls.el.querySelector<HTMLInputElement>('.agent-history-save')!;
  toggle.checked = true;
  toggle.dispatchEvent(new Event('change'));
  expect(toggle.checked).toBe(true);
  await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
  finish();
  await vi.waitFor(() => expect(store.saving).toBe(true));
});

it.each(['.agent-history-delete-current', '.agent-history-delete-all'])(
  'returns keyboard focus to %s after successful deletion',
  async (selector) => {
    const store = createConversationStore();
    store.history().save([{ role: 'user', content: 'delete this conversation' }]);
    const controls = createHistoryControls({ store, onRestore: vi.fn() });
    document.body.append(controls.el);
    const trigger = controls.el.querySelector<HTMLButtonElement>(selector)!;
    trigger.click();
    const confirm = controls.el.querySelector<HTMLButtonElement>('.agent-history-confirm')!;
    confirm.focus();
    confirm.click();
    await vi.waitFor(() => expect(controls.el.querySelector<HTMLElement>('.agent-history-confirmation')!.hidden).toBe(true));
    await vi.waitFor(() => expect(document.activeElement).toBe(trigger));
  },
);

it('keeps focus where the user moved it while deletion was pending', async () => {
  let finish!: () => void;
  const store = createConversationStore(undefined, { repository: {
    load: async () => null,
    save: async () => 1,
    clear: () => new Promise<number>((resolve) => { finish = () => resolve(1); }),
  } });
  const controls = createHistoryControls({ store, onRestore: vi.fn() });
  const elsewhere = document.createElement('button');
  document.body.append(controls.el, elsewhere);
  controls.el.querySelector<HTMLButtonElement>('.agent-history-delete-all')!.click();
  const confirm = controls.el.querySelector<HTMLButtonElement>('.agent-history-confirm')!;
  confirm.focus();
  confirm.click();
  await vi.waitFor(() => expect(finish).toBeDefined());
  elsewhere.focus();
  finish();
  await vi.waitFor(() => expect(controls.el.querySelector<HTMLElement>('.agent-history-confirmation')!.hidden).toBe(true));
  expect(document.activeElement).toBe(elsewhere);
});

it('keeps keyboard focus on retry when deleting all history fails', async () => {
  const store = createConversationStore(undefined, { repository: {
    load: async () => null,
    save: async () => 1,
    clear: async () => { throw new DOMException('Unavailable', 'UnknownError'); },
  } });
  store.history().save([{ role: 'user', content: 'preserve on failure' }]);
  const controls = createHistoryControls({ store, onRestore: vi.fn() });
  document.body.append(controls.el);
  controls.el.querySelector<HTMLButtonElement>('.agent-history-delete-all')!.click();
  const confirm = controls.el.querySelector<HTMLButtonElement>('.agent-history-confirm')!;
  confirm.focus();
  confirm.click();
  await vi.waitFor(() => expect(controls.el.querySelector('.agent-history-status')?.textContent).toBe(t('agentHistorySaveFailed')));
  expect(controls.el.querySelector<HTMLElement>('.agent-history-confirmation')!.hidden).toBe(false);
  expect(confirm.disabled).toBe(false);
  expect(document.activeElement).toBe(confirm);
  expect(store.history().load()[0].content).toBe('preserve on failure');
});
