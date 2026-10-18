import { bindCompletedPaste } from './completed-paste';
import { getPdfTextTool, addPdfCommentTool } from './pdf-tools';
import { setDocumentReviewMode } from './review-mode';
import { fillSeriesTool } from './fill-series';
import { clearDocumentTool } from './clear-document';
import { readWordBodyText } from './word-text-read';
import { writeExcelCellText, writeExcelCellValue } from './excel-cell-write';
import { pasteWordHtml } from './word-paste';
import { addSlideTextTool, replaceSlideText } from './office-tools';
/**
 * Agent tool definitions. Each tool wraps a verified editor capability
 * (see editor-bridge.ts) behind a typed `execute` + JSON Schema.
 *
 * All over editor methods verified live against the v7.5 SDK (Word/Excel/PPT):
 * insert_text, get_selection, replace_selection, set_review_mode,
 * get_document_text, add_comment, plus spreadsheet-only set_cell / get_cell.
 */
import { textToHtml, wordContent } from './word-content';
export { textToHtml } from './word-content';
import { requireEditorApi, requireEditorContext } from './editor-bridge';
import type { AgentTool } from '@ranuts/agent-core/types';
import { fitTextResult, minimumTextResult } from '@ranuts/agent-core/runtime';
import { createSlideTool } from './presentation-content';
import { setBoldTool, setParagraphAlignmentTool } from './formatting-tools';
import { readPresentationShapeText } from './slide-text-read';
import {
  getRangesTool,
  getRangeTool,
  sumRangeTool,
  sortRangeTool,
  slideActionTool,
  parseOfficeRange,
} from './office-tools';

export interface InsertTextParams {
  /** The plain text to insert at the cursor. */
  text: string;
  /** Explicit formatting for document artifacts; literal text remains the default. */
  format?: 'plain' | 'markdown';
}

export const insertTextTool: AgentTool<InsertTextParams, { inserted: true; length: number }> = {
  name: 'insert_text',
  description:
    'Word only. Insert text at the current cursor position. Default format plain preserves literals. ' +
    'Use format markdown for an explicitly formatted artifact with headings, lists and emphasis. ' +
    'Newlines are preserved as line breaks. Replaces the current selection if any text is selected.',
  inputSchema: {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'Document content to insert at the cursor.' },
      format: { type: 'string', enum: ['plain', 'markdown'] },
    },
    required: ['text'],
    additionalProperties: false,
  },
  readOnlyHint: false,
  execute: async ({ text, format }, signal) => {
    if (typeof text !== 'string') {
      throw new TypeError('insert_text requires a string "text" parameter');
    }
    const api = requireEditorApi();
    const receipt = await pasteWordHtml(api, wordContent(text, format).html, signal);
    return bindCompletedPaste({ inserted: true as const, length: text.length }, receipt);
  },
};

export const getSelectionTool: AgentTool<Record<string, never>, { type: string; text: string }> = {
  name: 'get_selection',
  description:
    'Read the current selection in the document. Returns the selection type ' +
    '("none" when nothing is selected) and the selected plain text.',
  inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  readOnlyHint: true,
  execute: async () => {
    const api = requireEditorApi();
    const type = api.pluginMethod_GetSelectionType();
    // The SDK returns CRLF-separated text; normalise to \n for the model.
    const text = api.pluginMethod_GetSelectedText({ TabSymbol: '\t', Numbering: false }).replace(/\r\n/g, '\n');
    return { type, text };
  },
};

export interface ReplaceSelectionParams {
  /** The replacement text. Newlines are sent as separate lines to the editor. */
  text: string;
}

export const replaceSelectionTool: AgentTool<
  ReplaceSelectionParams,
  { replaced: true; length: number; verified?: true }
> = {
  name: 'replace_selection',
  description:
    'Replace the currently selected text with nonempty plain text. Requires a nonempty text selection. ' +
    'Available in Word and PPT. Newlines and spacing are preserved. In Word review mode the change ' +
    'is recorded as a tracked revision.',
  inputSchema: {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'The replacement text.' },
    },
    required: ['text'],
    additionalProperties: false,
  },
  readOnlyHint: false,
  execute: async ({ text }, signal) => {
    if (typeof text !== 'string' || !text.length) {
      throw new TypeError('replace_selection requires a nonempty string "text" parameter');
    }
    const api = requireEditorApi();
    const slides = (api.WordControl as { m_oLogicDocument?: { Slides?: unknown[] } } | undefined)?.m_oLogicDocument
      ?.Slides;
    if (slides) {
      await replaceSlideText(text, signal);
      return { replaced: true, length: text.length, verified: true };
    }
    if (!api.pluginMethod_GetSelectedText({ TabSymbol: '\t', Numbering: false }).length)
      throw new Error('No text selection');
    // The bundled plugin wrapper calls an absent native ReplaceTextSmart method.
    // Native HTML paste replaces the current selection and retains normal Undo.
    const receipt = await pasteWordHtml(api, textToHtml(text), signal);
    return bindCompletedPaste({ replaced: true as const, length: text.length }, receipt);
  },
};

export interface SetReviewModeParams {
  /** True to turn track-changes on, false to turn it off. */
  enabled: boolean;
}

export const setReviewModeTool: AgentTool<SetReviewModeParams, { enabled: boolean }> = {
  name: 'set_review_mode',
  description:
    "Word documents only. Turn the document's track-changes (review) mode on or " +
    'off. When on, every edit is recorded as a revision the user can accept or ' +
    'reject. Not available in spreadsheets or presentations.',
  inputSchema: {
    type: 'object',
    properties: {
      enabled: { type: 'boolean', description: 'True to enable review mode, false to disable.' },
    },
    required: ['enabled'],
    additionalProperties: false,
  },
  readOnlyHint: false,
  execute: async ({ enabled }) => {
    if (typeof enabled !== 'boolean') {
      throw new TypeError('set_review_mode requires a boolean "enabled" parameter');
    }
    return { enabled: setDocumentReviewMode(enabled) };
  },
};

export interface GetDocumentTextParams {
  /** Maximum characters to return (default 8000). Long documents are truncated. */
  maxChars?: number;
}

const DEFAULT_MAX_CHARS = 8000;

export const getDocumentTextTool: AgentTool<GetDocumentTextParams, { text: string; truncated: boolean }> = {
  name: 'get_document_text',
  fitResult: { minimum: minimumTextResult, fit: fitTextResult },
  description:
    'Read source text from the current Word document so the application can answer factual questions about it. ' +
    'Use this when a question refers to the open document, including when no text is selected. ' +
    'This tool returns text, not a final answer; the application answers from the result. ' +
    'Reading does not modify the document or move the caret. Main body only; long text is truncated ' +
    'and unsupported structures are reported as unavailable.',
  inputSchema: {
    type: 'object',
    properties: {
      maxChars: { type: 'number', description: 'Maximum characters to return (default 8000).' },
    },
    additionalProperties: false,
  },
  readOnlyHint: true,
  execute: async ({ maxChars = DEFAULT_MAX_CHARS } = {}) => {
    if (!Number.isInteger(maxChars) || maxChars < 1 || maxChars > 32000) throw new Error('Invalid maximum text length');
    const api = requireEditorApi();
    if ((api.WordControl as { m_oLogicDocument?: { Slides?: unknown[] } } | undefined)?.m_oLogicDocument?.Slides)
      throw new Error('Use get_presentation_text to read presentation shape text');
    const body = readWordBodyText((api.WordControl as { m_oLogicDocument?: unknown } | undefined)?.m_oLogicDocument);
    if (body === undefined) throw new Error('Current document text is unavailable without changing selection');
    const text = body.replace(/\r\n?/g, '\n');
    return { text: text.slice(0, maxChars), truncated: text.length > maxChars };
  },
};

interface PresentationShape {
  getDocContent?(): { GetText(options: Record<string, never>): string };
  getText?(): string;
  spTree?: PresentationShape[];
}
export const getPresentationTextTool: AgentTool<
  GetDocumentTextParams,
  { text: string; truncated: boolean; slidesRead: number; totalSlides: number }
> = {
  name: 'get_presentation_text',
  fitResult: { minimum: minimumTextResult, fit: fitTextResult },
  description:
    'Presentation only. Read plain text from slide text shapes and groups without moving the selection. Does not read images, charts or speaker notes.',
  inputSchema: getDocumentTextTool.inputSchema,
  readOnlyHint: true,
  execute: async ({ maxChars = DEFAULT_MAX_CHARS } = {}) => {
    if (!Number.isInteger(maxChars) || maxChars < 1 || maxChars > 32000) throw new Error('Invalid maximum text length');
    const api = requireEditorApi();
    const slides = (
      api.WordControl as
        { m_oLogicDocument?: { Slides?: Array<{ cSld: { spTree: PresentationShape[] } }> } } | undefined
    )?.m_oLogicDocument?.Slides;
    if (!slides) throw new Error('get_presentation_text is only available in the presentation editor');
    let text = '';
    for (let index = 0; index < slides.length; index++) {
      const content = slides[index].cSld.spTree.map(readPresentationShapeText).filter(Boolean).join('\n');
      if (content) text += `${text ? '\n\n' : ''}Slide ${index + 1}:\n${content}`;
      if (text.length > maxChars)
        return { text: text.slice(0, maxChars), truncated: true, slidesRead: index + 1, totalSlides: slides.length };
    }
    return { text, truncated: false, slidesRead: slides.length, totalSlides: slides.length };
  },
};

export interface AddCommentParams {
  /** The comment text. */
  text: string;
  /** Comment author name (default "Agent"). */
  author?: string;
}

export const addCommentTool: AgentTool<AddCommentParams, { added: true }> = {
  name: 'add_comment',
  description:
    'Add a comment anchored to the current selection. Select the text to ' +
    'annotate first (see get_selection). Prefer this over editing when you want ' +
    'to suggest a change without altering the document text.',
  inputSchema: {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'The comment text.' },
      author: { type: 'string', description: 'Comment author name (default "Agent").' },
    },
    required: ['text'],
    additionalProperties: false,
  },
  readOnlyHint: false,
  execute: async ({ text, author = 'Agent' }) => {
    if (typeof text !== 'string') {
      throw new TypeError('add_comment requires a string "text" parameter');
    }
    const { api, Asc } = requireEditorContext();
    // Word uses asc_CCommentDataWord; the spreadsheet/presentation editors use
    // asc_CCommentData. Pick whichever this editor exposes.
    const CommentCtor = Asc.asc_CCommentDataWord ?? Asc.asc_CCommentData;
    if (typeof CommentCtor !== 'function') {
      throw new Error('add_comment is not supported in this editor');
    }
    const data = new CommentCtor();
    data.asc_putText(text);
    data.asc_putUserName(author);
    api.asc_addComment(data);
    return { added: true };
  },
};

export interface SetCellParams {
  /** Cell address, e.g. "A1" or "B2". */
  cell: string;
  /** Value to write. */
  value: string;
  /** Preserve literal text (IDs, leading zeros, date-like labels). Default uses native value parsing. */
  valueType?: 'text' | 'auto';
}

export const setCellTool: AgentTool<SetCellParams, { cell: string; value: string }> = {
  name: 'set_cell',
  description:
    'Spreadsheet (Excel) only. Write a value to a cell by address (e.g. "B2"). ' +
    'Use valueType="text" for explicitly quoted text, identifiers, or labels that must remain exact text. ' +
    'Moves the selection to that cell and sets its value. Use this instead of ' +
    'insert_text when you need to target a specific cell.',
  inputSchema: {
    type: 'object',
    properties: {
      cell: { type: 'string', description: 'Cell address, e.g. "A1".' },
      value: { type: 'string', description: 'The value to write.' },
      valueType: {
        type: 'string',
        enum: ['text', 'auto'],
        description: 'text preserves literal text; auto uses native numeric/date parsing.',
      },
    },
    required: ['cell', 'value'],
    additionalProperties: false,
  },
  readOnlyHint: false,
  execute: async ({ cell, value, valueType }, signal) => {
    signal?.throwIfAborted();
    if (typeof cell !== 'string' || typeof value !== 'string') {
      throw new TypeError('set_cell requires string "cell" and "value" parameters');
    }
    if (valueType !== undefined && valueType !== 'text' && valueType !== 'auto')
      throw new TypeError('Invalid set_cell valueType');
    if (valueType === 'text') {
      await writeExcelCellText(cell, value, signal);
      return { cell, value };
    }
    await writeExcelCellValue(cell, value, signal);
    return { cell, value };
  },
};

export interface GetCellParams {
  /** Cell address, e.g. "A1". */
  cell: string;
}

export const getCellTool: AgentTool<GetCellParams, { cell: string; text: string }> = {
  name: 'get_cell',
  description:
    'Spreadsheet (Excel) only. Read the text or numeric value stored in one cell, using its explicit address (e.g. "B2"). Reading a text value is supported. Does not move the selection or modify cells.',
  inputSchema: {
    type: 'object',
    properties: {
      cell: { type: 'string', description: 'Cell address, e.g. "A1".' },
    },
    required: ['cell'],
    additionalProperties: false,
  },
  readOnlyHint: true,
  execute: async ({ cell }) => {
    if (typeof cell !== 'string') {
      throw new TypeError('get_cell requires a string "cell" parameter');
    }
    const bounds = parseOfficeRange(cell);
    if (bounds.c1 !== bounds.c2 || bounds.r1 !== bounds.r2) throw new Error('get_cell requires one cell address');
    const api = requireEditorApi() as ReturnType<typeof requireEditorApi> & {
      wb?: {
        getWorksheet(): {
          model: { getRange3(r1: number, c1: number, r2: number, c2: number): { getValue(): string } };
        };
      };
    };
    const model = api.wb?.getWorksheet().model;
    if (typeof model?.getRange3 !== 'function') {
      throw new Error('get_cell is only available in the spreadsheet (Excel) editor');
    }
    return { cell, text: model.getRange3(bounds.r1, bounds.c1, bounds.r2, bounds.c2).getValue() };
  },
};

/** All registered agent tools, keyed by name for lookup by the runtime. */
export const agentTools: Record<string, AgentTool> = {
  [createSlideTool.name]: createSlideTool as unknown as AgentTool,
  [getPdfTextTool.name]: getPdfTextTool,
  [addPdfCommentTool.name]: addPdfCommentTool,
  [fillSeriesTool.name]: fillSeriesTool as unknown as AgentTool,
  [clearDocumentTool.name]: clearDocumentTool as unknown as AgentTool,
  [addSlideTextTool.name]: addSlideTextTool as unknown as AgentTool,
  [getRangesTool.name]: getRangesTool as unknown as AgentTool,
  [getRangeTool.name]: getRangeTool as unknown as AgentTool,
  [sumRangeTool.name]: sumRangeTool as unknown as AgentTool,
  [sortRangeTool.name]: sortRangeTool as unknown as AgentTool,
  [slideActionTool.name]: slideActionTool as unknown as AgentTool,
  [setBoldTool.name]: setBoldTool as unknown as AgentTool,
  [setParagraphAlignmentTool.name]: setParagraphAlignmentTool as unknown as AgentTool,
  [insertTextTool.name]: insertTextTool as unknown as AgentTool,
  [getSelectionTool.name]: getSelectionTool as unknown as AgentTool,
  [replaceSelectionTool.name]: replaceSelectionTool as unknown as AgentTool,
  [setReviewModeTool.name]: setReviewModeTool as unknown as AgentTool,
  [getDocumentTextTool.name]: getDocumentTextTool as unknown as AgentTool,
  [getPresentationTextTool.name]: getPresentationTextTool as unknown as AgentTool,
  [addCommentTool.name]: addCommentTool as unknown as AgentTool,
  [setCellTool.name]: setCellTool as unknown as AgentTool,
  [getCellTool.name]: getCellTool as unknown as AgentTool,
};
