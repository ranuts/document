import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const { convert, start, clear, remember } = vi.hoisted(() => ({
  convert: vi.fn(async (_options: any) => {}),
  start: vi.fn(),
  clear: vi.fn(async () => {}),
  remember: vi.fn(async () => true),
}));
vi.mock('../../lib/converter', () => ({ handleDocumentOperation: convert, loadEditorApi: async () => {} }));
vi.mock('../../lib/history/session', () => ({ startDocumentSession: start, newDocumentId: () => 'new-id' }));
vi.mock('../../lib/history/autosave', () => ({ stopAutosaveSession: vi.fn() }));
vi.mock('../../lib/active-document-source', () => ({ clearActiveSource: clear, rememberActiveSource: remember }));
vi.mock('../../lib/onlyoffice-editor', () => ({ getReadonlyMode: () => false }));
import { openDocumentFromUrl, openLocalFile, onCreateNew } from '../../lib/document';
import { getDocmentObj } from '@ranuts/shared/store';

const response = (headers: Record<string, string> = {}) => new Response('document bytes', { headers });
beforeEach(() => {
  convert.mockClear();
  start.mockClear();
  clear.mockClear();
  remember.mockClear();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('URL open failures', () => {
  it('rejects when download fails so callers cannot report success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network failed')));
    await expect(openDocumentFromUrl('https://files.example/missing.docx')).rejects.toThrow('network failed');
    expect(convert).not.toHaveBeenCalled();
    expect(start).not.toHaveBeenCalled();
  });
  it('reports document:error instead of document:opened to the embed host', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 404 })));
    history.replaceState(null, '', '/editor?embed=1');
    const listeners = vi.spyOn(window, 'addEventListener');
    const posted = vi.spyOn(window.parent, 'postMessage');
    const { initEmbedApi } = await import('../../lib/embed-api');
    initEmbedApi();
    try {
      window.dispatchEvent(
        new MessageEvent('message', {
          source: window.parent,
          origin: 'https://host.example',
          data: { id: 'missing', type: 'document:open-url', payload: { url: 'https://files.example/missing.docx' } },
        }),
      );
      await vi.waitFor(() =>
        expect(posted).toHaveBeenCalledWith(
          expect.objectContaining({ id: 'missing', type: 'document:error' }),
          'https://host.example',
        ),
      );
      expect(posted.mock.calls.some(([message]) => message.type === 'document:opened')).toBe(false);
    } finally {
      for (const [type, listener, options] of listeners.mock.calls) window.removeEventListener(type, listener, options);
      history.replaceState(null, '', '/');
    }
  });
});

describe('remote filenames', () => {
  it.each([
    ["attachment; filename*=UTF-8''%E6%8A%A5%E5%91%8A.docx", '\u62a5\u544a.docx'],
    ["attachment; filename=plain.docx; filename*=UTF-8'en'%E6%8A%A5%E5%91%8A.docx", '\u62a5\u544a.docx'],
    ['attachment; filename="semi;colon.docx"', 'semi;colon.docx'],
    ["attachment; filename=plain.docx; filename*=UTF-8''%FF.docx", 'plain.docx'],
  ])('decodes Content-Disposition %s', async (header, expected) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ 'Content-Disposition': header })));
    await openDocumentFromUrl('https://files.example/download');
    expect(convert).toHaveBeenCalledWith(expect.objectContaining({ fileName: expected }));
    expect(getDocmentObj().fileName).toBe(expected);
  });
  it('decodes percent-encoded URL path names', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response()));
    await openDocumentFromUrl('https://files.example/%E6%8A%A5%E5%91%8A.docx');
    expect(getDocmentObj().fileName).toBe('\u62a5\u544a.docx');
  });
  it('keeps an explicitly supplied file name', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(response({ 'Content-Disposition': 'attachment; filename=remote.docx' })),
    );
    await openDocumentFromUrl('https://files.example/download', 'chosen.docx');
    expect(getDocmentObj().fileName).toBe('chosen.docx');
  });
});

describe('remote open limits and currency', () => {
  it('rejects a declared remote file over 100 MiB before reading it', async () => {
    const remote = response({ 'Content-Length': String(100 * 1024 * 1024 + 1) });
    const read = vi.spyOn(remote, 'blob');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(remote));
    await expect(openDocumentFromUrl('https://files.example/huge.docx')).rejects.toThrow();
    expect(read).not.toHaveBeenCalled();
    expect(convert).not.toHaveBeenCalled();
  });
  it('aborts the previous URL download and never mounts its late response', async () => {
    let finish!: (value: Response) => void;
    let oldSignal: AbortSignal | undefined;
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockImplementationOnce((_url, options) => {
          oldSignal = options?.signal;
          return new Promise<Response>((resolve) => {
            finish = resolve;
          });
        })
        .mockResolvedValueOnce(response()),
    );
    const old = openDocumentFromUrl('https://files.example/old.docx');
    const oldResult = old.catch((error: Error) => error);
    await openDocumentFromUrl('https://files.example/new.docx');
    finish(response());
    expect((await oldResult)?.name).toBe('AbortError');
    expect(oldSignal?.aborted).toBe(true);
    expect(convert.mock.calls.map(([request]) => request.fileName)).toEqual(['new.docx']);
    expect(getDocmentObj().fileName).toBe('new.docx');
  });
  it.each(['local', 'new'])('cancels a remote fetch when opening a %s document', async (kind) => {
    const fetcher = vi.fn(() => new Promise<Response>(() => {}));
    vi.stubGlobal('fetch', fetcher);
    const old = openDocumentFromUrl('https://files.example/old.docx');
    const failed = expect(old).rejects.toMatchObject({ name: 'AbortError' });
    if (kind === 'local') await openLocalFile(new File(['local'], 'local.docx'));
    else await onCreateNew('.docx');
    await failed;
    expect(convert).toHaveBeenCalledTimes(1);
  });
  it('bounds a server that never returns response headers', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => {})),
    );
    const opening = openDocumentFromUrl('https://files.example/stalled.docx');
    const failed = expect(opening).rejects.toMatchObject({ name: 'TimeoutError' });
    try {
      await vi.advanceTimersByTimeAsync(60_000);
      await failed;
      expect(convert).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
