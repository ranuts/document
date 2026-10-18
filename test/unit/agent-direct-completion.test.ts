import { expect, it } from 'vitest';
import { parseGeminiResponse } from '@ranuts/agent-core/llm/gemini';
import { parseOpenAIResponse } from '@ranuts/agent-core/llm/openai-format';
import { generateWriting } from '@ranuts/agent-core/llm/writing-task';
import { generateActionPlan } from '@ranuts/agent-core/llm/action-plan';
import type { LLMProvider, LLMResponse } from '@ranuts/agent-core/llm/types';
import { generateReadAnswer } from '../../lib/agent-plugin/document-read-answer';
import { generateDocumentToolPlan } from '../../lib/agent-plugin/document-tool-plan';
import { generateDocumentDraft } from '../../lib/agent-plugin/ui/document-draft';
import { resolveRequestIntent } from '../../lib/agent-plugin/ui/request-intent';

const reasons = ['content_filter', 'length', 'max_tokens', 'SAFETY', 'CONTINUATION', 'MAX_TOKENS'] as const;
function parsed(text: string, reason: string): LLMResponse {
  return reason === reason.toUpperCase()
    ? parseGeminiResponse({ candidates: [{ finishReason: reason, content: { parts: [{ text }] } }] })
    : parseOpenAIResponse({ choices: [{ finish_reason: reason, message: { content: text } }] });
}
function provider(response: LLMResponse, schema: boolean): LLMProvider {
  return {
    name: 'direct',
    isReady: () => true,
    chat: async () => response,
    ...(schema ? { generateJSON: async () => response } : {}),
  };
}
for (const schema of [false, true]) {
  it.each(reasons)(
    `rejects valid %s JSON before returning an applicable writing body (${schema ? 'schema' : 'chat'})`,
    async (reason) => {
      const response = parsed('{"text":"The meeting will start soon."}', reason);
      await expect(
        generateWriting(
          provider(response, schema),
          {
            task: 'rewrite',
            text: 'The meeting starts soon.',
          },
          new AbortController().signal,
        ),
      ).rejects.toThrow('Incomplete writing response');
    },
  );
  it.each(reasons)(
    `rejects a valid ready proposal on %s before producing an executable plan (${schema ? 'schema' : 'chat'})`,
    async (reason) => {
      const response = parsed('{"status":"ready","content":"Hello there"}', reason);
      await expect(
        generateActionPlan(provider(response, schema), 'Insert a greeting', 'word', new AbortController().signal),
      ).rejects.toThrow('Incomplete or unexpected action response');
    },
  );
  it.each(reasons)(
    `rejects a valid %s document tool plan before enabling review (${schema ? 'schema' : 'chat'})`,
    async (reason) => {
      const response = parsed('{"tool":"insert_text","input":{"text":"Hello there"}}', reason);
      await expect(
        generateDocumentToolPlan(
          provider(response, schema),
          'Make an introduction',
          { kind: 'word' },
          new AbortController().signal,
        ),
      ).rejects.toThrow('Incomplete document operation response');
    },
  );
  it.each(reasons)(
    `rejects valid %s task-routing JSON before selecting a tool task (${schema ? 'schema' : 'chat'})`,
    async (reason) => {
      const response = parsed('{"task":"tools","language":"en"}', reason);
      await expect(
        resolveRequestIntent(
          provider(response, schema),
          'Make an introduction',
          { kind: 'word' },
          new AbortController().signal,
        ),
      ).rejects.toThrow('Incomplete task routing response');
    },
  );
  it.each(reasons)(
    `rejects a valid %s document draft before returning a complete artifact (${schema ? 'schema' : 'chat'})`,
    async (reason) => {
      const response = parsed('{"text":"A complete-looking document body."}', reason);
      await expect(
        generateDocumentDraft(provider(response, schema), 'Write an introduction', new AbortController().signal),
      ).rejects.toThrow('Incomplete writing response');
    },
  );
}
for (const streaming of [false, true]) {
  it.each(reasons)(
    `rejects a nonempty %s document answer before declaring it complete (${streaming ? 'stream' : 'chat'})`,
    async (reason) => {
      const response = parsed('The budget is 120.', reason);
      const partial: string[] = [];
      const backend: LLMProvider = {
        ...provider(response, false),
        ...(streaming
          ? {
              chatStream: async (_messages: unknown, _tools: unknown, delta: (text: string) => void) => {
                delta(response.text);
                return response;
              },
            }
          : {}),
      };
      await expect(
        generateReadAnswer(
          backend,
          'What is the budget?',
          { kind: 'word' },
          [],
          new AbortController().signal,
          (delta) => partial.push(delta),
        ),
      ).rejects.toThrow('Incomplete document answer');
      expect(partial.join('')).toBe(streaming ? 'The budget is 120.' : '');
    },
  );
}

it.each(reasons)('keeps a %s streamed artifact preview from becoming an accepted document body', async (reason) => {
  const response = parsed('{"text":"A document preview."}', reason);
  let partial = '';
  const backend: LLMProvider = {
    ...provider(response, true),
    generateJSONStream: async (_messages, _schema, delta) => {
      delta(response.text);
      return response;
    },
  };
  await expect(
    generateDocumentDraft(backend, 'Write an introduction', new AbortController().signal, (delta) => {
      partial += delta;
    }),
  ).rejects.toThrow('Incomplete writing response');
  expect(partial).toBe('A document preview.');
});
