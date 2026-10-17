import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const ASSISTANT_ENTRY = 'lib/agent-plugin/agent-plugin.ts';
const GENERATED_ASSET = /^assets\/[A-Za-z0-9_.-]+\.(?:m?js|css|wasm|woff2)$/;

const CAPABILITIES = ['webgpu', 'wllama', 'wllama-compat', 'cpu', 'cpu-compat', 'pdf'];

// Match source identities, never emitted hashes or arbitrary page-supplied URLs.
function capabilityFor(source) {
  if (/\/wllama-count\/native\/compat\//.test(source)) return 'cpu-compat';
  if (/\/wllama-count\//.test(source) || /\/wllama-cpu-runtime\.(?:js|ts)$/.test(source)) return 'cpu';
  if (/\/node_modules\/@wllama\/wllama-compat\//.test('/' + source)) return 'wllama-compat';
  if (/\/node_modules\/@wllama\/wllama\//.test('/' + source)) return 'wllama';
  if (/\/node_modules\/@mlc-ai\/web-llm\//.test('/' + source)) return 'webgpu';
  if (/\/node_modules\/pdfjs-dist\//.test('/' + source) || source.endsWith('/pdf-reference-reader.ts')) return 'pdf';
}

/** Follow edges within one capability; shared UI cycles never pull other engines in. */
function collectAssets(manifest, roots, assetOwners, allowed, owner) {
  const visited = new Set();
  const assets = new Set();
  const add = (asset) => {
    if (!GENERATED_ASSET.test(asset)) throw new Error(`Unsupported offline asset: ${asset}`);
    const capability = assetOwners.get(asset) ?? (/(?:^|\/)webllm\.worker-/.test(asset) ? 'webgpu' : undefined);
    if (!capability || capability === owner) assets.add(`/${asset}`);
  };
  const visit = (key) => {
    if (visited.has(key)) return;
    visited.add(key);
    const chunk = manifest[key];
    if (!chunk) throw new Error(`Missing offline manifest dependency: ${key}`);
    const capability = capabilityFor(chunk.src ?? key);
    if (capability && capability !== owner) return;
    if (allowed && !allowed.has(key)) return;
    for (const asset of [chunk.file, ...(chunk.css ?? []), ...(chunk.assets ?? [])]) add(asset);
    for (const imported of [...(chunk.imports ?? []), ...(chunk.dynamicImports ?? [])]) visit(imported);
  };
  for (const root of roots) visit(root);
  return { assets, visited };
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
  const assetOwners = new Map();
  for (const [key, chunk] of Object.entries(manifest)) {
    const capability = capabilityFor(chunk.src ?? key);
    if (capability) for (const asset of [chunk.file, ...(chunk.assets ?? [])]) assetOwners.set(asset, capability);
  }
  const { assets: core } = collectAssets(manifest, [...entries, ...assistant], assetOwners);
  const capabilityAssets = {};
  // Traversing a runtime root can point back into the UI chunk. Cut those
  // shared edges at the already-collected core graph before following lazy imports.
  const runtimeKeys = new Set(Object.keys(manifest).filter((key) => !core.has(`/${manifest[key].file}`)));
  for (const capability of CAPABILITIES) {
    const roots = Object.keys(manifest).filter((key) => capabilityFor(manifest[key].src ?? key) === capability);
    const { assets } = collectAssets(manifest, roots, assetOwners, runtimeKeys, capability);
    if (capability === 'webgpu') {
      for (const chunk of Object.values(manifest))
        for (const asset of chunk.assets ?? []) if (/(?:^|\/)webllm\.worker-/.test(asset)) assets.add(`/${asset}`);
    }
    capabilityAssets[capability] = [...assets].filter((asset) => !core.has(asset)).sort();
  }
  const fonts = (await readdir(join(directory, 'ran-fonts'))).filter((name) => name.endsWith('.woff2'));
  for (const name of fonts) core.add(`/ran-fonts/${name}`);
  // Vite-only previews retain the stable token URL; production builds may
  // fingerprint it. Both shipped styles must work before any offline reload.
  for (const name of await readdir(directory))
    if (/^(?:ran-tokens(?:\.[A-Za-z0-9_-]+)?|app-tokens)\.css$/.test(name)) core.add(`/${name}`);
  if ((await readdir(join(directory, 'ran-fonts'))).includes('fonts.css')) core.add('/ran-fonts/fonts.css');
  const assets = [...core].sort();
  const path = join(directory, 'sw.js');
  const source = await readFile(path, 'utf8');
  const marker = 'const APP_ASSETS_TO_CACHE = []; // BUILD_APP_ASSETS';
  const assistantMarker = 'const ASSISTANT_CAPABILITY_ASSETS = {}; // BUILD_ASSISTANT_CAPABILITIES';
  if (!source.includes(marker) || !source.includes(assistantMarker))
    throw new Error('Missing offline asset build marker');
  await writeFile(
    path,
    source
      .replace(marker, `const APP_ASSETS_TO_CACHE = ${JSON.stringify(assets)}; // BUILD_APP_ASSETS`)
      .replace(
        assistantMarker,
        `const ASSISTANT_CAPABILITY_ASSETS = ${JSON.stringify(capabilityAssets)}; // BUILD_ASSISTANT_CAPABILITIES`,
      ),
  );
  return assets;
}
if (process.argv[1]?.endsWith('/offline-assets.mjs')) await stampOfflineAssets(process.argv[2] ?? 'dist');
