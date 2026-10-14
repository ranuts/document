import type { OpenAICompletion, OpenAIStreamChunk } from '@ranuts/agent-core/llm/openai-format';

/** SDK-shaped stream for scripted engine tests, including tool fragments and usage. */
export async function* completionStream(completion: OpenAICompletion): AsyncIterable<OpenAIStreamChunk> {
  for (const choice of completion.choices) {
    yield {
      choices: [
        {
          delta: {
            content: choice.message.content,
            tool_calls: choice.message.tool_calls?.map((call, index) => ({ ...call, index })),
          },
          finish_reason: choice.finish_reason,
        },
      ],
    };
  }
  if (completion.usage || completion.timings)
    yield {
      choices: [],
      ...(completion.usage ? { usage: completion.usage } : {}),
      ...(completion.timings ? { timings: completion.timings } : {}),
    };
}
