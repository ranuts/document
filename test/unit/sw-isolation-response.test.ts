import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { expect, it } from 'vitest';

async function cachedResponse(isolated: boolean, path: string, original: Response, shell?: Response | Error, retryShell?: Response) {
  let listener!: (event: any) => void;
  runInNewContext(readFileSync('public/sw.js', 'utf8'), {
    URL, Promise, Date: class extends Date { static now() { return 123; } }, Headers, Response,
    self: { crossOriginIsolated: false, location: { origin: 'https://editor.example', href: 'https://editor.example/sw.js' + (isolated ? '?isolation=1' : '') }, addEventListener: (name: string, callback: typeof listener) => { if (name === 'fetch') listener = callback; } },
    caches: { open: async () => ({ match: async () => original }), match: async (request: unknown, options?: { cacheName?: string; ignoreVary?: boolean }) => {
      if (!options?.cacheName) return original;
      if (shell instanceof Error) throw shell;
      return options.cacheName === 'document-editor-core-dev-123' && options.ignoreVary === true && request === 'https://editor.example/editor.html' ? shell : undefined;
    } },
    fetch: async () => { throw new Error('offline'); },
  });
  let response!: Promise<Response>;
  const event = { request: { url: 'https://editor.example' + path, method: 'GET', mode: path.endsWith('.html') || path.split('?')[0] === '/editor/' ? 'navigate' : 'cors' }, respondWith: (value: Promise<Response>) => { response = value; }, waitUntil: () => {} };
  listener(event);
  if (retryShell) { await response; shell = retryShell; listener(event); }
  return response;
}

it.each(['/web-apps/apps/documenteditor/main/index.html', '/assets/webllm.worker-old.js', '/editor.html'])('upgrades cached response policy without changing bytes: %s', async path => {
  const original = new Response(new Uint8Array([0, 255, 17, 32]), { status: 200, statusText: 'OK', headers: { 'content-type': 'application/octet-stream', etag: 'original-hash' } });
  const response = await cachedResponse(true, path, original);
  expect(response.headers.get('cross-origin-opener-policy')).toBe('same-origin');
  expect(response.headers.get('cross-origin-embedder-policy')).toBe('require-corp');
  expect(response.headers.get('etag')).toBe('original-hash');
  expect(response.statusText).toBe('OK');
  expect(Array.from(new Uint8Array(await response.arrayBuffer()))).toEqual([0, 255, 17, 32]);
});

it('keeps nonisolated hosts and already isolated responses unchanged', async () => {
  const plain = new Response('plain');
  expect(await cachedResponse(false, '/editor.html', plain)).toBe(plain);
  const ready = new Response('ready', { headers: { 'cross-origin-opener-policy': 'same-origin', 'cross-origin-embedder-policy': 'require-corp' } });
  expect(await cachedResponse(true, '/editor.html', ready)).toBe(ready);
});

it('preserves network error responses', async () => {
  const error = Response.error();
  expect(await cachedResponse(true, '/editor.html', error)).toBe(error);
});

it('uses its own cached shell policy when an embedded client lacks isolation capability', async () => {
  const shell = new Response('shell', { headers: { 'cross-origin-opener-policy': 'same-origin', 'cross-origin-embedder-policy': 'require-corp' } });
  const response = await cachedResponse(false, '/web-apps/apps/documenteditor/main/index.html', new Response('native iframe'), shell);
  expect(response.headers.get('cross-origin-embedder-policy')).toBe('require-corp');
  expect(await response.text()).toBe('native iframe');
});
it('does not infer isolation from incomplete shell policy', async () => {
  const original = new Response('plain');
  const shell = new Response('shell', { headers: { 'cross-origin-embedder-policy': 'require-corp' } });
  expect(await cachedResponse(false, '/web-apps/apps/documenteditor/main/index.html', original, shell)).toBe(original);
});

it('keeps ordinary responses usable if shell policy lookup fails', async () => {
  const original = new Response('plain');
  expect(await cachedResponse(false, '/web-apps/apps/documenteditor/main/index.html', original, new Error('storage unavailable'))).toBe(original);
});

it.each([undefined, new Error('storage unavailable')])('recovers when the shell becomes available in the same Worker: %s', async initial => {
  const shell = new Response('shell', { headers: { 'cross-origin-opener-policy': 'same-origin', 'cross-origin-embedder-policy': 'require-corp' } });
  const response = await cachedResponse(false, '/web-apps/apps/documenteditor/main/index.html', new Response('native iframe'), initial, shell);
  expect(response.headers.get('cross-origin-embedder-policy')).toBe('require-corp');
  expect(await response.text()).toBe('native iframe');
});


it.each([[false, '/web-apps/apps/documenteditor/main/index.html'], [true, '/web-apps/apps/documenteditor/main/index.html'], [false, '/editor.html'], [true, '/editor.html']] as const)('serves redirected cached application HTML as a navigation response: isolation %s, %s', async (isolated, path) => {
  const original = new Response('native iframe', { headers: { 'cross-origin-opener-policy': 'same-origin', 'cross-origin-embedder-policy': 'require-corp', etag: 'unchanged' } });
  Object.defineProperties(original, { redirected: { value: true }, url: { value: 'https://editor.example' + (path === '/editor.html' ? '/editor' : '/web-apps/apps/documenteditor/main/') } });
  const response = await cachedResponse(isolated, path, original);
  expect(response.redirected).toBe(false);
  expect(response.headers.get('etag')).toBe('unchanged');
  expect(await response.text()).toBe('native iframe');
});
it('does not normalize foreign redirected cache responses', async () => {
  const original = new Response('foreign');
  Object.defineProperties(original, { redirected: { value: true }, url: { value: 'https://foreign.example/' } });
  expect(await cachedResponse(false, '/web-apps/apps/documenteditor/main/index.html', original)).toBe(original);
});


it.each(['?new=docx&locale=en', '?file=private%2Fdocument.docx&embed=1'])('canonicalizes trailing editor navigation without losing parameters: %s', async query => {
  const response = await cachedResponse(true, '/editor/' + query, new Response('shell'));
  expect(response.status).toBe(308);
  expect(response.headers.get('location')).toBe('https://editor.example/editor' + query);
});
