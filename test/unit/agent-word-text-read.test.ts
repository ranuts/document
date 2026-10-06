import { expect, it } from 'vitest';
import { readWordBodyText } from '../../lib/agent-plugin/word-text-read';
it('reads native emoji, tabs and paragraph ends instead of lossy SDK text', () => {
  const run = { Type: 39, Content: [{ Type: 1, GetCodePoint: () => 0x1f600 }, { Type: 21 }, { Type: 4 }] };
  const GetAllParagraphs = () => [{ Content: [run] }];
  expect(readWordBodyText({ GetAllParagraphs, GetText: () => '\uf600 \r\n' })).toBe('😀\t\r\n');
});
it('rejects unknown native structures rather than trusting legacy readback', () => {
  expect(
    readWordBodyText({ GetAllParagraphs: () => [{ Content: [{ Type: 999 }] }], GetText: () => 'safe' }),
  ).toBeUndefined();
});
