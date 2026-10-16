/** Declarative data only. No executable markup or inferred formats. */
export type ArtifactPayload =
  | { kind: 'text'; text: string }
  | { kind: 'table'; columns: string[]; rows: string[][] }
  | { kind: 'slides'; slides: Array<{ title: string; body: string }> };
const bytes = (s: string) => new TextEncoder().encode(s).length;
function object(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some((k) => !keys.includes(k)))
    throw new Error('Invalid artifact payload');
  return value as Record<string, unknown>;
}
function field(value: unknown): string {
  if (typeof value !== 'string' || bytes(value) > 16384) throw new Error('Invalid artifact field');
  return value;
}
function array(value: unknown, max: number): unknown[] {
  if (
    !Array.isArray(value) ||
    value.length > max ||
    Object.keys(value).length !== value.length ||
    !Array.from({ length: value.length }, (_, i) => Object.hasOwn(value, i)).every(Boolean)
  )
    throw new Error('Invalid artifact array');
  return value;
}
export function validatePayload(value: unknown): ArtifactPayload {
  const v = object(value, ['kind', 'text', 'columns', 'rows', 'slides']);
  let result: ArtifactPayload;
  if (v.kind === 'text') {
    object(v, ['kind', 'text']);
    if (typeof v.text !== 'string' || !v.text.trim() || bytes(v.text) > 131072)
      throw new Error('Invalid artifact text');
    result = { kind: 'text', text: v.text };
  } else if (v.kind === 'table') {
    object(v, ['kind', 'columns', 'rows']);
    const columns = array(v.columns, 50).map(field);
    if (!columns.length) throw new Error('Missing columns');
    const rows = array(v.rows, 500).map((row) => {
      const cells = array(row, 50).map(field);
      if (cells.length !== columns.length) throw new Error('Mismatched row');
      return cells;
    });
    if (rows.length * columns.length > 10000) throw new Error('Too many cells');
    result = { kind: 'table', columns, rows };
  } else if (v.kind === 'slides') {
    object(v, ['kind', 'slides']);
    const slides = array(v.slides, 50).map((value) => {
      const slide = object(value, ['title', 'body']);
      return { title: field(slide.title), body: field(slide.body) };
    });
    if (!slides.length) throw new Error('Missing slides');
    result = { kind: 'slides', slides };
  } else throw new Error('Unknown artifact kind');
  if (bytes(JSON.stringify(result)) > 131072) throw new Error('Artifact payload too large');
  return result;
}
export function payloadText(payload: ArtifactPayload): string {
  return payload.kind === 'text' ? payload.text : JSON.stringify(payload);
}
