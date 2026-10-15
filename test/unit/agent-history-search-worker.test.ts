import { afterEach, expect, it, vi } from 'vitest';
import type { SearchRequest } from '../../lib/agent-plugin/ui/history-search-model';

afterEach(() => vi.unstubAllGlobals());

it('shares a compiled query across Worker records and matches normalized segment boundaries', async () => {
  let receive!: (event: MessageEvent<SearchRequest>) => void;
  const post = vi.fn();
  vi.stubGlobal('self', {
    addEventListener: (_type: string, handler: typeof receive) => {
      receive = handler;
    },
    postMessage: post,
  });
  const NativeArray = Uint32Array;
  const sizes: number[] = [];
  vi.stubGlobal(
    'Uint32Array',
    class extends NativeArray {
      constructor(size: number) {
        super(size);
        sizes.push(size);
      }
    },
  );
  await import('../../lib/agent-plugin/ui/history-search.worker');
  const send = (data: SearchRequest) => receive({ data } as MessageEvent<SearchRequest>);
  send({
    type: 'update',
    revision: 1,
    removed: [],
    entries: [
      ...Array.from({ length: 32 }, (_, index) => ({ id: String(index), index: 0, text: 'tiny', normalized: 'tiny' })),
      { id: 'boundary', index: 0, text: 'ALPHA ', normalized: 'alpha ' },
      { id: 'boundary', index: 1, text: 'BETA', normalized: 'beta' },
    ],
  });
  send({ type: 'query', revision: 1, request: 1, query: 'a'.repeat(500000) });
  expect(sizes).toEqual([500000]);
  expect(post.mock.calls[0][0].matches).toEqual([]);
  send({ type: 'query', revision: 1, request: 2, query: 'alpha beta' });
  expect(sizes).toEqual([500000, 10]);
  expect(post.mock.calls[1][0]).toMatchObject({
    request: 2,
    query: 'alpha beta',
    matches: [{ id: 'boundary', snippet: expect.stringContaining('ALPHA BETA') }],
  });
});

it('returns canonical copied-whitespace results through the actual engine and Worker protocol', async () => {
  vi.resetModules();
  let workerReceive!: (event: MessageEvent<SearchRequest>) => void;
  let clientReceive: ((event: MessageEvent) => void) | undefined;
  vi.stubGlobal('self', {
    addEventListener: (_type: string, handler: typeof workerReceive) => {
      workerReceive = handler;
    },
    postMessage: (data: unknown) => clientReceive?.({ data } as MessageEvent),
  });
  vi.stubGlobal(
    'Worker',
    class {
      postMessage(data: SearchRequest) {
        workerReceive({ data } as MessageEvent<SearchRequest>);
      }
      addEventListener(type: string, handler: typeof clientReceive) {
        if (type === 'message') clientReceive = handler;
      }
      terminate() {}
    },
  );
  await import('../../lib/agent-plugin/ui/history-search.worker');
  const { createHistorySearch } = await import('../../lib/agent-plugin/ui/history-search');
  const result = vi.fn();
  const search = createHistorySearch(result);
  search.update([
    {
      id: 'copied',
      title: '',
      createdAt: 1,
      updatedAt: 1,
      empty: false,
      *text() {
        yield 'Alpha \t';
        yield '\n BETA';
      },
    },
  ]);
  search.query('  ALPHA \n\t  beta ');
  await vi.waitFor(() => expect(result).toHaveBeenCalledOnce());
  expect(result.mock.calls[0][0]).toMatchObject({
    query: 'alpha beta',
    matches: [{ id: 'copied', snippet: expect.any(String) }],
  });
  search.dispose();
});
