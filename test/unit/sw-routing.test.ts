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

/** Keep in sync with DEPLOY_COUPLED in public/sw.js and the no-cache group in public/_headers. */
const DEPLOY_COUPLED = /^\/(?:home|landing)\.css$|^\/lang-switch\.js$|^\/ranui-iife\//;

const isHtmlRequest = (mode: string, pathname: string): boolean =>
  mode === 'navigate' || pathname.endsWith('.html') || pathname === '/' || pathname.endsWith('/');

/** Which of the two strategies sw.js picks. */
function strategyFor(pathname: string, mode = 'no-cors'): 'network-first' | 'stale-while-revalidate' {
  return isHtmlRequest(mode, pathname) || DEPLOY_COUPLED.test(pathname) ? 'network-first' : 'stale-while-revalidate';
}

const ORIGIN = 'http://localhost:5173';

function swShouldHandle(method: string, urlStr: string): boolean {
  if (method !== 'GET') return false;
  const url = new URL(urlStr);
  if (url.origin !== ORIGIN) return false;
  if (url.searchParams.has('file') || url.searchParams.has('src')) return false;
  if (FONT_REGEX.test(url.pathname)) return false;
  if (url.pathname.includes('/sdkjs/common/spell/')) return false;
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

  describe('spellchecker engine is not intercepted (cold-profile hang prevention)', () => {
    // The spell engine is importScripts'd from inside a dedicated worker
    // during the editor's first boot; routing it through a just-activated SW
    // hangs forever on a cold profile and leaves every save/export broken.
    it.each(['/sdkjs/common/spell/spell/spell.js', '/sdkjs/common/spell/spell/spell.wasm'])('%s', (pathname) => {
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

/**
 * Deploy-coupled assets keep a stable filename while their content changes with every
 * deploy, so they must never be served stale.
 *
 * The bug this guards against: stale-while-revalidate returns the cached copy first, so a
 * deploy that changes a design token renders with the previous one; and because the
 * background refresh used a plain `fetch`, the browser could answer it from its own HTTP
 * disk cache and write the stale bytes straight back into the SW cache — the old copy then
 * survived deploy after deploy (`200 OK (from disk cache)` long after the tokens changed).
 */
describe('deploy-coupled assets use network-first', () => {
  it('covers the other unhashed, deploy-coupled files', () => {
    for (const path of [
      '/home.css',
      '/landing.css',
      '/lang-switch.js',
      '/ranui-iife/button.iife.js',
      '/ranui-iife/card.iife.js',
    ]) {
      expect(strategyFor(path)).toBe('network-first');
    }
  });

  it('leaves hashed build output on stale-while-revalidate — its filename already busts the cache', () => {
    expect(strategyFor('/assets/index-BX1VO-Oz.css')).toBe('stale-while-revalidate');
    expect(strategyFor('/assets/lib-CF3G5uGZ.js')).toBe('stale-while-revalidate');
  });

  it('treats the fingerprinted token layer as immutable, not deploy-coupled', () => {
    // bin/build.sh renames it to ran-tokens.<hash>.css and rewrites every <link>, so a new
    // build is a new URL. SWR is then both correct and faster than revalidating each load.
    expect(strategyFor('/ran-tokens.a1b2c3d4.css')).toBe('stale-while-revalidate');
  });

  it('still would not serve a bare /ran-tokens.css stale — but the build makes sure none is referenced', () => {
    // Kept as a tripwire: if a page ever ships pointing at the unhashed name again, the build
    // fails first (it greps dist/ and exits non-zero), so this path should never be requested.
    expect(strategyFor('/ran-tokens.css')).toBe('stale-while-revalidate');
  });

  it('leaves the OnlyOffice long tail on stale-while-revalidate', () => {
    // Hundreds of files; revalidating each on every load is exactly what SWR exists to avoid.
    expect(strategyFor('/web-apps/apps/documenteditor/main/index.html')).toBe('network-first'); // .html
    expect(strategyFor('/sdkjs/word/sdk-all.js')).toBe('stale-while-revalidate');
  });

  it('does not match a lookalike path outside the group', () => {
    expect(strategyFor('/vendor/ran-tokens.css')).toBe('stale-while-revalidate');
    expect(strategyFor('/ran-tokens.css.map')).toBe('stale-while-revalidate');
  });

  it('still treats HTML and navigations as network-first', () => {
    expect(strategyFor('/', 'navigate')).toBe('network-first');
    expect(strategyFor('/open/docx')).toBe('stale-while-revalidate'); // extensionless, non-navigate
    expect(strategyFor('/open/docx', 'navigate')).toBe('network-first');
  });
});
