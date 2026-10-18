import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const { convert, mount, start, clear, remember } = vi.hoisted(() => ({
  convert: vi.fn(async (_options: any) => {}),
  mount: vi.fn(async (_options: any) => {}),
  start: vi.fn(),
  clear: vi.fn(async () => {}),
  remember: vi.fn(async () => true),
}));
vi.mock('../../lib/converter', () => ({ handleDocumentOperation: convert, loadEditorApi: async () => {} }));
vi.mock('../../lib/history/session', () => ({ startDocumentSession: start, newDocumentId: () => 'new-id' }));
vi.mock('../../lib/history/autosave', () => ({ clearDocumentSession: vi.fn() }));
vi.mock('../../lib/active-document-source', () => ({ clearActiveSource: clear, rememberActiveSource: remember }));
vi.mock('../../lib/onlyoffice-editor', async () => ({
  createEditorInstance: mount,
  loadEditorApi: async () => {},
  getReadonlyMode: (await import('../../lib/onlyoffice/readonly')).getReadonlyMode,
}));
import { openDocumentFromUrl, openLocalFile, onCreateNew } from '../../lib/document';
import { getDocmentObj } from '@ranuts/shared/store';
import { getReadonlyMode } from '../../lib/onlyoffice/readonly';

const response = (headers: Record<string, string> = {}) => new Response('document bytes', { headers });
beforeEach(() => {
  convert.mockReset().mockResolvedValue(undefined);
  mount.mockReset().mockResolvedValue(undefined);
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

// Real document/converter/mount ownership runs here with controlled vendor and
// persistence boundaries. Early metadata publication breaks these regressions.
describe('mounted document metadata', () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    vi.stubGlobal('alert', vi.fn());
    vi.stubGlobal('DocsAPI', {
      DocEditor: class {
        constructor(
          _container: string,
          public config: { document: { title: string } },
        ) {}
        destroyEditor() {}
      },
    });
    const converter = await vi.importActual<typeof import('../../lib/converter')>('../../lib/converter');
    const editor = await vi.importActual<typeof import('../../lib/onlyoffice-editor')>('../../lib/onlyoffice-editor');
    convert.mockImplementation(converter.handleDocumentOperation);
    mount.mockImplementation(editor.createEditorInstance);
  });
  afterEach(() => {
    delete window.editor;
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  async function finishMount(opening: Promise<void>): Promise<void> {
    await vi.advanceTimersByTimeAsync(1_000);
    await opening;
  }

  async function originalDocument() {
    const file = new File(['original'], 'Original.txt');
    await finishMount(openLocalFile(file, { readonly: true }));
    return { metadata: getDocmentObj(), editor: window.editor };
  }

  it('preserves the original object identity and readonly mode when local bytes cannot be read', async () => {
    const original = await originalDocument();
    const file = new File(['replacement'], 'Unreadable.xlsx');
    vi.spyOn(file, 'arrayBuffer').mockRejectedValue(new DOMException('Backing file changed', 'NotReadableError'));
    await expect(openLocalFile(file)).rejects.toMatchObject({ name: 'NotReadableError' });
    expect(window.editor).toBe(original.editor);
    expect(getDocmentObj()).toBe(original.metadata);
    expect(getReadonlyMode()).toBe(true);
  });

  it('keeps the original identity while replacement bytes are pending, then commits the mounted file', async () => {
    const original = await originalDocument();
    const file = new File(['replacement'], 'Replacement.txt');
    let finish!: (bytes: ArrayBuffer) => void;
    vi.spyOn(file, 'arrayBuffer').mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const opening = openLocalFile(file);
    await vi.advanceTimersByTimeAsync(0);
    expect(getDocmentObj()).toBe(original.metadata);
    expect(window.editor).toBe(original.editor);
    expect(getReadonlyMode()).toBe(true);
    finish(new Uint8Array([1, 2, 3]).buffer);
    await finishMount(opening);
    expect(getDocmentObj()).toEqual({ fileName: 'Replacement.txt', file });
    expect(window.editor).not.toBe(original.editor);
    expect(getReadonlyMode()).toBe(false);
  });

  it('does not let an older read failure overwrite a newer successful owner', async () => {
    await originalDocument();
    const file = new File(['old attempt'], 'Old.xlsx');
    let fail!: (error: Error) => void;
    vi.spyOn(file, 'arrayBuffer').mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          fail = reject;
        }),
    );
    const pending = openLocalFile(file);
    const failed = expect(pending).rejects.toMatchObject({ name: 'NotReadableError' });
    await vi.advanceTimersByTimeAsync(0);
    await finishMount(openLocalFile(new File(['winner'], 'Winner.txt')));
    const winner = getDocmentObj();
    const editor = window.editor;
    fail(new DOMException('Backing file changed', 'NotReadableError'));
    await failed;
    expect(getDocmentObj()).toBe(winner);
    expect(getDocmentObj().fileName).toBe('Winner.txt');
    expect(window.editor).toBe(editor);
  });

  it.each(['local', 'url', 'new'])('publishes %s metadata only after its mount succeeds', async (kind) => {
    const original = await originalDocument();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response()));
    const file = new File(['replacement'], 'Local.txt');
    const opening =
      kind === 'local'
        ? openLocalFile(file)
        : kind === 'url'
          ? openDocumentFromUrl('https://files.example/Remote.txt')
          : onCreateNew('.docx');
    await vi.advanceTimersByTimeAsync(0);
    expect(getDocmentObj()).toBe(original.metadata);
    await finishMount(opening);
    const expectedName = kind === 'local' ? 'Local.txt' : kind === 'url' ? 'Remote.txt' : 'Untitled.docx';
    expect(getDocmentObj().fileName).toBe(expectedName);
    const editor = window.editor as unknown as { config: { document: { title: string } } };
    expect(editor.config.document.title).toBe(expectedName);
    if (kind === 'new') expect(getDocmentObj().file).toBeUndefined();
    else expect(getDocmentObj().file?.name).toBe(kind === 'local' ? 'Local.txt' : 'Remote.txt');
  });

  it('exposes the mounted source to listeners when native document readiness arrives', async () => {
    await originalDocument();
    let readySource: ReturnType<typeof getDocmentObj> | undefined;
    const onReady = () => {
      readySource = getDocmentObj();
    };
    window.addEventListener('document:content-ready', onReady);
    vi.stubGlobal('DocsAPI', {
      DocEditor: class {
        constructor(_container: string, config: { events: { onDocumentReady: () => void } }) {
          // The native API dispatches readiness from an iframe message task.
          setTimeout(() => config.events.onDocumentReady(), 0);
        }
        destroyEditor() {}
      },
    });
    const file = new File(['replacement'], 'Ready.txt');
    try {
      await finishMount(openLocalFile(file));
      expect(readySource).toBe(getDocmentObj());
      expect(readySource).toEqual({ fileName: 'Ready.txt', file });
    } finally {
      window.removeEventListener('document:content-ready', onReady);
      (await import('../../lib/onlyoffice/viewport')).cleanupViewportFollow();
    }
  });

  it('commits a replacement already in teardown when a newer URL download fails', async () => {
    await originalDocument();
    const file = new File(['replacement'], 'Mounted.txt');
    const opening = openLocalFile(file);
    await vi.advanceTimersByTimeAsync(0);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network failed')));
    await expect(openDocumentFromUrl('https://files.example/Failed.txt')).rejects.toThrow('network failed');
    await finishMount(opening);
    expect(getDocmentObj()).toEqual({ fileName: 'Mounted.txt', file });
    const editor = window.editor as unknown as { config: { document: { title: string } } };
    expect(editor.config.document.title).toBe('Mounted.txt');
    expect(getReadonlyMode()).toBe(false);
  });

  it.each(['url', 'new'])('preserves the mounted identity after a %s mount fails before replacement', async (kind) => {
    const original = await originalDocument();
    mount.mockRejectedValueOnce(new Error('mount refused'));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response()));
    const opening = kind === 'url' ? openDocumentFromUrl('https://files.example/Remote.txt') : onCreateNew('.docx');
    await expect(opening).rejects.toThrow('mount refused');
    expect(getDocmentObj()).toBe(original.metadata);
    expect(window.editor).toBe(original.editor);
    expect(getReadonlyMode()).toBe(true);
  });
});
