import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Hosting contract sentinel (Cloudflare Pages). Three of the campaign's
 * production-only defects lived in this layer (a vendor loader stuck behind
 * the index.html -> directory 308, the font catalog shipped without a cache
 * rule, sw.js/HTML that must never be cached). Pin the rules the app relies
 * on so an edit to public/_headers / _redirects / sw.js that drops one turns
 * red here first. The rules themselves are exercised for real by the
 * `e2e-pages` job (wrangler pages dev) and the production smoke.
 */
const ROOT = resolve(__dirname, '../..');
const read = (rel: string) => readFileSync(resolve(ROOT, rel), 'utf8');

/** Parse the simple `_headers` format into { path: { header: value } }. */
function parseHeaders(src: string): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  let current: string | null = null;
  for (const raw of src.split('\n')) {
    const line = raw.replace(/#.*$/, '').trimEnd();
    if (!line.trim()) continue;
    if (!/^\s/.test(line)) {
      current = line.trim();
      out[current] = {};
    } else if (current) {
      const idx = line.indexOf(':');
      out[current][line.slice(0, idx).trim().toLowerCase()] = line.slice(idx + 1).trim();
    }
  }
  return out;
}

describe('public/_headers', () => {
  const rules = parseHeaders(read('public/_headers'));
  const cc = (path: string) => rules[path]?.['cache-control'];

  it('keeps deploy-coupled files uncacheable (a stale one breaks the shell)', () => {
    for (const p of ['/sw.js', '/home.css', '/landing.css', '/lang-switch.js', '/ranui-iife/*']) {
      expect(cc(p), p).toBe('no-cache');
    }
  });

  it('keeps hashed/immutable assets long-lived: build assets, font catalog, x2t wasm', () => {
    for (const p of ['/assets/*', '/fonts/*', '/sdkjs/common/wasm/x2t/x2t.wasm.gz', '/ran-tokens.*.css']) {
      expect(cc(p), p).toMatch(/max-age=31536000.*immutable/);
    }
  });

  it('does not make patched vendor trees immutable (x2t_helper.js and editor HTML must revalidate)', () => {
    for (const p of Object.keys(rules)) {
      if (/^\/(sdkjs|web-apps)\/\*$/.test(p) || p === '/sdkjs/*' || p === '/web-apps/*') {
        expect(cc(p) ?? '').not.toMatch(/immutable/);
      }
    }
    expect(Object.keys(rules).some((p) => p.startsWith('/sdkjs/common/wasm/x2t/x2t_helper'))).toBe(false);
  });

  it('keeps vendor trees and the font catalog out of search indexes, and landing pages in', () => {
    const robots = (path: string) => rules[path]?.['x-robots-tag'];
    for (const p of ['/web-apps/*', '/sdkjs/*', '/fonts/*']) expect(robots(p), p).toMatch(/noindex/);
    for (const p of ['/*', '/open/*', '/zh-CN/*', '/assets/*']) expect(robots(p), p).toBeUndefined();
  });
});

describe('public/_redirects', () => {
  it('canonicalizes the localized landing directory', () => {
    expect(read('public/_redirects')).toMatch(/^\/zh-CN\s+\/zh-CN\/\s+308/m);
  });
});

describe('index.html -> directory normalization awareness', () => {
  it('the app never relies on the vendor common loader for PDFs (it breaks behind the 308)', () => {
    const src = read('lib/onlyoffice-editor.ts');
    expect(src).toMatch(/isForm:\s*false/);
  });
});
