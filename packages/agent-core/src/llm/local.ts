import type { LLMMessage, LLMResponse, LLMToolDef, LocalLLMProvider } from './types';
import { WebLLMProvider, type WebLLMProviderOptions } from './webllm';
import { WllamaProvider, type WllamaProviderOptions } from './wllama';
import { normalizeGenerationOptions, type GenerationOptions, type GenerationSettings } from './generation';

function localResponse(response: LLMResponse): LLMResponse {
  if (response.toolCalls.length)
    throw new Error('Local inference cannot invoke editor tools; review a text proposal instead');
  return response;
}

/** Revision-pinned availability fallback; multilingual quality remains experimental. */
export const DEFAULT_CPU_MODEL_URL =
  'https://huggingface.co/bartowski/Qwen_Qwen3-0.6B-GGUF/resolve/60b85c0e3d8fe0f6474f406922a26d12aca4550d/Qwen_Qwen3-0.6B-Q4_K_M.gguf';

export async function detectGPUAdapter(): Promise<boolean> {
  const gpu = typeof navigator === 'undefined' ? undefined : navigator.gpu;
  if (!gpu) return false;
  try {
    const adapter = await gpu.requestAdapter();
    return adapter !== null;
  } catch {
    return false;
  }
}

export interface LocalInferenceOptions {
  generation?: GenerationOptions;
  webllm?: WebLLMProviderOptions;
  wllama?: WllamaProviderOptions;
  /** Host integrations can provide local implementations of the lifecycle interface. */
  gpu?: () => LocalLLMProvider;
  cpu?: () => LocalLLMProvider;
  detectGPU?: () => Promise<boolean>;
  onBackend?: (backend: 'webllm' | 'wllama') => void;
}

/** Local-only initialization fallback. Never replays an in-flight generation. */
export class LocalInferenceProvider implements LocalLLMProvider {
  readonly name = 'local';
  private active?: LocalLLMProvider;
  private candidate?: LocalLLMProvider;
  private loading?: Promise<void>;
  private lifetime = new AbortController();
  private selected?: 'webllm' | 'wllama';
  private generation: GenerationSettings;

  constructor(private readonly options: LocalInferenceOptions = {}) {
    this.generation = normalizeGenerationOptions(options.generation);
  }
  setGenerationOptions(options: GenerationOptions): void {
    this.generation = normalizeGenerationOptions(options);
    this.active?.setGenerationOptions?.(this.generation);
    this.candidate?.setGenerationOptions?.(this.generation);
  }

  get backend(): 'webllm' | 'wllama' | undefined {
    return this.selected;
  }

  isReady(): boolean {
    return !this.lifetime.signal.aborted && !!this.active?.isReady();
  }

  hasExactContextBudget(): boolean {
    return this.isReady() && !!this.active?.hasExactContextBudget?.();
  }

  preload(): Promise<void> {
    if (this.lifetime.signal.aborted) return Promise.reject(this.lifetime.signal.reason);
    if (this.isReady()) return Promise.resolve();
    if (!this.loading) {
      this.loading = this.load().finally(() => {
        this.loading = undefined;
      });
    }
    return this.loading;
  }

  private async load(): Promise<void> {
    const signal = this.lifetime.signal;
    if (this.active) {
      const previous = this.active;
      this.active = undefined;
      this.selected = undefined;
      await previous.dispose();
    }
    let hasGPU = false;
    try {
      hasGPU = await (this.options.detectGPU ?? detectGPUAdapter)();
    } catch {
      /* CPU remains available. */
    }
    signal.throwIfAborted();
    const candidates: Array<'webllm' | 'wllama'> = hasGPU ? ['webllm', 'wllama'] : ['wllama'];
    const failures: unknown[] = [];
    for (const backend of candidates) {
      signal.throwIfAborted();
      let provider: LocalLLMProvider | undefined;
      try {
        provider =
          backend === 'webllm'
            ? (this.options.gpu?.() ??
              new WebLLMProvider({ ...this.options.webllm, generation: this.generation, chatOnly: true }))
            : (this.options.cpu?.() ??
              new WllamaProvider({
                ...this.options.wllama,
                modelUrl: this.options.wllama?.modelUrl || DEFAULT_CPU_MODEL_URL,
                cpuOnly: true,
                generation: this.generation,
              }));
        this.candidate = provider;
        this.options.onBackend?.(backend);
        await provider.preload();
        signal.throwIfAborted();
        if (!provider.isReady()) throw new Error(`${backend} initialization completed without a ready engine`);
        this.active = provider;
        this.selected = backend;
        return;
      } catch (error) {
        // dispose() owns the candidate when it cancels an in-flight load.
        if (this.candidate === provider) {
          this.candidate = undefined;
          try {
            await provider?.dispose();
          } catch (cleanupError) {
            signal.throwIfAborted();
            throw new AggregateError([error, cleanupError], 'Local engine cleanup failed');
          }
        }
        signal.throwIfAborted();
        if (typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError') throw error;
        failures.push(error);
      } finally {
        if (this.candidate === provider) this.candidate = undefined;
      }
    }
    throw new AggregateError(failures, `Local AI could not initialize: ${failures.map(String).join('; ')}`);
  }

  async dispose(): Promise<void> {
    if (this.lifetime.signal.aborted) return;
    this.lifetime.abort();
    const provider = this.active ?? this.candidate;
    this.active = this.candidate = undefined;
    this.selected = undefined;
    await provider?.dispose();
  }

  private requireReady(signal?: AbortSignal): LocalLLMProvider {
    signal?.throwIfAborted();
    this.lifetime.signal.throwIfAborted();
    if (!this.isReady()) throw new Error('Load the local model before sending');
    return this.active!;
  }

  chat(messages: LLMMessage[], _tools: LLMToolDef[], signal?: AbortSignal): Promise<LLMResponse> {
    try {
      return this.requireReady(signal).chat(messages, [], signal).then(localResponse);
    } catch (error) {
      return Promise.reject(error);
    }
  }

  generateJSON(messages: LLMMessage[], schema: Record<string, unknown>, signal?: AbortSignal): Promise<LLMResponse> {
    try {
      const provider = this.requireReady(signal);
      return (
        provider.generateJSON ? provider.generateJSON(messages, schema, signal) : provider.chat(messages, [], signal)
      ).then(localResponse);
    } catch (error) {
      return Promise.reject(error);
    }
  }

  chatStream(
    messages: LLMMessage[],
    _tools: LLMToolDef[],
    onDelta: (text: string) => void,
    signal?: AbortSignal,
  ): Promise<LLMResponse> {
    try {
      const provider = this.requireReady(signal);
      if (provider.chatStream) return provider.chatStream(messages, [], onDelta, signal).then(localResponse);
      return provider.chat(messages, [], signal).then((result) => {
        localResponse(result);
        onDelta(result.text);
        return result;
      });
    } catch (error) {
      return Promise.reject(error);
    }
  }
}
