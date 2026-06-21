/**
 * Tests for the fetch routing rules in public/sw.js.
 *
 * sw.js is a non-module service worker file that can't be imported directly,
 * so we replicate the routing conditions here as a living specification.
 * If sw.js changes, update both files together.
 *
 * The rules guard against two classes of bug found in this project:
 *   - Font files intercepted by SW → added latency → Chrome "Slow Network"
 *     intervention → OnlyOffice v7.5 fallback font crash (units_per_EM)
 *   - Document URLs cached by SW → stale content served to editor
 */

import { describe, expect, it } from 'vitest';

const FONT_REGEX = /\.(ttf|woff2?|otf|eot)(\?.*)?$/;

const ORIGIN = 'http://localhost:5173';

function swShouldHandle(method: string, urlStr: string): boolean {
  if (method !== 'GET') return false;
  const url = new URL(urlStr);
  if (url.origin !== ORIGIN) return false;
  if (url.searchParams.has('file') || url.searchParams.has('src')) return false;
  if (FONT_REGEX.test(url.pathname)) return false;
  return true;
}

describe('SW fetch routing', () => {
  describe('non-GET requests are not handled', () => {
    it.each(['POST', 'PUT', 'DELETE', 'PATCH'])('%s', (method) => {
      expect(swShouldHandle(method, `${ORIGIN}/index.html`)).toBe(false);
    });
  });

  describe('cross-origin requests are not handled', () => {
    it('skips external document URL', () => {
      expect(swShouldHandle('GET', 'https://example.com/doc.docx')).toBe(false);
    });

    it('skips CDN asset', () => {
      expect(swShouldHandle('GET', 'https://cdn.example.com/font.ttf')).toBe(false);
    });
  });

  describe('document query params bypass the SW cache', () => {
    it('skips ?src= URLs', () => {
      expect(swShouldHandle('GET', `${ORIGIN}/?src=https://example.com/doc.docx`)).toBe(false);
    });

    it('skips ?file= URLs', () => {
      expect(swShouldHandle('GET', `${ORIGIN}/?file=report.xlsx`)).toBe(false);
    });

    it('skips URL with both src and other params', () => {
      expect(swShouldHandle('GET', `${ORIGIN}/?src=doc.docx&readonly=true`)).toBe(false);
    });
  });

  describe('font files are not intercepted (crash prevention)', () => {
    // Intercepting font files adds SW latency which triggers Chrome's
    // "Slow Network" font-loading intervention. OnlyOffice v7.5 then
    // crashes with "Cannot read properties of undefined (reading 'units_per_EM')"
    // in the fallback font code path of slide/word/cell sdk-all.js.
    it.each([
      ['/web-apps/apps/common/main/resources/font/ASC.ttf', '.ttf (OnlyOffice internal font)'],
      ['/fonts/NotoSansTC-VF.ttf', '.ttf (CJK fallback font)'],
      ['/fonts/LiberationSans-Bold.woff2', '.woff2'],
      ['/fonts/arial.woff', '.woff'],
      ['/fonts/symbol.otf', '.otf'],
      ['/fonts/legacy.eot', '.eot'],
      ['/fonts/font.ttf?v=123', '.ttf with query string'],
    ])('%s (%s)', (pathname) => {
      expect(swShouldHandle('GET', `${ORIGIN}${pathname}`)).toBe(false);
    });
  });

  describe('font regex matches extensions correctly', () => {
    it.each(['.ttf', '.woff', '.woff2', '.otf', '.eot'])('matches %s', (ext) => {
      expect(FONT_REGEX.test(`/fonts/file${ext}`)).toBe(true);
    });

    it('does not match .ttfx', () => {
      expect(FONT_REGEX.test('/fonts/file.ttfx')).toBe(false);
    });

    it('does not match .js or .css', () => {
      expect(FONT_REGEX.test('/sdk-all.js')).toBe(false);
      expect(FONT_REGEX.test('/styles.css')).toBe(false);
    });

    it('matches font extensions embedded in longer paths', () => {
      expect(FONT_REGEX.test('/web-apps/apps/common/main/resources/font/ASC.ttf')).toBe(true);
    });
  });

  describe('same-origin static assets are handled', () => {
    it.each([
      `${ORIGIN}/index.html`,
      `${ORIGIN}/`,
      `${ORIGIN}/web-apps/apps/api/documents/api.js`,
      `${ORIGIN}/public/sdkjs/slide/sdk-all.js`,
      `${ORIGIN}/styles/base.css`,
      `${ORIGIN}/manifest.json`,
      `${ORIGIN}/img/64.png`,
    ])('%s', (url) => {
      expect(swShouldHandle('GET', url)).toBe(true);
    });
  });
});
