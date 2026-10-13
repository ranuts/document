import { test, expect } from '@playwright/test';
import { generate } from '../../bin/build-pages.mjs';

const routes = generate({ outDir: null }).map((o) => o.route);

test('every public page serves sharing metadata without JavaScript', async ({ request }) => {
  for (let i = 0; i < routes.length; i += 10) {
    await Promise.all(
      routes.slice(i, i + 10).map(async (route) => {
        const response = await request.get(route, { headers: { 'User-Agent': 'Twitterbot/1.0' } });
        expect(response.status(), route).toBe(200);
        const html = await response.text();
        expect(html, route).toContain('name="twitter:card" content="summary_large_image"');
        expect(html, route).toContain(
          'property="og:image" content="https://edit.chaxus.com/social/document-editor-v1.png"',
        );
        expect(html, route).toContain(`property="og:url" content="https://edit.chaxus.com${route}"`);
      }),
    );
  }
});

test('the sharing image is deployed as a readable PNG with the declared dimensions', async ({ request }) => {
  const response = await request.get('/social/document-editor-v1.png', { headers: { 'User-Agent': 'Twitterbot/1.0' } });
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('image/png');
  const png = await response.body();
  expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  expect(png.readUInt32BE(16)).toBe(1200);
  expect(png.readUInt32BE(20)).toBe(630);
});

test('editor and history serve generic cards without exposing local document state', async ({ request }) => {
  for (const path of ['/editor?new=docx', '/history?saved=private-document']) {
    const response = await request.get(path, { headers: { 'User-Agent': 'Twitterbot/1.0' } });
    expect(response.status()).toBe(200);
    const html = await response.text();
    expect(html).toContain('name="robots" content="noindex"');
    expect(html).toContain('property="og:title" content="Online Document Editor"');
    expect(html).toContain('property="og:url" content="https://edit.chaxus.com/"');
    expect(html).not.toContain('private-document');
  }
});
