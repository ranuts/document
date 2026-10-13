/** Render the product sharing artwork without a runtime dependency.
 * npm install --prefix <tools-dir> --no-audit --no-fund @resvg/resvg-js@2.6.2
 * node bin/build-social-image.mjs <tools-dir>/package.json
 */
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

if (!process.argv[2]) throw new Error('Pass the package.json path of an installation of @resvg/resvg-js.');
const { Resvg } = createRequire(resolve(process.argv[2]))('@resvg/resvg-js');
const brand = readFileSync(new URL('../public/icons/document-light.svg', import.meta.url), 'utf8').match(
  /<g fill="#171717">([\s\S]*?)<\/g>/,
)[1];

for (const [name, width, height] of [
  ['document-editor-v1', 1200, 630],
  ['document-editor-github-v1', 1280, 640],
]) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <title>Online Document Editor</title>
  <desc>Open-source document editing in your browser. Word, Excel, PowerPoint and PDF. Local editing, no signup, optional AI (Experimental Beta), WebMCP and PWA.</desc>
  <rect width="${width}" height="${height}" fill="#f7f7f4"/>
  <g transform="translate(${(width - 1200) / 2} ${(height - 630) / 2})">
  <g transform="translate(76 58) scale(.135)">${brand}</g>
  <g font-family="Arial, Helvetica, sans-serif" fill="#171717">
    <text x="160" y="103" font-size="28" font-weight="700">Online Document Editor</text>
    <text x="80" y="243" font-size="66" font-weight="700" letter-spacing="-2">Your documents.</text>
    <text x="80" y="322" font-size="66" font-weight="700" letter-spacing="-2">Right in your browser.</text>
    <text x="83" y="384" font-size="26" fill="#525252">Word · Excel · PowerPoint · PDF</text>
    <text x="83" y="443" font-size="22" fill="#525252">Local editing. Open source. No signup.</text>
    <path d="M80 480H1120" stroke="#d8d8d2"/>
    <text x="83" y="526" font-size="19" fill="#525252">AI (Experimental Beta) · WebMCP · PWA</text>
    <text x="83" y="568" font-size="20" font-weight="700">edit.chaxus.com</text>
    <text x="1120" y="568" text-anchor="end" font-size="18" fill="#737373">github.com/ranuts/document</text>
  </g>
  </g>
</svg>`;
  const folder = new URL('../public/social/', import.meta.url);
  mkdirSync(folder, { recursive: true });
  writeFileSync(new URL(`${name}.svg`, folder), svg);
  writeFileSync(new URL(`${name}.png`, folder), new Resvg(svg).render().asPng());
}
