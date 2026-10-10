import { setDocumentReviewMode } from './review-mode';
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
import { escapeHtml } from 'ranuts/utils';
import { requireEditorApi, requireEditorContext } from './editor-bridge';
import type { AgentTool } from '@ranuts/agent-core/types';
import { setBoldTool, setParagraphAlignmentTool } from './formatting-tools';
import { readSlideShapeText } from './slide-text-read';
import {
  getRangesTool,
  getRangeTool,
  sumRangeTool,
  sortRangeTool,
  slideActionTool,
  parseOfficeRange,
} from './office-tools';

/**
 * Convert plain text into the minimal HTML `pluginMethod_PasteHtml` expects.
 * Escapes HTML-significant characters (via ranuts `escapeHtml`) and maps newlines
 * to `<br />` so the inserted text keeps its line breaks without injecting markup.
 */
export function textToHtml(text: string): string {
  const html = escapeHtml(text).replace(/\r\n|\r|\n/g, '<br />');
  // The SDK collapses HTML whitespace unless the text node's parent declares
  // pre/pre-wrap. Keep ordinary single-space text unchanged for all editors.
  return / {2,}|\t|(?:^|[\r\n]) | $| [\r\n]/.test(text) ? `<span style="white-space: pre-wrap">${html}</span>` : html;
}

export interface InsertTextParams {
  /** The plain text to insert at the cursor. */
  text: string;
}

export const insertTextTool: AgentTool<InsertTextParams, { inserted: true; length: number }> = {
  name: 'insert_text',
  description:
    'Insert plain text at the current cursor position in the document. ' +
    'Newlines are preserved as line breaks. Replaces the current selection if any text is selected.',
  inputSchema: {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'The plain text to insert at the cursor.' },
    },
    required: ['text'],
    additionalProperties: false,
  },
  readOnlyHint: false,
  execute: async ({ text }, signal) => {
    if (typeof text !== 'string') {
      throw new TypeError('insert_text requires a string "text" parameter');
    }
    const api = requireEditorApi();
    await pasteWordHtml(api, textToHtml(text), signal);
    return { inserted: true, length: text.length };
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
    await pasteWordHtml(api, textToHtml(text), signal);
    return { replaced: true, length: text.length };
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
  description:
    'Read the full plain text of the document. Long documents are truncated ' +
    '(default 8000 characters). Side effect: this clears the current selection ' +
    'and moves the cursor — call it before editing, not mid-edit.',
  inputSchema: {
    type: 'object',
    properties: {
      maxChars: { type: 'number', description: 'Maximum characters to return (default 8000).' },
    },
    additionalProperties: false,
  },
  readOnlyHint: true,
  execute: async ({ maxChars = DEFAULT_MAX_CHARS } = {}) => {
    const api = requireEditorApi();
    if ((api.WordControl as { m_oLogicDocument?: { Slides?: unknown[] } } | undefined)?.m_oLogicDocument?.Slides)
      throw new Error('Use get_presentation_text to read presentation shape text');
    // The public plugin API lacks a non-destructive full-text read, so select
    // all → read → clear. GetSelectedText returns CRLF; normalise to \n.
    api.asc_EditSelectAll();
    const full = api.pluginMethod_GetSelectedText({ TabSymbol: '\t', Numbering: false }).replace(/\r\n/g, '\n');
    // asc_RemoveSelection exists in Word/Slide but not the spreadsheet editor.
    api.asc_RemoveSelection?.();
    const truncated = full.length > maxChars;
    return { text: truncated ? full.slice(0, maxChars) : full, truncated };
  },
};

interface PresentationShape {
  getDocContent?(): { GetText(options: Record<string, never>): string };
  getText?(): string;
  spTree?: PresentationShape[];
}
export const getPresentationTextTool: AgentTool<GetDocumentTextParams, { text: string; truncated: boolean }> = {
  name: 'get_presentation_text',
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
    const readShape = (shape: PresentationShape): string => {
      if (shape.spTree) return shape.spTree.map(readShape).filter(Boolean).join('\n');
      return (
        (readSlideShapeText(shape) ?? shape.getDocContent?.()?.GetText({}) ?? shape.getText?.())
          ?.replace(/\r\n?/g, '\n')
          .trim() ?? ''
      );
    };
    for (let index = 0; index < slides.length; index++) {
      const content = slides[index].cSld.spTree.map(readShape).filter(Boolean).join('\n');
      if (content) text += `${text ? '\n\n' : ''}Slide ${index + 1}:\n${content}`;
      if (text.length > maxChars) return { text: text.slice(0, maxChars), truncated: true };
    }
    return { text, truncated: false };
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
