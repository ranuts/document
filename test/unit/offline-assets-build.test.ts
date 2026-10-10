import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { stampOfflineAssets } from '../../bin/offline-assets.mjs';
it('builds an offline runtime manifest without model weights, maps or documents', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'document-offline-'));
  try {
    await mkdir(join(dir, 'assets'));
    await mkdir(join(dir, 'ran-fonts'));
    for (const name of [
      'agent.js',
      'runtime.wasm',
      'base.css',
      'model.gguf',
      'weights.bin',
      'source.js.map',
      'private.docx',
    ])
      await writeFile(join(dir, 'assets', name), '');
    await writeFile(join(dir, 'ran-fonts', 'Geist.woff2'), '');
    await writeFile(join(dir, 'sw.js'), 'const APP_ASSETS_TO_CACHE = []; // BUILD_APP_ASSETS');
    const assets = await stampOfflineAssets(dir);
    expect(assets).toEqual(['/assets/agent.js', '/assets/base.css', '/assets/runtime.wasm', '/ran-fonts/Geist.woff2']);
    expect(await readFile(join(dir, 'sw.js'), 'utf8')).toContain('/assets/agent.js');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
