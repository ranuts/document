import {
  accumulateOpenAIStream,
  parseOpenAIResponse,
  toOpenAIMessages,
  type OpenAICompletion,
  type OpenAIStreamChunk,
} from './openai-format';
import { budgetMessagesByTokens } from '../context-budget';
import { CHAT_ONLY_SYSTEM_PROMPT } from './prompt';
import {
  generationParameters,
  normalizeGenerationOptions,
  type GenerationOptions,
  type GenerationSettings,
} from './generation';
import type { LLMMessage, LocalLLMProvider, LLMToolDef } from './types';
import { selectWllamaStorage } from './wllama-cache-storage';
import { getWllamaCompatibility } from './wllama-compat-assets';
import { resolveModelArtifactUrl } from './model-source';

export interface WllamaEngine {
  isModelLoaded(): boolean;
  countChatTokens?(body: Record<string, unknown>): Promise<{ promptTokens: number; contextTokens: number }>;
  createChatCompletion(body: Record<string, unknown>): Promise<OpenAICompletion | AsyncIterable<OpenAIStreamChunk>>;
  exit(): Promise<void>;
}
export interface WllamaProviderOptions {
  generation?: GenerationOptions;
  systemPrompt?: string;
  modelUrl?: string;
  modelFiles?: Blob[];
  /** Self-hosted WASM asset; no implicit CDN runtime download. */
  wasmUrl?: string;
  cpuOnly?: boolean;
  onProgress?: (progress: { loaded: number; total: number }) => void;
  engineFactory?: (signal: AbortSignal) => Promise<WllamaEngine>;
}

/** Experimental, chat-only GGUF backend. Loading is always explicit. */
export class WllamaProvider implements LocalLLMProvider {
  readonly name = 'wllama';
  private engine?: WllamaEngine;
  private loading?: Promise<void>;
  private lifetime = new AbortController();
  private queue: Promise<unknown> = Promise.resolve();
  private cleanup?: Promise<void>;
  private loadingEngine?: WllamaEngine;
  private releases = new WeakMap<WllamaEngine, Promise<void>>();
  private generation: GenerationSettings;
  constructor(private options: WllamaProviderOptions) {
    this.generation = normalizeGenerationOptions(options.generation);
  }
  setGenerationOptions(options: GenerationOptions): void {
    this.generation = normalizeGenerationOptions(options);
  }
  isReady(): boolean {
    return !this.lifetime.signal.aborted && !!this.engine?.isModelLoaded();
  }
  hasExactContextBudget(): boolean {
    return this.isReady() && typeof this.engine?.countChatTokens === 'function';
  }
  async preload(): Promise<void> {
    if (this.cleanup) await this.cleanup;
    if (this.lifetime.signal.aborted) throw new Error('Provider disposed');
    if (this.isReady()) return;
    if (!this.loading)
      this.loading = this.load().finally(() => {
        this.loading = undefined;
      });
    return this.loading;
  }
  private async load(): Promise<void> {
    let engine: WllamaEngine | undefined;
    try {
      if (this.options.engineFactory) engine = await this.options.engineFactory(this.lifetime.signal);
      else {
        const modelUrl =
          !this.options.modelFiles?.length && this.options.modelUrl
            ? resolveModelArtifactUrl(this.options.modelUrl)
            : undefined;
        const cpuRuntime =
          this.options.cpuOnly && !this.options.wasmUrl
            ? await (await import('./wllama-cpu-runtime')).loadWllamaCPURuntime()
            : undefined;
        const wasmUrl =
          this.options.wasmUrl ??
          cpuRuntime?.wasmUrl ??
          (await import('@wllama/wllama/esm/wasm/wllama.wasm?url')).default;
        const { Wllama, CacheManager } = cpuRuntime ?? (await import('@wllama/wllama/esm/index.js'));
        const storage = await selectWllamaStorage(
          navigator.storage?.getDirectory
            ? async () => (await navigator.storage.getDirectory()).getDirectoryHandle('cache', { create: true })
            : undefined,
          () => caches.open('local-ai-wllama-models-v1'),
          location.origin,
        );
        this.lifetime.signal.throwIfAborted();
        const runtime = new Wllama(
          { default: wasmUrl },
          {
            allowOffline: true,
            cacheManager: storage ? new CacheManager([storage]) : undefined,
          },
        );
        engine = runtime as unknown as WllamaEngine;
        this.loadingEngine = engine;
        runtime.setCompat(cpuRuntime ? cpuRuntime.compatibility : await getWllamaCompatibility(), 'firefox_safari');
        this.lifetime.signal.throwIfAborted();
        const params = {
          signal: this.lifetime.signal,
          progressCallback: this.options.onProgress,
          n_ctx: 2048,
          n_gpu_layers: this.options.cpuOnly ? 0 : undefined,
          n_threads: globalThis.crossOriginIsolated ? Math.min(navigator.hardwareConcurrency || 2, 4) : 1,
          reasoning: false,
        };
        if (this.options.modelFiles?.length) await runtime.loadModel(this.options.modelFiles, params);
        else if (modelUrl) await runtime.loadModelFromUrl(modelUrl, params);
        else throw new Error('Choose a GGUF model URL or local files');
        // A resolved SDK load and metadata can outlive a failed native allocation.
        // Confirm the loaded tokenizer/context without evaluating or generating text.
        if (engine.countChatTokens) {
          const measured = await engine.countChatTokens({
            messages: [{ role: 'user', content: 'Ready.' }],
            max_tokens: 1,
            stream: false,
            abortSignal: this.lifetime.signal,
          });
          if (
            !Number.isSafeInteger(measured.promptTokens) ||
            measured.promptTokens < 0 ||
            !Number.isSafeInteger(measured.contextTokens) ||
            measured.contextTokens <= 0
          )
            throw new Error('Local model initialization did not provide a valid context');
        }
      }
      this.lifetime.signal.throwIfAborted();
      this.engine = engine;
    } catch (error) {
      if (engine) {
        const released = this.release(engine);
        try {
          await released;
        } catch (cleanupError) {
          // Failed teardown must stay observable and prevent a second runtime.
          this.cleanup = released;
          throw new AggregateError([error, cleanupError], 'Local model initialization and cleanup failed');
        }
      }
      throw this.lifetime.signal.aborted ? this.lifetime.signal.reason : error;
    } finally {
      if (this.loadingEngine === engine) this.loadingEngine = undefined;
    }
  }
  private release(engine: WllamaEngine): Promise<void> {
    let release = this.releases.get(engine);
    if (!release) {
      release = Promise.resolve().then(() => engine.exit());
      this.releases.set(engine, release);
    }
    return release;
  }
  async dispose(): Promise<void> {
    this.lifetime.abort();
    const engine = this.engine ?? this.loadingEngine;
    this.engine = undefined;
    this.loadingEngine = undefined;
    await this.cleanup;
    if (engine) await this.release(engine);
  }
  private async interruptible<T>(engine: WllamaEngine, signal: AbortSignal, work: () => Promise<T>): Promise<T> {
    signal.throwIfAborted();
    let stop!: () => void;
    const cancelled = new Promise<never>((_resolve, reject) => {
      stop = () => {
        if (this.engine === engine) {
          this.engine = undefined;
          this.cleanup = this.release(engine);
          // Cleanup failure remains observable to preload/dispose without an unhandled rejection.
          void this.cleanup.catch(() => undefined);
        }
        reject(signal.reason);
      };
      signal.addEventListener('abort', stop, { once: true });
    });
    try {
      return await Promise.race([Promise.resolve().then(work), cancelled]);
    } catch (error) {
      // A native trap invalidates runtime state; do not send another request to it.
      if (
        error instanceof Error &&
        ['RuntimeError', 'WllamaRuntimeError'].includes(error.name) &&
        this.engine === engine
      ) {
        this.engine = undefined;
        this.cleanup = this.release(engine);
        void this.cleanup.catch(() => undefined);
        // A retired runtime requires explicit reload; keep private SDK details in the cause.
        throw new Error('Local model worker failed. Reload the model to retry.', { cause: error });
      }
      throw error;
    } finally {
      signal.removeEventListener('abort', stop);
    }
  }
  generateJSON(messages: LLMMessage[], schema: Record<string, unknown>, signal?: AbortSignal) {
    return this.run(messages, undefined, signal, schema);
  }
  chat(messages: LLMMessage[], _tools: LLMToolDef[], signal?: AbortSignal) {
    return this.run(messages, undefined, signal);
  }
  chatStream(messages: LLMMessage[], _tools: LLMToolDef[], onDelta: (text: string) => void, signal?: AbortSignal) {
    return this.run(messages, onDelta, signal);
  }
  private run(
    messages: LLMMessage[],
    onDelta?: (text: string) => void,
    signal?: AbortSignal,
    schema?: Record<string, unknown>,
  ) {
    const operation = this.queue
      .then(async () => {
        signal?.throwIfAborted();
        if (!this.isReady()) throw new Error('Load the local model before sending');
        const abortSignal = signal ? AbortSignal.any([signal, this.lifetime.signal]) : this.lifetime.signal;
        const started = performance.now();
        let firstTextMs: number | undefined;
        const delta = onDelta
          ? (text: string): void => {
              if (abortSignal.aborted) return;
              if (text && firstTextMs === undefined) firstTextMs = performance.now() - started;
              onDelta(text);
            }
          : undefined;
        const engine = this.engine!;
        let contextTrimmed = false;
        const completion = await this.interruptible(engine, abortSignal, async () => {
          abortSignal.throwIfAborted();
          const systemPrompt = this.generation.systemPrompt ?? this.options.systemPrompt ?? CHAT_ONLY_SYSTEM_PROMPT;
          let request = {
            messages: toOpenAIMessages(messages, systemPrompt),
            ...generationParameters(this.generation),
            stream: !!onDelta,
            ...(schema
              ? {
                  // Match the GPU bounded-task policy without changing chat settings.
                  temperature: 0,
                  response_format: {
                    type: 'json_schema',
                    json_schema: { name: 'local_task', schema, strict: true },
                  },
                }
              : {}),
            ...(onDelta ? { stream_options: { include_usage: true } } : {}),
            abortSignal,
          };
          if (engine.countChatTokens) {
            const base = request;
            const budget = await budgetMessagesByTokens(
              messages,
              async (candidate) => {
                request = { ...base, messages: toOpenAIMessages(candidate, systemPrompt) };
                return engine.countChatTokens!(request);
              },
              request.max_tokens + 1,
              abortSignal,
            );
            contextTrimmed = budget.trimmed;
          }
          abortSignal.throwIfAborted();
          const result = await engine.createChatCompletion(request);
          return onDelta
            ? await accumulateOpenAIStream(result as AsyncIterable<OpenAIStreamChunk>, delta!, abortSignal)
            : (result as OpenAICompletion);
        });
        abortSignal.throwIfAborted();
        const response = parseOpenAIResponse(completion);
        if (contextTrimmed) response.contextTrimmed = true;
        const elapsed = performance.now() - started;
        response.usage = {
          ...response.usage,
          responseDurationMs: elapsed,
          ...(firstTextMs !== undefined ? { timeToFirstTextMs: firstTextMs } : {}),
          ...(response.usage?.completionTokens !== undefined && elapsed > 0
            ? { endToEndTokensPerSecond: (response.usage.completionTokens * 1000) / elapsed }
            : {}),
        };
        return response;
      })
      .catch((error: unknown) => {
        // The pinned native SDK reports its measured token/context sizes in this
        // inference error. Do not estimate from characters or expose SDK details.
        if (
          error instanceof Error &&
          error.name !== 'AbortError' &&
          'type' in error &&
          error.type === 'inference_error' &&
          /^request \(\d+ tokens\) exceeds the available context size \(\d+ tokens\), try increasing it$/.test(
            error.message,
          )
        )
          throw new Error('agentContextTooLong');
        throw error;
      });
    this.queue = operation.catch(() => undefined);
    return operation;
  }
}
