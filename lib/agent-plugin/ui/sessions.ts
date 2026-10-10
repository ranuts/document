import { localStorageGetItem } from 'ranuts/utils';
import type { LLMMessage } from '@ranuts/agent-core/llm/types';
import { createHistoryStorage, type HistoryStorage } from './storage';
import {
  ConversationConflictError,
  createConversationRepository,
  validConversationId,
  type Conversation,
  type ConversationData,
  type ConversationRecord,
  type ConversationRepository,
  type StoredConversations,
} from './conversation-db';
export type { Conversation } from './conversation-db';

export interface ConversationStoreOptions {
  repository?: ConversationRepository;
  onError?: (error: unknown) => void;
}
function blankConversation(): ConversationRecord {
  const now = Date.now();
  return { id: crypto.randomUUID(), title: '', createdAt: now, updatedAt: now, messages: [] };
}
function titleFor(messages: LLMMessage[]): string {
  const first = messages.find((message) => message.role === 'user' && typeof message.content === 'string');
  return typeof first?.content === 'string' ? first.content.replace(/\s+/g, ' ').trim().slice(0, 60) : '';
}

/** Memory is authoritative for this page; disk writes require an explicit opt-in. */
export function createConversationStore(onChange?: () => void, options: ConversationStoreOptions = {}) {
  const repository = options.repository ?? createConversationRepository();
  let sessions = [blankConversation()];
  let active = sessions[0].id;
  let saving = false;
  let epoch = 0;
  let knownRevision: number | undefined;
  let memoryRevision = 0;
  let dirty = false;
  const touched = new Set<string>();
  const removed = new Set<string>();
  let savedIds = new Set<string>();
  let queue: Promise<unknown> = Promise.resolve();
  let lastError: unknown;

  const snapshot = (): ConversationData => structuredClone({ version: 1, activeId: active, sessions });
  const enqueue = <T>(operation: () => Promise<T>): Promise<T> => {
    const task = queue.then(operation);
    queue = task.catch((error) => {
      saving = false;
      epoch++;
      lastError = error;
      options.onError?.(error);
      onChange?.();
    });
    return task;
  };
  const persist = (): void => {
    if (!saving) return;
    const data = snapshot();
    const attempt = epoch;
    const revision = memoryRevision;
    void enqueue(async () => {
      if (!saving || attempt !== epoch) return;
      knownRevision = await repository.save(data, knownRevision ?? 0);
      savedIds = new Set(data.sessions.map((item) => item.id));
      if (revision === memoryRevision) {
        dirty = false;
        touched.clear();
        removed.clear();
      }
    });
  };
  const changed = (): void => {
    memoryRevision++;
    dirty = true;
    onChange?.();
    persist();
  };
  const mergeSaved = (stored: StoredConversations | null): void => {
    if (!stored) {
      knownRevision = 0;
      return;
    }
    const current = sessions.filter(
      (item) =>
        (item.messages.length || item.title || touched.has(item.id)) &&
        (!savedIds.has(item.id) || touched.has(item.id)),
    );
    if (
      knownRevision !== undefined &&
      knownRevision !== stored.revision &&
      dirty &&
      current.some((item) =>
        stored.sessions.some((saved) => saved.id === item.id && JSON.stringify(saved) !== JSON.stringify(item)),
      )
    )
      throw new ConversationConflictError();
    const imported = structuredClone(stored.sessions).filter((item) => !removed.has(item.id));
    for (const item of current) {
      const index = imported.findIndex((saved) => saved.id === item.id);
      if (index < 0) imported.push(item);
      else imported[index] = item;
    }
    if (!imported.length) imported.push(blankConversation());
    sessions = imported;
    if (!current.some((item) => item.id === active))
      active = sessions.some((item) => item.id === stored.activeId) ? stored.activeId : sessions[0].id;
    knownRevision = stored.revision;
    savedIds = new Set(stored.sessions.map((item) => item.id));
    onChange?.();
  };
  const list = (): Conversation[] =>
    sessions
      .map(({ messages: _messages, ...item }) => ({ ...item }))
      .sort((a, b) => Number(b.id === active) - Number(a.id === active) || b.updatedAt - a.updatedAt);
  const history = (id = active): HistoryStorage => {
    if (!sessions.some((item) => item.id === id)) throw new Error('Unknown conversation');
    const save = (messages: LLMMessage[]) => {
      const item = sessions.find((item) => item.id === id);
      // A detached controller may finish after deletion. It must never resurrect history.
      if (!item) return;
      item.messages = structuredClone(messages);
      touched.add(id);
      item.title = titleFor(messages);
      item.updatedAt = Date.now();
      changed();
    };
    return {
      load: () => structuredClone(sessions.find((item) => item.id === id)?.messages ?? []),
      save,
      clear: () => save([]),
    };
  };
  return {
    get activeId() {
      return active;
    },
    get saving() {
      return saving;
    },
    list,
    history,
    create: () => {
      const item = blankConversation();
      sessions.push(item);
      touched.add(item.id);
      active = item.id;
      changed();
      return { id: item.id, title: item.title, createdAt: item.createdAt, updatedAt: item.updatedAt };
    },
    select: (id: string) => {
      if (!sessions.some((item) => item.id === id)) throw new Error('Unknown conversation');
      if (active === id) return;
      active = id;
      changed();
    },
    remove: async (id: string): Promise<void> => {
      if (!sessions.some((item) => item.id === id)) throw new Error('Unknown conversation');
      sessions = sessions.filter((item) => item.id !== id);
      removed.add(id);
      if (!sessions.length) sessions.push(blankConversation());
      if (active === id) active = sessions[0].id;
      changed();
      if (!saving && savedIds.has(id)) {
        await enqueue(async () => {
          const stored = await repository.load();
          if ((stored?.revision ?? 0) !== knownRevision) throw new ConversationConflictError();
          const remaining = stored?.sessions.filter((item) => item.id !== id) ?? [];
          knownRevision = await repository.save(
            {
              version: 1,
              activeId: remaining.some((item) => item.id === stored?.activeId)
                ? stored!.activeId
                : (remaining[0]?.id ?? ''),
              sessions: remaining,
            },
            knownRevision ?? 0,
          );
          savedIds.delete(id);
        });
      } else {
        await queue;
        if (lastError !== undefined) throw lastError;
      }
    },
    flush: async (): Promise<void> => {
      await queue;
      if (lastError !== undefined) throw lastError;
    },
    restoreSaved: (): Promise<void> =>
      enqueue(async () => {
        lastError = undefined;
        mergeSaved(await repository.load());
      }),
    setSaving: async (enabled: boolean): Promise<void> => {
      if (!enabled) {
        saving = false;
        epoch++;
        onChange?.();
        await queue;
        return;
      }
      const attempt = ++epoch;
      return enqueue(async () => {
        lastError = undefined;
        const stored = await repository.load();
        if (attempt !== epoch) return;
        mergeSaved(stored);
        const data = snapshot();
        const revision = memoryRevision;
        if (
          !stored ||
          JSON.stringify(data) !==
            JSON.stringify({ version: stored.version, activeId: stored.activeId, sessions: stored.sessions })
        ) {
          knownRevision = await repository.save(data, knownRevision ?? 0);
          savedIds = new Set(data.sessions.map((item) => item.id));
        }
        if (revision === memoryRevision) {
          dirty = false;
          touched.clear();
          removed.clear();
        }
        if (attempt !== epoch) return;
        saving = true;
        onChange?.();
        if (revision !== memoryRevision) persist();
      });
    },
    importLegacy: async (): Promise<void> => {
      let indexed: Conversation[] = [];
      try {
        const old = JSON.parse(localStorageGetItem('agent_sessions_v1') || 'null');
        if (Array.isArray(old?.sessions))
          indexed = old.sessions.filter(
            (item: Conversation) =>
              item &&
              validConversationId(item.id) &&
              typeof item.title === 'string' &&
              Number.isFinite(item.createdAt) &&
              Number.isFinite(item.updatedAt),
          );
      } catch {
        /* The default legacy conversation can still be imported. */
      }
      const now = Date.now();
      if (!indexed.some((item) => item.id === 'default'))
        indexed.unshift({ id: 'default', title: '', createdAt: now, updatedAt: now });
      const imported = indexed
        .map(({ id, title, createdAt, updatedAt }) => ({
          id,
          title,
          createdAt,
          updatedAt,
          messages: createHistoryStorage(id).load(),
        }))
        .filter((item) => item.messages.length && !sessions.some((existing) => existing.id === item.id));
      if (!imported.length) return;
      sessions = [...sessions.filter((item) => item.messages.length || item.title), ...imported];
      if (!sessions.some((item) => item.id === active)) active = imported[0].id;
      changed();
      await queue;
      if (lastError !== undefined) throw lastError;
    },
    clearAll: (): Promise<void> => {
      saving = false;
      epoch++;
      return enqueue(async () => {
        lastError = undefined;
        // Keep a revision tombstone so stale tabs cannot silently resurrect deleted records.
        knownRevision = await repository.clear();
        const keys = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index));
        for (const key of keys)
          if (key === 'agent_sessions_v1' || key?.startsWith('agent_history_')) localStorage.removeItem(key);
        sessions = [blankConversation()];
        touched.clear();
        removed.clear();
        savedIds.clear();
        active = sessions[0].id;
        dirty = false;
        memoryRevision++;
        onChange?.();
      });
    },
    exportJSON: (): string => {
      const exported = snapshot();
      // Clean an empty model protocol prefix only in this detached download.
      const clean = (text: string) => text.replace(/^\s*<think>\s*<\/think>\s*/, '');
      for (const session of exported.sessions) {
        for (const message of session.messages) {
          if (message.role !== 'assistant') continue;
          if (typeof message.content === 'string') message.content = clean(message.content);
          else if (message.content[0]?.type === 'text') message.content[0].text = clean(message.content[0].text);
        }
      }
      return JSON.stringify({ ...exported, exportedAt: new Date().toISOString() }, null, 2);
    },
  };
}
