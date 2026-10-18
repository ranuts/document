import type { LLMResponse } from './types';

export type IncompleteResponseReason = 'max_tokens' | 'content_filter';

/** Normalise provider termination without exposing backend error prose to the host UI. */
export function incompleteResponseReason(
  response: Pick<LLMResponse, 'stopReason'>,
): IncompleteResponseReason | undefined {
  if (response.stopReason === 'length' || response.stopReason === 'max_tokens') return 'max_tokens';
  if (response.stopReason === 'content_filter') return 'content_filter';
  return undefined;
}
