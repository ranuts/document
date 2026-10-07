import { describe, expect, it } from 'vitest';
import { resolveTaskModel, type TaskModelBinding } from '../../packages/agent-core/src/llm/task-model';

const fallback: TaskModelBinding = { backend: 'webllm', model: 'default-gpu' };
const writer: TaskModelBinding = { backend: 'wllama', model: 'writer-cpu' };
const japanese: TaskModelBinding = { backend: 'webllm', model: 'translate-ja' };

describe('task model routing', () => {
  it('preserves the existing default when the task has no override', () => {
    expect(resolveTaskModel({ task: 'chat' }, {}, fallback)).toEqual({
      binding: fallback,
      source: 'default',
      quality: 'experimental',
    });
  });
  it('selects a writing override without changing the chat model', () => {
    const preferences = { tasks: { rewrite: writer } };
    expect(resolveTaskModel({ task: 'rewrite' }, preferences, fallback).binding).toEqual(writer);
    expect(resolveTaskModel({ task: 'chat' }, preferences, fallback).binding).toEqual(fallback);
  });
  it('selects the exact translation target before the general translation model', () => {
    const preferences = { tasks: { translate: writer }, translations: { ja: japanese } };
    expect(resolveTaskModel({ task: 'translate', targetLanguage: 'ja' }, preferences, fallback)).toEqual({
      binding: japanese,
      source: 'language',
      quality: 'experimental',
    });
    expect(resolveTaskModel({ task: 'translate', targetLanguage: 'ko' }, preferences, fallback).binding).toEqual(
      writer,
    );
  });
  it('rejects translation without a supported target instead of selecting another language model', () => {
    expect(() => resolveTaskModel({ task: 'translate' }, {}, fallback)).toThrow();
    expect(() => resolveTaskModel({ task: 'translate', targetLanguage: 'xx' as never }, {}, fallback)).toThrow();
  });
  it('does not expose mutable preference objects through the selected binding', () => {
    const preferences = { tasks: { summarize: { ...writer } } };
    const resolved = resolveTaskModel({ task: 'summarize' }, preferences, fallback);
    resolved.binding.model = 'modified';
    expect(preferences.tasks.summarize.model).toBe('writer-cpu');
  });
  it('does not treat user-provided quality claims as acceptance', () => {
    const preferences = { tasks: { tools: { ...writer, quality: 'accepted' } } };
    expect(resolveTaskModel({ task: 'tools' }, preferences, fallback).quality).toBe('experimental');
  });
  it('rejects an invalid selected binding without silently replacing the user choice', () => {
    expect(() =>
      resolveTaskModel({ task: 'rewrite' }, { tasks: { rewrite: { backend: 'wllama', model: ' ' } } }, fallback),
    ).toThrow();
  });
});
