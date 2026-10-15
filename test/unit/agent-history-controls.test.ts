import 'fake-indexeddb/auto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createConversationStore } from '../../lib/agent-plugin/ui/sessions';
import { createHistoryControls } from '../../lib/agent-plugin/ui/history-controls';
import { ConversationConflictError } from '../../lib/agent-plugin/ui/conversation-db';
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
  const store = createConversationStore(undefined, {
    repository: {
      load: async () => null,
      save: async () => 1,
      clear: () =>
        new Promise<number>((resolve) => {
          finish = () => resolve(1);
        }),
    },
  });
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
  await vi.waitFor(() =>
    expect(controls.el.querySelector<HTMLElement>('.agent-history-confirmation')!.hidden).toBe(true),
  );
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
  expect(restore).toHaveBeenCalledExactlyOnceWith();
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
    await vi.waitFor(() =>
      expect(controls.el.querySelector<HTMLElement>('.agent-history-confirmation')!.hidden).toBe(true),
    );
    await vi.waitFor(() => expect(document.activeElement).toBe(trigger));
  },
);

it('keeps focus where the user moved it while deletion was pending', async () => {
  let finish!: () => void;
  const store = createConversationStore(undefined, {
    repository: {
      load: async () => null,
      save: async () => 1,
      clear: () =>
        new Promise<number>((resolve) => {
          finish = () => resolve(1);
        }),
    },
  });
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
  await vi.waitFor(() =>
    expect(controls.el.querySelector<HTMLElement>('.agent-history-confirmation')!.hidden).toBe(true),
  );
  expect(document.activeElement).toBe(elsewhere);
});

it('keeps keyboard focus on retry when deleting all history fails', async () => {
  const store = createConversationStore(undefined, {
    repository: {
      load: async () => null,
      save: async () => 1,
      clear: async () => {
        throw new DOMException('Unavailable', 'UnknownError');
      },
    },
  });
  store.history().save([{ role: 'user', content: 'preserve on failure' }]);
  const controls = createHistoryControls({ store, onRestore: vi.fn() });
  document.body.append(controls.el);
  controls.el.querySelector<HTMLButtonElement>('.agent-history-delete-all')!.click();
  const confirm = controls.el.querySelector<HTMLButtonElement>('.agent-history-confirm')!;
  confirm.focus();
  confirm.click();
  await vi.waitFor(() =>
    expect(controls.el.querySelector('.agent-history-status')?.textContent).toBe(t('agentHistorySaveFailed')),
  );
  expect(controls.el.querySelector<HTMLElement>('.agent-history-confirmation')!.hidden).toBe(false);
  expect(confirm.disabled).toBe(false);
  expect(document.activeElement).toBe(confirm);
  expect(store.history().load()[0].content).toBe('preserve on failure');
});

it('keeps data management collapsed while leaving conversation browsing prominent', () => {
  const controls = createHistoryControls({ store: createConversationStore(), onRestore: vi.fn() });
  const disclosure = controls.el.querySelector('details');
  expect(disclosure).not.toBeNull();
  expect(disclosure!.open).toBe(false);
  expect(disclosure!.querySelector('.agent-history-export')).not.toBeNull();
});

it('names the requested row before deleting it and preserves the current conversation', async () => {
  const store = createConversationStore();
  const target = store.activeId;
  store.history().save([{ role: 'user', content: 'Quarterly review' }]);
  store.create();
  store.history().save([{ role: 'user', content: 'Current work' }]);
  const current = store.activeId;
  const controls = createHistoryControls({ store, onRestore: vi.fn() });
  const trigger = document.createElement('button');
  document.body.append(controls.el, trigger);
  controls.requestDelete(target, trigger);
  expect(controls.el.querySelector('.agent-history-confirmation')?.textContent).toContain('Quarterly review');
  controls.el.querySelector<HTMLButtonElement>('.agent-history-confirm')!.click();
  await vi.waitFor(() => expect(store.list().some((item) => item.id === target)).toBe(false));
  expect(store.activeId).toBe(current);
  expect(store.history().load()[0].content).toBe('Current work');
});

it('dismisses the deletion decision with Escape before the history view handles it', () => {
  const controls = createHistoryControls({ store: createConversationStore(), onRestore: vi.fn() });
  document.body.append(controls.el);
  const trigger = controls.el.querySelector<HTMLButtonElement>('.agent-history-delete-current')!;
  trigger.click();
  const bubbled = vi.fn();
  controls.el.addEventListener('keydown', bubbled);
  controls.el
    .querySelector<HTMLButtonElement>('.agent-history-cancel')!
    .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  expect(controls.el.querySelector<HTMLElement>('.agent-history-confirmation')!.hidden).toBe(true);
  expect(document.activeElement).toBe(trigger);
  expect(bubbled).not.toHaveBeenCalled();
});

it.each([
  [new ConversationConflictError(), 'agentHistoryConflict'],
  [new DOMException('Unavailable', 'UnknownError'), 'agentHistorySaveFailed'],
] as const)('exposes %s after deleting a row while data controls are collapsed', async (error, key) => {
  const target = crypto.randomUUID();
  const current = crypto.randomUUID();
  const now = Date.now();
  const store = createConversationStore(undefined, {
    repository: {
      load: async () => ({
        version: 1,
        revision: 1,
        activeId: current,
        sessions: [
          {
            id: target,
            title: 'Earlier work',
            createdAt: now,
            updatedAt: now,
            messages: [{ role: 'user', content: 'Earlier work' }],
          },
          {
            id: current,
            title: 'Current work',
            createdAt: now,
            updatedAt: now,
            messages: [{ role: 'user', content: 'Current work' }],
          },
        ],
      }),
      save: async () => {
        throw error;
      },
      clear: async () => 1,
    },
  });
  await store.restoreSaved();
  const trigger = document.createElement('button');
  const search = document.createElement('input');
  const controls = createHistoryControls({
    store,
    onRestore: () => trigger.remove(),
    onFocusAfterDeletion: () => search.focus(),
  });
  document.body.append(search, trigger, controls.el);
  const details = controls.el.querySelector('details')!;
  expect(details.open).toBe(false);
  controls.requestDelete(target, trigger);
  controls.el.querySelector<HTMLButtonElement>('.agent-history-confirm')!.click();
  await vi.waitFor(() => expect(controls.el.querySelector('.agent-history-status')?.textContent).toBe(t(key)));
  expect(details.open).toBe(true);
  expect(controls.el.querySelector<HTMLElement>('.agent-history-confirmation')!.hidden).toBe(true);
  expect(document.activeElement).toBe(search);
  expect(store.activeId).toBe(current);
});

it.each(['success', 'remove failure', 'flush failure'] as const)(
  'settles single deletion exactly once with its identity on %s',
  async (mode) => {
    const store = createConversationStore();
    const target = store.activeId;
    store.history().save([{ role: 'user', content: 'Delete this owner' }]);
    if (mode === 'remove failure') vi.spyOn(store, 'remove').mockRejectedValue(new Error('Remove unavailable'));
    if (mode === 'flush failure') vi.spyOn(store, 'flush').mockRejectedValue(new Error('Flush unavailable'));
    const before = vi.fn();
    const restored = vi.fn();
    const controls = createHistoryControls({ store, onBeforeRestore: before, onRestore: restored });
    document.body.append(controls.el);
    controls.el.querySelector<HTMLButtonElement>('.agent-history-delete-current')!.click();
    controls.el.querySelector<HTMLButtonElement>('.agent-history-confirm')!.click();
    await vi.waitFor(() =>
      expect(controls.el.querySelector<HTMLElement>('.agent-history-confirmation')!.hidden).toBe(true),
    );
    expect(before).toHaveBeenCalledExactlyOnceWith(target);
    expect(restored).toHaveBeenCalledExactlyOnceWith(target);
  },
);
it('settles clear-all exactly once only on successful retry while preserving confirmation and focus on failure', async () => {
  const store = createConversationStore();
  store.history().save([{ role: 'user', content: 'Keep until successful clear' }]);
  vi.spyOn(store, 'clearAll').mockRejectedValueOnce(new Error('Clear unavailable'));
  const restored = vi.fn();
  const controls = createHistoryControls({ store, onRestore: restored });
  document.body.append(controls.el);
  const trigger = controls.el.querySelector<HTMLButtonElement>('.agent-history-delete-all')!;
  trigger.click();
  const confirm = controls.el.querySelector<HTMLButtonElement>('.agent-history-confirm')!;
  confirm.focus();
  confirm.click();
  await vi.waitFor(() =>
    expect(controls.el.querySelector('.agent-history-status')?.textContent).toBe(t('agentHistorySaveFailed')),
  );
  expect(restored).not.toHaveBeenCalled();
  expect(controls.el.querySelector<HTMLElement>('.agent-history-confirmation')!.hidden).toBe(false);
  expect(document.activeElement).toBe(confirm);
  confirm.click();
  await vi.waitFor(() =>
    expect(controls.el.querySelector<HTMLElement>('.agent-history-confirmation')!.hidden).toBe(true),
  );
  expect(restored).toHaveBeenCalledExactlyOnceWith('all');
  expect(document.activeElement).toBe(trigger);
});
