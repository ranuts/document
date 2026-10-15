import { t } from '@ranuts/shared/i18n';
import { captureRequestContext } from './request-context';
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
  // Store only one copy of the bounded source. Reserve room for the user prompt,
  // metadata and runtime envelope within the existing 6 KiB fallback budget.
  const grounded = { editor: reference.editor, content: reference.content && { ...reference.content } };
  const content = grounded.content;
  const serialize = () => JSON.stringify(grounded);
  const encoder = new TextEncoder();
  const bytes = () =>
    encoder.encode(JSON.stringify(serialize())).byteLength +
    encoder.encode(JSON.stringify(instruction)).byteLength +
    512;
  if (content?.text && bytes() > 4096) {
    const characters = [...content.text];
    content.truncated = true;
    let low = 0,
      high = characters.length;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      content.text = characters.slice(0, middle).join('');
      if (bytes() <= 4096) low = middle;
      else high = middle - 1;
    }
    content.text = characters.slice(0, low).join('');
  }
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
        return serialize();
      },
    },
  };
}
