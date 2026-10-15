import { expect, it } from 'vitest';
import { RequestScopePolicy, snapshotComposerContext } from '../../lib/agent-plugin/ui/request-scope';
import type { ComposerContext } from '../../lib/agent-plugin/ui/composer-context';
it.each([
  [{ context: { kind: 'word' }, text: '', truncated: false }, false, false, true],
  [{ context: { kind: 'cell', range: 'B2' }, text: '42', truncated: false }, false, false, false],
  [{ context: { kind: 'cell', range: 'A1:Z1000' }, text: '', truncated: true }, false, false, false],
  [{ context: { kind: 'word', selectionCharacters: 3 }, text: '', truncated: false }, false, false, false],
  [{ context: { kind: 'pdf', page: 2 }, text: '', truncated: false }, false, false, false],
  [{ context: { kind: 'pdf', page: 2 }, text: 'private', truncated: false }, true, false, true],
  [{ context: { kind: 'word' }, text: '', truncated: false }, true, true, false],
] as const)('keeps only source-free conversation independent: %j', (snapshot, greeting, referenced, independent) => {
  const scope = new RequestScopePolicy(snapshot as ComposerContext, { greeting, referenced });
  expect(scope.editorBound).toBe(!independent);
  expect(scope.deferNative).toBe(independent && snapshot.context.kind !== 'pdf');
  scope.bindEditor();
  expect(scope.editorBound).toBe(true);
  scope.bindEditor();
  expect(scope.editorBound).toBe(true);
});
it('freezes enqueue-time spreadsheet values, truncation and target metadata independently of later changes', () => {
  const original: ComposerContext = {
    context: { kind: 'cell', range: 'B2:C2', sheet: 'Budget' },
    text: '42\t9',
    truncated: true,
  };
  const snapshot = snapshotComposerContext(original);
  original.text = 'Later sensitive values';
  original.truncated = false;
  original.context!.range = 'A1';
  expect(snapshot).toEqual({
    context: { kind: 'cell', range: 'B2:C2', sheet: 'Budget' },
    text: '42\t9',
    truncated: true,
  });
  expect(Object.isFrozen(snapshot)).toBe(true);
  expect(Object.isFrozen(snapshot.context)).toBe(true);
});
