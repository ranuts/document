import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';

const root = process.cwd();

const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

describe('SEO landing pages', () => {
  test('uses a multi-format document editor positioning on the homepage', () => {
    const html = read('pages/index.html');

    expect(html).toContain('<h1>Local Document Editor in Your Browser</h1>');
    expect(html).toContain('Edit DOCX, XLSX, PPTX, and CSV files locally');
    expect(html).not.toContain('<h1>Local DOCX Editor in Your Browser</h1>');
  });

  test('publishes private and format-specific landing pages', () => {
    const sitemap = read('public/sitemap.xml');
    const viteConfig = read('vite.config.ts');
    const slugs = [
      'docx-editor',
      'xlsx-editor',
      'pptx-editor',
      'csv-editor',
      'private-document-editor',
      'onlyoffice-wasm',
      'embed-document-editor',
      'self-hosted-document-editor',
    ];

    for (const slug of slugs) {
      expect(fs.existsSync(path.join(root, 'pages', slug, 'index.html'))).toBe(true);
      expect(sitemap).toContain(`https://bybrowser.com/${slug}/`);
      expect(viteConfig).toContain(`${slug}/index.html`);
    }
  });
});
