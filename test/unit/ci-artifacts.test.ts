import { expect, it } from 'vitest';
import { playwrightArtifacts } from '../../bin/ci-artifacts.mjs';

it('keeps normal and serial traces and HTML in separate uploadable directories', () => {
  const normal = playwrightArtifacts('default-report', 'default-results', {
    E2E_REPORT_DIR: 'reports/normal',
    E2E_RESULTS_DIR: 'results/normal',
  });
  const serial = playwrightArtifacts('default-report', 'default-results', {
    E2E_REPORT_DIR: 'reports/serial',
    E2E_RESULTS_DIR: 'results/serial',
  });
  expect(normal.outputDir).toBe('results/normal');
  expect(serial.outputDir).toBe('results/serial');
  expect(normal.reporter).toEqual([['list'], ['html', { outputFolder: 'reports/normal', open: 'never' }]]);
  expect(serial.reporter).toEqual([['list'], ['html', { outputFolder: 'reports/serial', open: 'never' }]]);
  expect(playwrightArtifacts('default-report', 'default-results', {}).outputDir).toBe('default-results');
});

it('retains a failed first pass report and attachment after a successful second Playwright pass', async () => {
  const { mkdtemp, readFile, rm, writeFile } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join, resolve } = await import('node:path');
  const { pathToFileURL } = await import('node:url');
  const { createRequire } = await import('node:module');
  const { spawnSync } = await import('node:child_process');
  const require = createRequire(resolve('package.json'));
  const root = await mkdtemp(join(tmpdir(), 'ci-artifacts-'));
  try {
    const playwright = require.resolve('@playwright/test');
    const helper = pathToFileURL(resolve('bin/ci-artifacts.mjs')).href;
    await writeFile(
      join(root, 'playwright.config.mjs'),
      `import {playwrightArtifacts} from ${JSON.stringify(helper)}; export default {testDir: '.', ...playwrightArtifacts('unused-report','unused-results')};`,
    );
    await writeFile(
      join(root, 'passes.spec.cjs'),
      `const {test,expect}=require(${JSON.stringify(playwright)}); const fs=require('node:fs'); test('normal',async({},info)=>{fs.writeFileSync(info.outputPath('evidence.txt'),'first pass evidence');expect(1).toBe(2)});test('serial',()=>{});`,
    );
    const run = (pass: string) =>
      spawnSync(
        process.execPath,
        [require.resolve('@playwright/test/cli'), 'test', '-c', join(root, 'playwright.config.mjs'), '--grep', pass],
        {
          env: {
            ...process.env,
            E2E_REPORT_DIR: join(root, 'reports', pass),
            E2E_RESULTS_DIR: join(root, 'results', pass),
          },
          encoding: 'utf8',
        },
      );
    expect(run('normal').status).toBe(1);
    const serial = run('serial');
    expect(serial.status, serial.stdout + serial.stderr).toBe(0);
    expect(await readFile(join(root, 'reports/normal/index.html'), 'utf8')).toContain('<html');
    expect(await readFile(join(root, 'reports/serial/index.html'), 'utf8')).toContain('<html');
    expect(await readFile(join(root, 'results/normal/passes-normal/evidence.txt'), 'utf8')).toBe('first pass evidence');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}, 20_000);
