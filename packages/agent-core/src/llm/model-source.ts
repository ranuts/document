import type { AppConfig } from '@mlc-ai/web-llm';

export interface ModelSource {
  modelUrl?: string;
  modelLibUrl?: string;
}

export class ModelSourceError extends Error {
  constructor() {
    super('Model artifacts require HTTP or HTTPS');
    this.name = 'ModelSourceError';
  }
}

/** Shared URL policy for downloaded GPU artifacts and CPU GGUF models. */
export function resolveModelArtifactUrl(value: string, base?: string): string {
  try {
    const resolved = new URL(value, base ?? globalThis.location?.href);
    if (!['http:', 'https:'].includes(resolved.protocol)) throw new ModelSourceError();
    return resolved.href;
  } catch {
    throw new ModelSourceError();
  }
}

/** Keep artifact resolution identical for loading and cache checks. */
export function resolveModelConfig(
  config: AppConfig,
  modelId: string,
  source: ModelSource = {},
  base?: string,
): AppConfig {
  if (!source.modelUrl && !source.modelLibUrl) return { ...config, cacheBackend: 'indexeddb' };
  const url = (value: string): string => resolveModelArtifactUrl(value, base);
  const existing = config.model_list.find((record) => record.model_id === modelId);
  if (!existing && (!source.modelUrl || !source.modelLibUrl))
    throw new Error('Custom models require a model directory and compatible WASM URL');
  const record = {
    ...existing,
    model_id: modelId,
    model: source.modelUrl ? url(source.modelUrl) : existing!.model,
    model_lib: source.modelLibUrl ? url(source.modelLibUrl) : existing!.model_lib,
  };
  return {
    ...config,
    cacheBackend: 'indexeddb',
    model_list: [...config.model_list.filter((item) => item.model_id !== modelId), record],
  };
}
