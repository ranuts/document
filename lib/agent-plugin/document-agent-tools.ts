import type { AgentTool } from '@ranuts/agent-core/types';
import { documentTools, parseDocumentToolPlan } from './document-tool-plan';
import { DocumentToolAction, type DocumentToolTarget } from './document-tool-action';
import type { ReviewOutcome } from './review-outcome';

export interface DocumentAgentToolOptions {
  target: DocumentToolTarget;
  readonly: boolean;
  review(action: DocumentToolAction, signal?: AbortSignal): Promise<ReviewOutcome<DocumentToolAction>>;
  receipt(name: string, result: unknown): void;
  onTargetChanged?(target: DocumentToolTarget): void;
}
/** One request's editor-scoped registry. Native calls and bounded plans use the same adapters. */
export function createDocumentAgentTools(options: DocumentAgentToolOptions): Record<string, AgentTool> {
  let { target } = options;
  return Object.fromEntries(
    documentTools(target.context)
      .filter((tool) => !options.readonly || tool.readOnlyHint)
      .map((tool) => [
        tool.name,
        {
          ...tool,
          concludesTurn: ({ content, isError }: { content: string; isError: boolean }) => {
            if (isError) return true;
            const outcome = JSON.parse(content);
            return outcome.status === 'completed'
              ? outcome.result?.unavailable === true ||
                  (typeof outcome.result?.text === 'string' && !outcome.result.text.trim())
              : outcome.status !== 'verified';
          },
          execute: async (input: Record<string, unknown>, signal?: AbortSignal) => {
            signal?.throwIfAborted();
            if (!target.isCurrent(false)) throw new Error('agentPlanExpired');
            const plan = parseDocumentToolPlan(JSON.stringify({ tool: tool.name, input }), target.context);
            if (options.readonly && !plan.readOnly) throw new Error('agentReadonly');
            if (!plan.readOnly) {
              target = target.prepareWrite?.() ?? target;
              options.onTargetChanged?.(target);
            }
            const action = new DocumentToolAction(target, plan);
            if (!plan.readOnly) {
              target.assertSupported?.(plan);
              if (!action.isCurrent()) throw new Error('agentPlanExpired');
              const outcome = await options.review(action, signal);
              signal?.throwIfAborted();
              if (outcome.status === 'verified') {
                target = outcome.action.continuationTarget ?? target;
                options.onTargetChanged?.(target);
              }
              return {
                status: outcome.status,
                target: outcome.action.target.label,
                // The original call already carries these arguments. Include only
                // user revisions so long artifacts do not occupy the context twice.
                ...(JSON.stringify(outcome.action.plan.input) !== JSON.stringify(plan.input)
                  ? { input: outcome.action.plan.input }
                  : {}),
                result: outcome.action.result,
                ...(outcome.status === 'failed'
                  ? { error: outcome.error instanceof Error ? outcome.error.message : 'Execution failed' }
                  : {}),
              };
            }
            await action.apply(signal);
            signal?.throwIfAborted();
            target = action.continuationTarget ?? target;
            options.onTargetChanged?.(target);
            options.receipt(tool.name, action.result);
            return { status: 'completed', result: action.result };
          },
        },
      ]),
  );
}
