import { expect, it, vi } from 'vitest';
import {
  ReferenceSources,
  readLocalReference,
  McpResources,
} from '../../lib/agent-plugin/connectors/reference-sources';

it('accepts bounded text files and rejects binary or oversized sources', async () => {
  expect((await readLocalReference(new File(['hello'], 'notes.md'))).text).toBe('hello');
  await expect(readLocalReference(new File(['binary'], 'notes.docx'))).rejects.toThrow('corrupt');
  await expect(readLocalReference(new File(['x'.repeat(262145)], 'large.txt'))).rejects.toThrow('too-large');
});
it('captures immutable references and invalidates a snapshot on disconnect', () => {
  const sources = new ReferenceSources();
  sources.add({ id: 'one', connector: 'local', title: 'Notes', text: 'original' });
  const snapshot = sources.capture();
  sources.add({ id: 'two', connector: 'local', title: 'More', text: 'second' });
  expect(snapshot.references).toHaveLength(1);
  expect(snapshot.isCurrent()).toBe(true);
  sources.remove('one');
  expect(snapshot.isCurrent()).toBe(false);
});
it('never accepts unsafe endpoint URLs or arbitrary tools', async () => {
  expect(() => new McpResources('http://example.com/mcp')).toThrow('invalid-url');
  expect(() => new McpResources('https://user:secret@example.com/mcp')).toThrow('invalid-url');
  const fetcher = vi.fn(async (_url: unknown, init?: RequestInit) => {
    const request = JSON.parse(String(init?.body));
    const result =
      request.method === 'initialize'
        ? { protocolVersion: '2025-11-25', capabilities: { resources: {} }, serverInfo: { name: 'test', version: '1' } }
        : request.method === 'resources/list'
          ? { resources: [{ uri: 'notes://one', name: 'Notes' }] }
          : { contents: [{ uri: 'notes://one', text: 'reference text' }] };
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: request.id, result }), {
      headers: { 'content-type': 'application/json' },
    });
  });
  const client = new McpResources('http://localhost:1234/mcp', '', fetcher as typeof fetch);
  expect(await client.list()).toEqual([{ uri: 'notes://one', name: 'Notes' }]);
  expect((await client.read('notes://one')).text).toBe('reference text');
  await expect(client.read('notes://other')).rejects.toThrow('unlisted');
  expect(fetcher.mock.calls.every(([, init]) => !String(init?.body).includes('tools/call'))).toBe(true);
});
it('keeps attachments scoped to conversations and disconnects across all scopes', () => {
  const sources = new ReferenceSources();
  sources.select('one');
  sources.add({ id: 'x', connector: 'mcp', title: 'Source', text: 'one' });
  const queued = sources.capture();
  sources.select('two');
  expect(sources.list()).toEqual([]);
  expect(queued.isCurrent()).toBe(true);
  sources.disconnect('mcp');
  expect(queued.isCurrent()).toBe(false);
});
it('consumes matching SSE responses across chunk boundaries without waiting for closure', async () => {
  const cancel = vi.fn();
  const fetcher = vi.fn(async (_url: unknown, init?: RequestInit) => {
    const request = JSON.parse(String(init?.body));
    if (!request.id) return new Response(null, { status: 202 });
    const result =
      request.method === 'initialize'
        ? { protocolVersion: '2025-11-25' }
        : { resources: [{ uri: 'notes://one', name: '笔记' }] };
    const bytes = new TextEncoder().encode(`: ping\r\ndata: ${JSON.stringify({ id: request.id, result })}\r\n\r\n`);
    return new Response(
      new ReadableStream({
        start(controller) {
          // Split CRLF boundaries and multi-byte UTF-8 characters into individual bytes.
          for (const byte of bytes) controller.enqueue(new Uint8Array([byte]));
        },
        cancel,
      }),
      { headers: { 'content-type': 'text/event-stream' } },
    );
  });
  const client = new McpResources('https://example.com/mcp', '', fetcher as typeof fetch);
  const result = await Promise.race([
    client.list(),
    new Promise((_, reject) => setTimeout(() => reject(new Error('stream did not resolve')), 100)),
  ]);
  expect(result).toEqual([{ uri: 'notes://one', name: '笔记' }]);
  expect(cancel).toHaveBeenCalledTimes(2);
});
it('cancels pending SSE readers when disconnected', async () => {
  const cancel = vi.fn();
  const client = new McpResources(
    'https://example.com/mcp',
    '',
    (async () =>
      new Response(new ReadableStream({ cancel }), {
        headers: { 'content-type': 'text/event-stream' },
      })) as typeof fetch,
  );
  const pending = client.list();
  await Promise.resolve();
  client.disconnect();
  await expect(pending).rejects.toThrow();
  expect(cancel).toHaveBeenCalled();
});
it('retains cumulative byte limits for SSE responses', async () => {
  const cancel = vi.fn();
  const client = new McpResources(
    'https://example.com/mcp',
    '',
    (async () =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array(262144 + 32769));
          },
          cancel,
        }),
        { headers: { 'content-type': 'text/event-stream' } },
      )) as typeof fetch,
  );
  await expect(client.list()).rejects.toThrow('source-too-large');
  expect(cancel).toHaveBeenCalled();
});
it('cancels the SSE reader when the request deadline expires', async () => {
  const deadline = new AbortController();
  const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(deadline.signal);
  const cancel = vi.fn();
  try {
    const client = new McpResources(
      'https://example.com/mcp',
      '',
      (async () =>
        new Response(new ReadableStream({ cancel }), {
          headers: { 'content-type': 'text/event-stream' },
        })) as typeof fetch,
    );
    const pending = client.list();
    await Promise.resolve();
    deadline.abort(new DOMException('Deadline exceeded', 'TimeoutError'));
    await expect(pending).rejects.toThrow('Deadline exceeded');
    expect(cancel).toHaveBeenCalled();
  } finally {
    timeout.mockRestore();
  }
});
it('forgets deleted conversation attachments and invalidates their snapshots', () => {
  const sources = new ReferenceSources();
  sources.select('deleted');
  sources.add({ id: 'x', connector: 'local', title: 'Private', text: 'private' });
  const old = sources.capture();
  sources.select('kept');
  sources.add({ id: 'y', connector: 'local', title: 'Current', text: 'current' });
  sources.forget('deleted');
  expect(old.isCurrent()).toBe(false);
  expect(sources.list()).toHaveLength(1);
  const current = sources.capture();
  sources.forget();
  expect(current.isCurrent()).toBe(false);
  expect(sources.list()).toEqual([]);
});
it('loads explicit bounded MCP pages, deduplicates entries and stops cursor cycles', async () => {
  let page = 0;
  const fetcher = vi.fn(async (_url: unknown, init?: RequestInit) => {
    const request = JSON.parse(String(init?.body));
    const result =
      request.method === 'initialize'
        ? { protocolVersion: '2025-11-25' }
        : request.method === 'resources/list'
          ? ++page === 1
            ? { resources: [{ uri: 'notes://one', name: 'One' }], nextCursor: 'next' }
            : {
                resources: [
                  { uri: 'notes://one', name: 'One' },
                  { uri: 'notes://two', name: 'Two' },
                ],
                nextCursor: 'next',
              }
          : {};
    return new Response(JSON.stringify({ id: request.id, result }), {
      headers: { 'content-type': 'application/json' },
    });
  });
  const client = new McpResources('https://example.com/mcp', '', fetcher as typeof fetch);
  expect(await client.list()).toHaveLength(1);
  expect(page).toBe(1);
  expect(client.continuation).toBe('next');
  expect(await client.list('next')).toEqual([{ uri: 'notes://two', name: 'Two' }]);
  expect(client.continuation).toBe('');
  await expect(client.list('next')).rejects.toThrow('invalid-response');
});
it('releases canceled file reads and ignores their late completion', async () => {
  let complete!: (value: string) => void;
  const file = {
    name: 'slow.txt',
    size: 10,
    text: () => new Promise<string>((resolve) => (complete = resolve)),
  } as File;
  const controller = new AbortController();
  const pending = readLocalReference(file, controller.signal);
  controller.abort();
  await expect(pending).rejects.toThrow();
  complete('late text');
});
it('reports the deadline when an underlying file read never settles', async () => {
  vi.useFakeTimers();
  // AbortSignal.timeout uses the platform clock, so substitute a controllable deadline.
  const controller = new AbortController();
  const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(controller.signal);
  try {
    const file = { name: 'slow.txt', size: 10, text: () => new Promise<string>(() => {}) } as File;
    const pending = readLocalReference(file);
    controller.abort(new DOMException('Timed out', 'TimeoutError'));
    await expect(pending).rejects.toThrow('source-timeout');
  } finally {
    timeout.mockRestore();
    vi.useRealTimers();
  }
});
