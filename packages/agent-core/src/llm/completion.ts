import type { LLMResponse } from './types';

export type IncompleteResponseReason = 'max_tokens' | 'content_filter' | 'provider';

/** Strict completion gate for hosts accepting a complete, tool-free artifact. */
export function isCompletedResponse(response: Pick<LLMResponse, 'stopReason'>): boolean {
  return ['end_turn', 'stop', 'STOP', 'eos', 'completed'].includes(response.stopReason);
}

/** Normalise provider termination without exposing backend error prose to the host UI. */
export function incompleteResponseReason(
  response: Pick<LLMResponse, 'stopReason'>,
): IncompleteResponseReason | undefined {
  if (response.stopReason === 'length' || response.stopReason === 'max_tokens') return 'max_tokens';
  if (response.stopReason === 'content_filter') return 'content_filter';
  if (response.stopReason === 'incomplete') return 'provider';
  return undefined;
}
