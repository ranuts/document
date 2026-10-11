import { afterEach, describe, expect, it, vi } from 'vitest';

const excelCellText = vi.hoisted(() => vi.fn(async (_cell: string, _text: string, _signal?: AbortSignal) => {}));
const excelCellValue = vi.hoisted(() => vi.fn(async (_cell: string, _text: string, _signal?: AbortSignal) => {}));
vi.mock('../../lib/agent-plugin/excel-cell-write', () => ({
  writeExcelCellText: excelCellText,
  writeExcelCellValue: excelCellValue,
}));

// Mock the bridge so tool tests don't depend on a live editor iframe.
const pasteHtml = vi.fn();
const wordPaste = vi.fn(
  async (api: { pluginMethod_PasteHtml(html: string): void }, html: string, signal?: AbortSignal) => {
    signal?.throwIfAborted();
    api.pluginMethod_PasteHtml(html);
  },
);
vi.mock('../../lib/agent-plugin/word-paste', () => ({
  pasteWordHtml: (...args: Parameters<typeof wordPaste>) => wordPaste(...args),
}));
const getSelectedText = vi.fn(() => 'line1\r\nline2');
const getSelectionType = vi.fn(() => 'text');
const replaceTextSmart = vi.fn();
const setTrackRevisions = vi.fn();
const setGlobalTrackRevisions = vi.fn();
const setLocalTrackRevisions = vi.fn();
const isTrackRevisions = vi.fn(() => true);
const editSelectAll = vi.fn();
const removeSelection = vi.fn();
const addComment = vi.fn();
const pasteText = vi.fn();
const findCell = vi.fn();
const getCellInfo = vi.fn(() => ({ asc_getText: () => 'cellValue' }));
const makeApi = () => ({
  WordControl: {
    m_oLogicDocument: { IsSelectionLocked: () => false, GetText: () => getSelectedText() } as Record<string, unknown>,
  },
  isDocumentLoadComplete: true,
  isLoadFullApi: true,
  asc_SetGlobalTrackRevisions: setGlobalTrackRevisions,
  asc_GetGlobalTrackRevisions: isTrackRevisions,
  asc_SetLocalTrackRevisions: setLocalTrackRevisions,
  pluginMethod_PasteHtml: pasteHtml,
  pluginMethod_PasteText: pasteText,
  pluginMethod_GetSelectedText: getSelectedText,
  pluginMethod_GetSelectionType: getSelectionType,
  pluginMethod_ReplaceTextSmart: replaceTextSmart,
  asc_SetTrackRevisions: setTrackRevisions,
  asc_IsTrackRevisions: isTrackRevisions,
  asc_EditSelectAll: editSelectAll,
  asc_RemoveSelection: removeSelection,
  asc_addComment: addComment,
  asc_findCell: findCell,
  asc_getCellInfo: getCellInfo,
});
// Comment-data object built by the editor frame's Asc namespace.
const putText = vi.fn();
const putUserName = vi.fn();
const commentData = { asc_putText: putText, asc_putUserName: putUserName, asc_putUserId: vi.fn() };
// Must be a regular function (not arrow) so it works with `new`.
const makeAsc = () => ({
  asc_CCommentDataWord: vi.fn(function () {
    return commentData;
  }),
});
const requireEditorApi = vi.fn(makeApi);
const requireEditorContext = vi.fn(() => ({
  api: makeApi(),
  Asc: makeAsc(),
  AscCommon: { changestype_Document_Settings: 42 },
}));
vi.mock('../../lib/agent-plugin/editor-bridge', () => ({
  requireEditorApi: () => requireEditorApi(),
  requireEditorContext: () => requireEditorContext(),
  EditorNotReadyError: class EditorNotReadyError extends Error {},
}));

import {
  addCommentTool,
  agentTools,
  getCellTool,
  getDocumentTextTool,
  getPresentationTextTool,
  getSelectionTool,
  insertTextTool,
  replaceSelectionTool,
  setCellTool,
  setReviewModeTool,
  textToHtml,
} from '../../lib/agent-plugin/tools';

describe('agent tools', () => {
  it('reads native presentation Unicode, tabs and soft breaks without lossy SDK text conversion', async () => {
    const content = {
      GetText: () => 'Alex \uf600 Payment\rNext\r\n',
      Content: [
        {
          Content: [
            {
              Type: 39,
              Content: [
                ...[...'Alex 😀'].map((c) => ({ Type: 1, GetCodePoint: () => c.codePointAt(0)! })),
                { Type: 21 },
                ...[...'Payment'].map((c) => ({ Type: 1, GetCodePoint: () => c.codePointAt(0)! })),
                { Type: 16 },
                ...[...'Next'].map((c) => ({ Type: 1, GetCodePoint: () => c.codePointAt(0)! })),
                { Type: 4 },
              ],
            },
          ],
        },
      ],
    };
    requireEditorApi.mockImplementation(() => ({
      ...makeApi(),
      WordControl: {
        m_oLogicDocument: {
          Slides: [{ cSld: { spTree: [{ getDocContent: () => content }] } }],
        },
      },
    }));
    await expect(getPresentationTextTool.execute({})).resolves.toEqual({
      text: 'Slide 1:\nAlex 😀\tPayment\nNext',
      truncated: false,
    });
    expect(editSelectAll).not.toHaveBeenCalled();
  });
  it('reads multiline presentation content when selected-text getter returns undefined', async () => {
    const api = {
      ...makeApi(),
      WordControl: {
        m_oLogicDocument: {
          Slides: [
            {
              cSld: {
                spTree: [
                  { getText: () => undefined, getDocContent: () => ({ GetText: () => '第一行\r\nSecond line\r\n' }) },
                ],
              },
            },
          ],
        },
      },
    };
    requireEditorApi.mockImplementation(() => api);
    await expect(getPresentationTextTool.execute({})).resolves.toEqual({
      text: 'Slide 1:\n第一行\nSecond line',
      truncated: false,
    });
  });
  it('reads presentation shape and group text without moving selection', async () => {
    const api = {
      ...makeApi(),
      WordControl: {
        m_oLogicDocument: {
          Slides: [{ cSld: { spTree: [{ getText: () => 'Title\r\n' }, { spTree: [{ getText: () => 'Body' }] }] } }],
        },
      },
    };
    requireEditorApi.mockImplementation(() => api);
    const result = await getPresentationTextTool.execute({});
    expect(result.text).toBe('Slide 1:\nTitle\nBody');
    expect(editSelectAll).not.toHaveBeenCalled();
    await expect(getDocumentTextTool.execute({})).rejects.toThrow(/presentation/i);
    expect((await getPresentationTextTool.execute({ maxChars: 8 })).truncated).toBe(true);
    await expect(getPresentationTextTool.execute({ maxChars: -1 })).rejects.toThrow();
  });
  afterEach(() => {
    vi.clearAllMocks();
    wordPaste.mockImplementation(async (api, html, signal) => {
      signal?.throwIfAborted();
      api.pluginMethod_PasteHtml(html);
    });
    getSelectedText.mockReturnValue('line1\r\nline2');
    getSelectionType.mockReturnValue('text');
    isTrackRevisions.mockReturnValue(true);
    requireEditorApi.mockImplementation(makeApi);
    requireEditorContext.mockImplementation(() => ({
      api: makeApi(),
      Asc: makeAsc(),
      AscCommon: { changestype_Document_Settings: 42 },
    }));
  });

  describe('textToHtml', () => {
    it('escapes HTML-significant characters', () => {
      expect(textToHtml('a & b < c > d')).toBe('a &amp; b &lt; c &gt; d');
    });

    it('converts all newline styles to <br />', () => {
      expect(textToHtml('a\nb\r\nc\rd')).toBe('a<br />b<br />c<br />d');
    });

    it('escapes before converting so injected markup cannot survive', () => {
      expect(textToHtml('<script>')).toBe('&lt;script&gt;');
    });
    it('preserves significant whitespace for the SDK HTML paste parser', () => {
      expect(textToHtml('A  B  \nC')).toBe('<span style="white-space: pre-wrap">A  B  <br />C</span>');
      expect(textToHtml('  <script>\t')).toBe('<span style="white-space: pre-wrap">  &lt;script&gt;\t</span>');
      expect(textToHtml('A\n B')).toBe('<span style="white-space: pre-wrap">A<br /> B</span>');
    });
  });

  describe('insert_text tool', () => {
    it('is registered in the agentTools map and marked as a write tool', () => {
      expect(agentTools.insert_text).toBe(insertTextTool);
      expect(insertTextTool.readOnlyHint).toBe(false);
      expect(insertTextTool.inputSchema).toMatchObject({ required: ['text'] });
    });

    it('inserts escaped HTML via pluginMethod_PasteHtml and reports the length', async () => {
      const result = await insertTextTool.execute({ text: 'Hello <world>' });
      expect(pasteHtml).toHaveBeenCalledTimes(1);
      expect(pasteHtml).toHaveBeenCalledWith('Hello &lt;world&gt;');
      expect(result).toEqual({ inserted: true, length: 'Hello <world>'.length });
    });

    it('throws a TypeError for non-string input', async () => {
      // @ts-expect-error intentionally wrong type
      await expect(insertTextTool.execute({ text: 42 })).rejects.toThrow(TypeError);
      expect(pasteHtml).not.toHaveBeenCalled();
    });

    it('propagates the error when the editor is not ready', async () => {
      requireEditorApi.mockImplementation(() => {
        throw new Error('OnlyOffice editor is not ready');
      });
      await expect(insertTextTool.execute({ text: 'x' })).rejects.toThrow('not ready');
      expect(pasteHtml).not.toHaveBeenCalled();
    });
  });

  describe('get_selection tool', () => {
    it('is read-only and registered', () => {
      expect(agentTools.get_selection).toBe(getSelectionTool);
      expect(getSelectionTool.readOnlyHint).toBe(true);
    });

    it('returns the selection type and CRLF-normalised text', async () => {
      const result = await getSelectionTool.execute({});
      expect(result).toEqual({ type: 'text', text: 'line1\nline2' });
      expect(getSelectionType).toHaveBeenCalledTimes(1);
      expect(getSelectedText).toHaveBeenCalledTimes(1);
    });

    it('reports type "none" with empty text when nothing is selected', async () => {
      getSelectionType.mockReturnValue('none');
      getSelectedText.mockReturnValue('');
      expect(await getSelectionTool.execute({})).toEqual({ type: 'none', text: '' });
    });
  });

  describe('replace_selection tool', () => {
    it('is a write tool and registered', () => {
      expect(agentTools.replace_selection).toBe(replaceSelectionTool);
      expect(replaceSelectionTool.readOnlyHint).toBe(false);
    });

    it('replaces selected multiline text through the supported native HTML paste', async () => {
      const result = await replaceSelectionTool.execute({ text: 'first\nsecond' });
      expect(pasteHtml).toHaveBeenCalledWith('first<br />second');
      expect(replaceTextSmart).not.toHaveBeenCalled();
      expect(result).toEqual({ replaced: true, length: 'first\nsecond'.length });
    });

    it('escapes markup in exact replacement text', async () => {
      await replaceSelectionTool.execute({ text: '<b>Alex & Co</b>' });
      expect(pasteHtml).toHaveBeenCalledWith('&lt;b&gt;Alex &amp; Co&lt;/b&gt;');
    });

    it('rejects empty replacement rather than claiming a deletion occurred', async () => {
      await expect(replaceSelectionTool.execute({ text: '' })).rejects.toThrow(TypeError);
      expect(pasteHtml).not.toHaveBeenCalled();
    });

    it('does not insert replacement text when there is no selection', async () => {
      getSelectedText.mockReturnValue('');
      await expect(replaceSelectionTool.execute({ text: 'replacement' })).rejects.toThrow('No text selection');
      expect(pasteHtml).not.toHaveBeenCalled();
      expect(replaceTextSmart).not.toHaveBeenCalled();
    });

    it('allows a whitespace selection and preserves replacement spacing', async () => {
      getSelectedText.mockReturnValue(' ');
      await replaceSelectionTool.execute({ text: '  Alex  ' });
      expect(pasteHtml).toHaveBeenCalledWith('<span style="white-space: pre-wrap">  Alex  </span>');
    });

    it('throws a TypeError for non-string input', async () => {
      // @ts-expect-error intentionally wrong type
      await expect(replaceSelectionTool.execute({ text: null })).rejects.toThrow(TypeError);
      expect(replaceTextSmart).not.toHaveBeenCalled();
    });
  });

  describe('set_review_mode tool', () => {
    it('is registered', () => {
      expect(agentTools.set_review_mode).toBe(setReviewModeTool);
    });

    it('enables track-changes and returns the resulting state', async () => {
      isTrackRevisions.mockReturnValue(true);
      const result = await setReviewModeTool.execute({ enabled: true });
      expect(setGlobalTrackRevisions).toHaveBeenCalledWith(true);
      expect(setLocalTrackRevisions).toHaveBeenCalledWith(null);
      expect(result).toEqual({ enabled: true });
    });

    it('disables track-changes', async () => {
      isTrackRevisions.mockReturnValue(false);
      const result = await setReviewModeTool.execute({ enabled: false });
      expect(setGlobalTrackRevisions).toHaveBeenCalledWith(false);
      expect(result).toEqual({ enabled: false });
    });

    it('throws a TypeError when enabled is not a boolean', async () => {
      // @ts-expect-error intentionally wrong type
      await expect(setReviewModeTool.execute({ enabled: 'yes' })).rejects.toThrow(TypeError);
      expect(setTrackRevisions).not.toHaveBeenCalled();
    });
  });

  describe('get_document_text tool', () => {
    it('is read-only and registered', () => {
      expect(agentTools.get_document_text).toBe(getDocumentTextTool);
      expect(getDocumentTextTool.readOnlyHint).toBe(true);
    });

    it('reads CRLF-normalised body text without changing selection', async () => {
      getSelectedText.mockReturnValue('Alpha.\r\nBeta.');
      const result = await getDocumentTextTool.execute({});
      expect(editSelectAll).not.toHaveBeenCalled();
      expect(removeSelection).not.toHaveBeenCalled();
      expect(result).toEqual({ text: 'Alpha.\nBeta.', truncated: false });
    });

    it('truncates to maxChars and flags it', async () => {
      getSelectedText.mockReturnValue('abcdefghij');
      const result = await getDocumentTextTool.execute({ maxChars: 4 });
      expect(result).toEqual({ text: 'abcd', truncated: true });
    });

    it('defaults maxChars when called with empty params', async () => {
      getSelectedText.mockReturnValue('short');
      const result = await getDocumentTextTool.execute({});
      expect(result).toEqual({ text: 'short', truncated: false });
    });
  });

  describe('add_comment tool', () => {
    it('is a write tool and registered', () => {
      expect(agentTools.add_comment).toBe(addCommentTool);
      expect(addCommentTool.readOnlyHint).toBe(false);
    });

    it('builds a comment data object and adds it with the given author', async () => {
      const result = await addCommentTool.execute({ text: 'Consider rephrasing', author: 'Reviewer' });
      expect(putText).toHaveBeenCalledWith('Consider rephrasing');
      expect(putUserName).toHaveBeenCalledWith('Reviewer');
      expect(addComment).toHaveBeenCalledWith(commentData);
      expect(result).toEqual({ added: true });
    });

    it('defaults the author to "Agent"', async () => {
      await addCommentTool.execute({ text: 'note' });
      expect(putUserName).toHaveBeenCalledWith('Agent');
    });

    it('throws a TypeError for non-string text', async () => {
      // @ts-expect-error intentionally wrong type
      await expect(addCommentTool.execute({ text: 123 })).rejects.toThrow(TypeError);
      expect(addComment).not.toHaveBeenCalled();
    });
  });

  describe('set_cell tool (spreadsheet)', () => {
    it('is registered as a write tool', () => {
      expect(agentTools.set_cell).toBe(setCellTool);
      expect(setCellTool.readOnlyHint).toBe(false);
    });

    it('uses the native literal-text writer for explicit text and forwards Stop', async () => {
      const abort = new AbortController();
      await setCellTool.execute({ cell: 'B2', value: '00123', valueType: 'text' }, abort.signal);
      expect(excelCellText).toHaveBeenCalledWith('B2', '00123', abort.signal);
      expect(pasteText).not.toHaveBeenCalled();
    });

    it('uses the protected native writer for default auto values and forwards Stop', async () => {
      const abort = new AbortController();
      const result = await setCellTool.execute({ cell: 'B2', value: 'Revenue' }, abort.signal);
      expect(excelCellValue).toHaveBeenCalledWith('B2', 'Revenue', abort.signal);
      expect(pasteText).not.toHaveBeenCalled();
      expect(result).toEqual({ cell: 'B2', value: 'Revenue' });
    });

    it('errors when the editor is not a spreadsheet (no asc_findCell)', async () => {
      excelCellValue.mockRejectedValueOnce(new Error('officeSpreadsheetOnly'));
      await expect(setCellTool.execute({ cell: 'A1', value: 'x' })).rejects.toThrow('officeSpreadsheetOnly');
    });

    it('throws a TypeError for non-string params', async () => {
      // @ts-expect-error intentionally wrong type
      await expect(setCellTool.execute({ cell: 'A1', value: 5 })).rejects.toThrow(TypeError);
    });
  });

  describe('get_cell tool (spreadsheet)', () => {
    it('is registered as a read tool', () => {
      expect(agentTools.get_cell).toBe(getCellTool);
      expect(getCellTool.readOnlyHint).toBe(true);
    });

    it('reads an explicit cell without moving the current selection', async () => {
      const getRange3 = vi.fn(() => ({ getValue: () => 'cellValue' }));
      requireEditorApi.mockReturnValueOnce({
        ...makeApi(),
        wb: { getWorksheet: () => ({ model: { getRange3 } }) },
      } as ReturnType<typeof makeApi>);
      const result = await getCellTool.execute({ cell: 'C3' });
      expect(findCell).not.toHaveBeenCalled();
      expect(getRange3).toHaveBeenCalledWith(2, 2, 2, 2);
      expect(result).toEqual({ cell: 'C3', text: 'cellValue' });
    });

    it('errors when the editor is not a spreadsheet', async () => {
      requireEditorApi.mockImplementationOnce(() => ({}) as ReturnType<typeof makeApi>);
      await expect(getCellTool.execute({ cell: 'A1' })).rejects.toThrow('spreadsheet');
    });
  });

  describe('get_document_text robustness', () => {
    it('reports an unavailable reader without selecting all or clearing the caret', async () => {
      requireEditorApi.mockImplementationOnce(
        () =>
          ({
            asc_EditSelectAll: editSelectAll,
            pluginMethod_GetSelectedText: () => 'a\tb',
            // no asc_RemoveSelection
          }) as unknown as ReturnType<typeof makeApi>,
      );
      await expect(getDocumentTextTool.execute({})).rejects.toThrow('unavailable');
      expect(editSelectAll).not.toHaveBeenCalled();
      expect(removeSelection).not.toHaveBeenCalled();
    });
  });
});

it.each([insertTextTool, replaceSelectionTool])(
  'forwards cancellation and awaits native completion for $name',
  async (tool) => {
    const abort = new AbortController();
    let finish!: () => void;
    wordPaste.mockImplementation(
      (_api, _html, signal) =>
        new Promise<void>((resolve, reject) => {
          finish = resolve;
          signal?.addEventListener('abort', () => reject(signal.reason), { once: true });
        }),
    );
    let completed = false;
    const result = tool.execute({ text: 'Exact <literal>' }, abort.signal).then((value) => {
      completed = true;
      return value;
    });
    const rejection = expect(result).rejects.toThrow('Stopped');
    await Promise.resolve();
    expect(wordPaste.mock.calls.at(-1)?.[2]).toBe(abort.signal);
    expect(completed).toBe(false);
    abort.abort(new DOMException('Stopped', 'AbortError'));
    await rejection;
    finish();
    expect(completed).toBe(false);
  },
);
