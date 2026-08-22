import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { decode, encode, buildRecord } from '../../bin/lib/selection-bin.mjs';
import { readNames, xorPrefix } from '../../bin/lib/sfnt.mjs';

/**
 * `g_fonts_selection_bin` is the index the vendor's font matcher scores family
 * names against. It has no published format, which is why it was written off
 * as unmodifiable ("clearing it turns every character into tofu" -- true, and
 * beside the point). Two properties make writing to it safe, and this file is
 * where they are checked:
 *
 *   1. decode -> encode reproduces the shipped blob byte for byte, so nothing
 *      about the layout is guessed;
 *   2. a record rebuilt from a font file's own OS/2 + head + post tables is
 *      identical to the record the vendor's generator wrote for that same
 *      file, for every catalog face that maps to exactly one record.
 *
 * (2) is what licenses appending records for faces we add. A family with no
 * record cannot be found by name, and a family that cannot be found by name
 * gets shaped against whatever the matcher likes instead -- the same shifted
 * glyphs the slot-level mistake produced.
 */
const ROOT = resolve(__dirname, '../..');
const CATALOG_DIR = resolve(ROOT, 'public/fonts');
const source = readFileSync(resolve(ROOT, 'public/sdkjs/common/AllFonts.js'), 'utf8');

const base64 = (() => {
  const marker = 'window["g_fonts_selection_bin"] = "';
  const start = source.indexOf(marker) + marker.length;
  return source.slice(start, source.indexOf('"', start));
})();

describe('font selection index', () => {
  it('round-trips the shipped blob byte for byte', () => {
    const parsed = decode(base64);
    expect(parsed.records.length).toBeGreaterThan(200);
    expect(parsed.tail.length).toBe(0);
    expect(encode(parsed)).toBe(base64);
  });

  it('rebuilds a face record exactly as the vendor generator wrote it', () => {
    const records = decode(base64).records;
    let compared = 0;
    const differences: string[] = [];
    for (const slot of readdirSync(CATALOG_DIR)) {
      const face = xorPrefix(readFileSync(resolve(CATALOG_DIR, slot)));
      const built = buildRecord(face, { path: 'unused' });
      const candidates = records.filter(
        (r) => r.name === built.name && r.bold === built.bold && r.italic === built.italic,
      );
      // Several faces share a (name, bold, italic) triple -- condensed widths,
      // the Nanum family -- and there is no way to tell which record belongs
      // to which file. Compare only the ones that map one to one.
      if (candidates.length !== 1) continue;
      compared++;
      const shipped = candidates[0]!;
      for (const key of [
        'panose',
        'unicodeRange',
        'codePageRange',
        'weight',
        'width',
        'familyClass',
        'format',
        'avgCharWidth',
        'ascent',
        'descent',
        'lineGap',
        'xHeight',
        'capHeight',
        'type',
        'fixed',
      ] as const) {
        const a = JSON.stringify(shipped[key]);
        const b = JSON.stringify(built[key]);
        if (a !== b) differences.push(`${slot} ${built.name} ${key}: shipped=${a} rebuilt=${b}`);
      }
    }
    expect(compared).toBeGreaterThan(100);
    expect(differences, differences.slice(0, 10).join('\n')).toEqual([]);
  });

  it('carries a record for every family the fallback table routes to', () => {
    const registry = (key: string) => {
      const marker = `window["${key}"] = [`;
      const start = source.indexOf(marker) + marker.length;
      return source.slice(start, source.indexOf('];', start));
    };
    const infos: [string, ...number[]][] = JSON.parse(`[${registry('__fonts_infos').replace(/\n/g, '')}]`);
    const ranges: number[] = JSON.parse(`[${registry('__fonts_ranges')}]`);
    const known = new Set(decode(base64).records.map((r) => r.name));
    const routed = new Set<string>();
    for (let i = 2; i < ranges.length; i += 3) {
      const family = infos[ranges[i]!]?.[0];
      if (family) routed.add(family as string);
    }
    expect([...routed].filter((family) => !known.has(family))).toEqual([]);
  });

  it('describes the faces it indexes, not the files they were cut from', () => {
    // Sanity on the added CJK faces: the records must carry the family name
    // the catalog rows use, not the source file name.
    const records = decode(base64).records;
    for (const family of ['Noto Sans SC', 'Noto Serif SC']) {
      const own = records.filter((r) => r.name === family);
      expect(own.length, `${family} has no record`).toBeGreaterThan(0);
      // The subsets keep the source font's own metrics, so the record has to
      // agree with the file the catalog actually serves.
      const slot = readdirSync(CATALOG_DIR).find(
        (s) => readNames(xorPrefix(readFileSync(resolve(CATALOG_DIR, s))))[1] === family,
      );
      expect(slot, `${family} is not in public/fonts/`).toBeTruthy();
    }
  });
});
