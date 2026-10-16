import { expect, it } from 'vitest';
import {
  captureArtifactDraft,
  replaceArtifactRange,
  sameArtifactDraft,
} from '../../lib/agent-plugin/artifacts/edit-proposal';
const draft = {
  artifactId: 'a',
  expectedVersion: 2,
  revision: 4,
  title: 'Title',
  text: '前😀selected后',
  start: 3,
  end: 11,
};
it('captures native UTF-16 selection and replaces only that range', () => {
  const bound = captureArtifactDraft(draft);
  expect(bound.selectedText).toBe('selected');
  expect(replaceArtifactRange(bound, '新')).toBe('前😀新后');
  draft.text = 'changed';
  expect(bound.text).toBe('前😀selected后');
});
it('full artifact mode captures the complete immutable body', () => {
  const bound = captureArtifactDraft({ ...draft, text: 'whole', start: 2, end: 2 });
  expect(bound.selectedText).toBe('whole');
  expect(replaceArtifactRange(bound, 'new')).toBe('new');
});
it('rejects invalid offsets and distinguishes every freshness owner', () => {
  const value = { ...draft, text: 'abc', start: 0, end: 3 };
  expect(() => captureArtifactDraft({ ...value, start: -1 })).toThrow();
  const bound = captureArtifactDraft(value);
  expect(sameArtifactDraft(bound, value)).toBe(true);
  for (const delta of [{ artifactId: 'b' }, { expectedVersion: 3 }, { revision: 5 }, { title: 'new' }, { text: 'ab' }])
    expect(sameArtifactDraft(bound, { ...value, ...delta })).toBe(false);
  expect(() => replaceArtifactRange(bound, ' ')).toThrow();
  expect(() => replaceArtifactRange(bound, 'x'.repeat(131073))).toThrow();
});
