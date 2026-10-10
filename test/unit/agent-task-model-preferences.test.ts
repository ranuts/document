import { expect, it } from 'vitest';
import { readTaskModelPreferences, writeTaskModelPreference } from '../../lib/agent-plugin/ui/task-model-preferences';

const models = ['small', 'translator'];
it('keeps legacy global choices separate when task settings are absent', () => {
  expect(readTaskModelPreferences(null, models)).toEqual({});
});
it('round-trips a task override and a target-language override independently', () => {
  const first = writeTaskModelPreference({}, { task: 'rewrite' }, 'small', models);
  const second = writeTaskModelPreference(first, { task: 'translate', targetLanguage: 'ja' }, 'translator', models);
  expect(readTaskModelPreferences(JSON.stringify({ version: 1, ...second }), models)).toEqual({
    tasks: { rewrite: { backend: 'webllm', model: 'small' } },
    translations: { ja: { backend: 'webllm', model: 'translator' } },
  });
  expect(first).toEqual({ tasks: { rewrite: { backend: 'webllm', model: 'small' } } });
});
it('removes only the selected override when restoring inheritance', () => {
  const existing = {
    tasks: { rewrite: { backend: 'webllm' as const, model: 'small' } },
    translations: { ja: { backend: 'webllm' as const, model: 'translator' } },
  };
  const next = writeTaskModelPreference(existing, { task: 'translate', targetLanguage: 'ja' }, '', models);
  expect(next.tasks?.rewrite?.model).toBe('small');
  expect(next.translations?.ja).toBeUndefined();
  expect(existing.translations.ja.model).toBe('translator');
});
it('discards malformed, future-version and unrecognized model settings', () => {
  expect(readTaskModelPreferences('{', models)).toEqual({});
  expect(
    readTaskModelPreferences('{"version":2,"tasks":{"chat":{"backend":"webllm","model":"small"}}}', models),
  ).toEqual({});
  expect(
    readTaskModelPreferences(
      '{"version":1,"tasks":{"chat":{"backend":"webllm","model":"https://private/?token=secret"},"tools":{"backend":"webllm","model":"small","quality":"accepted"}}}',
      models,
    ),
  ).toEqual({ tasks: { tools: { backend: 'webllm', model: 'small' } } });
});
it('rejects unsupported values before serializing user preferences', () => {
  expect(() => writeTaskModelPreference({}, { task: 'rewrite' }, 'unknown', models)).toThrow();
});
