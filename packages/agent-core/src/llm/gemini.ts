/**
 * Google Gemini cloud LLM provider — browser Direct Mode.
 *
 * Calls the Generative Language `generateContent` endpoint directly from the
 * browser with a key from localStorage (never through a server of ours). Gemini
 * has its own request/response shape (and matches tool results to calls by
 * function *name*, not an id), so the converters here are more involved than the
 * OpenAI/Anthropic ones — see toGeminiContents for how neutral tool_use ids are
 * mapped back to names. Pure converters are exported for unit testing.
 */
import { assertStreamRecord, fetchProviderStream } from './provider-stream';
import { getApiKey } from './keys';
import { DEFAULT_SYSTEM_PROMPT } from './prompt';
import { fetchProviderJson, type ProviderHttpOptions } from './provider-http';
import type { LLMContent, LLMMessage, LLMProvider, LLMResponse, LLMToolDef } from './types';

const DEFAULT_MODEL = 'gemini-2.0-flash';
const DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

interface GeminiPart {
  thought?: boolean;
  text?: string;
  functionCall?: { name: string; args?: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
}
interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}
export interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: GeminiPart[] }; finishReason?: string }>;
}

/** Convert neutral tool defs to Gemini's `functionDeclarations` shape. */
export function toGeminiTools(tools: LLMToolDef[]): Record<string, unknown>[] {
  if (tools.length === 0) return [];
  return [
    {
      functionDeclarations: tools.map((tool) => {
        const decl: Record<string, unknown> = { name: tool.name, description: tool.description };
        // Gemini rejects an object schema with no properties; only send params when present.
        const props = (tool.inputSchema as { properties?: Record<string, unknown> }).properties;
        if (props && Object.keys(props).length > 0) decl.parameters = tool.inputSchema;
        return decl;
      }),
    },
  ];
}

/** Wrap a tool-result string as a Gemini functionResponse object. */
function toResponseObject(content: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(content);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return { result: parsed };
  } catch {
    return { result: content };
  }
}

/**
 * Convert neutral messages to Gemini `contents`. Because Gemini keys function
 * responses by name (not by the tool_use id our neutral shape carries), we first
 * build an id→name map from the assistant tool_use blocks, then resolve each
 * tool_result's name from it.
 */
export function toGeminiContents(messages: LLMMessage[]): GeminiContent[] {
  const idToName = new Map<string, string>();
  for (const message of messages) {
    if (typeof message.content === 'string') continue;
    for (const block of message.content) {
      if (block.type === 'tool_use') idToName.set(block.id, block.name);
    }
  }

  const contents: GeminiContent[] = [];
  for (const message of messages) {
    const role: GeminiContent['role'] = message.role === 'assistant' ? 'model' : 'user';
    if (typeof message.content === 'string') {
      contents.push({ role, parts: [{ text: message.content }] });
      continue;
    }
    const parts: GeminiPart[] = [];
    for (const block of message.content) {
      if (block.type === 'text') {
        parts.push({ text: block.text });
      } else if (block.type === 'tool_use') {
        parts.push({ functionCall: { name: block.name, args: block.input } });
      } else if (block.type === 'tool_result') {
        parts.push({
          functionResponse: {
            name: idToName.get(block.toolUseId) ?? block.toolUseId,
            response: toResponseObject(block.content),
          },
        });
      }
    }
    if (parts.length > 0) contents.push({ role, parts });
  }
  return contents;
}

/** Parse a Gemini response into the neutral {@link LLMResponse}. */
export function parseGeminiResponse(response: GeminiResponse): LLMResponse {
  const candidate = response.candidates?.[0];
  const parts = candidate?.content?.parts ?? [];
  let text = '';
  const toolCalls: LLMResponse['toolCalls'] = [];
  const assistant: LLMContent[] = [];
  parts.forEach((part, index) => {
    if (part.thought) return;
    if (part.text) {
      text += part.text;
      assistant.push({ type: 'text', text: part.text });
    } else if (part.functionCall) {
      // Gemini calls carry no id; synthesise a stable one so the runtime can pair
      // the tool_result back (toGeminiContents only needs the name, recovered above).
      const id = `${part.functionCall.name}-${index}`;
      const input = part.functionCall.args ?? {};
      toolCalls.push({ id, name: part.functionCall.name, input });
      assistant.push({ type: 'tool_use', id, name: part.functionCall.name, input });
    }
  });
  const finishReason = candidate?.finishReason;
  // CONTINUATION exhausts the current generation budget and requires another
  // request. Only explicit STOP completes a candidate. Keep missing reasons
  // compatible with intermediate streaming chunks; other explicit terminations
  // are incomplete and cannot authorize a tool call.
  const stopReason =
    finishReason === 'MAX_TOKENS' || finishReason === 'CONTINUATION'
      ? 'max_tokens'
      : [
            'SAFETY',
            'RECITATION',
            'BLOCKLIST',
            'PROHIBITED_CONTENT',
            'SPII',
            'LANGUAGE',
            'IMAGE_SAFETY',
            'IMAGE_PROHIBITED_CONTENT',
            'IMAGE_RECITATION',
            'ESCALATION',
            'PUP_LIMITED_DISABLED',
          ].includes(finishReason ?? '')
        ? 'content_filter'
        : finishReason === 'STOP' || finishReason === undefined
          ? (finishReason ?? 'stop')
          : 'incomplete';
  return {
    text,
    toolCalls,
    stopReason,
    assistant: { role: 'assistant', content: assistant },
  };
}

export interface GeminiProviderOptions extends ProviderHttpOptions {
  apiKey?: string;
  geminiModel?: string;
  systemPrompt?: string;
  geminiBaseURL?: string;
}

export class GeminiProvider implements LLMProvider {
  readonly toolCallingMode = 'native' as const;
  readonly name = 'gemini';
  private readonly apiKey?: string;
  private readonly model: string;
  private readonly systemPrompt: string;
  private readonly baseURL: string;
  private readonly requestOptions: ProviderHttpOptions;

  constructor(options: GeminiProviderOptions = {}) {
    this.apiKey = options.apiKey ?? getApiKey('gemini');
    this.model = options.geminiModel ?? DEFAULT_MODEL;
    this.systemPrompt = options.systemPrompt ?? DEFAULT_SYSTEM_PROMPT;
    this.baseURL = options.geminiBaseURL ?? DEFAULT_BASE_URL;
    this.requestOptions = {
      fetchImpl: options.fetchImpl,
      timeoutMs: options.timeoutMs,
      maxResponseBytes: options.maxResponseBytes,
    };
  }

  isReady(): boolean {
    return !!this.apiKey;
  }

  chat(messages: LLMMessage[], tools: LLMToolDef[], signal?: AbortSignal): Promise<LLMResponse> {
    return this.request(messages, tools, signal);
  }

  chatStream(
    messages: LLMMessage[],
    tools: LLMToolDef[],
    onDelta: (text: string) => void,
    signal?: AbortSignal,
  ): Promise<LLMResponse> {
    return tools.length ? this.chat(messages, tools, signal) : this.request(messages, tools, signal, onDelta);
  }

  private async request(
    messages: LLMMessage[],
    tools: LLMToolDef[],
    signal?: AbortSignal,
    onDelta?: (text: string) => void,
  ): Promise<LLMResponse> {
    signal?.throwIfAborted();
    if (!this.apiKey) {
      throw new Error('Gemini API key is not configured');
    }
    const body: Record<string, unknown> = {
      systemInstruction: { parts: [{ text: this.systemPrompt }] },
      contents: toGeminiContents(messages),
    };
    const geminiTools = toGeminiTools(tools);
    if (geminiTools.length > 0) body.tools = geminiTools;

    if (onDelta) {
      let text = '';
      let finish: string | undefined;
      let fallback: LLMResponse | undefined;
      await fetchProviderStream(
        'Gemini',
        `${this.baseURL}/models/${this.model}:streamGenerateContent?alt=sse`,
        {
          method: 'POST',
          signal,
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': this.apiKey },
          body: JSON.stringify(body),
        },
        this.requestOptions,
        'sse',
        (value) => {
          assertStreamRecord('Gemini', value);
          const candidate = (value as GeminiResponse).candidates?.[0];
          for (const part of candidate?.content?.parts ?? []) {
            if (part.functionCall) throw new Error('Unexpected Gemini tool response');
            if (part.thought || !part.text) continue;
            if (finish || typeof part.text !== 'string') throw new Error('Invalid Gemini stream');
            text += part.text;
            onDelta(part.text);
            signal?.throwIfAborted();
          }
          if (candidate?.finishReason) {
            finish = candidate.finishReason;
            return false;
          }
        },
        (value) => {
          assertStreamRecord('Gemini', value);
          fallback = parseGeminiResponse(value as GeminiResponse);
          if (fallback.toolCalls.length) throw new Error('Unexpected Gemini tool response');
          if (fallback.text) onDelta(fallback.text);
        },
      );
      if (fallback) return fallback;
      if (!finish) throw new Error('Incomplete Gemini stream');
      return parseGeminiResponse({ candidates: [{ content: { parts: [{ text }] }, finishReason: finish }] });
    }

    const data = await fetchProviderJson<GeminiResponse>(
      'Gemini',
      `${this.baseURL}/models/${this.model}:generateContent`,
      {
        method: 'POST',
        ...(signal ? { signal } : {}),
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': this.apiKey },
        body: JSON.stringify(body),
      },
      this.requestOptions,
    );
    signal?.throwIfAborted();
    return parseGeminiResponse(data);
  }
}
