import { t } from '@ranuts/shared/i18n';
import type { DocumentContext } from '../document-context';

/** One truthful, bounded host receipt shared by native and schema transports.
 * Only successful editor reads enter here; model prose is never a scope source.
 */
export function readReceipt(name: string, result: unknown, context: DocumentContext): string | undefined {
  if (
    ![
      'get_selection',
      'get_document_text',
      'get_presentation_text',
      'get_cell',
      'get_range',
      'get_ranges',
      'get_pdf_text',
    ].includes(name)
  )
    return undefined;
  if (!result || typeof result !== 'object' || Array.isArray(result)) return undefined;
  const value = result as {
    text?: string;
    unavailable?: boolean;
    truncated?: boolean;
    cell?: string;
    range?: string;
    ranges?: string[];
    page?: number;
    slidesRead?: number;
  };
  if (value.unavailable || (typeof value.text === 'string' && !value.text.trim()))
    return t(name === 'get_pdf_text' ? 'agentPdfTextUnavailable' : 'agentNoReadableText');
  const scope =
    name === 'get_document_text'
      ? t('agentDocumentBody')
      : name === 'get_selection'
        ? t('agentPlanSelection')
        : name === 'get_presentation_text'
          ? t('agentReadSlideText', { count: value.slidesRead ?? 0 })
          : name === 'get_pdf_text'
            ? t('agentPdfPageContext', { page: value.page ?? context.page ?? '' })
            : [context.sheet, value.cell ?? value.range ?? value.ranges?.join(', ')].filter(Boolean).join(' · ');
  if (!scope) return undefined;
  return `${t('agentReadScope', { scope })}${value.truncated ? ` · ${t('agentReadPartial')}` : ''}`;
}
