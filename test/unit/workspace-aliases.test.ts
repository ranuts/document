import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { createServer } from 'vite';
import { workspaceSourceAliases } from '../../bin/workspace-aliases.mjs';
it('loads current source instead of stale package exports, including subpaths and live edits', async () => {
  const root = await mkdtemp(join(tmpdir(), 'workspace-source-'));
  const pkg = join(root, 'packages/local');
  await mkdir(join(pkg, 'src/feature'), { recursive: true });
  await mkdir(join(pkg, 'dist/feature'), { recursive: true });
  await mkdir(join(root, 'node_modules/@test'), { recursive: true });
  await symlink(pkg, join(root, 'node_modules/@test/local'));
  await writeFile(
    join(pkg, 'package.json'),
    JSON.stringify({
      name: '@test/local',
      type: 'module',
      exports: {
        '.': { import: './dist/index.js' },
        './feature': { import: './dist/feature/index.js' },
        './feature/*': { import: './dist/feature/*.js' },
      },
    }),
  );
  for (const file of ['index', 'feature/index', 'feature/item']) {
    await writeFile(join(pkg, 'src', file + '.ts'), 'export const value = "source";');
    await writeFile(join(pkg, 'dist', file + '.js'), 'export const value = "stale";');
  }
  await writeFile(
    join(root, 'entry.ts'),
    `
    import { value as rootValue } from '@test/local';
    import { value as feature } from '@test/local/feature';
    import { value as item } from '@test/local/feature/item';
    export const values = [rootValue, feature, item];
  `,
  );
  const server = await createServer({
    root,
    configFile: false,
    logLevel: 'silent',
    server: { watch: null },
    resolve: { alias: workspaceSourceAliases(root) },
  });
  try {
    expect((await server.ssrLoadModule('/entry.ts')).values).toEqual(['source', 'source', 'source']);
    await writeFile(join(pkg, 'src/index.ts'), 'export const value = "updated";');
    server.environments.ssr.moduleGraph.invalidateAll();
    expect((await server.ssrLoadModule('/entry.ts')).values).toEqual(['updated', 'source', 'source']);
  } finally {
    await server.close();
    await rm(root, { recursive: true, force: true });
  }
});
