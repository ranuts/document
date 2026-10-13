import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { generate } from '../../bin/build-pages.mjs';

const ROOT = resolve(__dirname, '../..');
const ORIGIN = 'https://edit.chaxus.com';
const IMAGE = `${ORIGIN}/social/document-editor-v1.png`;
const outputs = generate({ outDir: null });

function meta(html: string, key: string): string | undefined {
  return html.match(new RegExp(`<meta\\s+(?:property|name)="${key}"\\s+content="([^"]*)"`))?.[1];
}

function expectImageCard(html: string) {
  expect(meta(html, 'twitter:card')).toBe('summary_large_image');
  expect(meta(html, 'og:image')).toBe(IMAGE);
  expect(meta(html, 'twitter:image')).toBe(IMAGE);
  expect(meta(html, 'og:image:type')).toBe('image/png');
  expect(meta(html, 'og:image:width')).toBe('1200');
  expect(meta(html, 'og:image:height')).toBe('630');
  expect(meta(html, 'og:image:alt')).toBeTruthy();
  expect(meta(html, 'twitter:image:alt')).toBe(meta(html, 'og:image:alt'));
  expect(meta(html, 'og:title')).toBe(meta(html, 'twitter:title'));
  expect(meta(html, 'og:description')).toBe(meta(html, 'twitter:description'));
  for (const key of ['og:image', 'twitter:image', 'twitter:card']) {
    expect(html.match(new RegExp(`(?:property|name)="${key}"`, 'g'))).toHaveLength(1);
  }
}

describe('public sharing cards', () => {
  it.each(outputs.map((o) => [o.route, o.html]))('%s has a complete static image card', (route, html) => {
    expectImageCard(html);
    expect(meta(html, 'og:url')).toBe(ORIGIN + route);
  });

  it.each(outputs.filter((o) => o.kind === 'home').map((o) => [o.locale, o.html]))(
    '%s homepage has concise product sharing copy',
    (_locale, html) => {
      expect(meta(html, 'og:title')!.length).toBeLessThanOrEqual(70);
      expect(meta(html, 'og:description')).toMatch(/PDF/);
      expect(meta(html, 'og:description')).toMatch(/Experimental Beta/);
      expect(meta(html, 'og:description')).toMatch(/WebMCP/);
      expect(meta(html, 'og:description')).toMatch(/PWA/);
    },
  );

  it.each(['editor.html', 'history.html'])('%s has a generic card and remains noindex', (path) => {
    const html = readFileSync(resolve(ROOT, path), 'utf8');
    expectImageCard(html);
    expect(meta(html, 'robots')).toBe('noindex');
    expect(meta(html, 'og:url')).toBe(`${ORIGIN}/`);
    expect(meta(html, 'og:title')).toBe('Online Document Editor');
  });

  it('the public embedding demo has its own title and URL', () => {
    const html = readFileSync(resolve(ROOT, 'public/embed-demo.html'), 'utf8');
    expectImageCard(html);
    expect(meta(html, 'og:url')).toBe(`${ORIGIN}/embed-demo.html`);
    expect(meta(html, 'og:title')).toBe('Document Editor iframe Demo');
  });

  it('references a compact PNG with the declared dimensions', () => {
    const png = readFileSync(resolve(ROOT, 'public/social/document-editor-v1.png'));
    expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect(png.readUInt32BE(16)).toBe(1200);
    expect(png.readUInt32BE(20)).toBe(630);
    expect(png.length).toBeLessThan(1_000_000);
  });
});
