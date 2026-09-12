#!/usr/bin/env node
/**
 * Keep the font picker's thumbnail sprites as long as the font catalog.
 *
 * The font dropdown does not draw font names as text. Each row is a tile cut
 * out of one sprite, and the tile index is the font's position in
 * `__fonts_infos`:
 *
 *     s = Math.floor(store.at(n).get('imgidx') / r)
 *     spriteThumbs.getImage(s)        // -> new Uint8ClampedArray(data.buffer, s*a, a)
 *
 * So the sprite's tile count must be at least the number of families. A
 * catalog with more families than the sprite has tiles crashes the editor the
 * moment the reader scrolls to the bottom of the list --
 * `RangeError: Invalid typed array length` out of that view constructor, then
 * again on every subsequent scroll, and the document can no longer be edited
 * (GitHub #218). Upstream never hits it because `allfontsgen` writes AllFonts.js
 * and the sprites in one pass; we edit the catalog by hand
 * (docs/changelogs/2026-08-22-font-licensing.md), so the two can drift.
 *
 * This appends the missing tiles, rendering each name in its own face the way
 * the vendor's own tiles are rendered. It is idempotent: families already
 * covered by the sprite are left byte-for-byte alone, so the 193 tiles that
 * arrived with the vendor are never re-rendered.
 *
 * Usage:
 *   node bin/font-thumbnails.mjs            # append what is missing
 *   node bin/font-thumbnails.mjs --check    # report drift, write nothing
 *   node bin/font-thumbnails.mjs --calibrate # print vendor vs rendered metrics
 *
 * Both files are written. The `.png` twin beside each `.bin` is read only when
 * `supportBinaryFormat` is false, which requires the ONLYOFFICE desktop shell
 * (`Common.Controllers.Desktop.isActive()`) -- no browser takes that path --
 * but two encodings of one picture drift unless one is generated from the
 * other, so the PNG is rebuilt from the mask every time.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { encodeAlphaPng } from './lib/png.mjs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ALL_FONTS = resolve(ROOT, 'public/sdkjs/common/AllFonts.js');
const FONT_DIR = resolve(ROOT, 'public/fonts');
const IMAGE_DIR = resolve(ROOT, 'public/sdkjs/common/Images');

/** Same 16-byte key bin/font-catalog.mjs and the vendor's fetchFonts use. */
const XOR_KEY = [160, 102, 214, 32, 20, 150, 71, 250, 149, 105, 184, 80, 176, 65, 73, 72];

/**
 * Every sprite the picker can ask for: `_ea` is chosen for zh/ja/ko, and the
 * ratio suffixes are picked by device pixel ratio. All of them are indexed by
 * the same font position, so all of them have to be as long as the catalog.
 */
const VARIANTS = ['', '_ea'];
const RATIOS = ['', '@1.25x', '@1.5x', '@1.75x', '@2x'];

/**
 * Type metrics, measured off the vendor's own tiles at ratio 1 (see
 * --calibrate): names start 18 px from the left and sit on a baseline 20 px
 * down, at a size whose cap height is 13 px.
 */
const LEFT_PX = 18;
const BASELINE_PX = 20;
const FONT_PX = 18;

function deobfuscate(buffer) {
  const out = Buffer.from(buffer);
  for (let i = 0; i < Math.min(32, out.length); i++) out[i] ^= XOR_KEY[i % XOR_KEY.length];
  return out;
}

/** `__fonts_files` and `__fonts_infos`, as the catalog declares them. */
function readCatalog() {
  const source = readFileSync(ALL_FONTS, 'utf8');
  const filesAt = source.indexOf('__fonts_files');
  const infosAt = source.indexOf('__fonts_infos');
  if (filesAt < 0 || infosAt < 0) throw new Error('AllFonts.js: no __fonts_files / __fonts_infos');

  const files = [...source.slice(filesAt, infosAt).matchAll(/"([^"]+)"/g)].slice(1).map((m) => m[1]);
  const infos = [...source.slice(infosAt).matchAll(/\n\s*\["((?:[^"\\]|\\.)*)",\s*(-?\d+)\s*,/g)].map((m) => ({
    name: m[1],
    indexR: Number(m[2]),
  }));
  return { files, infos };
}

/** The PNG twin's pixel size, straight out of IHDR. */
function pngSize(path) {
  if (!existsSync(path)) return null;
  const bytes = readFileSync(path);
  // signature (8) + length (4) + 'IHDR' (4)
  if (bytes.length < 24) return null;
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

/** Header plus the raw RLE payload; the payload is never rewritten. */
function readSprite(path) {
  const bytes = readFileSync(path);
  return {
    width: bytes.readUInt32BE(0),
    heightOne: bytes.readUInt32BE(4),
    count: bytes.readUInt32BE(8),
    payload: bytes.subarray(12),
  };
}

/**
 * The sprite's own encoding: a byte is a pixel's alpha, except 0, which is
 * followed by a run length of fully transparent pixels. Runs are one byte, so
 * anything longer is emitted as several.
 */
function encodeTile(alpha) {
  const out = [];
  let i = 0;
  while (i < alpha.length) {
    if (alpha[i] === 0) {
      let run = 0;
      while (i + run < alpha.length && alpha[i + run] === 0 && run < 255) run++;
      out.push(0, run);
      i += run;
    } else {
      out.push(alpha[i]);
      i++;
    }
  }
  return Buffer.from(out);
}

/** The whole mask, one byte of coverage per pixel. */
function decodeSheet(sprite) {
  const alpha = new Uint8Array(sprite.width * sprite.heightOne * sprite.count);
  const bytes = sprite.payload;
  let o = 0;
  let a = 0;
  while (o < bytes.length) {
    const value = bytes[o++];
    if (value === 0) a += bytes[o++];
    else alpha[a++] = value;
  }
  return alpha;
}

/** One tile out of the mask, for --calibrate. */
function decodeTile(sprite, index) {
  const perTile = sprite.width * sprite.heightOne;
  return decodeSheet(sprite).subarray(index * perTile, (index + 1) * perTile);
}

function inkBox(alpha, width, height) {
  let minX = width;
  let maxX = -1;
  let minY = height;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!alpha[y * width + x]) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  return { minX, maxX, minY, maxY };
}

/**
 * Render names to alpha masks in a real browser.
 *
 * A headless Chromium is the only rasteriser here that can be handed an
 * arbitrary TTF and asked for the same shaping the editor will do. Each face is
 * registered under a synthetic family so a system font of the same name cannot
 * answer instead, with the catalog's own Noto Sans behind it for names whose
 * own face has no Latin (Thaana and Syriac do not).
 */
async function renderTiles(requests, faces) {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    return await page.evaluate(
      async ({ requests, faces, metrics }) => {
        const toBytes = (base64) => Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
        for (const face of faces) {
          const loaded = await new FontFace(face.family, toBytes(face.data).buffer).load();
          document.fonts.add(loaded);
        }
        const out = [];
        for (const request of requests) {
          const canvas = document.createElement('canvas');
          canvas.width = request.width;
          canvas.height = request.height;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = '#000';
          ctx.textBaseline = 'alphabetic';
          ctx.font = `${metrics.fontPx * request.scale}px "${request.family}", "${request.fallback}"`;
          ctx.fillText(request.text, metrics.leftPx * request.scale, metrics.baselinePx * request.scale);
          const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
          const alpha = Array.from({ length: canvas.width * canvas.height }, (_, i) => data[i * 4 + 3]);
          out.push(alpha);
        }
        return out;
      },
      { requests, faces, metrics: { leftPx: LEFT_PX, baselinePx: BASELINE_PX, fontPx: FONT_PX } },
    );
  } finally {
    await browser.close();
  }
}

/** The face file backing a family, base64'd for the browser. */
function faceFor(catalog, info) {
  const fileName = catalog.files[info.indexR];
  if (!fileName) return null;
  const path = resolve(FONT_DIR, fileName);
  if (!existsSync(path)) return null;
  return deobfuscate(readFileSync(path)).toString('base64');
}

async function main() {
  const mode = process.argv[2] ?? '';
  const catalog = readCatalog();
  const families = catalog.infos.length;

  const sprites = [];
  for (const variant of VARIANTS) {
    for (const ratio of RATIOS) {
      const path = resolve(IMAGE_DIR, `fonts_thumbnail${variant}${ratio}.png.bin`);
      if (!existsSync(path)) continue;
      sprites.push({ path, name: `fonts_thumbnail${variant}${ratio}`, ...readSprite(path) });
    }
  }
  if (!sprites.length) throw new Error('no fonts_thumbnail*.png.bin found');

  const short = sprites.filter((sprite) => sprite.count < families);
  const stalePng = sprites.filter((sprite) => {
    const size = pngSize(sprite.path.replace(/\.bin$/, ''));
    return !size || size.width !== sprite.width || size.height !== sprite.heightOne * sprite.count;
  });
  console.log(`catalog: ${families} families; sprites: ${sprites.map((s) => s.count).join(', ')}`);

  if (mode === '--calibrate') {
    const sprite = sprites[0];
    for (const index of [0, 7, sprite.count - 1]) {
      const box = inkBox(decodeTile(sprite, index), sprite.width, sprite.heightOne);
      console.log(`vendor tile ${index} (${catalog.infos[index]?.name}):`, box);
    }
    return;
  }

  if (mode === '--check') {
    for (const sprite of short) {
      console.error(`${sprite.name}: ${sprite.count} tiles for ${families} families`);
    }
    for (const sprite of stalePng) {
      console.error(`${sprite.name}.png does not match its mask`);
    }
    if (!short.length && !stalePng.length) {
      console.log('every sprite already covers the catalog, and every png matches its mask');
      return;
    }
    console.error('\nRun `node bin/font-thumbnails.mjs` after changing the catalog.');
    process.exit(1);
  }
  if (!short.length && !stalePng.length) {
    console.log('every sprite already covers the catalog, and every png matches its mask');
    return;
  }

  // One browser for every missing tile of every sprite.
  const faces = [];
  const familyId = new Map();
  const requests = [];
  const plan = [];
  const fallbackInfo = catalog.infos.find((info) => info.name === 'Noto Sans') ?? catalog.infos[0];
  const fallbackData = faceFor(catalog, fallbackInfo);
  if (fallbackData) faces.push({ family: 'oo-fallback', data: fallbackData });

  for (const sprite of short) {
    for (let index = sprite.count; index < families; index++) {
      const info = catalog.infos[index];
      if (!familyId.has(info.name)) {
        const data = faceFor(catalog, info);
        const id = `oo-${familyId.size}`;
        familyId.set(info.name, data ? id : 'oo-fallback');
        if (data) faces.push({ family: id, data });
      }
      requests.push({
        text: info.name,
        family: familyId.get(info.name),
        fallback: 'oo-fallback',
        width: sprite.width,
        height: sprite.heightOne,
        scale: sprite.width / 300,
      });
      plan.push(sprite);
    }
  }

  console.log(`rendering ${requests.length} tiles across ${short.length} sprites...`);
  const rendered = await renderTiles(requests, faces);

  const appended = new Map();
  rendered.forEach((alpha, i) => {
    const sprite = plan[i];
    const chunks = appended.get(sprite.path) ?? [];
    chunks.push(encodeTile(Uint8Array.from(alpha)));
    appended.set(sprite.path, chunks);
  });

  for (const sprite of short) {
    const chunks = appended.get(sprite.path) ?? [];
    const header = Buffer.alloc(12);
    header.writeUInt32BE(sprite.width, 0);
    header.writeUInt32BE(sprite.heightOne, 4);
    header.writeUInt32BE(families, 8);
    writeFileSync(sprite.path, Buffer.concat([header, sprite.payload, ...chunks]));
    console.log(`${sprite.name}: ${sprite.count} -> ${families} tiles (+${chunks.length})`);
  }

  // The PNG twin is rebuilt from the mask rather than appended to, so the two
  // cannot disagree about anything -- not the tile count, not a pixel.
  for (const sprite of new Set([...short, ...stalePng])) {
    const grown = readSprite(sprite.path);
    const png = sprite.path.replace(/\.bin$/, '');
    writeFileSync(png, encodeAlphaPng(decodeSheet(grown), grown.width, grown.heightOne * grown.count));
    console.log(`${sprite.name}.png rebuilt from its mask (${grown.count} tiles)`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
