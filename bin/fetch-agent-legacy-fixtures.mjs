// Public LibreOffice regression files. Pinned revision and SHA-256 make the
// opt-in legacy assistant run reproducible without committing binary files.
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';

const revision = '63a2e191551b157adad367d020835e9ec21fc964';
const destination = new URL('../test-results-legacy-fixtures/', import.meta.url);
const fixtures = [
  {
    path: 'sw/qa/extras/ww8export/data/zoom.doc',
    size: 9216,
    sha256: '6ecc9bee5262dc8fb7fab7c21697db59c572e39efeca8661194b1c03bf1d3f82',
  },
  {
    path: 'sc/qa/unit/data/xls/universal-content.xls',
    size: 6656,
    sha256: '3f84bf513e191642835acbd56a40361bdcf1e4ef1a094b5a444b80f240fd889c',
  },
  {
    path: 'sd/qa/unit/data/ppt/tdf49561.ppt',
    size: 14336,
    sha256: 'a7f47bced272ef51dc756950886903fae5dda727bc2b24118989b76796cc0e17',
  },
];
await mkdir(destination, { recursive: true });
for (const fixture of fixtures) {
  const response = await fetch(`https://raw.githubusercontent.com/LibreOffice/core/${revision}/${fixture.path}`, {
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Cannot fetch ${fixture.path}: ${response.status}`);
  const data = Buffer.from(await response.arrayBuffer());
  if (
    data.length !== fixture.size ||
    data.subarray(0, 8).toString('hex') !== 'd0cf11e0a1b11ae1' ||
    createHash('sha256').update(data).digest('hex') !== fixture.sha256
  )
    throw new Error(`Public fixture verification failed: ${fixture.path}`);
  const name = fixture.path.split('/').at(-1);
  await writeFile(new URL(name, destination), data);
  console.log(`Verified public fixture: ${name}`);
}
