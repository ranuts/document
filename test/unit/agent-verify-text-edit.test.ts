import { expect, it, vi } from 'vitest';
import {
  assertReviewSelection,
  captureReviewCharacters,
  matchesTextEdit,
} from '../../lib/agent-plugin/verify-text-edit';
it.each([
  ['\r\n', 'Hello\r\n', '', 'Hello', true],
  ['Start old end\n', 'Start new end\n', 'old', 'new', true],
  ['aaaa', 'aaaaaa', '', 'aa', true],
  ['Start old end', 'Changed new end', 'old', 'new', false],
  ['Hello', 'Hello', '', 'Hello', false],
  ['a old b old c', 'a old b new c', 'old', 'new', true],
  ['a\nb', 'a\none\ntwo\nb', '', 'one\ntwo\n', true],
])('checks %s → %s', (before, after, selected, inserted, expected) => {
  expect(matchesTextEdit(before as string, after as string, selected as string, inserted as string)).toBe(expected);
});
it('accounts for the SDK preserving the final paragraph terminator on full selection replacement', () => {
  expect(matchesTextEdit('Old paragraph\r\n', 'New paragraph\r\n', 'Old paragraph\n', 'New paragraph')).toBe(true);
  expect(matchesTextEdit('Old paragraph\r\n', 'New paragraph\r\nExtra\r\n', 'Old paragraph\n', 'New paragraph')).toBe(
    false,
  );
});

it('normalizes SDK soft breaks encoded as lone CR', () => {
  expect(matchesTextEdit('\r\n', 'one\rtwo\r\n', '', 'one\ntwo')).toBe(true);
});

const reviewed = (text: string, reviewType: number) => [...text].map((text) => ({ text, reviewType }));
it.each([
  [-1, 2],
  [0, 3],
])('rejects out-of-bounds native run selections %s..%s', (StartPos, EndPos) => {
  const run = {
    Content: [{}, {}],
    Selection: { Use: true, StartPos, EndPos },
    GetText: () => 'AB',
    GetReviewType: () => 0,
  };
  expect(captureReviewCharacters({ GetAllParagraphs: () => [{ Content: [run] }] })).toBeUndefined();
});
it('distinguishes a soft break from the final paragraph terminator in the same run', () => {
  const run = { GetText: () => 'A\rB\r\n', GetReviewType: () => 0 };
  const snapshot = captureReviewCharacters({ GetAllParagraphs: () => [{ Content: [run] }] });
  expect(snapshot?.filter((c) => c.paragraphEnd).map((c) => c.text)).toEqual(['\n']);
  expect(snapshot?.[1].paragraphEnd).toBeUndefined();
});
it('verifies retained deletion and exact tracked insertion without discarding older revisions', () => {
  const before = [...reviewed('prior', 2), ...reviewed('old end', 0)];
  const after = [...reviewed('prior', 2), ...reviewed('old', 1), ...reviewed('new', 2), ...reviewed(' end', 0)];
  expect(matchesTextEdit('priorold end', 'prioroldnew end', 'old', 'new', { before, after })).toBe(true);
});
it.each(['untracked insertion', 'missing deletion', 'changed prior revision', 'wrong text'])(
  'rejects incorrect tracked replacement: %s',
  (kind) => {
    const before = [...reviewed('prior', 2), ...reviewed('old end', 0)];
    const after = [
      ...reviewed('prior', kind === 'changed prior revision' ? 0 : 2),
      ...reviewed('old', kind === 'missing deletion' ? 0 : 1),
      ...reviewed(kind === 'wrong text' ? 'bad' : 'new', kind === 'untracked insertion' ? 0 : 2),
      ...reviewed(' end', 0),
    ];
    expect(matchesTextEdit('priorold end', after.map((c) => c.text).join(''), 'old', 'new', { before, after })).toBe(
      false,
    );
  },
);

it('retains native zero-width bookmark identity in revision snapshots', () => {
  const marker = { Type: 71 };
  const logic = { GetAllParagraphs: () => [{ Content: [{ GetText: () => 'Alpha', GetReviewType: () => 0 }, marker] }] };
  const snapshot = captureReviewCharacters(logic);
  expect(snapshot?.map((c) => c.text).join('')).toBe('Alpha');
  expect(snapshot?.at(-1)?.marker).toBe(marker);
});
it('rejects a changed bookmark outside the tracked replacement', () => {
  const before = [...reviewed('old', 0), { text: '', reviewType: 0, marker: { Type: 71 } }];
  const after = [...reviewed('old', 1), ...reviewed('new', 2), { text: '', reviewType: 0, marker: { Type: 71 } }];
  expect(matchesTextEdit('old', 'oldnew', 'old', 'new', { before, after })).toBe(false);
});

it('verifies tracked inserted soft breaks and surrounding existing revisions', () => {
  const before = [...reviewed('old end', 0)];
  const after = [...reviewed('old', 1), ...reviewed('one\ntwo', 2), ...reviewed(' end', 0)];
  expect(matchesTextEdit('old end', 'oldone\rtwo end', 'old', 'one\ntwo', { before, after })).toBe(true);
});
it('verifies replacing previously inserted text without inventing a deletion revision', () => {
  const before = [...reviewed('old end', 2)];
  const after = [...reviewed('new end', 2)];
  expect(matchesTextEdit('old end', 'new end', 'old', 'new', { before, after })).toBe(true);
});

it('verifies a selected soft break without treating it as a paragraph ending', () => {
  const before = reviewed('a\nb end', 0),
    after = [...reviewed('a\nb', 1), ...reviewed('new', 2), ...reviewed(' end', 0)];
  expect(matchesTextEdit('a\rb end', 'a\rbnew end', 'a\nb', 'new', { before, after })).toBe(true);
});

it('does not approve a deleted actual selection because ordinary identical text exists elsewhere', () => {
  const before = [...reviewed('Alpha', 1).map((c) => ({ ...c, selected: true })), ...reviewed(' Alpha', 0)];
  expect(() => assertReviewSelection(before, 'Alpha')).toThrow('wordTrackedSelectionUnsupported');
});
it('limits candidate copying for insertion at the end of a long tracked document', () => {
  const before = reviewed('A'.repeat(800), 0),
    after = [...before, ...reviewed('new', 2)];
  const slices = vi.spyOn(before, 'slice');
  expect(matchesTextEdit('A'.repeat(800), 'A'.repeat(800) + 'new', '', 'new', { before, after })).toBe(true);
  expect(slices.mock.calls.length).toBeLessThan(8);
  slices.mockRestore();
});

it('rejects an unchanged long revision document without repeated full comparisons', () => {
  const before = reviewed('A'.repeat(800), 2),
    after = [...before];
  const slices = vi.spyOn(before, 'slice');
  expect(matchesTextEdit('A'.repeat(800), 'A'.repeat(800), 'AA', 'BB', { before, after })).toBe(false);
  expect(slices.mock.calls.length).toBeLessThan(8);
  slices.mockRestore();
});

it('reads native supplementary Unicode and tabs for revision verification', () => {
  const run = {
    Type: 39,
    Content: [{ Type: 1, GetCodePoint: () => 0x1f600 }, { Type: 21 }, { Type: 4 }],
    Selection: { Use: true, StartPos: 0, EndPos: 1 },
    GetText: () => '\uf600 \r\n',
    GetReviewType: () => 2,
  };
  const characters = captureReviewCharacters({ GetAllParagraphs: () => [{ Content: [run] }] });
  expect(characters?.map((c) => c.text).join('')).toBe('😀\t\n');
  expect(() => assertReviewSelection(characters, '😀')).not.toThrow();
  expect(characters?.at(-1)?.paragraphEnd).toBe(true);
});
