import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const ASSISTANT_ENTRY = 'lib/agent-plugin/agent-plugin.ts';
const GENERATED_ASSET = /^assets\/[A-Za-z0-9_.-]+\.(?:m?js|css|wasm|woff2)$/;

/** Follow app edges, optionally deferring lazy imports and attached runtime assets. */
function collectAssets(manifest, roots, excluded = new Set(), includeRuntime = true) {
  const visited = new Set();
  const assets = new Set();
  const visit = (key) => {
    if (visited.has(key) || excluded.has(key)) return;
    visited.add(key);
    const chunk = manifest[key];
    if (!chunk) throw new Error(`Missing offline manifest dependency: ${key}`);
    // Worker outputs can appear in a static UI chunk's assets without being a
    // static import. Keep its styles and fonts, but defer executable payloads.
    const attachedAssets = (chunk.assets ?? []).filter((asset) => includeRuntime || !/\.(?:m?js|wasm)$/.test(asset));
    for (const asset of [chunk.file, ...(chunk.css ?? []), ...attachedAssets]) {
      if (!GENERATED_ASSET.test(asset)) throw new Error(`Unsupported offline asset: ${asset}`);
      assets.add(`/${asset}`);
    }
    for (const imported of [...(chunk.imports ?? []), ...(includeRuntime ? (chunk.dynamicImports ?? []) : [])])
      visit(imported);
  };
  for (const root of roots) visit(root);
  return assets;
}

/** Core app dependencies install first; optional inference assets need explicit opt-in. */
export async function stampOfflineAssets(directory) {
  const manifest = JSON.parse(await readFile(join(directory, '.vite', 'manifest.json'), 'utf8'));
  const entries = Object.entries(manifest)
    .filter(([, chunk]) => chunk.isEntry)
    .map(([key]) => key);
  const assistant = Object.keys(manifest).filter(
    (key) => key === ASSISTANT_ENTRY || manifest[key].src === ASSISTANT_ENTRY,
  );
  if (!entries.length || assistant.length !== 1) throw new Error('Missing offline app or assistant manifest entry');
  const core = collectAssets(manifest, entries, new Set(assistant));
  // Retain the small UI graph for old live pages whose lazy import URLs must
  // survive a deploy. Inference engines, Workers and WASM remain optional.
  for (const asset of collectAssets(manifest, assistant, new Set(), false)) core.add(asset);
  const optional = collectAssets(manifest, assistant);
  // Worker outputs may be emitted outside the main manifest's dependency graph.
  // They belong to the optional inference runtime, never to the first visit.
  for (const name of await readdir(join(directory, 'assets'))) {
    if (/\.(?:m?js|css|wasm)$/.test(name)) optional.add(`/assets/${name}`);
  }
  const fonts = (await readdir(join(directory, 'ran-fonts'))).filter((name) => name.endsWith('.woff2'));
  for (const name of fonts) core.add(`/ran-fonts/${name}`);
  // Vite-only previews retain the stable token URL; production builds may
  // fingerprint it. Both shipped styles must work before any offline reload.
  for (const name of await readdir(directory))
    if (/^ran-tokens(?:\.[A-Za-z0-9_-]+)?\.css$/.test(name)) core.add(`/${name}`);
  if ((await readdir(join(directory, 'ran-fonts'))).includes('fonts.css')) core.add('/ran-fonts/fonts.css');
  const assets = [...core].sort();
  const assistantAssets = [...optional].filter((asset) => !core.has(asset)).sort();
  const path = join(directory, 'sw.js');
  const source = await readFile(path, 'utf8');
  const marker = 'const APP_ASSETS_TO_CACHE = []; // BUILD_APP_ASSETS';
  const assistantMarker = 'const ASSISTANT_ASSETS_TO_CACHE = []; // BUILD_ASSISTANT_ASSETS';
  if (!source.includes(marker) || !source.includes(assistantMarker))
    throw new Error('Missing offline asset build marker');
  await writeFile(
    path,
    source
      .replace(marker, `const APP_ASSETS_TO_CACHE = ${JSON.stringify(assets)}; // BUILD_APP_ASSETS`)
      .replace(
        assistantMarker,
        `const ASSISTANT_ASSETS_TO_CACHE = ${JSON.stringify(assistantAssets)}; // BUILD_ASSISTANT_ASSETS`,
      ),
  );
  return assets;
}
if (process.argv[1]?.endsWith('/offline-assets.mjs')) await stampOfflineAssets(process.argv[2] ?? 'dist');
