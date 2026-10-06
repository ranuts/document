import 'fake-indexeddb/auto';
import { createConversationStore } from '../../lib/agent-plugin/ui/sessions';
import { beforeEach, expect, it } from 'vitest';
import {
  CONVERSATION_DB_NAME,
  createConversationRepository,
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
    const opening = indexedDB.open(CONVERSATION_DB_NAME, 1);
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
