import type { SourceEvidence } from './request-context';
/** Reconcile final runtime clipping with captured host locators. No prose matching. */
export function capturedEvidence(context: string | undefined, captured: unknown): readonly Readonly<SourceEvidence>[] {
  if (!context || !Array.isArray(captured)) return [];
  try {
    const parsed = JSON.parse(context);
    if (!Array.isArray(parsed.references)) return [];
    return Object.freeze(
      parsed.references.flatMap((source: SourceEvidence) => {
        const original = captured.find((item) => item.id === source.id && item.sourceId === source.sourceId);
        return original && typeof source.text === 'string' && original.text.startsWith(source.text)
          ? [Object.freeze({ ...original, text: source.text, ...(source.truncated ? { truncated: true } : {}) })]
          : [];
      }),
    );
  } catch {
    return [];
  }
}
/** Explicit host envelope, bounded independently from untrusted imported conversation JSON. */
export function validSourcePresentation(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const item = value as { id?: unknown; metadata?: Record<string, unknown> };
  if (typeof item.id !== 'string' || item.id.length > 100 || !item.metadata || typeof item.metadata !== 'object')
    return false;
  if (new TextEncoder().encode(JSON.stringify(item.metadata)).length > 8192) return false;
  const evidence = item.metadata.evidence;
  return (
    evidence === undefined ||
    (Array.isArray(evidence) &&
      evidence.length <= 5 &&
      evidence.every(
        (source) =>
          source &&
          /^S[1-5]$/.test(source.id) &&
          typeof source.sourceId === 'string' &&
          source.sourceId.length <= 100 &&
          typeof source.title === 'string' &&
          source.title.length <= 200 &&
          typeof source.connector === 'string' &&
          typeof source.text === 'string',
      ))
  );
}
