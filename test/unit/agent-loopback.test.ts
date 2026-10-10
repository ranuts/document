import { expect, it } from 'vitest';
import { LoopbackProvider, validateLoopbackUrl } from '../../packages/agent-core/src/llm/loopback';
import { createProvider } from '../../packages/agent-core/src/llm/factory';
it('is reachable through the factory, which requires an explicit model', () => {
  // Imported from src rather than the built package so the assertion cannot pass
  // against a stale dist build.
  expect(createProvider('loopback', { model: 'qwen3:8b' }).name).toBe('loopback');
  expect(() => createProvider('loopback')).toThrow('A local model name is required');
  expect(() => createProvider('loopback', { model: '  ' })).toThrow('A local model name is required');
});
it('accepts only explicit loopback origins without credentials or query data', () => {
  expect(validateLoopbackUrl('http://127.0.0.1:11434/')).toBe('http://127.0.0.1:11434');
  expect(validateLoopbackUrl('http://[::1]:11434')).toBe('http://[::1]:11434');
  for (const value of [
    'https://example.com',
    'http://192.168.1.2',
    'http://localhost.evil.test',
    'http://user:secret@localhost',
    'http://localhost/?token=secret',
    'file:///tmp/model',
    'http://localhost/api',
  ])
    expect(() => validateLoopbackUrl(value)).toThrow();
});
it('requires an installed model before becoming ready', async () => {
  const provider = new LoopbackProvider({
    model: 'missing',
    fetchImpl: async () => Response.json({ models: [{ name: 'available' }] }),
  });
  expect(provider.isReady()).toBe(false);
  await expect(provider.preload()).rejects.toThrow();
  expect(provider.isReady()).toBe(false);
});
it('sends a schema through the native API without credentials and returns completed text', async () => {
  const requests: Array<{ url: string; init: RequestInit }> = [];
  const provider = new LoopbackProvider({
    model: 'local:latest',
    fetchImpl: async (url, init) => {
      requests.push({ url, init });
      return url.endsWith('/tags')
        ? Response.json({ models: [{ name: 'local:latest' }] })
        : Response.json({ done: true, done_reason: 'stop', message: { content: '{"text":"hello"}' } });
    },
  });
  await provider.preload();
  const result = await provider.generateJSON([{ role: 'user', content: 'source' }], { type: 'object' });
  expect(result.text).toBe('{"text":"hello"}');
  expect(requests[1].url).toBe('http://localhost:11434/api/chat');
  expect(requests[1].init.credentials).toBe('omit');
  expect(requests[1].init.redirect).toBe('error');
  expect(JSON.parse(requests[1].init.body as string)).toMatchObject({
    model: 'local:latest',
    stream: false,
    format: { type: 'object' },
  });
  await provider.dispose();
  expect(provider.isReady()).toBe(false);
  await expect(provider.preload()).rejects.toThrow();
});
it('does not publish readiness when disposal occurs during the connection check', async () => {
  let finish: (value: Response) => void = () => {};
  const provider = new LoopbackProvider({
    model: 'local',
    fetchImpl: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  });
  const loading = provider.preload();
  await provider.dispose();
  finish(Response.json({ models: [{ name: 'local' }] }));
  await expect(loading).rejects.toThrow();
  expect(provider.isReady()).toBe(false);
});
it('reports a connection failure instead of publishing readiness', async () => {
  const provider = new LoopbackProvider({
    model: 'local',
    fetchImpl: async () => new Response('nope', { status: 502 }),
  });
  expect(provider.isReady()).toBe(false);
  await expect(provider.preload()).rejects.toThrow('Local service request failed');
  expect(provider.isReady()).toBe(false);
});
it('aborts a connection check that exceeds the timeout', async () => {
  const provider = new LoopbackProvider({
    model: 'local',
    timeoutMs: 20,
    fetchImpl: (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(init.signal?.reason));
      }),
  });
  await expect(provider.preload()).rejects.toThrow();
  expect(provider.isReady()).toBe(false);
});
it('cancels generation through the caller signal without publishing a result', async () => {
  const provider = new LoopbackProvider({
    model: 'local',
    fetchImpl: (url, init) =>
      url.endsWith('/tags')
        ? Promise.resolve(Response.json({ models: [{ name: 'local' }] }))
        : new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () => reject(init.signal?.reason));
          }),
  });
  await provider.preload();
  const abort = new AbortController();
  const pending = provider.generateJSON([{ role: 'user', content: 'source' }], { type: 'object' }, abort.signal);
  abort.abort(new DOMException('Stopped', 'AbortError'));
  await expect(pending).rejects.toThrow();
  expect(provider.isReady()).toBe(true);
});
it('refuses editor tools, which a text-only local service cannot execute', async () => {
  const provider = new LoopbackProvider({
    model: 'local',
    fetchImpl: async (url) =>
      url.endsWith('/tags') ? Response.json({ models: [{ name: 'local' }] }) : Response.json({ done: true }),
  });
  await provider.preload();
  await expect(
    provider.chat([{ role: 'user', content: 'hi' }], [{ name: 'set_cell', description: '', inputSchema: {} }]),
  ).rejects.toThrow('Local service cannot execute editor tools');
});
it('rejects a response that never completed', async () => {
  const provider = new LoopbackProvider({
    model: 'local',
    fetchImpl: async (url) =>
      url.endsWith('/tags')
        ? Response.json({ models: [{ name: 'local' }] })
        : Response.json({ done: false, message: { content: '' } }),
  });
  await provider.preload();
  await expect(provider.generateJSON([{ role: 'user', content: 'x' }], { type: 'object' })).rejects.toThrow(
    'Incomplete local service response',
  );
});
