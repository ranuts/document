import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export function verifyArchive(root, manifest, { syntax = true } = {}) {
  if (manifest.version !== 1 || !Array.isArray(manifest.files)) throw new Error('Invalid archive manifest');
  const seen = new Set();
  for (const entry of manifest.files) {
    const { path, sha256 } = entry;
    if (
      typeof path !== 'string' ||
      !/^docs\/evaluations\/[\w.-]+\.(json|mjs|md)$/.test(path) ||
      !/^[a-f0-9]{64}$/.test(sha256) ||
      seen.has(path)
    )
      throw new Error('Invalid or duplicate archive entry');
    seen.add(path);
    let bytes;
    try {
      bytes = readFileSync(resolve(root, path));
    } catch {
      throw new Error(`Missing archive: ${path}`);
    }
    if (createHash('sha256').update(bytes).digest('hex') !== sha256) {
      throw new Error(`Archive bytes changed: ${path}`);
    }
    if (path.endsWith('.json')) {
      try {
        JSON.parse(bytes.toString('utf8'));
      } catch {
        throw new Error(`Invalid archived JSON: ${path}`);
      }
    } else if (syntax && path.endsWith('.mjs')) {
      const result = spawnSync(process.execPath, ['--check', resolve(root, path)], { encoding: 'utf8' });
      if (result.error || result.status !== 0) throw new Error(`Invalid archived script syntax: ${path}`);
    }
  }
  return seen.size;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const manifest = JSON.parse(readFileSync(resolve(root, 'docs/evaluations/archive-integrity.json'), 'utf8'));
  console.log(`Verified ${verifyArchive(root, manifest)} archived files (SHA-256, JSON and script syntax).`);
}
