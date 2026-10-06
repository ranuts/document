import { describe, expect, it } from 'vitest';
import { resolveModelConfig } from '../../packages/agent-core/src/llm/model-source';

describe('self-hosted model sources', () => {
  const config = {
    model_list: [
      {
        model_id: 'qwen',
        model: 'https://old/model',
        model_lib: 'https://old/runtime.wasm',
        required_features: ['shader-f16'],
      },
    ],
  };
  it('overrides both artifacts while preserving model requirements and IndexedDB', () => {
    const resolved = resolveModelConfig(
      config,
      'qwen',
      { modelUrl: '/models/qwen/', modelLibUrl: '/models/qwen/runtime.wasm' },
      'https://example.com/editor',
    );
    expect(resolved.cacheBackend).toBe('indexeddb');
    expect(resolved.model_list[0]).toEqual({
      ...config.model_list[0],
      model: 'https://example.com/models/qwen/',
      model_lib: 'https://example.com/models/qwen/runtime.wasm',
    });
    expect(config.model_list[0].model).toBe('https://old/model');
  });
  it('requires both artifacts for an unknown model', () => {
    expect(() =>
      resolveModelConfig(config, 'custom', { modelUrl: '/models/custom/' }, 'https://example.com'),
    ).toThrow();
    expect(
      resolveModelConfig(
        config,
        'custom',
        { modelUrl: '/models/custom/', modelLibUrl: '/models/custom/lib.wasm' },
        'https://example.com',
      ).model_list.at(-1)?.model_id,
    ).toBe('custom');
  });
  it('rejects non-HTTP artifact URLs', () => {
    expect(() =>
      resolveModelConfig(config, 'qwen', { modelUrl: 'javascript:alert(1)' }, 'https://example.com'),
    ).toThrow();
  });
});
