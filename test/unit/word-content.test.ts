import { expect, it } from 'vitest';
import { wordContent } from '../../lib/agent-plugin/word-content';
it('derives readable native text for explicitly formatted headings, lists and emphasis', () => {
  const content = wordContent('# Budget\n\n**Approved**\n\n1. 120\n2. November 1', 'markdown');
  expect(content.text).toBe('Budget\nApproved\n120\nNovember 1\n');
  expect(content.html).toContain('<ol start="1">');
});
it('preserves plain paragraphs, spacing and supplementary Unicode in an artifact', () => {
  expect(wordContent('Alex 😀\n\nPayment  120\tEUR', 'markdown').text).toBe('Alex 😀\n\nPayment  120\tEUR');
});
it('does not allow remote resources or active links into native HTML paste', () => {
  const content = wordContent(
    '# Budget\n\n[Open](javascript:alert(1))\n\n![image](https://example.invalid/pixel)\n\n<img src=x onerror=alert(1)>',
    'markdown',
  );
  expect(content.html).not.toMatch(/<(?:a|img|script)\b/i);
  expect(content.text).toContain('Open');
  expect(content.html).toContain('&lt;img');
});
it('rejects formatted tables before the native paste boundary', () => {
  expect(() => wordContent('| Name | Value |\n| --- | --- |\n| Budget | 120 |', 'markdown')).toThrow(
    'agentWordFormatUnsupported',
  );
});

it('preserves soft breaks and repeated spaces inside formatted paragraphs', () => {
  const result = wordContent('# Title\n\nLine  one\nLine two', 'markdown');
  expect(result.text).toBe('Title\nLine  one\nLine two\n');
  expect(result.html).toContain('white-space: pre-wrap');
  expect(result.html).toContain('Line  one<br />Line two');
});
