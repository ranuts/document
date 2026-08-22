import { expect, test } from './lib/l0';

/**
 * The caching contract of the self-hosted image (sws.toml), checked against
 * the real container. Docker-only: the vite preview server used by the other
 * configs serves its own headers, so the spec skips everywhere else --
 * playwright.docker.config.ts sets E2E_DOCKER.
 *
 * What it guards: static-web-server does not read `_headers`, and its default
 * is `max-age=86400` for HTML plus `max-age=31536000` for every .js/.css, all
 * without revalidation. With those defaults a pulled image changes nothing for
 * a day (the browser keeps the previous editor.html, which points at the
 * previous hashed bundle) and vendor JS never changes at all -- which is how a
 * reporter on GitHub #144 re-pulled the image and got a byte-identical error.
 */
const dockerOnly = !process.env.E2E_DOCKER;

test.describe('self-hosted image cache headers', () => {
  test.skip(dockerOnly, 'runs against the Docker image only (pnpm run test:e2e:docker)');

  test('every unhashed path revalidates, so a new image reaches the browser', async ({ request }) => {
    for (const path of ['/', '/editor', '/editor.html', '/sw.js', '/home.css', '/lang-switch.js']) {
      const response = await request.get(path);
      expect(response.status(), path).toBe(200);
      expect(response.headers()['cache-control'], path).toBe('no-cache');
    }
  });

  test('hashed and vendor-versioned payloads stay immutable', async ({ request }) => {
    const editorHtml = await (await request.get('/editor.html')).text();
    const bundle = /src="\.?\/?(assets\/[^"]+\.js)"/.exec(editorHtml)?.[1];
    expect(bundle, 'editor.html must reference a hashed bundle').toBeTruthy();

    // 062 is Liberation Sans regular -- a face every editor loads, and one of
    // the open replacements, so it survives a license sweep. (This used to be
    // /fonts/000, which bin/font-license-sweep.mjs removed.)
    for (const path of [`/${bundle}`, '/fonts/062', '/sdkjs/common/wasm/x2t/x2t.wasm.gz']) {
      const response = await request.get(path);
      expect(response.status(), path).toBe(200);
      expect(response.headers()['cache-control'], path).toMatch(/max-age=31536000.*immutable/);
    }
  });

  test('a revalidation costs a 304, not a re-download', async ({ request }) => {
    const first = await request.get('/editor.html');
    const lastModified = first.headers()['last-modified'];
    expect(lastModified).toBeTruthy();
    const second = await request.get('/editor.html', { headers: { 'If-Modified-Since': lastModified } });
    expect(second.status()).toBe(304);
  });
});
