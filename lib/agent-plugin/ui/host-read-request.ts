import { t } from '@ranuts/shared/i18n';
import { captureRequestContext, serializeRequestContext } from './request-context';
import { hostReadTarget, isCurrentHostRead, type HostReadTask } from './task-entry';
import type { TurnRequest } from './controller';

/** A host-created task reads its captured source once, with no classifier or tools. */
export function prepareHostRead(task: HostReadTask, instruction = ''): { request: TurnRequest; receipt: string } {
  const target = hostReadTarget(task);
  const assertCurrent = () => {
    if (!isCurrentHostRead(task) || !target.isCurrent(false)) throw new Error('agentPlanExpired');
  };
  assertCurrent();
  const reference = captureRequestContext(task.scope);
  assertCurrent();
  const bounded = serializeRequestContext(reference, instruction);
  const content = bounded.context.content;
  const scope =
    content?.scope === 'pdf-page'
      ? t('agentPdfPageContext', { page: content.page ?? target.context.page ?? '' })
      : content?.scope === 'selection'
        ? [t('agentPlanSelection'), reference.editor?.sheet, content.range].filter(Boolean).join(' · ')
        : content?.scope === 'active-sheet-used-range'
          ? [reference.editor?.sheet, content.range].filter(Boolean).join(' · ')
          : content?.scope === 'presentation-text'
            ? t('agentReadSlideText', { count: content.slidesRead ?? 0 })
            : t('agentDocumentBody');
  const receipt = `${t('agentReadScope', { scope })}${content?.truncated ? ` · ${t('agentReadPartial')}` : ''}`;
  const reply =
    !content || content.unavailable
      ? t(content?.scope === 'pdf-page' ? 'agentPdfTextUnavailable' : 'agentReadUnavailable')
      : !content.text?.trim()
        ? t('agentNoReadableText')
        : undefined;
  return {
    receipt,
    request: {
      tools: {},
      maxIterations: 1,
      assertCurrent,
      ...(reply ? { reply: `${receipt}\n${reply}` } : {}),
      getRequestContext: () => {
        assertCurrent();
        return bounded.serialized;
      },
    },
  };
}
