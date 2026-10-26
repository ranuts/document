import 'fake-indexeddb/auto';
import { createConversationStore } from '../../lib/agent-plugin/ui/sessions';
import { beforeEach, expect, it, vi } from 'vitest';
import {
  CONVERSATION_DB_NAME,
  createConversationRepository,
  prepareConversationRecord,
  type ConversationData,
} from '../../lib/agent-plugin/ui/conversation-db';

beforeEach(async () => {
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(CONVERSATION_DB_NAME);
    request.onsuccess = () => resolve();
  });
});
const data: ConversationData = {
  version: 1,
  activeId: 'default',
  sessions: [
    { id: 'default', title: 'question', createdAt: 1, updatedAt: 2, messages: [{ role: 'user', content: 'private' }] },
  ],
};

it('commits versioned data and atomically rejects competing revisions', async () => {
  const repository = createConversationRepository();
  const revision = await repository.save(data, 0);
  expect(revision).toBe(1);
  const results = await Promise.allSettled([
    repository.save({ ...data, sessions: [{ ...data.sessions[0], title: 'first' }] }, 1),
    repository.save({ ...data, sessions: [{ ...data.sessions[0], title: 'second' }] }, 1),
  ]);
  expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
  expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
  expect((await repository.load())?.revision).toBe(2);
});

it('retains valid history if malformed input attempts to replace it', async () => {
  const repository = createConversationRepository();
  await repository.save(data, 0);
  await expect(repository.save({ ...data, activeId: 'missing' }, 1)).rejects.toThrow(/invalid/i);
  expect((await repository.load())?.sessions[0].messages).toEqual([{ role: 'user', content: 'private' }]);
});

it('clears malformed records and invalidates stale writers with a revision tombstone', async () => {
  const repository = createConversationRepository();
  await repository.save(data, 0);
  await new Promise<void>((resolve, reject) => {
    const opening = indexedDB.open(CONVERSATION_DB_NAME);
    opening.onsuccess = () => {
      const db = opening.result;
      const tx = db.transaction('conversations', 'readwrite');
      tx.objectStore('conversations').put({ version: 1, revision: 1, sessions: 'corrupted private content' }, 'state');
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onabort = () => {
        db.close();
        reject(tx.error);
      };
    };
    opening.onerror = () => reject(opening.error);
  });
  await expect(repository.load()).rejects.toThrow(/invalid/i);
  const store = createConversationStore();
  store.history().save([{ role: 'user', content: 'memory private content' }]);
  await store.clearAll();
  expect(store.history().load()).toEqual([]);
  expect(await repository.load()).toEqual({ version: 1, revision: 2, activeId: '', sessions: [] });
  await expect(repository.save(data, 1)).rejects.toThrow(/another tab/i);
});

it('writes only the changed session and keeps active selection and removals atomic', async () => {
  const other = '00000000-0000-0000-0000-000000000001';
  const initial: ConversationData = {
    ...data,
    sessions: [...data.sessions, { ...data.sessions[0], id: other, title: 'unchanged' }],
  };
  const repository = createConversationRepository();
  await repository.save(initial, 0);
  const put = vi.spyOn(IDBObjectStore.prototype, 'put');
  const get = vi.spyOn(IDBObjectStore.prototype, 'get');
  try {
    await repository.save(
      { ...initial, sessions: [{ ...initial.sessions[0], title: 'changed' }, initial.sessions[1]] },
      1,
    );
    const writes = put.mock.calls.map((args, index) => ({
      name: (put.mock.contexts[index] as IDBObjectStore).name,
      args,
    }));
    expect(writes.filter(({ name }) => name === 'sessions').map(({ args }) => args[0].id)).toEqual(['default']);
    expect(get.mock.contexts.filter((store) => (store as IDBObjectStore).name === 'sessions')).toHaveLength(0);
    put.mockClear();
    await repository.save(
      { ...initial, activeId: other, sessions: [{ ...initial.sessions[0], title: 'changed' }, initial.sessions[1]] },
      2,
    );
    expect(put.mock.contexts.filter((store) => (store as IDBObjectStore).name === 'sessions')).toHaveLength(0);
    await repository.save({ version: 1, activeId: other, sessions: [initial.sessions[1]] }, 3);
    expect(await repository.load()).toEqual({
      version: 1,
      revision: 4,
      activeId: other,
      sessions: [initial.sessions[1]],
    });
  } finally {
    put.mockRestore();
    get.mockRestore();
  }
});

it('migrates v1 state into separate records without changing history or its revision', async () => {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open(CONVERSATION_DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('conversations');
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('conversations', 'readwrite');
      tx.objectStore('conversations').put({ ...data, revision: 7 }, 'state');
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onabort = () => {
        db.close();
        reject(tx.error);
      };
    };
    request.onerror = () => reject(request.error);
  });
  const repository = createConversationRepository();
  expect(await repository.load()).toEqual({ ...data, revision: 7 });
  const put = vi.spyOn(IDBObjectStore.prototype, 'put');
  try {
    expect(await repository.save(data, 7)).toBe(8);
    expect(put.mock.contexts.filter((store) => (store as IDBObjectStore).name === 'sessions')).toHaveLength(0);
  } finally {
    put.mockRestore();
  }
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open(CONVERSATION_DB_NAME);
    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('sessions')) {
        db.close();
        reject(new Error('Saved messages were not migrated to per-session records'));
        return;
      }
      const tx = db.transaction(['conversations', 'sessions'], 'readonly');
      const state = tx.objectStore('conversations').get('state');
      const session = tx.objectStore('sessions').get('default');
      tx.oncomplete = () => {
        db.close();
        expect(state.result).not.toHaveProperty('sessions');
        expect(session.result).toEqual(data.sessions[0]);
        resolve();
      };
      tx.onabort = () => {
        db.close();
        reject(tx.error);
      };
    };
    request.onerror = () => reject(request.error);
  });
});

it('a fresh repository avoids rewriting unchanged sessions without requiring a prior load', async () => {
  await createConversationRepository().save(data, 0);
  const repository = createConversationRepository();
  const put = vi.spyOn(IDBObjectStore.prototype, 'put');
  try {
    expect(await repository.save(structuredClone(data), 1)).toBe(2);
    expect(put.mock.contexts.filter((store) => (store as IDBObjectStore).name === 'sessions')).toHaveLength(0);
    expect(await repository.load()).toEqual({ ...data, revision: 2 });
  } finally {
    put.mockRestore();
  }
});

it('detects a caller mutating a previously loaded record rather than trusting object identity', async () => {
  const repository = createConversationRepository();
  await repository.save(data, 0);
  const loaded = (await repository.load())!;
  loaded.sessions[0].messages[0].content = 'changed in place';
  await repository.save(loaded, 1);
  expect((await createConversationRepository().load())?.sessions[0].messages[0].content).toBe('changed in place');
});

it('rolls back session writes and the revision together when a later session write fails', async () => {
  const other = '00000000-0000-0000-0000-000000000001';
  const initial: ConversationData = { ...data, sessions: [...data.sessions, { ...data.sessions[0], id: other }] };
  const repository = createConversationRepository();
  await repository.save(initial, 0);
  const originalPut = IDBObjectStore.prototype.put;
  const put = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, value, key) {
    if (this.name === 'sessions' && key === other) throw new DOMException('Full', 'QuotaExceededError');
    return originalPut.call(this, value, key);
  });
  try {
    await expect(
      repository.save({ ...initial, sessions: initial.sessions.map((item) => ({ ...item, title: 'changed' })) }, 1),
    ).rejects.toMatchObject({ name: 'QuotaExceededError' });
  } finally {
    put.mockRestore();
  }
  expect(await repository.load()).toEqual({ ...initial, revision: 1 });
});

it('rejects a blocked v1 upgrade and closes the abandoned connection after other tabs release it', async () => {
  const legacy = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(CONVERSATION_DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('conversations');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = legacy.transaction('conversations', 'readwrite');
      tx.objectStore('conversations').put({ ...data, revision: 5 }, 'state');
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error);
    });
    await expect(createConversationRepository().load()).rejects.toThrow(/Close other tabs/i);
  } finally {
    legacy.close();
  }
  expect(await createConversationRepository().load()).toEqual({ ...data, revision: 5 });
});

it('normalizes externally stored records before exposing them through the repository', async () => {
  const repository = createConversationRepository();
  await repository.save(data, 0);
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open(CONVERSATION_DB_NAME);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('sessions', 'readwrite');
      tx.objectStore('sessions').put({ ...data.sessions[0], apiKey: 'not conversation data' }, 'default');
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onabort = () => {
        db.close();
        reject(tx.error);
      };
    };
    request.onerror = () => reject(request.error);
  });
  expect((await repository.load())?.sessions[0]).not.toHaveProperty('apiKey');
});

it('keeps damaged v1 history erasable after upgrading and retains its revision tombstone', async () => {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open(CONVERSATION_DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('conversations');
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('conversations', 'readwrite');
      tx.objectStore('conversations').put({ version: 1, revision: 7, sessions: 'damaged private text' }, 'state');
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onabort = () => {
        db.close();
        reject(tx.error);
      };
    };
    request.onerror = () => reject(request.error);
  });
  const repository = createConversationRepository();
  await expect(repository.load()).rejects.toThrow(/invalid/i);
  expect(await repository.clear()).toBe(8);
  expect(await repository.load()).toEqual({ version: 1, revision: 8, activeId: '', sessions: [] });
  await expect(repository.save(data, 7)).rejects.toThrow(/another tab/i);
});

it('a racing erase cannot be undone by a save from the previous revision', async () => {
  const writer = createConversationRepository();
  await writer.save(data, 0);
  const eraser = createConversationRepository();
  const results = await Promise.allSettled([
    writer.save({ ...data, sessions: [{ ...data.sessions[0], title: 'racing edit' }] }, 1),
    eraser.clear(),
  ]);
  expect(results[1].status).toBe('fulfilled');
  const erased = await writer.load();
  expect(erased?.sessions).toEqual([]);
  expect(erased?.activeId).toBe('');
  expect(erased?.revision).toBeGreaterThanOrEqual(2);
  await expect(writer.save(data, 1)).rejects.toThrow(/another tab/i);
});

it('reuses only owned immutable prepared records across saves', async () => {
  const repository = createConversationRepository();
  const original = structuredClone(data.sessions[0]);
  const prepared = prepareConversationRecord(original);
  original.messages[0].content = 'changed outside';
  expect(prepared.messages[0].content).toBe('private');
  expect(() => {
    prepared.messages[0].content = 'mutated';
  }).toThrow();
  const stringify = vi.spyOn(JSON, 'stringify');
  try {
    await repository.save({ ...data, sessions: [prepared] }, 0);
    await repository.save({ ...data, sessions: [prepared] }, 1);
    expect(stringify).not.toHaveBeenCalled();
    const changed = prepareConversationRecord({ ...prepared, title: 'new title' });
    await repository.save({ ...data, sessions: [changed] }, 2);
    expect(stringify).toHaveBeenCalledOnce();
  } finally {
    stringify.mockRestore();
  }
  expect((await repository.load())?.sessions[0].title).toBe('new title');
});

it('never trusts identity caching for mutable external records', async () => {
  const repository = createConversationRepository();
  const mutable = structuredClone(data);
  await repository.save(mutable, 0);
  mutable.sessions[0].messages[0].content = 'nested change';
  await repository.save(mutable, 1);
  expect((await repository.load())?.sessions[0].messages[0].content).toBe('nested change');
});

it('does not brand mutable exotic objects as immutable prepared data', async () => {
  const repository = createConversationRepository();
  const record = prepareConversationRecord({
    ...data.sessions[0],
    messages: [
      { role: 'assistant', content: [{ type: 'tool_use', id: 'tool', name: 'read', input: { date: new Date(0) } }] },
    ],
  });
  await repository.save({ ...data, sessions: [record] }, 0);
  const blocks = record.messages[0].content as Array<{ input: { date: Date } }>;
  blocks[0].input.date.setTime(1000);
  await repository.save({ ...data, sessions: [record] }, 1);
  const saved = (await repository.load())!.sessions[0].messages[0].content as Array<{ input: { date: Date } }>;
  expect(saved[0].input.date.getTime()).toBe(1000);
});
