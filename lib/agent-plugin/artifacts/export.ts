/* eslint-disable no-control-regex -- Spreadsheet formula prefixes and portable filenames require explicit control-byte handling. */
import { validatePayload, type ArtifactPayload } from './payload';
export type ArtifactExportFormat = 'txt' | 'md' | 'csv' | 'json';
function csv(value: string): string {
  const safe = /^[\s\u0000-\u001f]*[=+@-]/.test(value) ? "'" + value : value;
  return '"' + safe.replaceAll('"', '""') + '"';
}
export function exportPayload(input: ArtifactPayload, format: ArtifactExportFormat): string {
  // Legacy text versions retain their original full 128 KiB capacity. Export
  // never writes a new schema envelope back into the store.
  const p =
    input?.kind === 'text'
      ? (() => {
          if (
            typeof input.text !== 'string' ||
            !input.text.trim() ||
            new TextEncoder().encode(input.text).length > 131072 ||
            Object.keys(input).some((k) => !['kind', 'text'].includes(k))
          )
            throw new Error('Invalid artifact text');
          return { kind: 'text' as const, text: input.text };
        })()
      : validatePayload(input);
  if (format === 'json') return JSON.stringify({ schemaVersion: 1, payload: p }, null, 2);
  if (format === 'csv') {
    if (p.kind !== 'table') throw new Error('CSV requires a table');
    return [p.columns, ...p.rows].map((row) => row.map(csv).join(',')).join('\r\n');
  }
  if (p.kind === 'text') return p.text;
  if (p.kind === 'slides')
    return p.slides.map((s) => `${format === 'md' ? '# ' : ''}${s.title}\n\n${s.body}`).join('\n\n---\n\n');
  const escape = (s: string) => s.replaceAll('|', '\\|').replaceAll('\n', ' ');
  if (format === 'md')
    return [
      p.columns.map(escape).join(' | '),
      p.columns.map(() => '---').join(' | '),
      ...p.rows.map((r) => r.map(escape).join(' | ')),
    ].join('\n');
  return [p.columns, ...p.rows].map((row) => row.join('\t')).join('\n');
}

export function artifactFilename(title: string, format: ArtifactExportFormat): string {
  let name = Array.from(
    title
      .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^\.+|\.+$/g, ''),
  )
    .slice(0, 80)
    .join('');
  if (!name) name = 'artifact';
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(name)) name = '_' + name;
  return `${name}.${format}`;
}
