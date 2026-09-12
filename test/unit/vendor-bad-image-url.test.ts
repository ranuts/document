import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { OFFLINE_BAD_IMAGE_URL } from '../../lib/onlyoffice/guards/bad-image-url';

/**
 * The one string the offline patch hardcodes in Chinese.
 *
 * `errorBadImageUrl` is a normal vendor locale key, translated in all 45 locale
 * files, and the editor shows it when an inserted image URL fails
 * (`Asc.c_oAscError.ID.UplImageUrl`). The offline build overwrites it on the
 * controller instance inside `loadDocument`, so every user of this site sees
 * Chinese there regardless of the language they chose.
 *
 * Guard 13 (`lib/onlyoffice/guards/bad-image-url.ts`) swallows that one
 * assignment by matching the literal. Matching a literal only works while the
 * literal is what we think it is -- this is the check that it still is, and
 * that the translated original the guard falls back to is still there. A vendor
 * upgrade that reworded, translated or dropped the override turns this red, and
 * the guard should then be re-examined rather than blindly re-pinned.
 */
const ROOT = resolve(__dirname, '../..');
const APPS = resolve(ROOT, 'public/web-apps/apps');

/** Namespaces whose offline patch carries the override. pdfeditor does not. */
const OVERRIDING_APPS = {
  documenteditor: 'DE',
  spreadsheeteditor: 'SSE',
  presentationeditor: 'PE',
} as const;

const appSources = (app: string) =>
  ['main/app.js', 'main/ie/app.js'].map((rel) => resolve(APPS, app, rel)).filter((path) => existsSync(path));

describe('vendor offline patch: errorBadImageUrl', () => {
  it('still assigns exactly the literal the guard matches', () => {
    const seen: string[] = [];
    for (const app of Object.keys(OVERRIDING_APPS)) {
      for (const path of appSources(app)) {
        const source = readFileSync(path, 'utf8');
        const match = /errorBadImageUrl\s*=\s*"([^"]*)"/.exec(source);
        expect(match, `${app} ${path} assigns errorBadImageUrl`).not.toBeNull();
        seen.push(match![1]);
      }
    }
    expect(seen.length).toBeGreaterThanOrEqual(3);
    for (const value of seen) expect(value).toBe(OFFLINE_BAD_IMAGE_URL);
  });

  it('leaves the translated original on the prototype for the guard to fall back to', () => {
    for (const [app, ns] of Object.entries(OVERRIDING_APPS)) {
      const localeDir = resolve(APPS, app, 'main/locale');
      const files = readdirSync(localeDir).filter((name) => name.endsWith('.json'));
      expect(files.length, `${app} has locale files`).toBeGreaterThan(10);

      const key = `${ns}.Controllers.Main.errorBadImageUrl`;
      const english = JSON.parse(readFileSync(resolve(localeDir, 'en.json'), 'utf8')) as Record<string, string>;
      expect(english[key], `${app} en.json carries ${key}`).toBe('Image URL is incorrect');

      // Every language the site ships must have its own, or the guard would
      // hand the user an English string where a translation exists upstream.
      for (const locale of ['zh', 'ja', 'ko', 'de', 'es', 'pt']) {
        const path = resolve(localeDir, `${locale}.json`);
        if (!existsSync(path)) continue;
        const strings = JSON.parse(readFileSync(path, 'utf8')) as Record<string, string>;
        expect(strings[key], `${app} ${locale}.json carries ${key}`).toBeTruthy();
        expect(strings[key]).not.toBe(OFFLINE_BAD_IMAGE_URL);
      }
    }
  });
});
