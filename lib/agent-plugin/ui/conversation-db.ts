import type { LLMMessage } from '@ranuts/agent-core/llm/types';
import { isMessage } from './storage';

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}
export interface ConversationRecord extends Conversation {
  messages: LLMMessage[];
}
export interface ConversationData {
  version: 1;
  activeId: string;
  sessions: ConversationRecord[];
}
export interface StoredConversations extends ConversationData {
  revision: number;
}
export interface ConversationRepository {
  load(): Promise<StoredConversations | null>;
  save(data: ConversationData, expectedRevision: number): Promise<number>;
  clear(): Promise<number>;
}

export const CONVERSATION_DB_NAME = 'document-ai-conversations';
export function validConversationId(value: unknown): value is string {
  return typeof value === 'string' && /^(?:default|[a-f0-9-]{36})$/.test(value);
}

export function isConversationRecord(value: unknown): value is ConversationRecord {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as ConversationRecord;
  return (
    validConversationId(item.id) &&
    typeof item.title === 'string' &&
    Number.isFinite(item.createdAt) &&
    Number.isFinite(item.updatedAt) &&
    Array.isArray(item.messages) &&
    item.messages.every(isMessage)
  );
}

function validateStored(value: unknown): StoredConversations | null {
  if (value === undefined) return null;
  if (typeof value !== 'object' || value === null) throw new Error('Saved conversation data is invalid');
  const stored = value as StoredConversations;
  if (
    stored.version !== 1 ||
    !Number.isSafeInteger(stored.revision) ||
    stored.revision < 1 ||
    !Array.isArray(stored.sessions) ||
    !stored.sessions.every(isConversationRecord) ||
    new Set(stored.sessions.map((item) => item.id)).size !== stored.sessions.length ||
    (stored.sessions.length ? !stored.sessions.some((item) => item.id === stored.activeId) : stored.activeId !== '')
  )
    throw new Error('Saved conversation data is invalid');
  return {
    version: 1,
    revision: stored.revision,
    activeId: stored.activeId,
    sessions: stored.sessions.map(({ id, title, createdAt, updatedAt, messages }) => ({
      id,
      title,
      createdAt,
      updatedAt,
      messages,
    })),
  };
}

export class ConversationConflictError extends Error {
  constructor() {
    super('Saved conversations changed in another tab. Export this conversation before restoring saved history.');
    this.name = 'ConversationConflictError';
  }
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('Conversation storage is unavailable'));
      return;
    }
    const request = indexedDB.open(CONVERSATION_DB_NAME, 1);
    let abandoned = false;
    request.onupgradeneeded = () => request.result.createObjectStore('conversations');
    request.onblocked = () => {
      abandoned = true;
      reject(new Error('Close other tabs to open conversation storage'));
    };
    request.onerror = () => reject(request.error ?? new Error('Conversation storage could not open'));
    request.onsuccess = () => {
      if (abandoned) {
        request.result.close();
        return;
      }
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
  });
}

/** One transaction compares the revision and commits the entire conversation index. */
export function createConversationRepository(): ConversationRepository {
  async function transact(
    data?: ConversationData,
    expectedRevision?: number,
    clear = false,
  ): Promise<StoredConversations | null> {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      let result: StoredConversations | null = null;
      let failure: unknown;
      let transaction: IDBTransaction;
      try {
        transaction = db.transaction('conversations', data || clear ? 'readwrite' : 'readonly');
      } catch (error) {
        db.close();
        reject(error);
        return;
      }
      transaction.oncomplete = () => {
        db.close();
        resolve(result);
      };
      transaction.onabort = () => {
        db.close();
        reject(failure ?? transaction.error ?? new Error('Conversation storage transaction aborted'));
      };
      const store = transaction.objectStore('conversations');
      const request = store.get('state');
      request.onsuccess = () => {
        try {
          if (clear) {
            // Confirmed erasure must not depend on parsing potentially damaged messages.
            // Read and replace in one transaction so another tab cannot slip in a write.
            const previous = request.result?.revision;
            const revision =
              Number.isSafeInteger(previous) && previous >= 0 && previous < Number.MAX_SAFE_INTEGER
                ? previous + 1
                : request.result === undefined
                  ? 1
                  : Date.now();
            result = { version: 1, revision, activeId: '', sessions: [] };
            store.put(result, 'state');
            return;
          }
          result = validateStored(request.result);
          if (data) {
            if ((result?.revision ?? 0) !== expectedRevision) throw new ConversationConflictError();
            result = { ...data, revision: (result?.revision ?? 0) + 1 };
            // Validate the host snapshot too; malformed input must not replace existing history.
            validateStored(result);
            store.put(result, 'state');
          }
        } catch (error) {
          failure = error;
          transaction.abort();
        }
      };
    });
  }
  return {
    load: () => transact(),
    save: async (data, expectedRevision) => (await transact(data, expectedRevision))!.revision,
    clear: async () => (await transact(undefined, undefined, true))!.revision,
  };
}
