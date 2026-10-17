/** Safe product categories; provider response bodies and endpoint addresses never reach UI copy. */
export function requestErrorKey(
  error: unknown,
):
  | 'agentServiceAuthFailed'
  | 'agentServiceRateLimited'
  | 'agentServiceUnavailable'
  | 'agentServiceTimedOut'
  | 'agentServiceNetworkFailed'
  | undefined {
  if (error instanceof DOMException && error.name === 'TimeoutError') return 'agentServiceTimedOut';
  if (!(error instanceof Error) && typeof error !== 'string') return;
  const message = error instanceof Error ? error.message : error;
  if (message === 'AI request timed out') return 'agentServiceTimedOut';
  if (error instanceof Error && error.name === 'TimeoutError') return 'agentServiceTimedOut';
  if (
    ['Failed to fetch', 'NetworkError when attempting to fetch resource.', 'Load failed', 'Connection error.'].includes(
      message,
    )
  )
    return 'agentServiceNetworkFailed';
  const status =
    error instanceof Error && 'status' in error && typeof error.status === 'number'
      ? error.status
      : Number(/^(?:OpenAI|Ollama|Gemini) request failed: (\d{3})(?:\s|$)/.exec(message)?.[1]);
  if (status === 401 || status === 403) return 'agentServiceAuthFailed';
  if (status === 429) return 'agentServiceRateLimited';
  if (status === 408 || status === 504) return 'agentServiceTimedOut';
  if (status >= 500 && status < 600) return 'agentServiceUnavailable';
}
