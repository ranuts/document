import { expect, it } from 'vitest';
import { validatePayload } from '../../lib/agent-plugin/artifacts/payload';
import { exportPayload } from '../../lib/agent-plugin/artifacts/export';
it('copies structured values and rejects malformed, sparse and excessive shapes', () => {
  const p = { kind: 'table', columns: ['Name'], rows: [['one']] };
  const copy = validatePayload(p);
  p.rows[0][0] = 'changed';
  expect(copy).toEqual({ kind: 'table', columns: ['Name'], rows: [['one']] });
  for (const bad of [
    { kind: 'table', columns: ['a'], rows: [[]] },
    { kind: 'slides', slides: new Array(2) },
    { kind: 'table', columns: Array(51).fill('a'), rows: [] },
    { kind: 'text', text: 'x', execute: 'bad' },
    { kind: 'slides', slides: [{ title: 'x', body: '中'.repeat(6000) }] },
  ])
    expect(() => validatePayload(bad)).toThrow();
});
it('exports CSV safely without mutating stored values', () => {
  const p = validatePayload({
    kind: 'table',
    columns: ['a', 'b'],
    rows: [
      [' =SUM(1)', 'a,"b\n'],
      ['\t@x', '-2'],
    ],
  });
  expect(exportPayload(p, 'csv')).toBe('"a","b"\r\n"\' =SUM(1)","a,""b\n"\r\n"\'\t@x","\'-2"');
  expect(exportPayload(p, 'json')).toContain(' =SUM(1)');
});
it('enforces all structured bounds including UTF-8 totals and rejects cycles without serializing them', () => {
  const table = (columns: number, rows: number) => ({
    kind: 'table',
    columns: Array(columns).fill('c'),
    rows: Array.from({ length: rows }, () => Array(columns).fill('')),
  });
  expect(() => validatePayload(table(50, 200))).not.toThrow();
  expect(() => validatePayload(table(50, 201))).toThrow();
  expect(() => validatePayload(table(1, 501))).toThrow();
  expect(() =>
    validatePayload({ kind: 'slides', slides: Array.from({ length: 51 }, () => ({ title: 'a', body: 'b' })) }),
  ).toThrow();
  expect(() =>
    validatePayload({
      kind: 'slides',
      slides: Array.from({ length: 10 }, () => ({ title: 'a', body: 'x'.repeat(16000) })),
    }),
  ).toThrow();
  const cycle: any = { kind: 'table', columns: ['a'], rows: [] };
  cycle.rows.push([cycle]);
  expect(() => validatePayload(cycle)).toThrow();
  const sparse: any = [];
  sparse.length = 1;
  sparse.extra = 'x';
  expect(() => validatePayload({ kind: 'table', columns: sparse, rows: [] })).toThrow();
  expect(() => validatePayload({ kind: 'text', text: 'x'.repeat(131072) })).toThrow();
});
it('exports the full legacy text capacity without forcing a new persisted schema', () => {
  const text = 'x'.repeat(131072);
  expect(exportPayload({ kind: 'text', text }, 'txt')).toBe(text);
});
it('uses bounded portable artifact titles for explicit downloads', async () => {
  const { artifactFilename } = await import('../../lib/agent-plugin/artifacts/export');
  expect(artifactFilename(' Release / Notes: 2026 ', 'csv')).toBe('Release - Notes- 2026.csv');
  expect(artifactFilename('..', 'json')).toBe('artifact.json');
  expect(artifactFilename('CON', 'txt')).toBe('_CON.txt');
  expect(artifactFilename('中'.repeat(100), 'md').length).toBe(83);
});
