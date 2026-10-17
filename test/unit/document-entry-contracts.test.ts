import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const native = vi.hoisted(() => ({
  convert: vi.fn(async (_options: unknown) => {}),
  remember: vi.fn(async () => true),
  readonly: vi.fn(),
  start: vi.fn(),
  decode: vi.fn(async () => new File(['desktop'], 'Desktop.docx')),
}));
vi.mock('../../lib/converter', () => ({
  handleDocumentOperation: native.convert,
  loadEditorApi: async () => {},
}));
vi.mock('../../lib/history/session', () => ({ startDocumentSession: native.start, newDocumentId: () => 'local-id' }));
vi.mock('../../lib/history/autosave', () => ({ stopAutosaveSession: vi.fn(), clearDocumentSession: vi.fn() }));
vi.mock('../../lib/active-document-source', () => ({
  rememberActiveSource: native.remember,
  clearActiveSource: async () => {},
}));
vi.mock('../../lib/onlyoffice-editor', () => ({
  getReadonlyMode: () => false,
  setReadonlyMode: native.readonly,
  requestSaveDocument: vi.fn(),
}));
vi.mock('../../lib/agent-plugin/tools', () => ({ getDocumentTextTool: {} }));
vi.mock('ranuts/utils', async (original) => ({
  ...(await original<typeof import('ranuts/utils')>()),
  MessageCodec: { decodeFileChunked: native.decode },
}));
import { onCreateNew, onOpenDocument, openDocumentFromUrl, openLocalFile } from '../../lib/document';
import { initWebMcp, disposeWebMcp, type WebMcpTool } from '../../lib/web-mcp';
import { events } from '../../lib/events';
import { initEmbedApi } from '../../lib/embed-api';

const chunk = { chunkIndex: 0, data: '', lastModified: 0, name: 'Desktop.docx', size: 7, totalChunks: 1, type: '' };
const held = new Map<string, Blob | MediaSource>();
let listeners: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  native.convert.mockReset().mockResolvedValue(undefined);
  native.remember.mockReset().mockResolvedValue(true);
  native.start.mockClear();
  native.readonly.mockClear();
  held.clear();
  let sequence = 0;
  vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
    const url = `blob:source-${++sequence}`;
    held.set(url, blob);
    return url;
  });
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation((url) => {
    held.delete(url);
  });
  vi.spyOn(console, 'error').mockImplementation(() => {});
  listeners = vi.spyOn(window, 'addEventListener');
  history.replaceState(null, '', '/editor');
});
afterEach(() => {
  disposeWebMcp();
  delete (document as Document & { modelContext?: unknown }).modelContext;
  for (const [type, listener, options] of listeners.mock.calls) window.removeEventListener(type, listener, options);
  document.body.classList.remove('embed-mode');
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function registeredBufferTool(): WebMcpTool {
  const tools = new Map<string, WebMcpTool>();
  Object.assign(document, {
    modelContext: { registerTool: (tool: WebMcpTool) => tools.set(tool.name, tool), unregisterTool: vi.fn() },
  });
  initWebMcp();
  return tools.get('open_document_buffer')!;
}

describe('local open outcome ownership', () => {
  it('rejects a failed native open so its caller cannot report success', async () => {
    native.convert.mockRejectedValueOnce(new Error('conversion failed'));
    await expect(openLocalFile(new File(['broken'], 'Broken.docx'))).rejects.toThrow('conversion failed');
    expect(native.start).not.toHaveBeenCalled();
  });

  it('reports a registered buffer tool failure without changing the old editor readonly state', async () => {
    native.convert.mockRejectedValueOnce(new Error('conversion failed'));
    const result = await registeredBufferTool().execute({
      fileName: 'Broken.docx',
      base64: btoa('broken'),
      readonly: true,
    });
    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content[0].text)).toMatchObject({ ok: false, error: 'conversion failed' });
    expect(native.readonly).not.toHaveBeenCalled();
  });

  it('applies buffer readonly as part of the owned open rather than a later global mutation', async () => {
    const result = await registeredBufferTool().execute({
      fileName: 'Read.docx',
      base64: btoa('read'),
      readonly: true,
    });
    expect(result.isError).not.toBe(true);
    expect(native.convert).toHaveBeenCalledWith(expect.objectContaining({ readonly: true }));
    expect(native.readonly).not.toHaveBeenCalled();
  });

  it('reports a superseded tool open as cancelled after a replacement commits', async () => {
    let finish!: (saved: boolean) => void;
    native.remember.mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)));
    const result = registeredBufferTool().execute({ fileName: 'Old.docx', base64: btoa('old'), readonly: true });
    await vi.waitFor(() => expect(native.remember).toHaveBeenCalled());
    await onCreateNew('.xlsx');
    finish(true);
    expect((await result).isError).toBe(true);
    expect(native.readonly).not.toHaveBeenCalled();
    expect(native.start).toHaveBeenCalledWith(expect.objectContaining({ title: 'Untitled.xlsx' }));
  });

  it('consumes an already-reported file picker failure at the event boundary', async () => {
    native.convert.mockRejectedValueOnce(new Error('picker conversion failed'));
    onOpenDocument();
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, 'files', { configurable: true, value: [new File(['broken'], 'Broken.docx')] });
    input.dispatchEvent(new Event('change'));
    await vi.waitFor(() => expect(native.convert).toHaveBeenCalled());
    await vi.waitFor(() => expect(input.value).toBe(''));
  });
});

describe('original document Blob ownership', () => {
  it('leaves no original-file URLs behind across local opens and a blank replacement', async () => {
    for (let i = 0; i < 3; i++) await openLocalFile(new File([`original-${i}`], `${i}.docx`));
    await onCreateNew('.docx');
    expect(held.size).toBe(0);
  });

  it('leaves no original URL behind after a remote or desktop replacement', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('remote')),
    );
    await openDocumentFromUrl('https://files.example/Remote.docx');
    await events.RENDER_OFFICE(chunk);
    events.CLOSE_EDITOR(undefined);
    expect(held.size).toBe(0);
  });

  it('hands embedded bytes to the editor without retaining an extra source URL', async () => {
    history.replaceState(null, '', '/editor?embed=1');
    const posted = vi.spyOn(window.parent, 'postMessage');
    initEmbedApi();
    window.dispatchEvent(
      new MessageEvent('message', {
        source: window.parent,
        origin: 'https://host.example',
        data: { id: 'source-url', type: 'document:open-file', payload: { file: new File(['host'], 'Host.docx') } },
      }),
    );
    await vi.waitFor(() =>
      expect(posted).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'source-url', type: 'document:opened' }),
        'https://host.example',
      ),
    );
    expect(held.size).toBe(0);
  });
});
