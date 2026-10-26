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

// Only detached, recursively immutable plain data may skip repeated validation.
// Object.freeze(Date/Map) does not freeze their contents: those remain uncached.
const preparedRecords = new WeakMap<ConversationRecord, string>();
function freezePlainData(value: unknown, seen = new WeakSet<object>()): boolean {
  if (value === null || typeof value !== 'object') return true;
  if (seen.has(value)) return true;
  const prototype = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) return false;
  seen.add(value);
  const plain = Object.values(value)
    .map((child) => freezePlainData(child, seen))
    .every(Boolean);
  if (plain) Object.freeze(value);
  return plain;
}

/** Prepare an owned snapshot once; arbitrary repository callers remain mutable. */
export function prepareConversationRecord(record: ConversationRecord): ConversationRecord {
  if (!isConversationRecord(record)) throw new Error('Saved conversation data is invalid');
  const copy = structuredClone(normalizeRecord(record));
  if (freezePlainData(copy)) preparedRecords.set(copy, JSON.stringify(copy));
  return copy;
}

export const CONVERSATION_DB_NAME = 'document-ai-conversations';
export function validConversationId(value: unknown): value is string {
  return typeof value === 'string' && /^(?:default|[a-f0-9-]{36})$/.test(value);
}

export function isConversationRecord(value: unknown): value is ConversationRecord {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as ConversationRecord;
  if (preparedRecords.has(item)) return true;
  return (
    validConversationId(item.id) &&
    typeof item.title === 'string' &&
    Number.isFinite(item.createdAt) &&
    Number.isFinite(item.updatedAt) &&
    Array.isArray(item.messages) &&
    item.messages.every(isMessage)
  );
}

function normalizeRecord(record: ConversationRecord): ConversationRecord {
  if (preparedRecords.has(record)) return record;
  const { id, title, createdAt, updatedAt, messages } = record;
  return { id, title, createdAt, updatedAt, messages };
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
    sessions: stored.sessions.map(normalizeRecord),
  };
}

export class ConversationConflictError extends Error {
  constructor() {
    super(
      'Saved conversations changed in another tab. Keep local copies and restore saved history to preserve both versions.',
    );
    this.name = 'ConversationConflictError';
  }
}

interface ConversationIndex {
  version: 2;
  revision: number;
  activeId: string;
  sessionIds: string[];
}

function indexFor(data: StoredConversations): ConversationIndex {
  return {
    version: 2,
    revision: data.revision,
    activeId: data.activeId,
    sessionIds: data.sessions.map((item) => item.id),
  };
}

function validateIndex(value: unknown): ConversationIndex | null {
  if (value === undefined) return null;
  const index = value as ConversationIndex;
  if (
    !index ||
    index.version !== 2 ||
    !Number.isSafeInteger(index.revision) ||
    index.revision < 1 ||
    !Array.isArray(index.sessionIds) ||
    !index.sessionIds.every(validConversationId) ||
    new Set(index.sessionIds).size !== index.sessionIds.length ||
    (index.sessionIds.length ? !index.sessionIds.includes(index.activeId) : index.activeId !== '')
  )
    throw new Error('Saved conversation data is invalid');
  return index;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('Conversation storage is unavailable'));
      return;
    }
    const request = indexedDB.open(CONVERSATION_DB_NAME, 2);
    let abandoned = false;
    request.onupgradeneeded = (event) => {
      const db = request.result;
      const transaction = request.transaction!;
      if (event.oldVersion === 0) db.createObjectStore('conversations');
      const sessions = db.createObjectStore('sessions');
      const conversations = transaction.objectStore('conversations');
      const old = conversations.get('state');
      old.onsuccess = () => {
        let stored: StoredConversations | null;
        try {
          stored = validateStored(old.result);
        } catch {
          // Keep damaged v1 data available for explicit erasure; load/save still reject it.
          return;
        }
        if (!stored) return;
        for (const item of stored.sessions) sessions.put(item, item.id);
        conversations.put(indexFor(stored), 'state');
      };
    };
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

/** Session changes, deletions and the global revision/index commit in one transaction. */
export function createConversationRepository(): ConversationRepository {
  // Exact serialized records avoid rereading/structured-cloning unchanged persisted messages.
  // They are usable only after comparing the cached global revision in the transaction.
  let cachedRevision: number | undefined;
  let cachedSessions = new Map<string, string>();
  async function transact(
    data?: ConversationData,
    expectedRevision?: number,
    clear = false,
  ): Promise<StoredConversations | null> {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      let result: StoredConversations | null = null;
      let failure: unknown;
      let serialized = new Map<string, string>();
      let transaction: IDBTransaction;
      try {
        transaction = db.transaction(['conversations', 'sessions'], data || clear ? 'readwrite' : 'readonly');
      } catch (error) {
        db.close();
        reject(error);
        return;
      }
      const fail = (error: unknown) => {
        failure = error;
        transaction.abort();
      };
      transaction.oncomplete = () => {
        db.close();
        cachedRevision = result?.revision ?? 0;
        cachedSessions = serialized;
        resolve(result);
      };
      transaction.onabort = () => {
        db.close();
        reject(failure ?? transaction.error ?? new Error('Conversation storage transaction aborted'));
      };
      const store = transaction.objectStore('conversations');
      const sessions = transaction.objectStore('sessions');
      const request = store.get('state');
      request.onsuccess = () => {
        try {
          if (clear) {
            // Erasure also works for damaged legacy/index/messages, without decoding their contents.
            const previous = request.result?.revision;
            const revision =
              Number.isSafeInteger(previous) && previous >= 0 && previous < Number.MAX_SAFE_INTEGER
                ? previous + 1
                : request.result === undefined
                  ? 1
                  : Date.now();
            result = { version: 1, revision, activeId: '', sessions: [] };
            sessions.clear();
            store.put(indexFor(result), 'state');
            return;
          }
          const index = validateIndex(request.result);
          if (data) {
            if ((index?.revision ?? 0) !== expectedRevision) throw new ConversationConflictError();
            // Normalize host records too, so unrelated properties never enter saved history.
            result = validateStored({ ...data, revision: (index?.revision ?? 0) + 1 })!;
            serialized = new Map(
              result.sessions.map((item) => [item.id, preparedRecords.get(item) ?? JSON.stringify(item)]),
            );
            const nextIds = new Set(serialized.keys());
            for (const id of index?.sessionIds ?? []) if (!nextIds.has(id)) sessions.delete(id);
            for (const item of result.sessions) {
              const text = serialized.get(item.id)!;
              if (cachedRevision === (index?.revision ?? 0)) {
                if (cachedSessions.get(item.id) !== text) sessions.put(item, item.id);
              } else if (!index?.sessionIds.includes(item.id)) {
                sessions.put(item, item.id);
              } else {
                // A fresh repository may be used to save without loading. Compare existing records once.
                const previous = sessions.get(item.id);
                previous.onsuccess = () => {
                  try {
                    if (!isConversationRecord(previous.result) || previous.result.id !== item.id)
                      throw new Error('Saved conversation data is invalid');
                    if (JSON.stringify(normalizeRecord(previous.result)) !== text) sessions.put(item, item.id);
                  } catch (error) {
                    fail(error);
                  }
                };
              }
            }
            store.put(indexFor(result), 'state');
          } else if (index) {
            result = { version: 1, revision: index.revision, activeId: index.activeId, sessions: [] };
            const records = new Map<string, ConversationRecord>();
            for (const id of index.sessionIds) {
              const record = sessions.get(id);
              record.onsuccess = () => {
                try {
                  if (!isConversationRecord(record.result) || record.result.id !== id)
                    throw new Error('Saved conversation data is invalid');
                  const item = normalizeRecord(record.result);
                  records.set(id, item);
                  serialized.set(id, JSON.stringify(item));
                  if (records.size === index.sessionIds.length)
                    result!.sessions = index.sessionIds.map((sessionId) => records.get(sessionId)!);
                } catch (error) {
                  fail(error);
                }
              };
            }
          }
        } catch (error) {
          fail(error);
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
