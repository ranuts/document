import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { X2TConverter } from '@ranuts/converter';

import { glyphId, readNames, xorPrefix } from '../../bin/lib/sfnt.mjs';

/**
 * The font catalog is redistributed from a public repository and a public
 * origin, so every face in it has to be one we are allowed to redistribute.
 * The vendor bundle arrived with the font set an OnlyOffice Docs *server*
 * would have picked up from its host -- Microsoft's core web fonts,
 * Monotype's Arial/Times/Courier, and ~150 MB of Chinese faces owned by
 * SinoType, Founder and ZhongYi. bin/font-license-sweep.mjs replaced them;
 * this keeps them from coming back with the next vendor bump.
 *
 * It also pins the two things that made the first attempt at that sweep
 * (PR #170, reverted) render every glyph shifted:
 *
 *   - the name inside a file has to belong to a row that points at it, and
 *   - a family the fallback table routes to has to be one the matcher can
 *     find by name, which means having a record in g_fonts_selection_bin.
 */
const ROOT = resolve(__dirname, '../..');
const CATALOG_DIR = resolve(ROOT, 'public/fonts');

const OPEN_LICENSE =
  /scripts\.sil\.org\/ofl|open font license|ofl 1\.1|apache licen|gnu general public|\bgpl\b|gnu©|ubuntu font licen|public domain|bitstream|arphic|ipafont|nhncorp|navercorp|free software|liberation fonts license|allowed to distribute/i;
const OPEN_FAMILY =
  /^(AR PL|Takao|Nanum|나눔|Droid|Lohit|Noto|OpenSymbol|ASCW|Symbola|DejaVu|Liberation|Carlito|Caladea|Open Sans|Free(Mono|Sans|Serif)|Kacst|mry_Kacst|Samyak|Rekha|padmaa|padmmaa|Pothana|Vemana|Jamrul|Likhan|Abyssinica|Asana|Ubuntu|Mitra|Ani|Khmer OS|Tibetan Machine|Padauk|WenQuanYi)/i;

const slots = readdirSync(CATALOG_DIR).filter((f) => statSync(resolve(CATALOG_DIR, f)).isFile());
const namesOf = (slot: string) => readNames(xorPrefix(readFileSync(resolve(CATALOG_DIR, slot))));

const source = readFileSync(resolve(ROOT, 'public/sdkjs/common/AllFonts.js'), 'utf8');
function registry(key: string): string {
  const marker = `window["${key}"] = [`;
  const start = source.indexOf(marker) + marker.length;
  return source.slice(start, source.indexOf('];', start));
}
const files: string[] = JSON.parse(`[${registry('__fonts_files')}]`);
const infos: [string, ...number[]][] = JSON.parse(`[${registry('__fonts_infos').replace(/\n/g, '')}]`);
const ranges: number[] = JSON.parse(`[${registry('__fonts_ranges')}]`);
const FACE_SLOTS = [1, 3, 5, 7];

describe('font catalog licensing', () => {
  it('ships no face whose own name table fails to show an open license', () => {
    const offenders: string[] = [];
    for (const slot of slots) {
      const names = namesOf(slot);
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
      for (const idx of FACE_SLOTS) {
        const pos = row[idx] as number;
        if (pos >= 0 && !onDisk.has(files[pos]!)) missing.add(files[pos]!);
      }
    }
    expect([...missing]).toEqual([]);
  });

  it('leaves no unreferenced face on disk', () => {
    const referenced = new Set<string>();
    for (const row of infos) {
      for (const idx of FACE_SLOTS) {
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

  /**
   * The rule substitution lives or dies by. The shaper reads the family name
   * off the face it loaded and resolves *that* name through the matcher; if
   * the name belongs to some other entry, the run is shaped against one font
   * and drawn with another and every glyph comes out shifted -- `Hello`
   * rendered as `Ebiil` on the live site for the hour PR #170 was up.
   *
   * The pristine vendor catalog satisfies this for all of its positions, so
   * this is not a rule we invented: it is the one we broke.
   */
  it('never points a row at a face carrying some other family name', () => {
    const owners = new Map<number, string[]>();
    for (const row of infos) {
      for (const idx of FACE_SLOTS) {
        const pos = row[idx] as number;
        if (pos < 0) continue;
        owners.set(pos, [...(owners.get(pos) ?? []), row[0] as string]);
      }
    }
    const broken: string[] = [];
    for (const [pos, rows] of owners) {
      const inside = namesOf(files[pos]!)[1];
      if (!rows.includes(inside!))
        broken.push(`position ${pos} (${files[pos]}) holds "${inside}", pointed at by ${rows.join(', ')}`);
    }
    expect(broken, `faces the engine would shape and rasterise differently:\n${broken.join('\n')}`).toEqual([]);
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
      [0x3105, 'bopomofo'],
      [0xf900, 'compatibility ideograph'],
      [0xfe30, 'compatibility form'],
    ];
    const resolved = probes.map(([cp, what]) => [what, familyAt(cp)] as const);
    const families = new Set(resolved.map(([, family]) => family));
    expect(families.size, `split across families: ${JSON.stringify(resolved)}`).toBe(1);
    expect([...families][0]).toBe('Noto Sans SC');
  });

  /**
   * Korean stays on the catalog's own open Korean face. The CJK subset this
   * sweep adds is cut to the Chinese and Japanese repertoire -- hangul
   * syllables alone are 11k glyphs -- and routing a block at a face that does
   * not carry it renders blanks, not a fallback.
   */
  it('answers hangul with one family that actually has it', () => {
    const jamo = familyAt(0x3131);
    const syllables = familyAt(0xac00);
    expect(syllables).toBe('NanumGothic');
    expect(jamo).toBe(syllables);
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
 * A route is only worth having if the face behind it carries the characters.
 * The picker consults the range table once: when the family it names has no
 * glyph for the codepoint, the character is blank, not re-routed. That is how
 * a CJK subset cut to GB2312 -- which is what the first version of the sweep
 * pointed every ideograph at -- turns traditional Chinese into gaps.
 */
describe('fallback faces carry what they are routed for', () => {
  const faceFor = (cp: number): Buffer | null => {
    for (let i = 0; i < ranges.length; i += 3) {
      if (cp < ranges[i]! || cp > ranges[i + 1]!) continue;
      const row = infos[ranges[i + 2]!];
      if (!row) return null;
      const pos = row[1] as number;
      return xorPrefix(readFileSync(resolve(CATALOG_DIR, files[pos]!)));
    }
    return null;
  };

  it.each([
    { what: 'simplified ideographs', text: '你好世界中文测试' },
    { what: 'traditional ideographs', text: '繁體漢字臺灣國語' },
    { what: 'rare ideographs', text: '龘鱻犇' },
    { what: 'extension A', text: '㐀㐁' },
    { what: 'kana', text: 'こんにちはカタカナ' },
    { what: 'hangul', text: '안녕하세요' },
    { what: 'CJK punctuation and fullwidth', text: '，。、！？（）' },
    { what: 'Cyrillic supplement and Greek', text: 'ԁԃαβγ' },
    { what: 'Hebrew, Arabic, Armenian, Georgian', text: 'שלוםمرحباԲարևგამარჯობა' },
    { what: 'Syriac and Thaana', text: 'ܐܒܓހށނ' },
  ])('renders $what without gaps', ({ text }) => {
    const missing: string[] = [];
    for (const ch of text) {
      const cp = ch.codePointAt(0)!;
      const face = faceFor(cp);
      if (!face || !glyphId(face, cp)) missing.push(`${ch} U+${cp.toString(16).toUpperCase()}`);
    }
    expect(missing, `no glyph behind the fallback route: ${missing.join(', ')}`).toEqual([]);
  });
});

/**
 * PDF export does not go through the catalog registries: packages/converter
 * writes a fixed list of catalog slots into the x2t working directory under
 * the names x2t looks for. That list is hand-maintained, so it silently went
 * stale the moment the sweep removed the proprietary slots it named --
 * SimSun (017) and Microsoft YaHei (016) were still in it, pointing at files
 * that no longer existed, and every CJK glyph in an exported PDF would have
 * come out blank. It then went stale a second time in the other direction:
 * the revert put the proprietary catalog back but left the manifest naming
 * slots 267-270, which did not exist again until this sweep recreated them.
 * Hence both halves of this: the slots exist, and they hold what their
 * aliases claim.
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

  it('backs each alias with a face of the family it stands in for', () => {
    const expected: [RegExp, RegExp][] = [
      [/^Arial/, /^Liberation Sans/],
      [/^Calibri/, /^Carlito/],
      [/^Times_New_Roman/, /^Liberation Serif/],
      [/^Courier_New/, /^Liberation Mono/],
      [/^(SimSun|宋体)/, /^Noto Serif SC/],
      [/^(SimHei|黑体|Microsoft YaHei|微软雅黑)/, /^Noto Sans SC/],
    ];
    for (const entry of manifest) {
      const family = namesOf(entry.file)[1] ?? '';
      for (const alias of entry.aliases) {
        const rule = expected.find(([name]) => name.test(alias));
        if (rule) expect(family, `${alias} -> slot ${entry.file}`).toMatch(rule[1]);
      }
    }
  });
});
