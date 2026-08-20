/**
 * WebMCP adapter: expose the editor's operations as browser-agent tools.
 *
 * WebMCP (W3C Web Machine Learning CG; Chrome origin trial) lets a page
 * register structured tools that an in-browser AI agent can call directly
 * instead of scraping the UI. This site is a "verb" site -- open / convert /
 * export / preview -- and embed-api.ts already defines those verbs as a
 * message protocol, so this file is a thin mapping onto the same internal
 * functions. Everything WebMCP-specific stays in this one file: the API is
 * still moving (it migrated from navigator.modelContext to
 * document.modelContext in 2026-07), so both locations are probed and the
 * shape can be fixed in one place. Where the API is absent this is a no-op.
 *
 * Constraints (see docs/superpowers/plans/2026-08-15-next-phase-roadmap.md,
 * "WebMCP 评估与接入方案"):
 * - registered only in a top-level window (cross-origin iframes need the
 *   parent's `allow`, which collides with the embed use case);
 * - tool results must be JSON-serialisable: save_document returns a blob URL
 *   (+ optional data URL for small files) instead of a File.
 */
import { getDocmentObj } from '@ranuts/shared/store';
import { DOCUMENT_TYPE_MAP, getDocumentType } from '@ranuts/shared/document-utils';
import { getReadonlyMode, requestSaveDocument, setReadonlyMode } from './onlyoffice-editor';
import { onCreateNew, openDocumentFromUrl, openLocalFile } from './document';
// The tool layer is transport-agnostic by design (see @ranuts/agent-core types):
// the same definitions back the in-page agent panel. Reused rather than
// reimplemented -- editor-bridge has no imports of its own, so this costs
// nothing in the bundle and cannot drift from the panel's behaviour.
import { getDocumentTextTool } from './agent-plugin/tools';

/** Minimal shape of the WebMCP surface this adapter uses. */
export interface ModelContextLike {
  registerTool?: (tool: WebMcpTool) => unknown;
  unregisterTool?: (name: string) => unknown;
  provideContext?: (ctx: { tools: WebMcpTool[] }) => unknown;
}

export interface WebMcpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (input: Record<string, unknown>) => Promise<WebMcpResult>;
}

/** MCP-style tool result: content parts, JSON as text. */
export interface WebMcpResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

/** Below this size save_document also inlines a data URL (agents cannot always read blob: URLs). */
export const INLINE_DATA_URL_MAX_BYTES = 2 * 1024 * 1024;

/**
 * The formats the engine can open, derived from DOCUMENT_TYPE_MAP rather than
 * spelled out again. The hand-written list here said "docx, doc, xlsx, xls,
 * pptx, ppt, csv, pdf" and had already fallen behind the map, which has carried
 * odt/ods/odp/rtf/txt all along -- so an agent was told a file it could open was
 * unsupported. Deriving it means the next format the engine gains is advertised
 * the day it is mapped.
 */
export const OPENABLE_EXTENSIONS: string[] = Object.keys(DOCUMENT_TYPE_MAP).sort();

/** Formats save_document can convert to. */
export const SAVE_EXTENSIONS = ['DOCX', 'XLSX', 'PPTX', 'PDF', 'CSV', 'TXT', 'ODT', 'ODS', 'ODP', 'RTF'] as const;

/** New-document kinds `create_document` accepts, and the extension each maps to. */
export const NEW_DOCUMENT_KINDS: Record<string, string> = {
  document: '.docx',
  spreadsheet: '.xlsx',
  presentation: '.pptx',
};

const ok = (data: unknown): WebMcpResult => ({ content: [{ type: 'text', text: JSON.stringify(data) }] });
const fail = (message: string): WebMcpResult => ({
  content: [{ type: 'text', text: JSON.stringify({ ok: false, error: message }) }],
  isError: true,
});

/** Locate the WebMCP surface (new location first), or null. */
export function findModelContext(win: Window = window): ModelContextLike | null {
  const doc = win.document as Document & { modelContext?: ModelContextLike };
  const nav = win.navigator as Navigator & { modelContext?: ModelContextLike };
  const mc = doc.modelContext ?? nav.modelContext ?? null;
  if (!mc) return null;
  if (typeof mc.registerTool !== 'function' && typeof mc.provideContext !== 'function') return null;
  return mc;
}

function decodeBase64(base64: string): Uint8Array<ArrayBuffer> {
  const clean = base64.replace(/^data:[^,]*,/, '').replace(/\s+/g, '');
  const bin = atob(clean);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const LEGACY_TARGET: Record<string, string> = { XLS: 'XLSX', DOC: 'DOCX', PPT: 'PPTX' };

function defaultSaveExt(): string {
  const currentExt = (getDocmentObj()?.fileName || '').split('.').pop()?.toUpperCase() || '';
  return LEGACY_TARGET[currentExt] || currentExt || 'XLSX';
}

async function fileToDataUrl(file: File): Promise<string> {
  const buf = new Uint8Array(await file.arrayBuffer());
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < buf.length; i += CHUNK) bin += String.fromCharCode(...buf.subarray(i, i + CHUNK));
  return `data:${file.type || 'application/octet-stream'};base64,${btoa(bin)}`;
}

/** The tool set. Same verbs as embed-api.ts, same internal functions. */
export function buildTools(): WebMcpTool[] {
  return [
    {
      name: 'open_document_url',
      description:
        `Open a document (${OPENABLE_EXTENSIONS.join(', ')}) from a URL in the on-device editor. ` +
        'Nothing is uploaded: the file is fetched by the browser and rendered locally.',
      inputSchema: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'Absolute URL of the document; the host must allow CORS.' },
          fileName: { type: 'string', description: 'Optional file name (with extension) when the URL has none.' },
          readonly: { type: 'boolean', description: 'Open as a read-only preview.' },
        },
        required: ['url'],
        additionalProperties: false,
      },
      async execute(input) {
        const url = String(input.url || '');
        if (!/^https?:\/\//i.test(url)) return fail('url must be an absolute http(s) URL');
        await openDocumentFromUrl(url, typeof input.fileName === 'string' ? input.fileName : undefined, {
          readonly: Boolean(input.readonly),
        });
        return ok({ ok: true, fileName: getDocmentObj()?.fileName || null, readonly: getReadonlyMode() });
      },
    },
    {
      name: 'open_document_buffer',
      description: `Open a document from base64-encoded bytes in the on-device editor (${OPENABLE_EXTENSIONS.join(', ')}).`,
      inputSchema: {
        type: 'object',
        properties: {
          fileName: { type: 'string', description: 'File name with extension, e.g. report.xlsx' },
          base64: { type: 'string', description: 'The file bytes, base64 (a data: URL prefix is tolerated).' },
          readonly: { type: 'boolean' },
        },
        required: ['fileName', 'base64'],
        additionalProperties: false,
      },
      async execute(input) {
        const fileName = String(input.fileName || '');
        if (!fileName.includes('.')) return fail('fileName must include an extension');
        const bytes = decodeBase64(String(input.base64 || ''));
        if (!bytes.byteLength) return fail('base64 decoded to zero bytes');
        await openLocalFile(new File([bytes], fileName));
        if (input.readonly) setReadonlyMode(true);
        return ok({ ok: true, fileName, size: bytes.byteLength, readonly: getReadonlyMode() });
      },
    },
    {
      name: 'create_document',
      description:
        'Create a new empty document, spreadsheet or presentation in the on-device editor. ' +
        'Replaces whatever is currently open.',
      inputSchema: {
        type: 'object',
        properties: {
          kind: {
            type: 'string',
            enum: Object.keys(NEW_DOCUMENT_KINDS),
            description: 'What to create: document (Word), spreadsheet (Excel) or presentation (PowerPoint).',
          },
        },
        required: ['kind'],
        additionalProperties: false,
      },
      async execute(input) {
        const kind = String(input.kind || '');
        const ext = NEW_DOCUMENT_KINDS[kind];
        if (!ext) return fail(`kind must be one of: ${Object.keys(NEW_DOCUMENT_KINDS).join(', ')}`);
        await onCreateNew(ext);
        return ok({ ok: true, kind, fileName: getDocmentObj()?.fileName || null });
      },
    },
    {
      name: 'save_document',
      description:
        `Export the open document, optionally converting it (targetExt: ${SAVE_EXTENSIONS.join(', ')}). ` +
        'Returns a blob URL and, for small files, a data URL; the conversion runs on the device.',
      inputSchema: {
        type: 'object',
        properties: {
          targetExt: { type: 'string', description: 'Target format; defaults to the format of the open document.' },
        },
        additionalProperties: false,
      },
      async execute(input) {
        const targetExt = typeof input.targetExt === 'string' && input.targetExt ? input.targetExt : defaultSaveExt();
        const file = await requestSaveDocument(targetExt.toUpperCase());
        const result: Record<string, unknown> = {
          ok: true,
          fileName: file.name,
          mimeType: file.type,
          size: file.size,
          blobUrl: URL.createObjectURL(file),
        };
        if (file.size <= INLINE_DATA_URL_MAX_BYTES) result.dataUrl = await fileToDataUrl(file);
        return ok(result);
      },
    },
    {
      name: 'get_document_text',
      description:
        'Read the plain text of the open document, so the content can be answered about without exporting it. ' +
        'Word-processing documents return their full text; spreadsheets and presentations do not expose one on ' +
        'this engine -- use save_document for those. Side effect: clears the current selection.',
      inputSchema: {
        type: 'object',
        properties: {
          maxChars: { type: 'number', description: 'Maximum characters to return (default 8000).' },
        },
        additionalProperties: false,
      },
      async execute(input) {
        const maxChars = typeof input.maxChars === 'number' && input.maxChars > 0 ? input.maxChars : undefined;
        const { text, truncated } = await getDocumentTextTool.execute(maxChars ? { maxChars } : {});
        const fileName = getDocmentObj()?.fileName || '';
        const kind = getDocumentType(fileName.split('.').pop() || '');
        // An empty answer is ambiguous -- an empty document and an editor that
        // has no full-text read look identical from here. Only the word editor
        // implements one (verified against v9 for docx/xlsx/pptx), so say which
        // case this is instead of letting an agent conclude "the file is empty".
        if (!text && kind !== 'word') {
          return ok({
            ok: true,
            text: '',
            truncated: false,
            supported: false,
            note: `Full text is only available for word-processing documents; this is a ${kind || 'non-word'} document. Use save_document (targetExt TXT, CSV or PDF) and read the exported file instead.`,
          });
        }
        return ok({ ok: true, text, truncated, supported: true });
      },
    },
    {
      name: 'set_readonly',
      description: 'Switch the open document between read-only preview and editing without reloading it.',
      inputSchema: {
        type: 'object',
        properties: { readonly: { type: 'boolean' } },
        required: ['readonly'],
        additionalProperties: false,
      },
      async execute(input) {
        setReadonlyMode(Boolean(input.readonly));
        return ok({ ok: true, readonly: getReadonlyMode() });
      },
    },
    {
      name: 'get_document_state',
      description: 'Report whether a document is open, its file name, and whether it is read-only.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      async execute() {
        return ok({
          hasDocument: Boolean(window.editor),
          fileName: getDocmentObj()?.fileName || null,
          readonly: getReadonlyMode(),
        });
      },
    },
  ];
}

/** Wrap execute so a thrown error becomes an isError result instead of an unhandled rejection. */
function guarded(tool: WebMcpTool): WebMcpTool {
  return {
    ...tool,
    async execute(input) {
      try {
        return await tool.execute(input || {});
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    },
  };
}

let registered: string[] = [];

/**
 * Register the tools when a WebMCP surface exists and this is a top-level
 * window. Returns the registered tool names ([] when skipped). Idempotent.
 */
export function initWebMcp(win: Window = window): string[] {
  if (registered.length) return registered;
  let top = true;
  try {
    top = win.parent === win;
  } catch {
    top = false;
  }
  if (!top) return [];
  const mc = findModelContext(win);
  if (!mc) return [];
  const tools = buildTools().map(guarded);
  try {
    if (typeof mc.registerTool === 'function') {
      for (const tool of tools) mc.registerTool(tool);
    } else {
      mc.provideContext?.({ tools });
    }
    registered = tools.map((t) => t.name);
  } catch (error) {
    console.warn('[web-mcp] registration failed:', error);
    registered = [];
  }
  return registered;
}

/** Test hook / teardown. */
export function disposeWebMcp(win: Window = window): void {
  const mc = findModelContext(win);
  if (mc && typeof mc.unregisterTool === 'function') {
    for (const name of registered) {
      try {
        mc.unregisterTool(name);
      } catch {
        // ignore
      }
    }
  }
  registered = [];
}
