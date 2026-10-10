import { expect, it } from 'vitest';
import { readSlideShapeText, readSlideTextSelection } from '../../lib/agent-plugin/slide-text-read';

it('reads native hyperlink runs and zero-width bookmarks without changing their content', () => {
  const bookmark = { Type: 71 };
  const content = {
    GetText: () => 'lossy',
    Content: [
      {
        Content: [
          bookmark,
          { Type: 48, Content: [{ Type: 39, Content: [{ Type: 1, GetCodePoint: () => 0x1f600 }, { Type: 21 }] }] },
          { Type: 39, Content: [{ Type: 4 }] },
        ],
      },
    ],
  };
  expect(readSlideShapeText({ getDocContent: () => content })).toBe('😀\t\r\n');
  expect(content.Content[0].Content[0]).toBe(bookmark);
});

function selectionShape(items: unknown[], start: number, end: number, selected: string) {
  return {
    getDocContent: () => ({
      GetText: () => 'lossy',
      GetSelectedText: (_clear: boolean, options: { TabSymbol: string }) =>
        options.TabSymbol === '\t' ? selected : selected.replace(/\t/g, ' '),
      Content: [{ Content: [{ Type: 39, Selection: { Use: true, StartPos: start, EndPos: end }, Content: items }] }],
    }),
  };
}
const character = (value: string) => ({ Type: 1, GetCodePoint: () => value.codePointAt(0)! });

it('captures the second repeated selection by native position, preserving emoji and tabs', () => {
  const items: unknown[] = [...'😀 x 😀'].map(character);
  items.push({ Type: 21 }, { Type: 4 });
  expect(readSlideTextSelection(selectionShape(items, 4, 6, '😀\t'))).toEqual({
    text: '😀 x 😀\t\n',
    selectedText: '😀\t',
    start: 5,
    end: 8,
  });
});

it('captures contiguous text across hyperlink runs and paragraph boundaries', () => {
  const run = (text: string, start: number, end: number) => ({
    Type: 39,
    Content: [...text].map(character),
    Selection: { Use: true, StartPos: start, EndPos: end },
  });
  const shape = {
    getDocContent: () => ({
      GetText: () => 'lossy',
      GetSelectedText: () => 'ha\r\nBe',
      Content: [
        {
          Content: [
            run('Alpha', 3, 5),
            { Type: 71 },
            {
              Type: 39,
              Content: [{ Type: 4 }],
              Selection: { Use: true, StartPos: 0, EndPos: 1 },
            },
          ],
        },
        { Content: [{ Type: 48, Content: [run('Beta', 0, 2)] }] },
      ],
    }),
  };
  expect(readSlideTextSelection(shape)).toEqual({ text: 'Alpha\nBeta', selectedText: 'ha\nBe', start: 3, end: 8 });
});

it('declines discontinuous run selections even if their concatenated native text matches', () => {
  const run = (text: string, selected: boolean) => ({
    Type: 39,
    Content: [...text].map(character),
    Selection: { Use: selected, StartPos: 0, EndPos: text.length },
  });
  expect(
    readSlideTextSelection({
      getDocContent: () => ({
        GetText: () => 'AXB',
        GetSelectedText: () => 'AB',
        Content: [{ Content: [run('A', true), run('X', false), run('B', true)] }],
      }),
    }),
  ).toBeUndefined();
});

it.each([{ Type: 999 }, { Type: 1, GetCodePoint: () => 0xd800 }])(
  'declines unknown or invalid characters even outside the selected range',
  (unknown) => {
    expect(readSlideTextSelection(selectionShape([character('A'), unknown], 0, 1, 'A'))).toBeUndefined();
  },
);

it('captures a backwards selection without reversing its text', () => {
  expect(readSlideTextSelection(selectionShape([...'Alpha'].map(character), 4, 1, 'lph'))).toEqual({
    text: 'Alpha',
    selectedText: 'lph',
    start: 1,
    end: 4,
  });
});

it.each([
  ['fractional boundary', 0.5, 2, 'Al'],
  ['outside boundary', 0, 7, 'Alpha'],
  ['collapsed selection', 2, 2, ''],
  ['native text mismatch', 0, 2, 'wrong'],
])('declines %s before allowing replacement', (_, start, end, selected) => {
  expect(readSlideTextSelection(selectionShape([...'Alpha'].map(character), start, end, selected))).toBeUndefined();
});
