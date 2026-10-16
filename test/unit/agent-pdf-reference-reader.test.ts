import { beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
  pages: 1,
  pending: undefined as Promise<any> | undefined,
  started: vi.fn(),
  items: [{ str: 'PDF text', hasEOL: true }],
  destroy: vi.fn(async () => {}),
  cleanup: vi.fn(),
  terminate: vi.fn(),
}));
vi.mock('pdfjs-dist', () => ({
  PDFWorker: class {
    destroy = vi.fn();
  },
  getDocument: () => {
    state.started();
    return {
      destroy: state.destroy,
      promise:
        state.pending ??
        Promise.resolve({
          numPages: state.pages,
          getPage: async () => ({
            cleanup: state.cleanup,
            streamTextContent: () =>
              new ReadableStream({
                start(c) {
                  c.enqueue({ items: state.items });
                  c.close();
                },
              }),
          }),
        }),
    };
  },
}));
import { readPdfReference } from '../../lib/agent-plugin/connectors/pdf-reference-reader';
beforeEach(() => {
  state.pending = undefined;
  state.pages = 1;
  state.items = [{ str: 'PDF text', hasEOL: true }];
  vi.clearAllMocks();
  vi.stubGlobal(
    'Worker',
    class {
      terminate = state.terminate;
    },
  );
});
it('extracts streamed text and releases parser and worker', async () => {
  expect(await readPdfReference(new Uint8Array([1]))).toBe('PDF text');
  expect(state.destroy).toHaveBeenCalled();
  expect(state.terminate).toHaveBeenCalled();
  expect(state.cleanup).toHaveBeenCalled();
});
it('rejects page and UTF8 text limits, and explains scanned documents', async () => {
  state.pages = 101;
  await expect(readPdfReference(new Uint8Array())).rejects.toThrow('source-too-large');
  state.pages = 1;
  state.items = [{ str: '字'.repeat(100000), hasEOL: false }];
  await expect(readPdfReference(new Uint8Array())).rejects.toThrow('source-too-large');
  state.items = [];
  await expect(readPdfReference(new Uint8Array())).rejects.toThrow('source-empty');
});
it('never creates worker for an already canceled read', async () => {
  const controller = new AbortController();
  controller.abort();
  await expect(readPdfReference(new Uint8Array(), controller.signal)).rejects.toThrow();
  expect(state.destroy).not.toHaveBeenCalled();
});
it('terminates an active parser on abort without waiting for its late completion', async () => {
  let resolve!: (value: any) => void;
  state.pending = new Promise((done) => (resolve = done));
  const controller = new AbortController();
  const pending = readPdfReference(new Uint8Array(), controller.signal);
  await vi.waitFor(() => expect(state.started).toHaveBeenCalled());
  controller.abort();
  await expect(pending).rejects.toThrow();
  expect(state.terminate).toHaveBeenCalled();
  expect(state.destroy).toHaveBeenCalled();
  resolve({ numPages: 1, getPage: vi.fn() });
  await Promise.resolve();
  expect(state.cleanup).not.toHaveBeenCalled();
});
