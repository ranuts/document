import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LOCALES } from '../../bin/build-pages.mjs';
import { fill } from '../../bin/locale-fill.mjs';

/**
 * The vendor's translation files, for the languages this site claims to ship.
 *
 * They are not complete against en.json -- every one of the 44 is short, some
 * by thousands of keys. That is usually cosmetic, but a string that exists only
 * in the locale file leaves the property `undefined` when its translation is
 * missing, and the tooltip setter does `hint[0]` without checking. The editor
 * catches the TypeError as a document error and shows "an error occurred while
 * working with the document" on a blank page. Korean did exactly this.
 *
 * bin/locale-fill.mjs backfills the gaps from en.json. This is the check that
 * it has been run: after a vendor upgrade it will not have been.
 */
const ROOT = resolve(__dirname, '../..');
const APPS = resolve(ROOT, 'public/web-apps/apps');
const VENDOR_LOCALE: Record<string, string> = { 'zh-CN': 'zh' };

const localeDirs = () =>
  readdirSync(APPS)
    .map((app) => resolve(APPS, app, 'main/locale'))
    .filter((dir) => existsSync(resolve(dir, 'en.json')));

describe('vendor editor locales', () => {
  it('finds the vendor locale trees (sanity)', () => {
    expect(localeDirs().length).toBeGreaterThanOrEqual(3);
  });

  it('covers every key en.json has, for every language the site ships', () => {
    // fill({ check: true }) reports the gaps without writing.
    expect(fill({ check: true })).toEqual([]);
  });

  /**
   * The specific string that took Korean down, kept as a named example so the
   * next person meets the failure mode rather than only the rule.
   */
  it('has the status-bar tooltip Korean was missing', () => {
    const ko = JSON.parse(readFileSync(resolve(APPS, 'documenteditor/main/locale/ko.json'), 'utf8')) as Record<
      string,
      string
    >;
    expect(ko['DE.Views.Statusbar.tipMultiplePages']).toBeTruthy();
  });

  it('maps each site locale to a vendor file that exists', () => {
    const dir = resolve(APPS, 'documenteditor/main/locale');
    for (const locale of Object.keys(LOCALES)) {
      const code = VENDOR_LOCALE[locale] ?? locale;
      expect(existsSync(resolve(dir, `${code}.json`)), `${locale} -> ${code}.json`).toBe(true);
    }
  });
});
