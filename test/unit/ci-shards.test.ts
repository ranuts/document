import { describe, expect, it } from 'vitest';
import { balanceTestFiles, selectShard } from '../../bin/ci-shards.mjs';

describe('duration-informed CI partitions', () => {
  it('balances measured long suites and gives new specs a deterministic place without duplicates', () => {
    const files = ['a.spec.ts', 'b.spec.ts', 'c.spec.ts', 'new.spec.ts'];
    const shards = balanceTestFiles(files, { 'a.spec.ts': 90, 'b.spec.ts': 50, 'c.spec.ts': 40 }, 2);
    expect(shards).toEqual([
      ['a.spec.ts', 'c.spec.ts'],
      ['b.spec.ts', 'new.spec.ts'],
    ]);
    expect(balanceTestFiles([...files].reverse(), { 'a.spec.ts': 90, 'b.spec.ts': 50, 'c.spec.ts': 40 }, 2)).toEqual(
      shards,
    );
    expect(shards.flat().sort()).toEqual(files.sort());
  });
  it('selects only its partition and refuses empty or invalid assignments instead of running everything', () => {
    const shards = [['a.spec.ts'], ['b.spec.ts']];
    expect(selectShard(shards, '2/2')).toEqual(['b.spec.ts']);
    for (const shard of ['0/2', '3/2', '1/3', 'bad']) expect(() => selectShard(shards, shard)).toThrow();
    expect(() => selectShard([[], ['b.spec.ts']], '1/2')).toThrow();
  });
});

it('assigns every current spec once in both CI topologies, including unmeasured specs', async () => {
  const { readdirSync } = await import('node:fs');
  const { spawnSync } = await import('node:child_process');
  const { pathToFileURL } = await import('node:url');
  const { resolve } = await import('node:path');
  const moduleUrl = pathToFileURL(resolve('bin/ci-shards.mjs')).href;
  const files = readdirSync('test/e2e').filter((file) => file.endsWith('.spec.ts'));
  const run = (suite: string, shard: string) => {
    const result = spawnSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `import {ciTestMatch} from ${JSON.stringify(moduleUrl)}; console.log(JSON.stringify(ciTestMatch(${JSON.stringify(suite)})));`,
      ],
      {
        env: { ...process.env, E2E_SHARD: shard },
        encoding: 'utf8',
      },
    );
    expect(result.status, result.stderr).toBe(0);
    return JSON.parse(result.stdout);
  };
  for (const [suite, count] of [
    ['preview', 3],
    ['pages', 5],
  ] as const) {
    const selected: string[] = [];
    for (let index = 1; index <= count; index++) selected.push(...run(suite, `${index}/${count}`).testMatch);
    expect(selected.sort()).toEqual(files.map((file) => `**/test/e2e/${file}`).sort());
  }
  expect(run('preview', '')).toEqual({});
});

it('keeps nested specs in isolated repository partitions', async () => {
  const { mkdtemp, mkdir, copyFile, rm, writeFile } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { spawnSync } = await import('node:child_process');
  const { pathToFileURL } = await import('node:url');
  const root = await mkdtemp(join(tmpdir(), 'ci-nested-shards-'));
  try {
    await mkdir(join(root, 'bin'));
    await mkdir(join(root, 'test/e2e/nested/deep'), { recursive: true });
    await copyFile('bin/ci-shards.mjs', join(root, 'bin/ci-shards.mjs'));
    await writeFile(join(root, 'bin/ci-shard-timings.json'), JSON.stringify({ preview: { 'root.spec.ts': 10 } }));
    await writeFile(join(root, 'test/e2e/root.spec.ts'), '');
    await writeFile(join(root, 'test/e2e/nested/deep/new.spec.ts'), '');
    const selected = [];
    for (const shard of ['1/2', '2/2']) {
      const result = spawnSync(
        process.execPath,
        [
          '--input-type=module',
          '-e',
          `import {ciTestMatch} from ${JSON.stringify(pathToFileURL(join(root, 'bin/ci-shards.mjs')).href)}; console.log(JSON.stringify(ciTestMatch('preview').testMatch));`,
        ],
        {
          env: { ...process.env, E2E_SHARD: shard },
          encoding: 'utf8',
        },
      );
      expect(result.status, result.stderr).toBe(0);
      selected.push(...JSON.parse(result.stdout));
    }
    expect(selected.sort()).toEqual(['**/test/e2e/nested/deep/new.spec.ts', '**/test/e2e/root.spec.ts']);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it('runs root and nested specs with the same basename exactly once through the real Playwright CLI', async () => {
  const { mkdtemp, mkdir, copyFile, rm, writeFile } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join, resolve } = await import('node:path');
  const { createRequire } = await import('node:module');
  const { spawnSync } = await import('node:child_process');
  const require = createRequire(resolve('package.json'));
  const root = await mkdtemp(join(tmpdir(), 'ci-colliding-shards-'));
  try {
    await mkdir(join(root, 'bin'));
    await mkdir(join(root, 'test/e2e/nested'), { recursive: true });
    await copyFile('bin/ci-shards.mjs', join(root, 'bin/ci-shards.mjs'));
    await writeFile(join(root, 'bin/ci-shard-timings.json'), JSON.stringify({ preview: { 'same.spec.ts': 10 } }));
    await writeFile(
      join(root, 'playwright.config.mjs'),
      "import {ciTestMatch} from './bin/ci-shards.mjs'; export default {testDir:'./test/e2e', ...ciTestMatch('preview')};",
    );
    for (const [file, title] of [
      ['same.spec.ts', 'root same'],
      ['nested/same.spec.ts', 'nested same'],
    ]) {
      await writeFile(
        join(root, 'test/e2e', file),
        `const {test}=require(${JSON.stringify(require.resolve('@playwright/test'))});test(${JSON.stringify(title)},()=>{});`,
      );
    }
    const selected: string[] = [];
    const titles = (suite: { specs?: { title: string }[]; suites?: unknown[] }): string[] => [
      ...(suite.specs || []).map((spec) => spec.title),
      ...(suite.suites || []).flatMap((child) => titles(child as typeof suite)),
    ];
    for (const shard of ['1/2', '2/2']) {
      const result = spawnSync(
        process.execPath,
        [
          require.resolve('@playwright/test/cli'),
          'test',
          '-c',
          join(root, 'playwright.config.mjs'),
          '--list',
          '--reporter=json',
        ],
        {
          env: { ...process.env, E2E_SHARD: shard },
          encoding: 'utf8',
        },
      );
      expect(result.status, result.stderr + result.stdout).toBe(0);
      selected.push(...titles(JSON.parse(result.stdout)));
    }
    expect(selected.sort()).toEqual(['nested same', 'root same']);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}, 20_000);
