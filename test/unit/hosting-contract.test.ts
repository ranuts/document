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
    const deployCoupled = [
      '/sw.js',
      '/sw-register.js',
      '/home.css',
      '/landing.css',
      '/lang-switch.js',
      // Stable-named landing scripts: content changes with the deploy, so the
      // one combination caching cannot get right (see /ran-tokens above).
      '/open-local.js',
      '/landing-prefetch.js',
      '/ranui-iife/*',
    ];
    for (const p of deployCoupled) {
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

/**
 * Docker twin of the same contract. static-web-server never reads `_headers`,
 * and its extension-based defaults are actively wrong for this app: HTML for a
 * day and every stable-named .js/.css for a year, both without revalidation.
 * A self-hoster who pulled a new image therefore kept serving the previous
 * editor.html -- and with it the previous hashed bundle -- so a shipped fix
 * was simply not there (GitHub #144, "re-pulled the image, same error").
 */
describe('sws.toml (self-hosted Docker)', () => {
  /** Parse the `[[advanced.headers]]` blocks into { source, headers }. */
  const rules = read('sws.toml')
    .split(/^\[\[advanced\.headers\]\]$/m)
    .slice(1)
    .map((block) => {
      const source = /source\s*=\s*"([^"]+)"/.exec(block)?.[1] ?? '';
      const headers: Record<string, string> = {};
      for (const line of block.split('\n')) {
        const match = /^([A-Za-z-]+)\s*=\s*"([^"]*)"$/.exec(line.trim());
        if (match && match[1] !== 'source') headers[match[1].toLowerCase()] = match[2];
      }
      return { source, headers };
    });
  const cc = (source: string) => rules.find((rule) => rule.source === source)?.headers['cache-control'];

  it('defaults every path to revalidation, so a new image is actually served', () => {
    expect(rules[0]?.source).toBe('**');
    expect(cc('**')).toBe('no-cache');
  });

  it('pins the same immutable set as _headers (hashed assets, font catalog, x2t wasm)', () => {
    for (const source of ['/assets/**', '/fonts/*', '/sdkjs/common/wasm/x2t/x2t.wasm.gz', '/ran-tokens.*.css']) {
      expect(cc(source), source).toMatch(/max-age=31536000.*immutable/);
    }
  });

  it('never makes the patched vendor trees immutable', () => {
    for (const rule of rules) {
      if (/^\/(sdkjs|web-apps)\/\*\*$/.test(rule.source)) {
        expect(rule.headers['cache-control'] ?? '', rule.source).not.toMatch(/immutable|max-age=[1-9]/);
      }
    }
  });

  it('is wired into the image (a config the server never loads pins nothing)', () => {
    const dockerfile = read('Dockerfile');
    expect(dockerfile).toMatch(/COPY sws\.toml \/sws\.toml/);
    expect(dockerfile).toMatch(/ENV SERVER_CONFIG_FILE=\/sws\.toml/);
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
