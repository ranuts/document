import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const { convert, start, remember, decode } = vi.hoisted(() => ({
  convert: vi.fn(async (_options: any) => {}),
  start: vi.fn(),
  remember: vi.fn(async () => true),
  decode: vi.fn(async () => new File(['desktop'], 'desktop.docx')),
}));
vi.mock('ranuts/utils', async (original) => ({
  ...(await original<typeof import('ranuts/utils')>()),
  MessageCodec: { decodeFileChunked: decode },
}));
vi.mock('../../lib/converter', () => ({ handleDocumentOperation: convert, loadEditorApi: async () => {} }));
vi.mock('../../lib/history/session', () => ({ startDocumentSession: start, newDocumentId: () => 'source-id' }));
vi.mock('../../lib/history/autosave', () => ({ clearDocumentSession: vi.fn() }));
vi.mock('../../lib/active-document-source', () => ({
  rememberActiveSource: remember,
  clearActiveSource: async () => {},
}));
vi.mock('../../lib/onlyoffice-editor', () => ({ getReadonlyMode: () => false }));
import { openLocalFile, openDocumentFromUrl } from '../../lib/document';
import { events } from '../../lib/events';
import { initEmbedApi } from '../../lib/embed-api';
import { getDocmentObj, setDocmentObj } from '@ranuts/shared/store';
const chunk = { chunkIndex: 0, data: '', lastModified: 0, name: 'desktop.docx', size: 1, totalChunks: 1, type: '' };

beforeEach(() => {
  start.mockClear();
  convert.mockClear();
  remember.mockReset().mockResolvedValue(true);
});
afterEach(() => vi.unstubAllGlobals());

describe('open ownership across entry points', () => {
  it('prevents a mounted local source from committing after an embed replacement', async () => {
    let finish!: (value: boolean) => void;
    remember.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const local = openLocalFile(new File(['original'], 'original.docx'));
    await vi.waitFor(() => expect(remember).toHaveBeenCalled());
    history.replaceState(null, '', '/editor?embed=1');
    const listeners = vi.spyOn(window, 'addEventListener');
    const posted = vi.spyOn(window.parent, 'postMessage');
    initEmbedApi();
    try {
      window.dispatchEvent(
        new MessageEvent('message', {
          source: window.parent,
          origin: 'https://host.example',
          data: {
            id: 'replacement',
            type: 'document:open-file',
            payload: { file: new File(['replacement'], 'replacement.docx') },
          },
        }),
      );
      await vi.waitFor(() =>
        expect(posted).toHaveBeenCalledWith(
          expect.objectContaining({ id: 'replacement', type: 'document:opened' }),
          'https://host.example',
        ),
      );
      finish(true);
      await expect(local).rejects.toMatchObject({ name: 'AbortError' });
      expect(start).not.toHaveBeenCalled();
    } finally {
      for (const [type, listener, options] of listeners.mock.calls) window.removeEventListener(type, listener, options);
      vi.restoreAllMocks();
      history.replaceState(null, '', '/');
    }
  });
  it('prevents a mounted local source from committing after a desktop replacement', async () => {
    let finish!: (value: boolean) => void;
    remember.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const local = openLocalFile(new File(['original'], 'original.docx'));
    await vi.waitFor(() => expect(remember).toHaveBeenCalled());
    await events.RENDER_OFFICE(chunk);
    finish(true);
    await expect(local).rejects.toMatchObject({ name: 'AbortError' });
    expect(start).not.toHaveBeenCalled();
  });
  it.each(['open', 'close'])('cancels a remote fetch on desktop %s', async (action) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>(() => {})),
    );
    const remote = openDocumentFromUrl('https://files.example/old.docx');
    const failed = expect(remote).rejects.toMatchObject({ name: 'AbortError' });
    if (action === 'open') await events.RENDER_OFFICE(chunk);
    else events.CLOSE_EDITOR(undefined);
    await failed;
  });
});

describe('desktop mounted metadata', () => {
  it('preserves the mounted metadata when desktop conversion fails', async () => {
    setDocmentObj({ fileName: 'Original.docx', file: new File(['original'], 'Original.docx') });
    const original = getDocmentObj();
    convert.mockRejectedValueOnce(new DOMException('Unreadable file', 'NotReadableError'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await events.RENDER_OFFICE(chunk);
      expect(getDocmentObj()).toBe(original);
    } finally {
      vi.restoreAllMocks();
    }
  });
  it('publishes desktop metadata after conversion mounts the document', async () => {
    setDocmentObj({ fileName: 'Original.docx', file: new File(['original'], 'Original.docx') });
    const original = getDocmentObj();
    let finish!: () => void;
    convert.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const opening = events.RENDER_OFFICE(chunk);
    await vi.waitFor(() => expect(convert).toHaveBeenCalled());
    try {
      expect(getDocmentObj()).toBe(original);
    } finally {
      finish();
      await opening;
    }
    expect(getDocmentObj().fileName).toBe('desktop.docx');
    expect(getDocmentObj().file?.name).toBe('desktop.docx');
  });
});
