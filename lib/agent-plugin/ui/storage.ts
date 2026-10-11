/**
 * Legacy conversation import and message-to-display conversion.
 *
 * The old model-facing history ({@link LLMMessage}[]) was stored in localStorage.
 * New panel sessions use memory and opt-in IndexedDB; this reader supports explicit
 * migration. To re-render a conversation, {@link historyToTurns} maps the
 * stored message history back to display {@link ChatTurn}s using the same
 * role/prefix conventions the controller emits live.
 */
import { localStorageGetItem, localStorageSetItem } from 'ranuts/utils';
import { assistantPresentation, toolLabel, displayError } from './presentation';
import type { ChatTurn } from './controller';
import type { LLMMessage } from '@ranuts/agent-core/llm/types';

const STORAGE_PREFIX = 'agent_history_';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export function isMessage(value: unknown): value is LLMMessage {
  if (!isRecord(value) || (value.role !== 'user' && value.role !== 'assistant')) return false;
  if (value.copyOnly !== undefined && value.copyOnly !== true) return false;
  if (
    value.documentArtifact !== undefined &&
    (value.documentArtifact !== true || value.role !== 'assistant' || typeof value.content !== 'string')
  )
    return false;
  if (value.interrupted !== undefined && value.interrupted !== true) return false;
  if (value.hostGuidance !== undefined && !['tool', 'status', 'error'].includes(String(value.hostGuidance)))
    return false;
  if (typeof value.content === 'string') return true;
  return (
    Array.isArray(value.content) &&
    value.content.every((block: unknown) => {
      if (!isRecord(block)) return false;
      if (block.type === 'text') return typeof block.text === 'string';
      if (block.type === 'tool_use')
        return typeof block.id === 'string' && typeof block.name === 'string' && isRecord(block.input);
      if (block.type === 'tool_result')
        return (
          typeof block.toolUseId === 'string' &&
          typeof block.content === 'string' &&
          (block.isError === undefined || typeof block.isError === 'boolean')
        );
      return false;
    })
  );
}

/** Persisted conversation history (model-facing messages). */
export interface HistoryStorage {
  load(): LLMMessage[];
  save(messages: LLMMessage[]): void;
  clear(): void;
}

/** A localStorage-backed history store, namespaced by `sessionKey`. */
export function createHistoryStorage(sessionKey = 'default'): HistoryStorage {
  const key = `${STORAGE_PREFIX}${sessionKey}`;
  return {
    load(): LLMMessage[] {
      const raw = localStorageGetItem(key);
      if (!raw) return [];
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) && parsed.every(isMessage) ? parsed : [];
      } catch {
        return [];
      }
    },
    save(messages: LLMMessage[]): void {
      try {
        localStorageSetItem(key, JSON.stringify(messages));
      } catch {
        // Ignore quota / serialisation failures — persistence is best-effort.
      }
    },
    clear(): void {
      localStorageSetItem(key, '');
    },
  };
}

/**
 * Rebuild display turns from persisted history. Mirrors the controller's live
 * event→turn mapping: assistant text → agent, tool_use → tool, errored
 * tool_result → error, plain user/assistant strings → their role.
 */
export function historyToTurns(messages: LLMMessage[]): ChatTurn[] {
  const turns: ChatTurn[] = [];
  for (const [index, message] of messages.entries()) {
    if (typeof message.content === 'string') {
      const text = message.role === 'assistant' ? assistantPresentation(message.content) : message.content;
      if (text)
        turns.push({
          role:
            (message as LLMMessage & { hostGuidance?: 'tool' | 'status' | 'error' }).hostGuidance ??
            (message.role === 'assistant' ? 'agent' : 'user'),
          text,
          ...(message.documentArtifact ? { documentArtifact: true as const } : {}),
          ...((message as LLMMessage & { copyOnly?: true }).copyOnly ? { copyOnly: true as const } : {}),
          ...(message.role === 'assistant' &&
          !(message as LLMMessage & { hostGuidance?: string }).hostGuidance &&
          (message.interrupted ||
            (messages[index + 1] as (LLMMessage & { hostGuidance?: string }) | undefined)?.hostGuidance === 'status')
            ? { interrupted: true as const }
            : {}),
        });
      continue;
    }
    const containsCalls = message.role === 'assistant' && message.content.some((block) => block.type === 'tool_use');
    for (const block of message.content) {
      if (block.type === 'text') {
        if (containsCalls) continue;
        const text = message.role === 'assistant' ? assistantPresentation(block.text) : block.text;
        if (text)
          turns.push({
            role: message.role === 'assistant' ? 'agent' : 'user',
            text,
            ...(message.role === 'assistant' && message.interrupted ? { interrupted: true as const } : {}),
          });
      } else if (block.type === 'tool_use') {
        turns.push({ role: 'tool', text: toolLabel(block.name) });
      } else if (block.type === 'tool_result' && block.isError) {
        turns.push({ role: 'error', text: displayError(block.content) });
      }
    }
  }
  return turns;
}
