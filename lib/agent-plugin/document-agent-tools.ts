import type { AgentTool } from '@ranuts/agent-core/types';
import { documentTools, parseDocumentToolPlan } from './document-tool-plan';
import { DocumentToolAction, type DocumentToolTarget } from './document-tool-action';

export interface DocumentAgentToolOptions {
  target: DocumentToolTarget;
  readonly: boolean;
  review(action: DocumentToolAction): void;
  receipt(name: string, result: unknown): void;
}
/** One request's editor-scoped registry. Native calls and bounded plans use the same adapters. */
export function createDocumentAgentTools(options: DocumentAgentToolOptions): Record<string, AgentTool> {
  const { target } = options;
  return Object.fromEntries(
    documentTools(target.context)
      .filter((tool) => !options.readonly || tool.readOnlyHint)
      .map((tool) => [
        tool.name,
        {
          ...tool,
          concludesTurn: !tool.readOnlyHint,
          execute: async (input: Record<string, unknown>, signal?: AbortSignal) => {
            signal?.throwIfAborted();
            if (!target.isCurrent(false)) throw new Error('agentPlanExpired');
            const plan = parseDocumentToolPlan(JSON.stringify({ tool: tool.name, input }), target.context);
            if (options.readonly && !plan.readOnly) throw new Error('agentReadonly');
            const action = new DocumentToolAction(target, plan);
            if (!plan.readOnly) {
              target.assertSupported?.(plan);
              if (!action.isCurrent()) throw new Error('agentPlanExpired');
              options.review(action);
              return { status: 'pending_review', executed: false, target: target.label };
            }
            await action.apply(signal);
            signal?.throwIfAborted();
            options.receipt(tool.name, action.result);
            return { status: 'completed', result: action.result };
          },
        },
      ]),
  );
}
