import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { stampOfflineAssets } from '../../bin/offline-assets.mjs';

async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'document-offline-'));
  await mkdir(join(dir, 'assets'));
  await mkdir(join(dir, 'ran-fonts'));
  await mkdir(join(dir, '.vite'));
  for (const name of [
    'editor.js',
    'shared.js',
    'recovery.js',
    'agent.js',
    'engine.js',
    'runtime.wasm',
    'base.css',
    'private.docx',
    'model.gguf',
  ])
    await writeFile(join(dir, 'assets', name), '');
  await writeFile(join(dir, 'ran-fonts', 'Geist.woff2'), '');
  await writeFile(
    join(dir, 'sw.js'),
    'const APP_ASSETS_TO_CACHE = []; // BUILD_APP_ASSETS\nconst ASSISTANT_ASSETS_TO_CACHE = []; // BUILD_ASSISTANT_ASSETS',
  );
  const manifest = {
    'editor.html': {
      file: 'assets/editor.js',
      isEntry: true,
      imports: ['shared'],
      dynamicImports: ['recovery', 'lib/agent-plugin/agent-plugin.ts'],
      css: ['assets/base.css'],
    },
    shared: { file: 'assets/shared.js' },
    recovery: { file: 'assets/recovery.js' },
    'lib/agent-plugin/agent-plugin.ts': { file: 'assets/agent.js', imports: ['shared'], dynamicImports: ['engine'] },
    engine: { file: 'assets/engine.js', assets: ['assets/runtime.wasm'] },
  };
  await writeFile(join(dir, '.vite', 'manifest.json'), JSON.stringify(manifest));
  return { dir, manifest };
}

it('keeps offline editor dependencies while deferring the assistant and its runtime', async () => {
  const { dir } = await fixture();
  try {
    expect(await stampOfflineAssets(dir)).toEqual([
      '/assets/agent.js',
      '/assets/base.css',
      '/assets/editor.js',
      '/assets/recovery.js',
      '/assets/shared.js',
      '/ran-fonts/Geist.woff2',
    ]);
    const source = await readFile(join(dir, 'sw.js'), 'utf8');
    const optional = JSON.parse(source.match(/const ASSISTANT_ASSETS_TO_CACHE = (\[.*?\]);/)![1]);
    expect(optional).toEqual(['/assets/engine.js', '/assets/runtime.wasm']);
    expect(source).not.toContain('model.gguf');
    expect(source).not.toContain('private.docx');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

it('rejects graph dependencies that could cache an external URL or private file', async () => {
  const { dir, manifest } = await fixture();
  try {
    manifest.engine.assets = ['https://outside.example/runtime.wasm'];
    await writeFile(join(dir, '.vite', 'manifest.json'), JSON.stringify(manifest));
    await expect(stampOfflineAssets(dir)).rejects.toThrow(/asset/i);
    manifest.engine.assets = ['assets/private.docx'];
    await writeFile(join(dir, '.vite', 'manifest.json'), JSON.stringify(manifest));
    await expect(stampOfflineAssets(dir)).rejects.toThrow(/asset/i);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

it('fails the build when an import graph edge is missing', async () => {
  const { dir, manifest } = await fixture();
  try {
    manifest.engine = undefined as never;
    await writeFile(join(dir, '.vite', 'manifest.json'), JSON.stringify(manifest));
    await expect(stampOfflineAssets(dir)).rejects.toThrow(/manifest/i);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
