import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/** Build outputs only: no model weights, documents, source maps or external URLs. */
export async function stampOfflineAssets(directory) {
  const chunks = (await readdir(join(directory, 'assets'))).filter((name) => /\.(?:js|css|wasm)$/.test(name));
  const fonts = (await readdir(join(directory, 'ran-fonts'))).filter((name) => name.endsWith('.woff2'));
  const assets = [...chunks.map((name) => `/assets/${name}`), ...fonts.map((name) => `/ran-fonts/${name}`)].sort();
  const path = join(directory, 'sw.js');
  const source = await readFile(path, 'utf8');
  const marker = 'const APP_ASSETS_TO_CACHE = []; // BUILD_APP_ASSETS';
  if (!source.includes(marker)) throw new Error('Missing offline app asset build marker');
  await writeFile(
    path,
    source.replace(marker, `const APP_ASSETS_TO_CACHE = ${JSON.stringify(assets)}; // BUILD_APP_ASSETS`),
  );
  return assets;
}
if (process.argv[1]?.endsWith('/offline-assets.mjs')) await stampOfflineAssets(process.argv[2] ?? 'dist');
