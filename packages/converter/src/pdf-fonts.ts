import { BASE_PATH } from '@ranuts/shared/document-utils';
import type { EmscriptenModule } from '@ranuts/shared/document-types';

/**
 * The fonts an exported PDF needs, and where they come from.
 *
 * Without them x2t writes a PDF whose text is invisible. They are read from
 * the indexed catalog (public/fonts/{index}) -- the same files the editor
 * loads, so they are usually already in the HTTP cache -- and de-obfuscated
 * before being written under the alias names x2t matches against.
 *
 * The slot numbers here are one of three places in the repository that hard-code
 * them (the others are public/landing-prefetch.js and
 * test/e2e/landing-prefetch.spec.ts). Changing the catalog means changing all
 * three; test/unit/font-catalog-licensing.test.ts checks this one against what
 * is actually on disk.
 */

/** Same 16-byte key bin/font-catalog.mjs and the vendor's fetchFonts use. */
const CATALOG_FONT_XOR_KEY = [160, 102, 214, 32, 20, 150, 71, 250, 149, 105, 184, 80, 176, 65, 73, 72];

/**
 * PDF-export font manifest: catalog file index -> alias file names x2t
 * matches against inside m_sFontDir. One decoded byte set is written once
 * per alias. Indexes come from __fonts_infos in public/sdkjs/common/
 * AllFonts.js (file position, then __fonts_files lookup). Keep Arial and
 * other western families on their own files -- aliasing them to the CJK
 * fallback garbles latin text and digits. The CJK alias entries carry the
 * literal zh font names documents reference; they are data, not UI copy.
 */
export const PDF_FONT_MANIFEST: ReadonlyArray<{ file: string; aliases: string[] }> = [
  // The aliases are the names x2t looks for; the slot behind each one is an
  // open-licensed face after bin/font-license-sweep.mjs (the proprietary
  // originals are no longer in the catalog). Liberation and Carlito are
  // metric-compatible with the names they answer to, so an exported PDF
  // keeps the same line and page breaks.
  { file: '062', aliases: ['Arial.ttf', 'LiberationSans-Regular.ttf'] },
  { file: '059', aliases: ['Arial_Bold.ttf'] },
  { file: '061', aliases: ['Arial_Italic.ttf'] },
  { file: '060', aliases: ['Arial_Bold_Italic.ttf'] },
  { file: '112', aliases: ['Calibri.ttf', 'Carlito.ttf'] },
  { file: '109', aliases: ['Calibri_Bold.ttf', 'Carlito_Bold.ttf'] },
  { file: '111', aliases: ['Calibri_Italic.ttf', 'Carlito_Italic.ttf'] },
  { file: '110', aliases: ['Calibri_Bold_Italic.ttf', 'Carlito_Bold_Italic.ttf'] },
  { file: '070', aliases: ['Times_New_Roman.ttf', 'Times New Roman.ttf'] },
  { file: '067', aliases: ['Times_New_Roman_Bold.ttf'] },
  { file: '069', aliases: ['Times_New_Roman_Italic.ttf'] },
  { file: '068', aliases: ['Times_New_Roman_Bold_Italic.ttf'] },
  { file: '058', aliases: ['Courier_New.ttf', 'Courier New.ttf'] },
  // Names the previous implementation fetched directly (kept for the same
  // default-latin coverage).
  { file: '117', aliases: ['DejaVuSans.ttf'] },
  { file: '050', aliases: ['DejaVuSans-Bold.ttf'] },
  // CJK. Serif answers to the Song/Ming names a document's body text uses,
  // sans to the Hei/YaHei names; PingFang maps to the sans as the closest
  // match. Both are TrueType on purpose: x2t embeds no glyphs at all for
  // CFF-flavoured faces, so a pan-CJK OTF here exports a PDF whose Chinese
  // is blank while its Latin survives (measured both ways round).
  { file: '269', aliases: ['SimSun.ttf', 'NSimSun.ttf', '宋体.ttf', 'NotoSerifSC-Regular.ttf'] },
  { file: '270', aliases: ['SimSun_Bold.ttf'] },
  {
    file: '267',
    aliases: [
      'Microsoft YaHei.ttf',
      '微软雅黑.ttf',
      'PingFang SC.ttf',
      'SimHei.ttf',
      '黑体.ttf',
      'DroidSansFallback.ttf',
      'Droid Sans Fallback.ttf',
      'NotoSansSC-Regular.ttf',
    ],
  },
  { file: '268', aliases: ['Microsoft YaHei_Bold.ttf', 'SimHei_Bold.ttf'] },
];

/** Undo the catalog XOR obfuscation, returning a plain TTF byte copy. */
export function decodeCatalogFont(bytes: Uint8Array): Uint8Array {
  const out = new Uint8Array(bytes);
  const n = Math.min(32, out.length);
  for (let i = 0; i < n; i++) {
    out[i] ^= CATALOG_FONT_XOR_KEY[i % CATALOG_FONT_XOR_KEY.length]!;
  }
  return out;
}

/**
 * Write every manifest face into the module's FS, once per session. A face
 * that cannot be fetched is skipped rather than failing the export: the PDF
 * still renders with the ones that arrived.
 */
export async function loadFontsForPdf(module: EmscriptenModule): Promise<void> {
  await Promise.all(
    PDF_FONT_MANIFEST.map(async ({ file, aliases }) => {
      try {
        const res = await fetch(`${BASE_PATH}fonts/${file}`);
        if (!res.ok) return;
        const bytes = decodeCatalogFont(new Uint8Array(await res.arrayBuffer()));
        for (const alias of aliases) {
          module.FS.writeFile(`/working/fonts/${alias}`, bytes);
        }
      } catch {
        // Non-fatal -- the PDF may still render with the remaining fonts.
      }
    }),
  );
}
