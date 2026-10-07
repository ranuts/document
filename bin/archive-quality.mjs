import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { verifyArchive } from './evaluation-archive.mjs';

const mode = process.argv[2];
if (!['format', 'format:check', 'lint'].includes(mode)) throw new Error('Expected format, format:check or lint');
const root = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(readFileSync(join(root, 'docs/evaluations/archive-integrity.json'), 'utf8'));
console.log(`Verified ${verifyArchive(root, manifest)} immutable evaluation artifacts.`);
// Ignore patterns resolve relative to the ignore file, so it must live at
// the repository root. Exclusive creation avoids overwriting another run.
const ignore = join(root, `.archive-quality-${process.pid}.ignore`);
try {
  const existing = mode === 'lint' ? '' : readFileSync(join(root, '.prettierignore'), 'utf8');
  writeFileSync(ignore, `${existing}\n${manifest.files.map(({ path }) => `/${path}`).join('\n')}\n`, { flag: 'wx' });
  const args =
    mode === 'lint'
      ? [
          'exec',
          'oxlint',
          '--deny-warnings',
          ...manifest.files
            .filter(({ path }) => path.endsWith('.mjs'))
            .flatMap(({ path }) => ['--ignore-pattern', path]),
        ]
      : [
          'exec',
          'prettier',
          mode === 'format' ? '--write' : '--check',
          '.',
          '--ignore-path',
          '.gitignore',
          '--ignore-path',
          ignore,
        ];
  const result = spawnSync('pnpm', args, { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  rmSync(ignore, { force: true });
}
