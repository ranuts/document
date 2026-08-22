import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { X2TConverter } from '@ranuts/converter';

/**
 * The font catalog is redistributed from a public repository and a public
 * origin, so every face in it has to be one we are allowed to redistribute.
 * The vendor bundle arrived with the font set an OnlyOffice Docs *server*
 * would have picked up from its host -- Microsoft's core web fonts,
 * Monotype's Arial/Times/Courier, and ~150 MB of Chinese faces owned by
 * SinoType, Founder and ZhongYi. bin/font-license-sweep.mjs replaced them;
 * this keeps them from coming back with the next vendor bump.
 *
 * It also pins the rendering half of that sweep. Fallback used to be stitched
 * per block -- ideographs from Droid Sans Fallback, the fullwidth comma from
 * SimSun, the ideographic full stop from Microsoft YaHei -- so one line of
 * Chinese came out in three typefaces. And Calibri alone was covering Arabic,
 * Armenian, Georgian and Hebrew, which is why swapping it for Carlito (which
 * has none of them) had to be paired with an explicit route per script.
 */
const ROOT = resolve(__dirname, '../..');
const CATALOG_DIR = resolve(ROOT, 'public/fonts');
const XOR_KEY = [160, 102, 214, 32, 20, 150, 71, 250, 149, 105, 184, 80, 176, 65, 73, 72];

/** Undo the catalog's XOR-obfuscated 32-byte prefix (see docs/fonts.md). */
function decode(buf: Buffer): Buffer {
  const out = Buffer.from(buf);
  for (let i = 0; i < Math.min(32, out.length); i++) out[i] ^= XOR_KEY[i % XOR_KEY.length]!;
  return out;
}

/** Read the sfnt name table as nameID -> string. */
function readNames(buf: Buffer): Record<number, string> {
  let off = 0;
  if (buf.readUInt32BE(0) === 0x74746366) off = buf.readUInt32BE(12); // ttcf
  const numTables = buf.readUInt16BE(off + 4);
  let nameOff: number | null = null;
  for (let i = 0; i < numTables; i++) {
    const p = off + 12 + i * 16;
    if (buf.toString('latin1', p, p + 4) === 'name') nameOff = buf.readUInt32BE(p + 8);
  }
  if (nameOff === null) return {};
  const count = buf.readUInt16BE(nameOff + 2);
  const strOff = nameOff + buf.readUInt16BE(nameOff + 4);
  const out: Record<number, string> = {};
  for (let i = 0; i < count; i++) {
    const r = nameOff + 6 + i * 12;
    const platformId = buf.readUInt16BE(r);
    const nameId = buf.readUInt16BE(r + 6);
    const len = buf.readUInt16BE(r + 8);
    const o = buf.readUInt16BE(r + 10);
    try {
      const raw = buf.subarray(strOff + o, strOff + o + len);
      const s = platformId === 1 ? raw.toString('latin1') : Buffer.from(raw).swap16().toString('utf16le');
      if (out[nameId] === undefined || platformId === 3) out[nameId] = s;
    } catch {
      // A malformed record is not a reason to misjudge the whole file.
    }
  }
  return out;
}

const OPEN_LICENSE =
  /scripts\.sil\.org\/ofl|open font license|ofl 1\.1|apache licen|gnu general public|\bgpl\b|gnu©|ubuntu font licen|public domain|bitstream|arphic|ipafont|nhncorp|navercorp|free software|liberation fonts license|allowed to distribute/i;
const OPEN_FAMILY =
  /^(AR PL|Takao|Nanum|나눔|Droid|Lohit|Noto|OpenSymbol|ASCW|Symbola|DejaVu|Liberation|Carlito|Caladea|Open Sans|Free(Mono|Sans|Serif)|Kacst|mry_Kacst|Samyak|Rekha|padmaa|padmmaa|Pothana|Vemana|Jamrul|Likhan|Abyssinica|Asana|Ubuntu|Mitra|Ani|Khmer OS|Tibetan Machine|Padauk|WenQuanYi)/i;

const slots = readdirSync(CATALOG_DIR).filter((f) => statSync(resolve(CATALOG_DIR, f)).isFile());

const source = readFileSync(resolve(ROOT, 'public/sdkjs/common/AllFonts.js'), 'utf8');
function registry(key: string): string {
  const marker = `window["${key}"] = [`;
  const start = source.indexOf(marker) + marker.length;
  return source.slice(start, source.indexOf('];', start));
}
const files: string[] = JSON.parse(`[${registry('__fonts_files')}]`);
const infos: [string, ...number[]][] = JSON.parse(`[${registry('__fonts_infos').replace(/\n/g, '')}]`);
const ranges: number[] = JSON.parse(`[${registry('__fonts_ranges')}]`);

describe('font catalog licensing', () => {
  it('ships no face whose own name table fails to show an open license', () => {
    const offenders: string[] = [];
    for (const slot of slots) {
      const names = readNames(decode(readFileSync(resolve(CATALOG_DIR, slot))));
      const evidence = `${names[0] ?? ''} ${names[13] ?? ''} ${names[14] ?? ''}`;
      if (OPEN_LICENSE.test(evidence)) continue;
      if (OPEN_FAMILY.test(names[1] ?? '')) continue;
      offenders.push(`${slot} (${names[1] ?? 'unnamed'}: ${(names[0] ?? 'no copyright').slice(0, 60)})`);
    }
    expect(offenders, `proprietary faces in public/fonts/:\n${offenders.join('\n')}`).toEqual([]);
  });
});

describe('font catalog integrity', () => {
  it('references only faces that exist on disk', () => {
    const onDisk = new Set(slots);
    const missing = new Set<string>();
    for (const row of infos) {
      for (const idx of [1, 3, 5, 7]) {
        const pos = row[idx] as number;
        if (pos >= 0 && !onDisk.has(files[pos]!)) missing.add(files[pos]!);
      }
    }
    expect([...missing]).toEqual([]);
  });

  it('leaves no unreferenced face on disk', () => {
    const referenced = new Set<string>();
    for (const row of infos) {
      for (const idx of [1, 3, 5, 7]) {
        const pos = row[idx] as number;
        if (pos >= 0) referenced.add(files[pos]!);
      }
    }
    expect(slots.filter((s) => !referenced.has(s))).toEqual([]);
  });

  it('points every fallback range at a real family row', () => {
    const bad = new Set<number>();
    for (let i = 2; i < ranges.length; i += 3) if (!infos[ranges[i]!]) bad.add(ranges[i]!);
    expect([...bad]).toEqual([]);
  });
});

describe('script fallback routing', () => {
  const familyAt = (cp: number): string | null => {
    for (let i = 0; i < ranges.length; i += 3) {
      if (cp >= ranges[i]! && cp <= ranges[i + 1]!) return infos[ranges[i + 2]!]?.[0] ?? null;
    }
    return null;
  };

  /**
   * The whole point of the CJK half: a line of Chinese, Japanese or Korean
   * has to come out of one typeface. Ideographs, kana, hangul, bopomofo and
   * -- the ones that used to be split off -- the ideographic full stop and
   * the fullwidth comma.
   */
  it('answers every CJK block with a single family', () => {
    const probes: [number, string][] = [
      [0x4e00, 'ideograph 一'],
      [0x9fa5, 'ideograph 龥'],
      [0x3400, 'extension A'],
      [0x3002, 'ideographic full stop'],
      [0xff0c, 'fullwidth comma'],
      [0x3042, 'hiragana'],
      [0x30a2, 'katakana'],
      [0xac00, 'hangul'],
      [0x3105, 'bopomofo'],
      [0xf900, 'compatibility ideograph'],
      [0xfe30, 'compatibility form'],
    ];
    const resolved = probes.map(([cp, what]) => [what, familyAt(cp)] as const);
    const families = new Set(resolved.map(([, family]) => family));
    expect(families.size, `split across families: ${JSON.stringify(resolved)}`).toBe(1);
    expect([...families][0]).toBe('Noto Sans CJK SC');
  });

  /**
   * Calibri used to be the only face covering these, so dropping it without
   * a route each would have turned all of them into tofu. Syriac and Thaana
   * had no coverage at all before the sweep.
   */
  it.each([
    { script: 'Arabic', cp: 0x0627, family: 'Noto Naskh Arabic' },
    { script: 'Arabic Supplement', cp: 0x0750, family: 'Noto Naskh Arabic' },
    { script: 'Hebrew', cp: 0x05d0, family: 'Noto Sans Hebrew' },
    { script: 'Armenian', cp: 0x0531, family: 'Noto Sans Armenian' },
    { script: 'Georgian', cp: 0x10a0, family: 'Noto Sans Georgian' },
    { script: 'Syriac', cp: 0x0710, family: 'Noto Sans Syriac' },
    { script: 'Thaana', cp: 0x0780, family: 'Noto Sans Thaana' },
    { script: 'Cyrillic Supplement', cp: 0x0500, family: 'Noto Sans' },
    { script: 'Latin Extended Additional', cp: 0x1e00, family: 'Noto Sans' },
    { script: 'Greek', cp: 0x03b1, family: 'DejaVu Sans' },
  ])('routes $script at $family', ({ cp, script, family }) => {
    expect(familyAt(cp), `U+${cp.toString(16).toUpperCase().padStart(4, '0')} (${script})`).toBe(family);
  });
});

/**
 * PDF export does not go through the catalog registries: packages/converter
 * writes a fixed list of catalog slots into the x2t working directory under
 * the names x2t looks for. That list is hand-maintained, so it silently went
 * stale the moment the sweep removed the proprietary slots it named --
 * SimSun (017) and Microsoft YaHei (016) were still in it, pointing at files
 * that no longer existed, and every CJK glyph in an exported PDF would have
 * come out blank. Nothing caught it, hence this.
 */
describe('PDF export font manifest', () => {
  const manifest = (X2TConverter as unknown as { PDF_FONT_MANIFEST: { file: string; aliases: string[] }[] })
    .PDF_FONT_MANIFEST;

  it('names only catalog slots that exist', () => {
    const onDisk = new Set(slots);
    expect(manifest.filter((entry) => !onDisk.has(entry.file)).map((entry) => entry.file)).toEqual([]);
  });

  it('covers the CJK names a Chinese document actually asks for', () => {
    const aliases = new Set(manifest.flatMap((entry) => entry.aliases));
    for (const name of ['SimSun.ttf', '宋体.ttf', 'Microsoft YaHei.ttf', '微软雅黑.ttf', 'SimHei.ttf', '黑体.ttf']) {
      expect(aliases.has(name), `PDF export has no face for ${name}`).toBe(true);
    }
  });
});
