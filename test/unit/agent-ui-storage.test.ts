import { afterEach, describe, expect, it } from 'vitest';
import { createHistoryStorage, historyToTurns } from '../../lib/agent-plugin/ui/storage';
import { t } from '@ranuts/shared/i18n';
import type { LLMMessage } from '@ranuts/agent-core/llm/types';

it('restores host guidance as activity or error rather than an insertable answer', () => {
  const messages: (LLMMessage & { hostGuidance?: 'tool' | 'status' | 'error' })[] = [
    { role: 'assistant', content: 'article' },
    { role: 'assistant', content: 'Select text first', hostGuidance: 'tool' },
    { role: 'assistant', content: 'No previous answer', hostGuidance: 'error' },
    { role: 'assistant', content: 'Stopped.', hostGuidance: 'status' },
  ];
  expect(historyToTurns(messages).map((turn) => turn.role)).toEqual(['agent', 'tool', 'error', 'status']);
});

describe('createHistoryStorage', () => {
  afterEach(() => createHistoryStorage('test').clear());

  it('round-trips messages through localStorage', () => {
    const store = createHistoryStorage('test');
    expect(store.load()).toEqual([]);
    const messages: (LLMMessage & { hostGuidance?: 'status' })[] = [
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'Stopped.', hostGuidance: 'status' },
      { role: 'assistant', content: [{ type: 'text', text: 'hello' }] },
    ];
    store.save(messages);
    expect(store.load()).toEqual(messages);
  });

  it('clear() empties the store', () => {
    const store = createHistoryStorage('test');
    store.save([{ role: 'user', content: 'hi' }]);
    store.clear();
    expect(store.load()).toEqual([]);
  });

  it('returns [] for malformed stored data', () => {
    const store = createHistoryStorage('test');
    store.save([{ role: 'user', content: 'hi' }]);
    // Corrupt the underlying value directly.
    localStorage.setItem('agent_history_test', '{not json');
    expect(store.load()).toEqual([]);
  });
  it('rejects malformed records before restoring display or model context', () => {
    const store = createHistoryStorage('test');
    for (const value of [
      [null],
      [{}],
      [{ role: 'assistant', content: [{ type: 'text', text: 42 }] }],
      [{ role: 'assistant', content: [{ type: 'tool_use', id: 'x', name: 'get_selection', input: null }] }],
    ]) {
      localStorage.setItem('agent_history_test', JSON.stringify(value));
      expect(store.load()).toEqual([]);
    }
  });

  it('namespaces by session key', () => {
    createHistoryStorage('a').save([{ role: 'user', content: 'in-a' }]);
    expect(createHistoryStorage('b').load()).toEqual([]);
    createHistoryStorage('a').clear();
  });
});

describe('historyToTurns', () => {
  it('maps user/assistant/tool_use/errored tool_result to display turns', () => {
    const messages: LLMMessage[] = [
      { role: 'user', content: 'do it' },
      {
        role: 'assistant',
        content: [
          { type: 'text', text: 'working' },
          { type: 'tool_use', id: 't1', name: 'insert_text', input: {} },
        ],
      },
      { role: 'user', content: [{ type: 'tool_result', toolUseId: 't1', content: 'boom', isError: true }] },
      { role: 'assistant', content: [{ type: 'text', text: 'done' }] },
    ];
    expect(historyToTurns(messages)).toEqual([
      { role: 'user', text: 'do it' },
      { role: 'agent', text: 'working' },
      { role: 'tool', text: t('agentUpdateDocument') },
      { role: 'error', text: t('agentRequestFailed') },
      { role: 'agent', text: 'done' },
    ]);
  });

  it('skips successful tool_results and empty text', () => {
    const messages: LLMMessage[] = [
      { role: 'user', content: [{ type: 'tool_result', toolUseId: 't1', content: 'ok', isError: false }] },
      { role: 'assistant', content: [{ type: 'text', text: '' }] },
    ];
    expect(historyToTurns(messages)).toEqual([]);
  });
});

it('marks legacy partial prose immediately followed by a stopped host status on restore', () => {
  expect(
    historyToTurns([
      { role: 'assistant', content: 'partial prose' },
      { role: 'assistant', content: 'Stopped.', hostGuidance: 'status' } as LLMMessage,
    ]),
  ).toEqual([
    { role: 'agent', text: 'partial prose', interrupted: true },
    { role: 'status', text: 'Stopped.' },
  ]);
});
