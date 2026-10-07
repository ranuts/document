import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { verifyArchive } from '../../bin/evaluation-archive.mjs';

const roots: string[] = [];
function fixture(text = '{}', extension = 'json') {
  const root = mkdtempSync(join(tmpdir(), 'evaluation-archive-'));
  roots.push(root);
  mkdirSync(join(root, 'docs/evaluations'), { recursive: true });
  const path = `docs/evaluations/receipt.${extension}`;
  writeFileSync(join(root, path), text);
  return { root, manifest: { version: 1, files: [{ path, sha256: createHash('sha256').update(text).digest('hex') }] } };
}
afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));
it('accepts intact parseable receipts', () => {
  const { root, manifest } = fixture();
  expect(verifyArchive(root, manifest)).toBe(1);
});
it('rejects modified or removed evidence', () => {
  const { root, manifest } = fixture();
  writeFileSync(join(root, manifest.files[0].path), '{"changed":true}');
  expect(() => verifyArchive(root, manifest)).toThrow('bytes changed');
  rmSync(join(root, manifest.files[0].path));
  expect(() => verifyArchive(root, manifest)).toThrow('Missing archive');
});
it('rejects invalid JSON even with matching bytes', () => {
  const { root, manifest } = fixture('{');
  expect(() => verifyArchive(root, manifest)).toThrow('Invalid archived JSON');
});
it('rejects script syntax errors even with matching bytes', () => {
  const { root, manifest } = fixture('const = ;', 'mjs');
  expect(() => verifyArchive(root, manifest)).toThrow('script syntax');
});
it('rejects traversal and duplicate manifest entries', () => {
  const { root, manifest } = fixture();
  manifest.files.push(manifest.files[0]);
  expect(() => verifyArchive(root, manifest)).toThrow('duplicate');
  manifest.files = [{ ...manifest.files[0], path: 'docs/evaluations/../../package.json' }];
  expect(() => verifyArchive(root, manifest)).toThrow('Invalid');
});
