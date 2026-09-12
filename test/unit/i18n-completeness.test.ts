import { describe, expect, it } from 'vitest';
import { de } from '../../packages/shared/src/i18n/messages/de';
import { en } from '../../packages/shared/src/i18n/messages/en';
import { es } from '../../packages/shared/src/i18n/messages/es';
import { ja } from '../../packages/shared/src/i18n/messages/ja';
import { ko } from '../../packages/shared/src/i18n/messages/ko';
import { pt } from '../../packages/shared/src/i18n/messages/pt';
import { zhCN } from '../../packages/shared/src/i18n/messages/zh-CN';
import { LanguageCode, SHELL_LOCALES } from '@ranuts/shared/i18n';

/**
 * Every language this site claims to ship says everything.
 *
 * The compiler only enforces that for en and zh-CN: they are typed
 * `I18nMessages`, the other five are `Partial<I18nMessages>` so that staying
 * complete is a choice rather than something a half-finished translation
 * cannot compile against. The cost of that choice is that a missing key is
 * silent -- `t()` falls back to English, which reads like a translation
 * somebody chose rather than one nobody wrote.
 *
 * CLAUDE.md and the README both say all seven tables are complete. This is
 * what makes that true rather than aspirational, and it is the check a new UI
 * string has to pass: add it to en, and this fails until the other six have it.
 *
 * Imported from source rather than from the built package: the tables are
 * internal, and the point is to compare them against each other.
 */
// Keyed by the internal language code, which is what SHELL_LOCALES holds --
// `zh` there, `zh-CN` as a file name and as the tag the vendor wants.
const asTable = (table: object): Record<string, unknown> => table as Record<string, unknown>;

const TABLES: Record<string, Record<string, unknown>> = {
  [LanguageCode.EN]: asTable(en),
  [LanguageCode.ZH]: asTable(zhCN),
  [LanguageCode.JA]: asTable(ja),
  [LanguageCode.KO]: asTable(ko),
  [LanguageCode.DE]: asTable(de),
  [LanguageCode.ES]: asTable(es),
  [LanguageCode.PT]: asTable(pt),
};

describe('message tables', () => {
  it('covers every language the shell offers (and nothing it does not)', () => {
    expect(Object.keys(TABLES).sort()).toEqual([...SHELL_LOCALES].sort());
  });

  it('gives every language every string en has', () => {
    const reference = Object.keys(en).sort();
    expect(reference.length).toBeGreaterThan(50);
    for (const [locale, table] of Object.entries(TABLES)) {
      const missing = reference.filter((key) => !(key in table));
      expect(missing, `${locale} is missing ${missing.length} string(s)`).toEqual([]);
    }
  });

  it('has no string a language invented on its own', () => {
    // An extra key is a typo that will never be read -- `t()` looks up by the
    // name en uses.
    const reference = new Set(Object.keys(en));
    for (const [locale, table] of Object.entries(TABLES)) {
      const extra = Object.keys(table).filter((key) => !reference.has(key));
      expect(extra, `${locale} has ${extra.length} string(s) en does not`).toEqual([]);
    }
  });

  it('leaves no string empty', () => {
    for (const [locale, table] of Object.entries(TABLES)) {
      const blank = Object.entries(table)
        .filter(([, value]) => typeof value === 'string' && value.trim() === '')
        .map(([key]) => key);
      expect(blank, `${locale} has blank string(s)`).toEqual([]);
    }
  });
});
