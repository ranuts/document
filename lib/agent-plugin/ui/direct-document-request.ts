import { getLanguage, t } from '@ranuts/shared/i18n';
import type { LLMMessage } from '@ranuts/agent-core/llm/types';
import type { DirectDocumentIntent } from '../direct-intent';
import { getEditorApi } from '../editor-bridge';
import { agentTools } from '../tools';
import { DocumentToolAction, type DocumentToolTarget } from '../document-tool-action';
import type { ChatTurn } from './controller';

type DirectRequestMessage = LLMMessage & { hostGuidance?: 'tool' | 'status' | 'error' };
/** Prepare scope synchronously before queue acceptance; execute only the closed command grammar. */
export function prepareDirectDocumentRequest(
  intent: Exclude<DirectDocumentIntent, { kind: 'clarify' }>,
  text: string,
  target: DocumentToolTarget | null,
  answer: string,
) {
  const chinese = getLanguage().startsWith('zh');
  if (!target?.isCurrent(false)) throw new Error(t('agentPlanExpired'));
  const readOnly =
    (intent.kind === 'sum_range' && !intent.target) || (intent.kind === 'slide' && intent.action === 'navigate');
  const directTarget = readOnly ? target : (target.prepareWrite?.() ?? target);
  if (!directTarget.isCurrent(!readOnly)) throw new Error(t('agentPlanExpired'));
  if (intent.kind === 'write_reply') {
    if (!answer.trim()) throw new Error('agentNoCompletedAnswer');
    if (directTarget.context.kind !== 'word') throw new Error(t('agentWordOnly'));
    if (intent.requireSelection && !directTarget.selectedText.trim()) throw new Error(t('agentNoSelection'));
  }
  if (
    intent.kind === 'align' &&
    /当前段落|current paragraph/i.test(text) &&
    getEditorApi()?.pluginMethod_GetSelectedText().trim()
  )
    throw new Error('agentParagraphSelectionConflict');
  return {
    async execute(signal: AbortSignal) {
      let name: string;
      let input: Record<string, unknown>;
      let result: unknown;
      if (intent.kind === 'write_reply') {
        const target = directTarget;
        name = 'insert_text';
        input = { text: answer, format: 'markdown' };
        const action = new DocumentToolAction(target, { tool: 'insert_text', input, readOnly: false });
        try {
          result = { outcome: await action.apply(signal) };
        } finally {
          action.dispose();
        }
      } else if (intent.kind === 'sum_range' || intent.kind === 'sort_range' || intent.kind === 'slide') {
        name = intent.kind === 'slide' ? 'slide_action' : intent.kind;
        const { kind: _kind, ...parameters } = intent;
        input = parameters;
        result = await agentTools[name].execute(input, signal);
      } else {
        name = intent.kind === 'bold' ? 'set_bold' : 'set_paragraph_alignment';
        input = intent.kind === 'bold' ? { enabled: intent.enabled } : { alignment: intent.alignment };
        result = await agentTools[name].execute(input, signal);
      }
      signal.throwIfAborted();
      if (intent.kind !== 'write_reply' && (result as { verified?: unknown } | undefined)?.verified !== true)
        throw new Error(t('agentPlanUnverified'));
      const status =
        intent.kind === 'write_reply'
          ? (result as { outcome?: string }).outcome === 'verified'
            ? ('success' as const)
            : ('failed' as const)
          : ('success' as const);
      const messages: DirectRequestMessage[] = [];
      const id = `direct-${crypto.randomUUID()}`;
      messages.push(
        { role: 'assistant', content: [{ type: 'tool_use', id, name, input }] },
        { role: 'user', content: [{ type: 'tool_result', toolUseId: id, content: JSON.stringify(result) }] },
      );
      if (intent.kind === 'sum_range' && !intent.target)
        messages.push({
          role: 'assistant',
          content: `${intent.range}: ${(result as { sum: number }).sum}`,
          hostGuidance: 'tool',
        });
      const turn: ChatTurn = {
        role: 'tool',
        text:
          intent.kind === 'sum_range' && !intent.target
            ? `${intent.range}: ${(result as { sum: number }).sum}`
            : intent.kind === 'slide' && intent.action === 'navigate'
              ? chinese
                ? `已切换到第 ${intent.page} 页幻灯片`
                : `Opened slide ${intent.page}`
              : intent.kind === 'write_reply' && (result as { outcome?: string }).outcome !== 'verified'
                ? t('agentPlanApplied')
                : t('agentPlanVerified'),
      };
      return { status, messages, turn };
    },
  };
}
