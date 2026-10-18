#!/usr/bin/env node
// Stamp the final served output, after every build transform (including sw.js).
// Git archives/Docker contexts omit .git: pass BUILD_REVISION to preserve source
// identity there. Without source metadata the content identity remains explicit.
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(process.argv[2] || 'dist');
const files = (await readdir(root, { recursive: true, withFileTypes: true }))
  .filter((entry) => entry.isFile())
  .map((entry) =>
    resolve(entry.parentPath, entry.name)
      .slice(root.length + 1)
      .replaceAll('\\', '/'),
  )
  .filter((name) => name !== 'build-identity.json')
  .sort();
if (!files.length) throw new Error('Cannot identify an empty build');
const tree = createHash('sha256');
for (const name of files) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(resolve(root, name))) hash.update(chunk);
  tree.update(name + '\0' + hash.digest('hex') + '\n');
}
const contentSha256 = tree.digest('hex');
let revision = process.env.BUILD_REVISION;
if (!revision) {
  try {
    revision = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: resolve(import.meta.dirname, '..'),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    revision = process.env.CF_PAGES_COMMIT_SHA || `content:${contentSha256}`;
  }
}
if (!/^(?:[a-f0-9]{40,64}|content:[a-f0-9]{64})$/.test(revision)) throw new Error('Invalid build revision');
await writeFile(resolve(root, 'build-identity.json'), JSON.stringify({ schema: 1, revision, contentSha256 }) + '\n');
console.log(`Build identity: ${revision} (${contentSha256})`);
