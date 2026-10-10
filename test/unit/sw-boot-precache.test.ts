import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { expect, it, vi } from 'vitest';

it('precaches current HTML boot assets without downloading models or external sources', async () => {
  const origin = 'https://editor.example';
  const addAll = vi.fn(async (_urls: string[]) => {});
  const html =
    '<script src="./assets/editor-abcd.js"></script><link href="/assets/base-abcd.css"><link href="/ran-tokens.abcd.css"><link href="/ran-fonts/fonts.css"><script src="https://outside.example/assets/remote.js"></script><a href="/models/large.gguf">model</a><script src="./assets/editor-abcd.js"></script>';
  const cache = { match: async () => ({ text: async () => html }), addAll };
  const context = { URL, Promise, Date, Set, self: { location: { origin }, addEventListener: () => {} }, cache };
  await runInNewContext(readFileSync('public/sw.js', 'utf8') + '\nprecacheBootAssets(cache);', context);
  expect(addAll).toHaveBeenCalledOnce();
  expect(addAll.mock.calls[0][0]).toEqual([
    `${origin}/assets/editor-abcd.js`,
    `${origin}/assets/base-abcd.css`,
    `${origin}/ran-tokens.abcd.css`,
    `${origin}/ran-fonts/fonts.css`,
  ]);
});

it.each([
  ['/assets/editor-hash.js', true],
  ['/ran-fonts/Geist.woff2', true],
  ['/private/script.js', false],
])('limits Vary bypass to public build assets and UI fonts: %s', async (path, expected) => {
  const listeners = new Map<string, (event: any) => void>();
  const asset = { status: 200, body: 'hashed public javascript' };
  const origin = 'https://editor.example';
  runInNewContext(readFileSync('public/sw.js', 'utf8'), {
    URL,
    Promise,
    Date,
    self: {
      location: { origin },
      addEventListener: (name: string, listener: (event: any) => void) => listeners.set(name, listener),
    },
    fetch: async () => {
      throw new Error('offline');
    },
    caches: {
      match: async (_request: unknown, options?: { ignoreVary: boolean }) => (options?.ignoreVary ? asset : undefined),
    },
  });
  let response!: Promise<unknown>;
  listeners.get('fetch')!({
    request: { url: `${origin}${path}`, method: 'GET' },
    respondWith: (value: Promise<unknown>) => (response = value),
    waitUntil: () => {},
  });
  expect(await response).toBe(expected ? asset : undefined);
});

it('caches vendor bootstrap script and style tags without evaluating inline scripts', async () => {
  const origin = 'https://editor.example',
    addAll = vi.fn(async (_urls: string[]) => {});
  const html =
    '<script>document.write(\'<script src="/sdkjs/vendor/removed.js"><\\/script>\')</script><script src="../../../vendor/requirejs/require.js"></script><link href="./resources/css/app.css"><link href="https://external.example/file.css">';
  const cache = { match: async () => ({ text: async () => html }), addAll };
  await runInNewContext(readFileSync('public/sw.js', 'utf8') + '\nprecacheBootAssets(cache, true);', {
    URL,
    Promise,
    Date,
    Set,
    self: { location: { origin }, addEventListener: () => {} },
    cache,
  });
  expect(addAll.mock.calls[0][0]).toEqual([
    `${origin}/web-apps/vendor/requirejs/require.js`,
    `${origin}/web-apps/apps/documenteditor/main/resources/css/app.css`,
    `${origin}/web-apps/apps/spreadsheeteditor/main/resources/css/app.css`,
    `${origin}/web-apps/apps/presentationeditor/main/resources/css/app.css`,
  ]);
});

it('installs native export runtime before the editor is used offline', async () => {
  const listeners = new Map<string, (event: any) => void>();
  const stored = new Set<string>();
  const cache = {
    addAll: async (urls: string[]) => {
      for (const url of urls) stored.add(url);
    },
    match: async () => ({ text: async () => '<html></html>' }),
  };
  runInNewContext(readFileSync('public/sw.js', 'utf8'), {
    URL,
    Promise,
    Date,
    Set,
    self: {
      location: { origin: 'https://editor.example' },
      addEventListener: (name: string, callback: (event: any) => void) => listeners.set(name, callback),
      skipWaiting: () => {},
    },
    caches: { open: async () => cache, keys: async () => [] },
  });
  let installed!: Promise<unknown>;
  listeners.get('install')!({
    waitUntil: (promise: Promise<unknown>) => {
      installed = promise;
    },
  });
  await installed;
  expect(stored.has('/sdkjs/common/wasm/x2t/x2t.js')).toBe(true);
  expect(stored.has('/sdkjs/common/wasm/x2t/x2t.wasm.br')).toBe(true);
  expect(stored.has('/sdkjs/common/wasm/x2t/x2t.worker.js')).toBe(true);
});

it('precaches local file-open controls from the offline homepage', async () => {
  const stored = new Set<string>();
  const cache = {
    match: async () => ({
      text: async () =>
        '<script src="/open-local.js"></script><script src="/landing-prefetch.js"></script><link href="/home.css"><script src="/private/unsupported.js"></script>',
    }),
    addAll: async (urls: string[]) => {
      for (const url of urls) stored.add(url);
    },
  };
  await runInNewContext(readFileSync('public/sw.js', 'utf8') + '\nprecacheBootAssets(cache);', {
    URL,
    Promise,
    Date,
    Set,
    self: { location: { origin: 'https://editor.example' }, addEventListener: () => {} },
    cache,
  });
  expect(stored.has('https://editor.example/open-local.js')).toBe(true);
  expect(stored.has('https://editor.example/landing-prefetch.js')).toBe(true);
  expect(stored.has('https://editor.example/home.css')).toBe(true);
  expect(stored.has('https://editor.example/private/unsupported.js')).toBe(false);
});

it('installs font menu sprites before their first offline use at any locale or density', async () => {
  const listeners = new Map<string, (event: any) => void>();
  const stored = new Set<string>();
  const cache = {
    addAll: async (urls: string[]) => {
      for (const url of urls) stored.add(url);
    },
    match: async () => ({ text: async () => '<html></html>' }),
  };
  runInNewContext(readFileSync('public/sw.js', 'utf8'), {
    URL,
    Promise,
    Date,
    Set,
    self: {
      location: { origin: 'https://editor.example' },
      addEventListener: (name: string, callback: (event: any) => void) => listeners.set(name, callback),
      skipWaiting: () => {},
    },
    caches: { open: async () => cache, keys: async () => [] },
  });
  let installed!: Promise<unknown>;
  listeners.get('install')!({
    waitUntil: (promise: Promise<unknown>) => {
      installed = promise;
    },
  });
  await installed;
  for (const locale of ['', '_ea']) {
    for (const density of ['', '@1.25x', '@1.5x', '@1.75x', '@2x']) {
      expect(stored.has(`/sdkjs/common/Images/fonts_thumbnail${locale}${density}.png.bin`)).toBe(true);
    }
  }
  expect([...stored].some((url) => url.startsWith('/fonts/'))).toBe(false);
});
