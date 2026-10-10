import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { expect, it } from 'vitest';

it.each([
  ['/editor?new=docx&saved=local', true],
  ['/editor.html?new=xlsx', true],
  ['/unrelated?new=docx', false],
  ['/editor?file=external', false],
])('limits offline editor fallback: %s', async (path, expected) => {
  const listeners = new Map<string, (event: any) => void>();
  const shell = { status: 200, body: 'editor shell' };
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
      match: async () => undefined,
      open: async () => ({ match: async (url: string) => (url === `${origin}/editor.html` ? shell : undefined) }),
    },
  });
  let response!: Promise<unknown>;
  listeners.get('fetch')!({
    request: { url: `${origin}${path}`, method: 'GET', mode: 'navigate' },
    respondWith: (value: Promise<unknown>) => (response = value),
    waitUntil: () => {},
  });
  expect(await response).toBe(expected ? shell : undefined);
});

it.each([
  ['/web-apps/apps/documenteditor/main/index.html?lang=en&frameEditorId=iframe', true],
  ['/web-apps/apps/spreadsheeteditor/main/index.html?lang=ja', true],
  ['/web-apps/apps/presentationeditor/main/index.html?lang=de', true],
  ['/sdkjs/word/sdk-all.js?version=other', false],
])('ignores config parameters only for static editor bootstrap HTML: %s', async (path, expected) => {
  const listeners = new Map<string, (event: any) => void>(),
    shell = { status: 200 },
    origin = 'https://editor.example';
  runInNewContext(readFileSync('public/sw.js', 'utf8'), {
    URL,
    Promise,
    Date,
    self: {
      location: { origin },
      addEventListener: (name: string, listener: (event: any) => void) => listeners.set(name, listener),
    },
    caches: {
      open: async () => ({
        match: async (_request: unknown, options?: { ignoreSearch: boolean }) =>
          options?.ignoreSearch ? shell : undefined,
      }),
    },
    fetch: async () => {
      throw new Error('offline');
    },
  });
  let response!: Promise<unknown>;
  listeners.get('fetch')!({
    request: { url: origin + path, method: 'GET', mode: 'navigate' },
    respondWith: (value: Promise<unknown>) => (response = value),
    waitUntil: () => {},
  });
  expect(await response.catch(() => undefined)).toBe(expected ? shell : undefined);
});
