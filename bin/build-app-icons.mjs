/** Rasterize the checked-in SVG sources without adding a runtime dependency.
 * npm install --prefix /tmp/document-icon-tools --no-audit --no-fund @resvg/resvg-js@2.6.2
 * node bin/build-app-icons.mjs /tmp/document-icon-tools/package.json
 */
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

if (!process.argv[2]) throw new Error('Pass the package.json path of an installation of @resvg/resvg-js.');
const { Resvg } = createRequire(resolve(process.argv[2]))('@resvg/resvg-js');
for (const [name, sizes] of [
  ['document', [32, 180, 192, 512]],
  ['document-maskable', [512]],
  ['document-light', [32]],
  ['document-dark', [32]],
]) {
  const source = new URL(`../public/icons/${name}.svg`, import.meta.url);
  for (const size of sizes) {
    const png = new Resvg(readFileSync(source), { fitTo: { mode: 'width', value: size } }).render().asPng();
    writeFileSync(new URL(`../public/icons/${name}-${size}.png`, import.meta.url), png);
  }
}
