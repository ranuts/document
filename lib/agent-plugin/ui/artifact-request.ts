import type { LLMProvider } from '@ranuts/agent-core/llm/types';
import type { ArtifactStore } from '../artifacts/store';
import type { ArtifactDraftBinding } from '../artifacts/edit-proposal';
import type { ReferenceText } from '../references/reference-sources';
import { ArtifactRevisionError, runArtifactRevision, type ArtifactRevisionRequest } from './artifact-workflow';
import type { QueuedRequest } from './request-queue';
import type { TurnResult } from './controller';
import { serializeRequestContext } from './request-context';
export interface ArtifactRequestBinding {
  origin: 'artifact';
  conversation: string;
  providerRevision: number;
  sources: { readonly references: readonly Readonly<ReferenceText>[]; isCurrent(): boolean };
  request: ArtifactRevisionRequest;
}
export interface ArtifactRequestLabels {
  stale: string;
  prepare: string;
  failed: string;
  stopped: string;
  tooLarge: string;
}
/** Shares the panel's physical queue lease; never builds a document controller. */
export function createArtifactRequestOwner(options: {
  store: Pick<ArtifactStore, 'get'>;
  sources(): ArtifactRequestBinding['sources'];
  conversation(): string;
  providerRevision(): number;
  enabled(): boolean;
  provider(): LLMProvider | null | undefined;
  isCurrentDraft(draft: ArtifactDraftBinding): boolean;
  enqueue(text: string, binding: ArtifactRequestBinding): { id: string };
  cancel(id: string, conversation: string): void;
  labels(): ArtifactRequestLabels;
  error(error: unknown): string;
}) {
  let active: AbortController | undefined;
  const current = (binding: ArtifactRequestBinding) =>
    options.enabled() &&
    binding.conversation === options.conversation() &&
    binding.providerRevision === options.providerRevision() &&
    binding.sources.isCurrent() &&
    options.isCurrentDraft(binding.request.draft);
  return {
    enqueue(request: ArtifactRevisionRequest): () => void {
      const binding: ArtifactRequestBinding = {
        origin: 'artifact',
        conversation: options.conversation(),
        providerRevision: options.providerRevision(),
        sources: options.sources(),
        request,
      };
      const provider = options.provider();
      request.bindCurrent(() => current(binding) && provider === options.provider());
      const entry = options.enqueue(request.instruction, binding);
      return () => options.cancel(entry.id, binding.conversation);
    },
    cancelActive(): boolean {
      if (!active) return false;
      active.abort();
      return true;
    },
    async execute(entry: QueuedRequest<ArtifactRequestBinding>, accept: () => boolean): Promise<TurnResult> {
      const binding = entry.binding,
        request = binding.request;
      const owns = () => current(binding) && request.isCurrent();
      const result = (status: TurnResult['status']): TurnResult => ({ turnId: entry.id, status });
      if (!owns()) {
        request.fail(options.labels().stale);
        return result('superseded');
      }
      const provider = options.provider();
      if (!provider?.isReady()) {
        request.fail(options.labels().prepare);
        return result('failed');
      }
      const abort = new AbortController();
      active = abort;
      const check = async () => {
        const persisted = await options.store.get(request.draft.artifactId);
        abort.signal.throwIfAborted();
        if (!owns() || !persisted || persisted.versions.at(-1)?.version !== request.draft.expectedVersion)
          throw new ArtifactRevisionError('stale');
      };
      try {
        await check();
        if (!accept()) {
          request.fail(options.labels().stopped);
          return result('stopped');
        }
        const reference = binding.sources.references.length
          ? serializeRequestContext(
              { editor: null, selection: { text: '', truncated: false }, references: binding.sources.references },
              entry.text,
            ).serialized
          : undefined;
        const replacement = await runArtifactRevision({
          provider,
          draft: request.draft,
          instruction: entry.text,
          reference,
          signal: abort.signal,
          current: owns,
          delta: request.delta,
        });
        await check();
        request.complete(replacement);
        return result('success');
      } catch (error) {
        const stale = !owns() || (error instanceof ArtifactRevisionError && error.code === 'stale');
        request.fail(
          abort.signal.aborted
            ? options.labels().stopped
            : stale
              ? options.labels().stale
              : error instanceof ArtifactRevisionError
                ? error.code === 'too-large'
                  ? options.labels().tooLarge
                  : error.code === 'not-ready'
                    ? options.labels().prepare
                    : options.labels().failed
                : options.error(error),
        );
        return result(abort.signal.aborted ? 'stopped' : stale ? 'superseded' : 'failed');
      } finally {
        if (active === abort) active = undefined;
      }
    },
  };
}
