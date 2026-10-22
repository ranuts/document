import { expect, it } from 'vitest';
import { codeLanguage, highlightCode } from '../../packages/chat-ui/src/markdown-highlight';
it.each([
  ['js', 'const value = "安全";'],
  ['ts', 'const value: string = "安全";'],
  ['jsx', 'const node = <div>Hello</div>;'],
  ['tsx', 'const node: Node = <div>Hello</div>;'],
  ['python', 'def run():\n\treturn "safe"'],
  ['json', '{"value": 12}'],
  ['html', '<img src="x" onerror="alert(1)">'],
  ['css', '.class { color: red; }'],
  ['sh', 'echo "hello"'],
  ['sql', 'SELECT value FROM items;'],
  ['yml', 'name: value'],
  ['md', '# Heading\n\n**safe**'],
])('loads only a supported language and returns exact dual-theme token text: %s', async (info, source) => {
  const language = codeLanguage(info);
  expect(language.id).toBeTruthy();
  const tokens = await highlightCode(source, language.id!);
  expect(tokens.map((line) => line.map((token) => token.content).join('')).join('\n')).toBe(source);
  expect(tokens.flat().some((token) => token.htmlStyle?.['--shiki-light'] && token.htmlStyle?.['--shiki-dark'])).toBe(
    true,
  );
});
it.each(['constructor', '__proto__', '../../langs/x', 'https://example.com', 'rust', 'x'.repeat(100)])(
  'never resolves an untrusted module language: %s',
  (info) => {
    expect(codeLanguage(info).id).toBeUndefined();
    expect(codeLanguage(info).label.length).toBeLessThanOrEqual(64);
  },
);
