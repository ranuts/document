/** Controlled providers follow the same next-step envelope as schema-only engines. */
export function taskProtocol(
  request: {
    format?: { oneOf?: Array<{ properties?: { kind?: { const?: string } } }> };
    messages: Array<{ content: string }>;
  },
  operation: unknown,
  answer = 'The reviewed operation is finished.',
): unknown {
  if (!request.format?.oneOf?.some((branch) => branch.properties?.kind?.const === 'tool')) return operation;
  const prompt = request.messages.at(-1)?.content ?? '';
  const reference = prompt.split('Conversation and actual results: ')[1];
  const messages = reference ? JSON.parse(reference) : [];
  const results = messages.flatMap((message: { content: unknown }) =>
    Array.isArray(message.content) ? message.content.filter((block) => block.type === 'tool_result') : [],
  );
  return results.length
    ? { kind: 'answer', text: answer, disposition: 'answered' }
    : { kind: 'tool', ...(operation as object) };
}
