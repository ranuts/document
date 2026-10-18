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
    'const APP_ASSETS_TO_CACHE = []; // BUILD_APP_ASSETS\nconst ASSISTANT_CAPABILITY_ASSETS = {}; // BUILD_ASSISTANT_CAPABILITIES',
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

function lists(source: string) {
  return {
    core: JSON.parse(source.match(/const APP_ASSETS_TO_CACHE = (\[.*?\]);/)![1]),
    capabilities: JSON.parse(source.match(/const ASSISTANT_CAPABILITY_ASSETS = (\{.*?\});/)![1]),
  };
}

it('partitions actual capability graphs without downloading unrelated emitted payloads', async () => {
  const { dir, manifest } = await fixture();
  try {
    const graph = manifest as Record<string, any>;
    graph['lib/agent-plugin/agent-plugin.ts'].dynamicImports = [
      'node_modules/@mlc-ai/web-llm/lib/index.js',
      'packages/agent-core/dist/llm/wllama-cpu-runtime.js',
      'lib/agent-plugin/references/pdf-reference-reader.ts',
      'reference',
    ];
    graph['lib/agent-plugin/agent-plugin.ts'].assets = [
      'assets/webllm.worker-test.js',
      'assets/history-search.worker-test.js',
      'assets/cpu.wasm',
    ];
    graph['node_modules/@mlc-ai/web-llm/lib/index.js'] = { file: 'assets/gpu.js' };
    graph['packages/agent-core/dist/llm/wllama-cpu-runtime.js'] = {
      file: 'assets/cpu.js',
      imports: ['lib/agent-plugin/agent-plugin.ts'],
      dynamicImports: [
        'packages/agent-core/vendor/wllama-count/native/default/wllama.wasm?url',
        'packages/agent-core/vendor/wllama-count/native/compat/wllama.wasm?url',
      ],
    };
    graph['packages/agent-core/vendor/wllama-count/native/default/wllama.wasm?url'] = {
      file: 'assets/cpu-url.js',
      assets: ['assets/cpu.wasm'],
    };
    graph['packages/agent-core/vendor/wllama-count/native/compat/wllama.wasm?url'] = {
      file: 'assets/compat-url.js',
      assets: ['assets/compat.wasm'],
    };
    graph['lib/agent-plugin/references/pdf-reference-reader.ts'] = {
      file: 'assets/pdf.js',
      assets: ['assets/pdf.worker-test.mjs'],
    };
    graph.reference = { file: 'assets/reference.js' };
    await writeFile(join(dir, '.vite', 'manifest.json'), JSON.stringify(graph));
    await stampOfflineAssets(dir);
    const { core, capabilities } = lists(await readFile(join(dir, 'sw.js'), 'utf8'));
    expect(core).toContain('/assets/reference.js');
    expect(core).not.toContain('/assets/cpu.wasm');
    expect(core).toContain('/assets/history-search.worker-test.js');
    expect(capabilities.webgpu).toEqual(['/assets/gpu.js', '/assets/webllm.worker-test.js']);
    expect(capabilities.cpu).toEqual(['/assets/cpu-url.js', '/assets/cpu.js', '/assets/cpu.wasm']);
    expect(capabilities['cpu-compat']).toEqual(['/assets/compat-url.js', '/assets/compat.wasm']);
    expect(capabilities.pdf).toEqual(['/assets/pdf.js', '/assets/pdf.worker-test.mjs']);
    expect(JSON.stringify({ core, capabilities })).not.toContain('/assets/engine.js');
    expect(JSON.stringify({ core, capabilities })).not.toContain('private.docx');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

it('rejects unsafe or missing graph dependencies', async () => {
  const { dir, manifest } = await fixture();
  try {
    manifest.engine.assets = ['https://outside.example/runtime.wasm'];
    await writeFile(join(dir, '.vite', 'manifest.json'), JSON.stringify(manifest));
    await expect(stampOfflineAssets(dir)).rejects.toThrow(/asset/i);
    manifest.engine = undefined as never;
    await writeFile(join(dir, '.vite', 'manifest.json'), JSON.stringify(manifest));
    await expect(stampOfflineAssets(dir)).rejects.toThrow(/manifest/i);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

it('keeps the local token and font stylesheets available after an offline reload', async () => {
  const { dir } = await fixture();
  try {
    await writeFile(join(dir, 'app-tokens.css'), ':root{}');
    await writeFile(join(dir, 'ran-tokens.css'), ':root{}');
    await writeFile(join(dir, 'ran-fonts', 'fonts.css'), '@font-face{}');
    const assets = await stampOfflineAssets(dir);
    expect(assets).toContain('/ran-tokens.css');
    expect(assets).toContain('/app-tokens.css');
    expect(assets).toContain('/ran-fonts/fonts.css');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
