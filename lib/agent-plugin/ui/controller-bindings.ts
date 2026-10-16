import { t } from '@ranuts/shared/i18n';
import type { LLMProvider } from '@ranuts/agent-core/llm/types';
import { getReadonlyMode } from '../../onlyoffice/readonly';
import { prepareDocumentTask } from '../document-task';
import type { DocumentAgentToolOptions } from '../document-agent-tools';
import type { captureDocumentToolScope } from '../document-tool-action';
import type { AgentChatControllerOptions, ChatTurn, TurnRequest } from './controller';
import type { ComposerContext } from './composer-context';
import type { RequestScopePolicy } from './request-scope';
import { readReceipt } from './read-receipt';
import { captureRequestContext, serializeRequestContext, type ReferenceExcerpt } from './request-context';

interface BindingOptions {
  base: AgentChatControllerOptions;
  isCurrent: () => boolean;
  appendTurn: (turn: ChatTurn) => void;
}

/** Guard controller callbacks and keep its fallback reference metadata bounded. */
export function createDocumentControllerBindings(host: BindingOptions): AgentChatControllerOptions {
  return {
    ...host.base,
    tools: {},
    getRequestContext: () => {
      const reference = captureRequestContext('metadata');
      return reference.editor ? serializeRequestContext(reference, '').serialized : undefined;
    },
    onContextTrimmed: () => {
      if (host.isCurrent()) host.appendTurn({ role: 'tool', text: t('agentContextTrimmed') });
    },
    onAgentDelta: (delta) => {
      if (host.isCurrent()) host.base.onAgentDelta?.(delta);
    },
    onAgentStreamEnd: () => {
      if (host.isCurrent()) host.base.onAgentStreamEnd?.();
    },
  };
}

interface NativeRequestOptions {
  references?: readonly ReferenceExcerpt[];
  target: ReturnType<typeof captureDocumentToolScope>;
  instruction: string;
  snapshot: ComposerContext;
  scope: RequestScopePolicy;
  readonly: boolean;
  provider: LLMProvider;
  isCurrent: () => boolean;
  review: DocumentAgentToolOptions['review'];
  appendTurn: (turn: ChatTurn) => void;
}

/** Native tool scope belongs to the submitted request, including deferred binding. */
export function createNativeDocumentRequest(host: NativeRequestOptions): TurnRequest {
  let current = host.target;
  const assertCurrent = () => {
    if (
      !host.isCurrent() ||
      (host.scope.editorBound && (host.readonly !== getReadonlyMode() || !current.isCurrent(false)))
    )
      throw new Error(t('agentPlanExpired'));
  };
  return {
    tools: {},
    assertCurrent,
    getRequestContext: () =>
      host.scope.deferNative && !host.references?.length
        ? undefined
        : serializeRequestContext(
            {
              editor: host.snapshot.context,
              references: host.references,
              selection: { text: host.snapshot.text, truncated: host.snapshot.truncated },
            },
            host.instruction,
          ).serialized,
    prepareRun: async (request, signal) =>
      prepareDocumentTask(host.provider, request, {
        target: host.target,
        deferEditorFreshness: host.scope.deferNative,
        readonly: host.readonly,
        signal,
        assertCurrent,
        onTargetChanged: (next) => {
          host.scope.bindEditor();
          current = next;
        },
        review: host.review,
        receipt: (name, result) => {
          if (!host.isCurrent()) return;
          const text = readReceipt(name, result, current.context);
          if (text) host.appendTurn({ role: 'tool', text });
        },
      }),
  };
}
