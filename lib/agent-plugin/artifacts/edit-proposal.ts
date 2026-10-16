/** Native textarea offsets are UTF-16, not code-point indices. No DOM or model ownership. */
export interface ArtifactDraft {
  readonly artifactId: string;
  readonly expectedVersion: number;
  readonly revision: number;
  readonly title: string;
  readonly text: string;
  readonly start: number;
  readonly end: number;
}
export interface ArtifactDraftBinding extends ArtifactDraft {
  readonly selectedText: string;
  readonly scope: 'selection' | 'artifact';
}
const MAX_BYTES = 128 * 1024;
export function captureArtifactDraft(input: ArtifactDraft): ArtifactDraftBinding {
  if (
    !Number.isInteger(input.start) ||
    !Number.isInteger(input.end) ||
    input.start < 0 ||
    input.end < input.start ||
    input.end > input.text.length
  )
    throw new Error('Invalid artifact selection');
  const start = input.start === input.end ? 0 : input.start;
  const end = input.start === input.end ? input.text.length : input.end;
  return Object.freeze({
    ...input,
    scope: input.start === input.end ? 'artifact' : 'selection',
    start,
    end,
    selectedText: input.text.slice(start, end),
  });
}
export function sameArtifactDraft(bound: ArtifactDraft, current: ArtifactDraft): boolean {
  return (
    bound.artifactId === current.artifactId &&
    bound.expectedVersion === current.expectedVersion &&
    bound.revision === current.revision &&
    bound.title === current.title &&
    bound.text === current.text
  );
}
export function replaceArtifactRange(bound: ArtifactDraftBinding, replacement: string): string {
  if (!replacement.trim()) throw new Error('Empty artifact proposal');
  const text = bound.text.slice(0, bound.start) + replacement + bound.text.slice(bound.end);
  if (new TextEncoder().encode(text).length > MAX_BYTES) throw new Error('Artifact proposal exceeds 128 KiB');
  return text;
}
