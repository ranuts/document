import type { AgentTool } from '@ranuts/agent-core/types';
import { requireEditorApi, type EditorApi } from './editor-bridge';
import { getReadonlyMode } from '../onlyoffice/readonly';

interface FormatApi extends EditorApi {
  WordControl?: { m_oLogicDocument?: { Slides?: unknown; GetDocPosType?(): number } };
  put_TextPrBold?(enabled: boolean): void;
  put_PrAlign?(alignment: number): void;
  get_TextProps?(): { get_TextPr?(): { get_Bold?(): boolean }; get_ParaPr?(): { get_Jc?(): number } };
}
function currentWordApi(): FormatApi {
  if (getReadonlyMode()) throw new Error('Document is read-only');
  const api = requireEditorApi() as FormatApi;
  if (!api.isDocumentLoadComplete || !api.isLoadFullApi) throw new Error('Editor is still loading');
  const logic = api.WordControl?.m_oLogicDocument;
  if (!logic || logic.Slides || logic.GetDocPosType?.() !== 0 || typeof api.get_TextProps !== 'function')
    throw new Error('Formatting is only available in the document body');
  return api;
}

export const setBoldTool: AgentTool<{ enabled: boolean }, { enabled: boolean; verified: true }> = {
  name: 'set_bold',
  description:
    'Word main body only. Set bold on the current nonempty text selection and verify it. Does not select text or format the entire document.',
  inputSchema: {
    type: 'object',
    properties: { enabled: { type: 'boolean' } },
    required: ['enabled'],
    additionalProperties: false,
  },
  readOnlyHint: false,
  execute: async ({ enabled }) => {
    if (typeof enabled !== 'boolean') throw new TypeError('set_bold requires a boolean');
    const api = currentWordApi();
    if (!api.pluginMethod_GetSelectedText().trim()) throw new Error('No text selection');
    if (typeof api.put_TextPrBold !== 'function' || typeof api.get_TextProps!().get_TextPr?.().get_Bold !== 'function')
      throw new Error('Bold formatting is unavailable');
    api.put_TextPrBold(enabled);
    if (api.get_TextProps!().get_TextPr?.().get_Bold?.() !== enabled)
      throw new Error('Formatting could not be verified. Check the document and use Undo if needed.');
    return { enabled, verified: true };
  },
};

const ALIGNMENTS = { left: 1, center: 2, right: 0, justify: 3 } as const;
export const setParagraphAlignmentTool: AgentTool<
  { alignment: keyof typeof ALIGNMENTS },
  { alignment: keyof typeof ALIGNMENTS; verified: true }
> = {
  name: 'set_paragraph_alignment',
  description:
    'Word main body only. Align the current paragraph or selected paragraphs left, center, right or justify; verify the result. Does not select the whole document.',
  inputSchema: {
    type: 'object',
    properties: { alignment: { type: 'string', enum: Object.keys(ALIGNMENTS) } },
    required: ['alignment'],
    additionalProperties: false,
  },
  readOnlyHint: false,
  execute: async ({ alignment }) => {
    if (!Object.hasOwn(ALIGNMENTS, alignment)) throw new TypeError('Invalid paragraph alignment');
    const api = currentWordApi();
    if (typeof api.put_PrAlign !== 'function' || typeof api.get_TextProps!().get_ParaPr?.().get_Jc !== 'function')
      throw new Error('Paragraph formatting is unavailable');
    api.put_PrAlign(ALIGNMENTS[alignment]);
    if (api.get_TextProps!().get_ParaPr?.().get_Jc?.() !== ALIGNMENTS[alignment])
      throw new Error('Formatting could not be verified. Check the document and use Undo if needed.');
    return { alignment, verified: true };
  },
};
