import { expect, it } from 'vitest';
import {
  assistantPresentation,
  AssistantDisplayStream,
  toolLabel,
  displayError,
} from '../../lib/agent-plugin/ui/presentation';
import { historyToTurns } from '../../lib/agent-plugin/ui/storage';
import { LanguageCode, setLanguage, SHELL_LOCALES, t } from '@ranuts/shared/i18n';

it.each(SHELL_LOCALES)('restores actionable model guidance saved in %s after a language switch', (language) => {
  try {
    setLanguage(language);
    const quota = t('agentModelQuota');
    const loading = t('agentModelLoadFailed');
    const target = language === LanguageCode.EN ? LanguageCode.ZH : LanguageCode.EN;
    setLanguage(target);
    expect(displayError(quota)).toBe(t('agentModelQuota'));
    expect(displayError(loading)).toBe(t('agentModelLoadFailed'));
    expect(displayError(quota + ' secret=private')).toBe(t('agentRequestFailed'));
    expect(
      historyToTurns([
        { role: 'user', content: [{ type: 'tool_result', toolUseId: 'model', content: quota, isError: true }] },
      ]),
    ).toEqual([{ role: 'error', text: t('agentModelQuota') }]);
  } finally {
    setLanguage(LanguageCode.EN);
  }
});

it('guides reloading a failed local model without exposing unexpected error details', () => {
  for (const reason of [
    'Local model worker failed. Reload the model to retry.',
    'Local model worker communication failed. Reload the model to retry.',
    'Local model was unloaded, possibly because GPU resources were lost. Reload to retry.',
  ]) {
    const message = displayError(new Error(reason));
    expect(message).toBe('Reload the model in settings, then try your request again.');
    expect(displayError(message)).toBe(message);
    expect(displayError(new Error(reason + ' private detail'))).not.toContain('private');
  }
});

it('keeps reload guidance localized through error formatting and restored tool errors', () => {
  try {
    for (const language of SHELL_LOCALES) {
      setLanguage(language);
      const reason = 'Local model worker failed. Reload the model to retry.';
      const message = displayError(reason);
      expect(message).toBe(t('agentLocalModelReload'));
      expect(message).not.toBe('agentLocalModelReload');
      expect(message).not.toBe(t('agentRequestFailed'));
      expect(displayError(message)).toBe(message);
      expect(
        historyToTurns([
          { role: 'user', content: [{ type: 'tool_result', toolUseId: 'local', isError: true, content: reason }] },
        ]),
      ).toEqual([{ role: 'error', text: message }]);
    }
  } finally {
    setLanguage(LanguageCode.EN);
  }
});

it('explains a refused translation language and preserves guidance on restoration', () => {
  const message = displayError(new Error('The output appears to use a different language. Try another model.'));
  expect(message).toBe('The output does not match the requested language. Try another model.');
  expect(displayError(new Error(message))).toBe(message);
  expect(
    displayError(new Error('The output appears to use a different language. Try another model. secret=private')),
  ).not.toContain('secret');
});

it('localizes known language refusals in all shell locales and restored tool errors', () => {
  try {
    for (const language of SHELL_LOCALES) {
      setLanguage(language);
      const reason = 'The output appears to use a different language. Try another model.';
      const message = displayError(reason);
      expect(message).toBe(t('agentWritingLanguageMismatch'));
      expect(message).not.toBe(t('agentRequestFailed'));
      expect(message).not.toBe('agentWritingLanguageMismatch');
      expect(displayError(message)).toBe(message);
      expect(
        historyToTurns([
          { role: 'user', content: [{ type: 'tool_result', toolUseId: 'writing', isError: true, content: reason }] },
        ]),
      ).toEqual([{ role: 'error', text: message }]);
    }
  } finally {
    setLanguage(LanguageCode.EN);
  }
});

it.each(['get_range', 'get_ranges'])('presents %s as a read activity without raw protocol JSON', (name) => {
  expect(toolLabel(name)).toBe(t('agentReadCell'));
  expect(assistantPresentation(JSON.stringify({ name, arguments: { range: 'A1:B2' } }))).toBe('');
  expect(historyToTurns([{ role: 'assistant', content: [{ type: 'tool_use', id: 'read', name, input: {} }] }])).toEqual(
    [{ role: 'tool', text: t('agentReadCell') }],
  );
});

it('removes protocol messages and reasoning without swallowing requested JSON or code', () => {
  expect(assistantPresentation('[{"arguments":{},"name":"get_selection"}]')).toBe('');
  expect(assistantPresentation('<think>private reasoning</think>\nHello')).toBe('Hello');
  expect(assistantPresentation('{"name":"Alice","age":4}')).toBe('{"name":"Alice","age":4}');
  expect(assistantPresentation('```json\n[{"name":"get_selection","arguments":{}}]\n```')).toContain('get_selection');
});
it('never flashes split protocol or reasoning tokens during streaming', () => {
  const output: string[] = [];
  const stream = new AssistantDisplayStream((delta) => output.push(delta));
  stream.push('[');
  stream.push('{"name":"get_selection","arguments":{}}]');
  stream.finish();
  expect(output).toEqual([]);
  stream.push('<thi');
  stream.push('nk>private');
  stream.push('</think>Answer');
  stream.finish();
  expect(output.join('')).toBe('Answer');
  stream.push('{"name":"Alice"}');
  stream.finish();
  expect(output.join('')).toContain('{"name":"Alice"}');
});
it('holds protocol JSON immediately after a split reasoning prefix', () => {
  const output: string[] = [];
  const stream = new AssistantDisplayStream((delta) => output.push(delta));
  stream.push('<think>private</think>[{"name":');
  expect(output).toEqual([]);
  stream.push('"get_selection","arguments":{}}]');
  stream.finish();
  expect(output).toEqual([]);
});
it('retains actionable check-document guidance after a mutation fails verification', () => {
  expect(displayError('The change could not be verified. Check the document and use Undo if needed.')).toMatch(
    /Undo|撤销/,
  );
});
it('projects restored history without leaking protocol, tool arguments or internal errors', () => {
  const turns = historyToTurns([
    { role: 'user', content: [{ type: 'text', text: '{"name":"Alice"}' }] },
    { role: 'assistant', content: '[{"name":"get_selection","arguments":{}}]' },
    { role: 'assistant', content: [{ type: 'tool_use', id: '1', name: 'get_selection', input: { secret: 'hidden' } }] },
    {
      role: 'user',
      content: [{ type: 'tool_result', toolUseId: '1', isError: true, content: 'TypeError secret=abc' }],
    },
  ]);
  expect(turns).toEqual([
    { role: 'user', text: '{"name":"Alice"}' },
    { role: 'tool', text: toolLabel('get_selection') },
    { role: 'error', text: displayError('TypeError secret=abc') },
  ]);
  expect(JSON.stringify(turns)).not.toMatch(/TypeError|secret|get_selection/);
});
it('explains unchanged writing output instead of showing a generic request error', () => {
  for (const reason of ['No rewrite was proposed', 'No summary was proposed', 'No translation was proposed']) {
    const message = displayError(new Error(reason));
    expect(message).toMatch(/original|原文/);
    expect(displayError(message)).toBe(message);
  }
});

it('explains an unchosen document operation without claiming the editor lacks that capability', () => {
  const message = displayError(new Error('agentToolNotChosen'));
  expect(message).toMatch(/operation|操作/);
  expect(message).toMatch(/model|模型/);
  expect(displayError(message)).toBe(message);
});

it('explains rejected writing numbers without hiding the reason on repeated formatting', () => {
  const message = 'The model changed or omitted source numbers or date formatting. Try again or use another model.';
  expect(displayError(new Error('Writing changed or omitted source numbers; review the request'))).toBe(message);
  expect(displayError(new Error(message))).toBe(message);
});

it('explains an uncompressed summary and preserves the localized message', () => {
  const message = displayError(new Error('agentSummaryNotShorter'));
  expect(message).toMatch(/not shorter|更简短/);
  expect(displayError(message)).toBe(message);
});
it('shows concise document timeout guidance and preserves it on restoration', () => {
  const message = displayError(new Error('Native paste timed out'));
  expect(message).toBe('The document operation timed out. Try again.');
  expect(displayError(message)).toBe(message);
});

it('explains insufficient slide space without adding a confirmation step', () => {
  const message = displayError(new Error('No free text area'));
  expect(message).toBe('There is not enough space on this slide. Use less text or another slide.');
  expect(displayError(message)).toBe(message);
});

it('explains unsupported tracked selections without claiming a document change', () => {
  const message = displayError(new Error('wordTrackedSelectionUnsupported'));
  expect(message).toMatch(/paragraph/i);
  expect(message).toMatch(/no change/i);
});
it('shows concise document review lock guidance', () => {
  expect(displayError(new Error('officeReviewSettingsLocked'))).toMatch(/locked|锁定/);
});

it('currency validation errors use a localized message', () => {
  const message = displayError(new Error('agentWritingCurrencyChanged'));
  expect(message).toMatch(/currency|货币/);
  expect(message).not.toContain('agentWritingCurrencyChanged');
});

it('explains oversized range reads and preserves the guidance in history', () => {
  try {
    for (const language of [LanguageCode.EN, LanguageCode.ZH]) {
      setLanguage(language);
      const message = displayError(new Error('officeRangeReadTooLarge'));
      expect(message).toMatch(/smaller range|缩小读取区域/);
      expect(displayError(message)).toBe(message);
      expect(
        historyToTurns([
          {
            role: 'user',
            content: [{ type: 'tool_result', toolUseId: 'range', isError: true, content: 'officeRangeReadTooLarge' }],
          },
        ]),
      ).toEqual([{ role: 'error', text: message }]);
    }
  } finally {
    setLanguage(LanguageCode.EN);
  }
});

it.each(SHELL_LOCALES)(
  'keeps exact action guidance localizable and filters appended private details in %s',
  (language) => {
    try {
      setLanguage(language);
      for (const key of ['agentNoCompletedAnswer', 'agentParagraphSelectionConflict'] as const) {
        const localized = t(key);
        expect(displayError(new Error(key))).toBe(localized);
        expect(displayError(displayError(key))).toBe(localized);
        expect(displayError(localized + ' secret=private')).toBe(t('agentRequestFailed'));
        setLanguage(language === LanguageCode.EN ? LanguageCode.ZH : LanguageCode.EN);
        expect(displayError(localized)).toBe(t(key));
        setLanguage(language);
      }
    } finally {
      setLanguage(LanguageCode.EN);
    }
  },
);
