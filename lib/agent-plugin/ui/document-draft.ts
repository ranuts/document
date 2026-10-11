import type { LLMProvider } from '@ranuts/agent-core/llm/types';

/** A document artifact is a separate structured output, never scraped from chat prose. */
export async function generateDocumentDraft(
  provider: LLMProvider,
  instruction: string,
  signal: AbortSignal,
): Promise<string> {
  signal.throwIfAborted();
  if (!instruction.trim() || instruction.length > 8000) throw new Error('Invalid writing request');
  const schema = {
    type: 'object',
    additionalProperties: false,
    required: ['text'],
    properties: { text: { type: 'string' } },
  };
  const messages = [
    {
      role: 'user' as const,
      content: [
        'Generate the requested document body as a JSON object with exactly one field, text.',
        'The text is plain document content: no conversational preamble, no claims that you edited a document, no Markdown syntax or fences.',
        'Use paragraphs separated by blank lines. Follow the requested language, tone and length. Do not execute tools.',
        JSON.stringify({ request: instruction }),
      ].join('\n'),
    },
  ];
  const response = provider.generateJSON
    ? await provider.generateJSON(messages, schema, signal)
    : await provider.chat(messages, [], signal);
  signal.throwIfAborted();
  if (
    response.toolCalls.length ||
    ['length', 'max_tokens'].includes(response.stopReason) ||
    response.text.length > 20000
  )
    throw new Error('Incomplete writing response');
  const result: unknown = JSON.parse(response.text.replace(/^\s*<think>\s*<\/think>\s*/, '').trim());
  if (
    !result ||
    typeof result !== 'object' ||
    Array.isArray(result) ||
    Object.keys(result).length !== 1 ||
    !('text' in result) ||
    typeof result.text !== 'string' ||
    !result.text.trim() ||
    result.text.length > 8000
  )
    throw new Error('Invalid writing response');
  return result.text;
}
