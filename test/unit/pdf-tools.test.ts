import { afterEach, expect, it, vi } from 'vitest';
import { addPdfCommentTool, getPdfTextTool } from '../../lib/agent-plugin/pdf-tools';
const state = vi.hoisted(() => ({ readonly: false }));
vi.mock('../../lib/onlyoffice/readonly', () => ({ getReadonlyMode: () => state.readonly }));
afterEach(() => {
  document.body.replaceChildren();
  state.readonly = false;
});
function mount() {
  const annotations: Array<{ GetId(): string; GetPage(): number; GetContents(): string }> = [];
  const doc = {
    annots: annotations,
    CancelAction: vi.fn(),
    DoAction: vi.fn((fn: () => unknown) => fn()),
    AddAnnot: vi.fn((annot: any, page: number) => {
      annot.GetPage = () => page;
      annotations.push(annot);
    }),
  };
  const api = {
    isDocumentLoadComplete: true,
    isLoadFullApi: true,
    isPdfEditor: () => true,
    getPDFDoc: () => doc,
    getCurrentPage: () => 0,
    DocumentRenderer: {
      file: {
        pages: [{ text: [] }, { text: [] }],
        copySelection(_page: number, out: { Text: string }) {
          out.Text = 'Budget 120';
        },
      },
    },
  };
  const frame = document.createElement('iframe');
  frame.name = 'frameEditor';
  document.body.append(frame);
  Object.assign(frame.contentWindow!, {
    editor: api,
    Asc: {},
    AscCommon: { CreateGUID: () => 'note-id' },
    AscDFH: { historydescription_Pdf_AddComment: 666 },
    AscPDF: {
      ANNOTATIONS_TYPES: { Text: 0 },
      CreateAnnotByProps: (props: any) => ({ GetId: () => props.name, GetContents: () => props.contents }),
    },
  });
  return { api, doc };
}
it('adds a note to its explicit page even when a different page is current', async () => {
  const { doc } = mount();
  expect(await addPdfCommentTool.execute({ page: 2, text: 'Check dates' })).toMatchObject({
    page: 2,
    text: 'Check dates',
    verified: true,
  });
  expect(doc.annots[0].GetPage()).toBe(1);
});
it('rejects read-only, invalid page and aborted note requests without mutation', async () => {
  const { doc } = mount();
  state.readonly = true;
  await expect(addPdfCommentTool.execute({ page: 1, text: 'Check' })).rejects.toThrow(/read only/);
  state.readonly = false;
  await expect(addPdfCommentTool.execute({ page: 3, text: 'Check' })).rejects.toThrow();
  await expect(addPdfCommentTool.execute({ page: 1, text: 'Check' }, AbortSignal.abort())).rejects.toThrow();
  expect(doc.DoAction).not.toHaveBeenCalled();
  expect(doc.annots).toEqual([]);
});
it('reads bounded PDF text with the exact page scope', async () => {
  mount();
  expect(await getPdfTextTool.execute({ page: 2, maxChars: 6 })).toMatchObject({
    page: 2,
    pages: 2,
    text: 'Budget',
    truncated: true,
    scope: 'pdf-page',
  });
});

it('cancels a native failure inside the callback so the editor can finish the action', async () => {
  const { doc } = mount();
  let finalized = false;
  doc.DoAction.mockImplementation((fn: () => unknown) => {
    const value = fn();
    finalized = true;
    return value;
  });
  doc.AddAnnot.mockImplementation(() => {
    throw new Error('Native add failed');
  });
  await expect(addPdfCommentTool.execute({ page: 1, text: 'Check' })).rejects.toThrow('Native add failed');
  expect(doc.CancelAction).toHaveBeenCalledOnce();
  expect(finalized).toBe(true);
});
