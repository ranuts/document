import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockOpenDocumentFromUrl = vi.fn().mockResolvedValue(undefined);
const mockLoadEditorApi = vi.fn().mockResolvedValue(undefined);
const mockHandleDocumentOperation = vi.fn().mockResolvedValue(undefined);
const mockSetDocmentObj = vi.fn();
const mockGetReadonlyMode = vi.fn().mockReturnValue(false);
const mockSetReadonlyMode = vi.fn();
const mockRequestSaveDocument = vi.fn();

vi.mock('../../src/lib/document', () => ({ openDocumentFromUrl: mockOpenDocumentFromUrl }));
vi.mock('../../src/lib/converter', () => ({
  loadEditorApi: mockLoadEditorApi,
  handleDocumentOperation: mockHandleDocumentOperation,
}));
vi.mock('../../src/store', () => ({ setDocmentObj: mockSetDocmentObj }));
vi.mock('@bybrowser/editor', () => ({
  getReadonlyMode: mockGetReadonlyMode,
  setReadonlyMode: mockSetReadonlyMode,
  requestSaveDocument: mockRequestSaveDocument,
}));

async function dispatchMessage(data: unknown, origin = 'https://parent.example.com') {
  window.dispatchEvent(new MessageEvent('message', { data, origin }));
  await new Promise((r) => setTimeout(r, 0));
}

// Verify a specific message type + id was posted (content-based, not count-based).
// Using unique IDs per test prevents false positives from accumulated old listeners.
function expectMessagePosted(
  spy: ReturnType<typeof vi.spyOn>,
  type: string,
  id: string,
  payloadMatch?: Record<string, unknown>,
) {
  const found = spy.mock.calls.find((call: unknown[]) => {
    const msg = call[0] as { type?: string; id?: string };
    return msg?.type === type && msg?.id === id;
  });
  expect(found, `Expected message type="${type}" id="${id}" to have been posted`).toBeDefined();
  if (payloadMatch) {
    const msg = found![0] as { payload?: Record<string, unknown> };
    expect(msg.payload).toMatchObject(payloadMatch);
  }
}

function expectMessageNotPosted(spy: ReturnType<typeof vi.spyOn>, id: string) {
  const found = spy.mock.calls.find((call: unknown[]) => {
    const msg = call[0] as { id?: string };
    return msg?.id === id;
  });
  expect(found, `Expected no message with id="${id}" to be posted`).toBeUndefined();
}

describe('embed-api', () => {
  let postMessageSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    postMessageSpy = vi.spyOn(window, 'postMessage');
    document.body.classList.remove('embed-mode');
    window.history.pushState({}, '', '/');
  });

  afterEach(() => {
    postMessageSpy.mockRestore();
    delete (window as any).editor;
  });

  describe('detectEmbedMode via URL params', () => {
    it.each([
      ['?embed=', true],
      ['?embed=1', true],
      ['?embed=true', true],
      ['?embedded=true', true],
      ['?embedded=1', true],
      ['', false],
      ['?other=1', false],
    ])('URL "%s" → embed mode = %s', async (search, expected) => {
      window.history.pushState({}, '', `/${search}`);
      const { initEmbedApi } = await import('../../src/lib/embed-api');
      initEmbedApi();
      expect(document.body.classList.contains('embed-mode')).toBe(expected);
    });
  });

  describe('initEmbedApi', () => {
    it('is idempotent - second call does not throw', async () => {
      window.history.pushState({}, '', '/?embed=1');
      const { initEmbedApi } = await import('../../src/lib/embed-api');
      expect(() => initEmbedApi()).not.toThrow();
      expect(() => initEmbedApi()).not.toThrow();
      expect(document.body.classList.contains('embed-mode')).toBe(true);
    });

    it('posts document:ready when the load event fires', async () => {
      window.history.pushState({}, '', '/?embed=1');
      const { initEmbedApi } = await import('../../src/lib/embed-api');
      initEmbedApi();

      window.dispatchEvent(new Event('load'));

      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'document:ready' }),
        expect.any(String),
      );
    });
  });

  describe('message handling', () => {
    it('ignores messages that lack a document: prefix', async () => {
      window.history.pushState({}, '', '/?embed=1');
      const { initEmbedApi } = await import('../../src/lib/embed-api');
      initEmbedApi();

      await dispatchMessage({ type: 'other:ping', id: 'ignore-1' });
      await dispatchMessage(null);
      await dispatchMessage('plain string');

      expectMessageNotPosted(postMessageSpy, 'ignore-1');
    });

    it('ignores messages from disallowed origins when embedOrigin is set', async () => {
      window.history.pushState({}, '', '/?embed=1&embedOrigin=https://allowed.example.com');
      const { initEmbedApi } = await import('../../src/lib/embed-api');
      initEmbedApi();

      // All active listeners (including accumulated ones) read the current URL's embedOrigin,
      // so they will all reject this disallowed origin too.
      await dispatchMessage({ type: 'document:get-state', id: 'origin-block-1' }, 'https://evil.example.com');

      expectMessageNotPosted(postMessageSpy, 'origin-block-1');
    });

    it('accepts messages from a matching embedOrigin', async () => {
      window.history.pushState({}, '', '/?embed=1&embedOrigin=https://allowed.example.com');
      const { initEmbedApi } = await import('../../src/lib/embed-api');
      initEmbedApi();

      await dispatchMessage({ type: 'document:get-state', id: 'origin-allow-1' }, 'https://allowed.example.com');

      expectMessagePosted(postMessageSpy, 'document:state', 'origin-allow-1');
    });

    it('responds to document:get-state with readonly and hasDocument flags', async () => {
      window.history.pushState({}, '', '/?embed=1');
      mockGetReadonlyMode.mockReturnValue(false);
      const { initEmbedApi } = await import('../../src/lib/embed-api');
      initEmbedApi();

      await dispatchMessage({ type: 'document:get-state', id: 'state-1' });

      expectMessagePosted(postMessageSpy, 'document:state', 'state-1', {
        readonly: false,
        hasDocument: false,
      });
    });

    it('responds to document:set-readonly and updates readonly mode', async () => {
      window.history.pushState({}, '', '/?embed=1');
      const { initEmbedApi } = await import('../../src/lib/embed-api');
      initEmbedApi();

      await dispatchMessage({ type: 'document:set-readonly', id: 'ro-1', payload: { readonly: true } });

      expect(mockSetReadonlyMode).toHaveBeenCalledWith(true);
      expectMessagePosted(postMessageSpy, 'document:readonly-changed', 'ro-1');
    });

    it('posts document:error when a handler throws', async () => {
      window.history.pushState({}, '', '/?embed=1');
      mockRequestSaveDocument.mockRejectedValueOnce(new Error('Save failed'));
      const { initEmbedApi } = await import('../../src/lib/embed-api');
      initEmbedApi();

      await dispatchMessage({ type: 'document:save', id: 'err-1', payload: {} });

      expectMessagePosted(postMessageSpy, 'document:error', 'err-1', { message: 'Save failed' });
    });

    it('opens a document from url payload', async () => {
      window.history.pushState({}, '', '/?embed=1');
      const { initEmbedApi } = await import('../../src/lib/embed-api');
      initEmbedApi();

      await dispatchMessage({
        type: 'document:open-url',
        id: 'open-1',
        payload: { url: 'https://example.com/test.xlsx' },
      });

      expect(mockOpenDocumentFromUrl).toHaveBeenCalledWith(
        'https://example.com/test.xlsx',
        undefined,
        expect.objectContaining({ readonly: false }),
      );
      expectMessagePosted(postMessageSpy, 'document:opened', 'open-1');
    });
  });

  describe('makeFileFromPayload branches', () => {
    // makeFileFromPayload is internal; we exercise it via document:open-buffer messages.
    // mockHandleDocumentOperation lets us inspect the File that was constructed.

    async function openWithPayload(payload: Record<string, unknown>, id: string) {
      window.history.pushState({}, '', '/?embed=1');
      const { initEmbedApi } = await import('../../src/lib/embed-api');
      initEmbedApi();
      await dispatchMessage({ type: 'document:open-buffer', id, payload });
    }

    it('passes a File payload through unchanged', async () => {
      const file = new File([new Uint8Array([1, 2, 3])], 'original.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      await openWithPayload({ file }, 'file-1');

      const [callArg] = mockHandleDocumentOperation.mock.calls.at(-1)!;
      expect(callArg.fileName).toBe('original.xlsx');
      expectMessagePosted(postMessageSpy, 'document:opened', 'file-1');
    });

    it('wraps a Blob payload into a File', async () => {
      const blob = new Blob([new Uint8Array([10, 20])], { type: 'text/csv' });

      await openWithPayload({ blob, fileName: 'data.csv' }, 'blob-1');

      const [callArg] = mockHandleDocumentOperation.mock.calls.at(-1)!;
      expect(callArg.fileName).toBe('data.csv');
      expectMessagePosted(postMessageSpy, 'document:opened', 'blob-1');
    });

    it('wraps an ArrayBuffer payload into a File', async () => {
      const buffer = new Uint8Array([7, 8, 9]).buffer;

      await openWithPayload({ buffer, fileName: 'report.docx' }, 'arraybuffer-1');

      const [callArg] = mockHandleDocumentOperation.mock.calls.at(-1)!;
      expect(callArg.fileName).toBe('report.docx');
      expectMessagePosted(postMessageSpy, 'document:opened', 'arraybuffer-1');
    });

    it('wraps a Uint8Array payload (via "bytes" key) into a File', async () => {
      const bytes = new Uint8Array([0xff, 0xfe]);

      await openWithPayload({ bytes, fileName: 'slide.pptx' }, 'uint8-1');

      const [callArg] = mockHandleDocumentOperation.mock.calls.at(-1)!;
      expect(callArg.fileName).toBe('slide.pptx');
      expectMessagePosted(postMessageSpy, 'document:opened', 'uint8-1');
    });

    it('uses default filename "document.xlsx" when no name is supplied', async () => {
      const buffer = new Uint8Array([1]).buffer;

      await openWithPayload({ buffer }, 'default-name-1');

      const [callArg] = mockHandleDocumentOperation.mock.calls.at(-1)!;
      expect(callArg.fileName).toBe('document.xlsx');
    });

    it('posts document:error for an empty payload (no file/blob/buffer/url)', async () => {
      await openWithPayload({}, 'invalid-1');

      expectMessagePosted(postMessageSpy, 'document:error', 'invalid-1', {
        message: expect.stringContaining('document:open requires'),
      });
    });
  });
});
