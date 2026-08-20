import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const editor = vi.hoisted(() => ({
  readonly: false,
  requestSaveDocument: vi.fn(),
  setReadonlyMode: vi.fn((v: boolean) => {
    editor.readonly = v;
  }),
  getReadonlyMode: vi.fn(() => editor.readonly),
}));
const documentApi = vi.hoisted(() => ({
  openDocumentFromUrl: vi.fn(async (_url: string, _name?: string, _opts?: { readonly?: boolean }) => {}),
  openLocalFile: vi.fn(async (_file: File) => {}),
  onCreateNew: vi.fn(async (_ext: string) => {}),
}));
const agentTools = vi.hoisted(() => ({
  text: '' as string,
  truncated: false,
}));
const store = vi.hoisted(() => ({ doc: { fileName: '' } as { fileName: string } }));

vi.mock('../../lib/onlyoffice-editor', () => ({
  requestSaveDocument: editor.requestSaveDocument,
  setReadonlyMode: editor.setReadonlyMode,
  getReadonlyMode: editor.getReadonlyMode,
}));
vi.mock('../../lib/document', () => documentApi);
vi.mock('@ranuts/shared/store', () => ({ getDocmentObj: () => store.doc }));
vi.mock('../../lib/agent-plugin/tools', () => ({
  getDocumentTextTool: {
    name: 'get_document_text',
    execute: async () => ({ text: agentTools.text, truncated: agentTools.truncated }),
  },
}));

import {
  buildTools,
  disposeWebMcp,
  findModelContext,
  initWebMcp,
  NEW_DOCUMENT_KINDS,
  OPENABLE_EXTENSIONS,
} from '../../lib/web-mcp';
import { DOCUMENT_TYPE_MAP } from '@ranuts/shared/document-utils';

type Surface = {
  tools: Map<string, any>;
  registerTool: ReturnType<typeof vi.fn>;
  unregisterTool: ReturnType<typeof vi.fn>;
};

function fakeSurface(): Surface {
  const tools = new Map<string, any>();
  return {
    tools,
    registerTool: vi.fn((t: any) => tools.set(t.name, t)),
    unregisterTool: vi.fn((n: string) => tools.delete(n)),
  };
}

const parse = (r: { content: Array<{ text: string }> }) => JSON.parse(r.content[0].text);

describe('WebMCP adapter', () => {
  beforeEach(() => {
    editor.readonly = false;
    store.doc = { fileName: '' };
    agentTools.text = '';
    agentTools.truncated = false;
    delete (document as any).modelContext;
    delete (navigator as any).modelContext;
  });
  afterEach(() => {
    disposeWebMcp();
    vi.clearAllMocks();
  });

  it('is a no-op without a modelContext surface', () => {
    expect(findModelContext()).toBeNull();
    expect(initWebMcp()).toEqual([]);
  });

  it('prefers document.modelContext over the legacy navigator location', () => {
    const onDoc = fakeSurface();
    const onNav = fakeSurface();
    (document as any).modelContext = onDoc;
    (navigator as any).modelContext = onNav;
    expect(findModelContext()).toBe(onDoc);
  });

  it('registers the tool set, once', () => {
    const s = fakeSurface();
    (document as any).modelContext = s;
    const names = initWebMcp();
    expect(names).toEqual([
      'open_document_url',
      'open_document_buffer',
      'create_document',
      'save_document',
      'get_document_text',
      'set_readonly',
      'get_document_state',
    ]);
    expect(s.registerTool).toHaveBeenCalledTimes(names.length);
    expect(initWebMcp()).toEqual(names);
    expect(s.registerTool).toHaveBeenCalledTimes(names.length);
    for (const t of s.tools.values()) {
      expect(t.inputSchema.type).toBe('object');
      expect(typeof t.description).toBe('string');
    }
    disposeWebMcp();
    expect(s.unregisterTool).toHaveBeenCalledTimes(names.length);
  });

  it('falls back to provideContext when registerTool is absent', () => {
    const provideContext = vi.fn();
    (navigator as any).modelContext = { provideContext };
    expect(initWebMcp()).toHaveLength(7);
    expect(provideContext).toHaveBeenCalledWith({ tools: expect.any(Array) });
  });

  it('does not register inside a frame', () => {
    (document as any).modelContext = fakeSurface();
    const fakeWin = { parent: {}, document, navigator } as unknown as Window;
    expect(initWebMcp(fakeWin)).toEqual([]);
  });

  it('get_document_state / set_readonly mirror the editor state', async () => {
    const tools = Object.fromEntries(buildTools().map((t) => [t.name, t]));
    store.doc = { fileName: 'a.docx' };
    expect(parse(await tools.get_document_state.execute({}))).toEqual({
      hasDocument: false,
      fileName: 'a.docx',
      readonly: false,
    });
    expect(parse(await tools.set_readonly.execute({ readonly: true }))).toEqual({ ok: true, readonly: true });
    expect(editor.setReadonlyMode).toHaveBeenCalledWith(true);
  });

  it('open_document_url validates the URL and forwards readonly', async () => {
    const tools = Object.fromEntries(buildTools().map((t) => [t.name, t]));
    const bad = await tools.open_document_url.execute({ url: 'file:///etc/passwd' });
    expect(bad.isError).toBe(true);
    store.doc = { fileName: 'x.xlsx' };
    const good = await tools.open_document_url.execute({ url: 'https://example.com/x.xlsx', readonly: true });
    expect(documentApi.openDocumentFromUrl).toHaveBeenCalledWith('https://example.com/x.xlsx', undefined, {
      readonly: true,
    });
    expect(parse(good)).toMatchObject({ ok: true, fileName: 'x.xlsx' });
  });

  it('open_document_buffer decodes base64 into a File', async () => {
    const tools = Object.fromEntries(buildTools().map((t) => [t.name, t]));
    const r = await tools.open_document_buffer.execute({ fileName: 'n.csv', base64: btoa('a,b\n1,2') });
    expect(parse(r)).toMatchObject({ ok: true, fileName: 'n.csv', size: 7 });
    const file = documentApi.openLocalFile.mock.calls[0][0] as File;
    expect(file.name).toBe('n.csv');
    expect(await file.text()).toBe('a,b\n1,2');
    expect(parse(await tools.open_document_buffer.execute({ fileName: 'noext', base64: 'QQ==' })).ok).toBe(false);
  });

  it('save_document returns JSON-serialisable handles, defaulting to the open format', async () => {
    const tools = Object.fromEntries(buildTools().map((t) => [t.name, t]));
    store.doc = { fileName: 'legacy.doc' };
    editor.requestSaveDocument.mockResolvedValue(new File(['hello'], 'legacy.docx', { type: 'application/x' }));
    const r = parse(await tools.save_document.execute({}));
    expect(editor.requestSaveDocument).toHaveBeenCalledWith('DOCX');
    expect(r).toMatchObject({ ok: true, fileName: 'legacy.docx', size: 5, mimeType: 'application/x' });
    expect(r.blobUrl).toMatch(/^blob:/);
    expect(r.dataUrl).toBe(`data:application/x;base64,${btoa('hello')}`);
    await tools.save_document.execute({ targetExt: 'pdf' });
    expect(editor.requestSaveDocument).toHaveBeenLastCalledWith('PDF');
  });

  it('a throwing handler surfaces as an isError result through the registered wrapper', async () => {
    const s = fakeSurface();
    (document as any).modelContext = s;
    initWebMcp();
    editor.requestSaveDocument.mockRejectedValue(new Error('no editor'));
    const r = await s.tools.get('save_document').execute({});
    expect(r.isError).toBe(true);
    expect(parse(r)).toEqual({ ok: false, error: 'no editor' });
  });

  /**
   * The advertised format list used to be hand-written and had already fallen
   * behind DOCUMENT_TYPE_MAP: an agent was told odt/ods/odp/rtf/txt were not
   * supported while the engine read them. Derived now, and pinned here.
   */
  it('advertises exactly the formats the engine maps, ODF included', () => {
    expect(OPENABLE_EXTENSIONS).toEqual(Object.keys(DOCUMENT_TYPE_MAP).sort());
    for (const ext of ['odt', 'ods', 'odp', 'rtf', 'txt', 'docx', 'pdf']) {
      expect(OPENABLE_EXTENSIONS).toContain(ext);
    }
    const open = buildTools().find((t) => t.name === 'open_document_url')!;
    for (const ext of ['odt', 'ods', 'odp']) expect(open.description).toContain(ext);
  });

  it('create_document maps each kind to an extension and rejects anything else', async () => {
    const create = buildTools().find((t) => t.name === 'create_document')!;
    for (const [kind, ext] of Object.entries(NEW_DOCUMENT_KINDS)) {
      documentApi.onCreateNew.mockClear();
      const r = parse(await create.execute({ kind }));
      expect(r.ok).toBe(true);
      expect(documentApi.onCreateNew).toHaveBeenCalledWith(ext);
    }
    const bad = await create.execute({ kind: 'novel' });
    expect(bad.isError).toBe(true);
    expect(parse(bad).error).toMatch(/kind must be one of/);
  });

  /**
   * An empty answer is ambiguous: an empty document and an editor with no
   * full-text read look identical to a caller. Only the word editor implements
   * one, so the non-word case has to say so rather than let an agent conclude
   * the file is empty.
   */
  it('get_document_text distinguishes an empty document from an unsupported one', async () => {
    const tool = buildTools().find((t) => t.name === 'get_document_text')!;

    store.doc = { fileName: 'report.docx' };
    agentTools.text = 'hello from the document';
    const word = parse(await tool.execute({}));
    expect(word).toMatchObject({ ok: true, text: 'hello from the document', supported: true });

    // Word document that really is empty: still "supported", no misleading note.
    agentTools.text = '';
    const emptyWord = parse(await tool.execute({}));
    expect(emptyWord).toMatchObject({ ok: true, text: '', supported: true });
    expect(emptyWord.note).toBeUndefined();

    // Spreadsheet: the engine exposes no full text, and the answer says so.
    store.doc = { fileName: 'budget.xlsx' };
    const sheet = parse(await tool.execute({}));
    expect(sheet).toMatchObject({ ok: true, text: '', supported: false });
    expect(sheet.note).toMatch(/save_document/);
  });
});
