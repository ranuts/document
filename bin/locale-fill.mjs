#!/usr/bin/env node
/**
 * Fill the vendor editor's translation gaps for the languages this site ships.
 *
 * The OnlyOffice locale files are not complete against `en.json` -- every one
 * of the 44 non-English files is missing keys, from a couple to a few thousand.
 * That is normally harmless (a string keeps whatever default the component has)
 * but some strings exist ONLY in the locale file, and then the property is
 * `undefined` rather than English. When one of those reaches a tooltip:
 *
 *     updateHint: function (t) { ... "string" == typeof t ? t : t[0] ... }
 *
 * `undefined[0]` throws, the editor catches it as a document error and shows
 * the modal "An error occurred while working with the document. Use the
 * 'Download as' option to save a backup copy". Korean hit exactly this on a
 * blank document: `DE.Views.Statusbar.tipMultiplePages` is in en.json and not
 * in ko.json, and the status bar asks for it while rendering.
 *
 * So: for the locales the site is translated into, any key en.json has and the
 * locale does not gets the English value. An English tooltip is a cosmetic gap;
 * a modal error dialog on an empty document is not. Everything else is left
 * exactly as the vendor shipped it.
 *
 * Idempotent -- run it again after a vendor upgrade (bin/build.sh does, and
 * test/unit/vendor-locale.test.ts fails if it has not been run).
 *
 *   node bin/locale-fill.mjs           # fill in place
 *   node bin/locale-fill.mjs --check   # exit 1 if any gap remains
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LOCALES } from './build-pages.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const APPS_DIR = resolve(ROOT, 'public/web-apps/apps');

/**
 * Site locale -> vendor locale file. The vendor uses bare language codes with a
 * handful of four-letter exceptions (pt-pt, zh-tw, sr-cyrl); `zh-CN` is served
 * by `zh.json`. Mirrors resolveEditorLocale() in packages/shared/src/i18n.ts,
 * which decides what `lang=` the editor is loaded with.
 */
const VENDOR_LOCALE = { 'zh-CN': 'zh' };
const vendorCodeFor = (locale) => VENDOR_LOCALE[locale] ?? locale;

/** Apps that have a locale directory (documenteditor, pdfeditor, ...). */
function localeDirs() {
  return readdirSync(APPS_DIR)
    .map((app) => resolve(APPS_DIR, app, 'main/locale'))
    .filter((dir) => existsSync(dir) && existsSync(resolve(dir, 'en.json')));
}

/** Keys en.json has that `locale` does not, in en.json's order. */
function gaps(dir, code) {
  const target = resolve(dir, `${code}.json`);
  if (!existsSync(target)) return null;
  const en = JSON.parse(readFileSync(resolve(dir, 'en.json'), 'utf8'));
  const translated = JSON.parse(readFileSync(target, 'utf8'));
  const missing = Object.keys(en).filter((key) => !(key in translated));
  return { target, en, translated, missing };
}

export function fill({ check = false } = {}) {
  const codes = Object.keys(LOCALES).map(vendorCodeFor);
  const report = [];
  for (const dir of localeDirs()) {
    for (const code of codes) {
      if (code === 'en') continue;
      const found = gaps(dir, code);
      if (!found || !found.missing.length) continue;
      report.push({ file: found.target.slice(ROOT.length + 1), count: found.missing.length });
      if (check) continue;
      // Rebuild in en.json's key order so the file stays diffable rather than
      // growing an appendix of filled keys at the bottom.
      const merged = {};
      for (const key of Object.keys(found.en)) merged[key] = found.translated[key] ?? found.en[key];
      for (const [key, value] of Object.entries(found.translated)) if (!(key in merged)) merged[key] = value;
      // Keep the vendor's formatting. These files ship minified on one line;
      // pretty-printing them would add ~25 KB each to a tree that is already
      // 600 MB and is downloaded by every visitor's service worker.
      const pretty = readFileSync(found.target, 'utf8').includes('\n  "');
      writeFileSync(found.target, pretty ? `${JSON.stringify(merged, null, 2)}\n` : JSON.stringify(merged));
    }
  }
  return report;
}

if (process.argv[1] && process.argv[1].endsWith('locale-fill.mjs')) {
  const check = process.argv.includes('--check');
  const report = fill({ check });
  if (!report.length) {
    console.log('[locale-fill] every shipped locale covers en.json');
  } else if (check) {
    for (const { file, count } of report) console.error(`  ${file}: ${count} keys missing`);
    console.error('[locale-fill] vendor locales are short; run node bin/locale-fill.mjs');
    process.exit(1);
  } else {
    for (const { file, count } of report) console.log(`  ${file}: filled ${count} keys from en.json`);
    console.log(`[locale-fill] filled ${report.length} file(s)`);
  }
}
