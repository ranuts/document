import 'fake-indexeddb/auto';
import { beforeEach, expect, it, vi } from 'vitest';
import { createConversationStore } from '../../lib/agent-plugin/ui/sessions';
import { createHistoryStorage } from '../../lib/agent-plugin/ui/storage';
beforeEach(async () => {
  localStorage.clear();
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase('document-ai-conversations');
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
});
it('keeps history in memory until saving is explicitly enabled', async () => {
  const open = vi.spyOn(indexedDB, 'open');
  const store = createConversationStore();
  store.history().save([{ role: 'user', content: 'private question' }]);
  store.create();
  await store.flush();
  expect(open).not.toHaveBeenCalled();
  expect(localStorage.length).toBe(0);
  const fresh = createConversationStore();
  expect(fresh.history().load()).toEqual([]);
  open.mockRestore();
});
it('imports old history only on request without deleting the source', async () => {
  createHistoryStorage().save([{ role: 'assistant', content: 'old article' }]);
  const store = createConversationStore();
  expect(store.history().load()).toEqual([]);
  await store.importLegacy();
  const original = store.list().find((item) => item.id === 'default')!.id;
  const next = store.create();
  expect(next.id).not.toBe(original);
  expect(store.history().load()).toEqual([]);
  store.history().save([{ role: 'user', content: 'new question' }]);
  store.select(original);
  expect(store.history().load()).toEqual([{ role: 'assistant', content: 'old article' }]);
  expect(store.list()).toHaveLength(2);
  expect(createHistoryStorage().load()).toEqual([{ role: 'assistant', content: 'old article' }]);
});
it('restores saved sessions only after opting in and derives a bounded title', async () => {
  const store = createConversationStore();
  const next = store.create();
  store.history().save([
    { role: 'user', content: 'first question' },
    { role: 'assistant', content: 'answer' },
  ]);
  await store.setSaving(true);
  const restored = createConversationStore();
  expect(restored.history().load()).toEqual([]);
  await restored.restoreSaved();
  expect(restored.activeId).toBe(next.id);
  expect(restored.list()[0].title).toBe('first question');
  expect(localStorage.length).toBe(0);
});
it('keeps captured history storage attached to its original session after switching', () => {
  const store = createConversationStore();
  const old = store.history();
  store.create();
  old.save([{ role: 'user', content: 'old result' }]);
  expect(store.history().load()).toEqual([]);
});

it('turning saving off retains previous saved history but stops writing new messages', async () => {
  const store = createConversationStore();
  store.history().save([{ role: 'user', content: 'saved question' }]);
  await store.setSaving(true);
  await store.setSaving(false);
  store.history().save([{ role: 'user', content: 'unsaved question' }]);
  await store.flush();
  expect(store.history().load()[0].content).toBe('unsaved question');
  const restored = createConversationStore();
  await restored.restoreSaved();
  expect(restored.history().load()[0].content).toBe('saved question');
});

it('rejects a stale tab write and preserves both the database and unsaved memory', async () => {
  const first = createConversationStore();
  first.history().save([{ role: 'user', content: 'initial' }]);
  await first.setSaving(true);
  const errors: unknown[] = [];
  const stale = createConversationStore(undefined, { onError: (error) => errors.push(error) });
  await stale.restoreSaved();
  await stale.setSaving(true);
  first.history().save([{ role: 'user', content: 'first tab edit' }]);
  await first.flush();
  stale.history().save([{ role: 'user', content: 'stale tab edit' }]);
  await expect(stale.flush()).rejects.toThrow(/another tab/i);
  expect(stale.saving).toBe(false);
  expect(stale.history().load()[0].content).toBe('stale tab edit');
  expect(errors).toHaveLength(1);
  const restored = createConversationStore();
  await restored.restoreSaved();
  expect(restored.history().load()[0].content).toBe('first tab edit');
});

it('deleting a conversation prevents late captured storage from resurrecting it', async () => {
  const store = createConversationStore();
  const id = store.activeId;
  const late = store.history();
  late.save([{ role: 'user', content: 'delete me' }]);
  await store.setSaving(true);
  await store.remove(id);
  late.save([{ role: 'assistant', content: 'late response' }]);
  await store.flush();
  expect(store.list().some((item) => item.id === id)).toBe(false);
  const restored = createConversationStore();
  await restored.restoreSaved();
  expect(restored.list().some((item) => item.id === id)).toBe(false);
});

it('clears saved, in-memory and legacy chat history without touching model or document storage', async () => {
  const store = createConversationStore();
  store.history().save([{ role: 'user', content: 'sensitive text' }]);
  await store.setSaving(true);
  createHistoryStorage().save([{ role: 'user', content: 'legacy sensitive text' }]);
  localStorage.setItem('unrelated-model-setting', 'preserved');
  await store.clearAll();
  expect(store.history().load()).toEqual([]);
  expect(createHistoryStorage().load()).toEqual([]);
  expect(localStorage.getItem('unrelated-model-setting')).toBe('preserved');
  const restored = createConversationStore();
  await restored.restoreSaved();
  expect(restored.history().load()).toEqual([]);
});

it('exports a detached versioned JSON snapshot and retains memory on quota failure', async () => {
  const store = createConversationStore(undefined, {
    repository: {
      clear: async () => 1,
      load: async () => null,
      save: async () => {
        throw new DOMException('Full', 'QuotaExceededError');
      },
    },
  });
  store.history().save([{ role: 'user', content: '<script>private</script>' }]);
  await expect(store.setSaving(true)).rejects.toMatchObject({ name: 'QuotaExceededError' });
  expect(store.history().load()[0].content).toBe('<script>private</script>');
  const exported = JSON.parse(store.exportJSON());
  expect(exported.version).toBe(1);
  expect(exported.sessions[0].messages).toEqual([{ role: 'user', content: '<script>private</script>' }]);
  expect(exported).not.toHaveProperty('apiKey');
});

it('cleans only empty leading assistant protocol markers in detached exports', () => {
  const store = createConversationStore();
  const messages = [
    { role: 'user' as const, content: '<think> </think> user example' },
    { role: 'assistant' as const, content: '<think>\n\n</think>\n\nHello!' },
    {
      role: 'assistant' as const,
      content: [
        { type: 'text' as const, text: '<think> </think> Answer' },
        { type: 'text' as const, text: '<think> </think> literal continuation' },
      ],
    },
    { role: 'assistant' as const, content: '<think>Actual content</think> Answer' },
    { role: 'assistant' as const, content: 'Example: <think> </think>' },
  ];
  store.history().save(messages);
  const exported = JSON.parse(store.exportJSON()).sessions[0].messages;
  expect(exported[0]).toEqual(messages[0]);
  expect(exported[1].content).toBe('Hello!');
  expect(exported[2].content).toEqual([{ type: 'text', text: 'Answer' }, messages[2].content[1]]);
  expect(exported[3]).toEqual(messages[3]);
  expect(exported[4]).toEqual(messages[4]);
  expect(store.history().load()).toEqual(messages);
});

it('turning saving off while an opt-in read is pending cancels the pending write', async () => {
  let finish!: () => void;
  let reads = 0;
  const save = vi.fn(async () => 1);
  const store = createConversationStore(undefined, {
    repository: {
      clear: async () => 1,
      load: async () => {
        reads++;
        await new Promise<void>((resolve) => {
          finish = resolve;
        });
        return null;
      },
      save,
    },
  });
  store.history().save([{ role: 'user', content: 'must stay private' }]);
  const enabling = store.setSaving(true);
  await vi.waitFor(() => expect(reads).toBe(1));
  const disabling = store.setSaving(false);
  finish();
  await Promise.all([enabling, disabling]);
  expect(store.saving).toBe(false);
  expect(save).not.toHaveBeenCalled();
});

it('preserves a deliberately cleared conversation when saved history is restored', async () => {
  const store = createConversationStore();
  store.history().save([{ role: 'user', content: 'old text' }]);
  await store.setSaving(true);
  await store.setSaving(false);
  store.history().clear();
  await store.restoreSaved();
  expect(store.history().load()).toEqual([]);
});

it('deleting a saved conversation still removes its persisted copy when saving is off', async () => {
  const store = createConversationStore();
  const id = store.activeId;
  store.history().save([{ role: 'user', content: 'saved record' }]);
  await store.setSaving(true);
  await store.setSaving(false);
  store.history().save([{ role: 'user', content: 'unsaved changes' }]);
  await store.remove(id);
  const restored = createConversationStore();
  await restored.restoreSaved();
  expect(restored.list().some((item) => item.id === id)).toBe(false);
});

it('restoring saved history adopts another tab changes when this tab has no local edits', async () => {
  const first = createConversationStore();
  first.history().save([{ role: 'user', content: 'original' }]);
  await first.setSaving(true);
  const clean = createConversationStore();
  await clean.restoreSaved();
  first.history().save([{ role: 'user', content: 'updated elsewhere' }]);
  await first.flush();
  await clean.restoreSaved();
  expect(clean.history().load()[0].content).toBe('updated elsewhere');
});

it('persists messages entered while enabling saving waits for its first commit', async () => {
  let finish!: () => void;
  const writes: unknown[] = [];
  const store = createConversationStore(undefined, {
    repository: {
      clear: async () => 1,
      load: async () => null,
      save: async (data, revision) => {
        writes.push(structuredClone(data));
        if (!revision)
          await new Promise<void>((resolve) => {
            finish = resolve;
          });
        return revision + 1;
      },
    },
  });
  store.history().save([{ role: 'user', content: 'first' }]);
  const enabling = store.setSaving(true);
  await vi.waitFor(() => expect(writes).toHaveLength(1));
  store.history().save([{ role: 'user', content: 'latest' }]);
  finish();
  await enabling;
  await store.flush();
  expect(writes.at(-1)).toMatchObject({
    sessions: [expect.objectContaining({ messages: [{ role: 'user', content: 'latest' }] })],
  });
});

it('imports conversation metadata without carrying unrelated legacy credentials into exports', async () => {
  localStorage.setItem(
    'agent_sessions_v1',
    JSON.stringify({
      sessions: [
        {
          id: 'default',
          title: 'old',
          createdAt: 1,
          updatedAt: 2,
          apiKey: 'legacy-secret',
          systemPrompt: 'legacy-settings',
        },
      ],
    }),
  );
  createHistoryStorage().save([{ role: 'user', content: 'retained question' }]);
  const store = createConversationStore();
  await store.importLegacy();
  expect(store.history().load()[0].content).toBe('retained question');
  expect(store.exportJSON()).not.toContain('legacy-secret');
  expect(store.exportJSON()).not.toContain('legacy-settings');
});

it('retains current and legacy history when confirmed disk deletion cannot commit', async () => {
  createHistoryStorage().save([{ role: 'user', content: 'legacy private' }]);
  const store = createConversationStore(undefined, {
    repository: {
      load: async () => null,
      save: async () => 1,
      clear: async () => {
        throw new DOMException('Cannot commit', 'QuotaExceededError');
      },
    },
  });
  store.history().save([{ role: 'user', content: 'current private' }]);
  await expect(store.clearAll()).rejects.toMatchObject({ name: 'QuotaExceededError' });
  expect(store.history().load()[0].content).toBe('current private');
  expect(createHistoryStorage().load()[0].content).toBe('legacy private');
  expect(store.exportJSON()).toContain('current private');
});
