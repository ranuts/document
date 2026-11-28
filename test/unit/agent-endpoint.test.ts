import { describe, expect, it } from 'vitest';
import {
  createEndpointProvider,
  listEndpointModels,
  validateRemoteEndpointUrl,
  validateWritingEndpoint,
  writingEndpointDataPath,
} from '../../packages/agent-core/src/llm/endpoint';

it('requires https for a remote endpoint and keeps its API path', () => {
  expect(validateRemoteEndpointUrl('https://api.example.com/v1/')).toBe('https://api.example.com/v1');
  expect(validateRemoteEndpointUrl('https://api.example.com')).toBe('https://api.example.com');
  // Clear text would put the key and the selected document text on the wire.
  for (const value of [
    'http://api.example.com/v1',
    'http://192.168.1.9:8000/v1',
    'https://user:secret@api.example.com',
    'https://api.example.com/v1?token=secret',
    'https://api.example.com/v1#frag',
  ])
    expect(() => validateRemoteEndpointUrl(value)).toThrow();
});

it('normalises a loopback service and a cloud endpoint differently', () => {
  expect(validateWritingEndpoint({ kind: 'loopback', baseUrl: '', model: ' qwen3:8b ' })).toEqual({
    kind: 'loopback',
    baseUrl: 'http://localhost:11434',
    model: 'qwen3:8b',
  });
  // A loopback service is origin-only; the native API path is fixed by the provider.
  expect(() =>
    validateWritingEndpoint({ kind: 'loopback', baseUrl: 'http://localhost:11434/api', model: 'm' }),
  ).toThrow();
  expect(
    validateWritingEndpoint({ kind: 'openai-compatible', baseUrl: 'https://api.example.com/v1', model: 'm' }),
  ).toEqual({ kind: 'openai-compatible', baseUrl: 'https://api.example.com/v1', model: 'm' });
  expect(validateWritingEndpoint({ kind: 'anthropic', baseUrl: '', model: 'claude-sonnet-4-5' })).toEqual({
    kind: 'anthropic',
    baseUrl: '',
    model: 'claude-sonnet-4-5',
  });
});

it('rejects an endpoint without a model, without a base URL or of an unknown kind', () => {
  expect(() => validateWritingEndpoint({ kind: 'loopback', baseUrl: '', model: '   ' })).toThrow();
  expect(() => validateWritingEndpoint({ kind: 'openai-compatible', baseUrl: '  ', model: 'm' })).toThrow();
  expect(() =>
    validateWritingEndpoint({ kind: 'not-a-kind' as unknown as 'loopback', baseUrl: '', model: 'm' }),
  ).toThrow();
});

it('reports where the text goes, so the host can say it out loud', () => {
  expect(writingEndpointDataPath({ kind: 'loopback', baseUrl: '', model: 'm' })).toBe('device');
  for (const kind of ['openai-compatible', 'anthropic', 'gemini'] as const)
    expect(writingEndpointDataPath({ kind, baseUrl: '', model: 'm' })).toBe('remote');
});

it('builds the provider that matches the endpoint kind', () => {
  expect(createEndpointProvider({ kind: 'loopback', baseUrl: '', model: 'qwen3:8b' }).name).toBe('loopback');
  expect(
    createEndpointProvider({ kind: 'openai-compatible', baseUrl: 'https://api.example.com/v1', model: 'm' }, 'k').name,
  ).toBe('openai');
  expect(createEndpointProvider({ kind: 'anthropic', baseUrl: '', model: 'm' }, 'k').name).toBe('anthropic');
  expect(createEndpointProvider({ kind: 'gemini', baseUrl: '', model: 'm' }, 'k').name).toBe('gemini');
});

describe('listEndpointModels', () => {
  const reply = (body: unknown) => {
    const calls: Array<{ url: string; headers: Record<string, string> }> = [];
    const fetchImpl = async (url: string, init: RequestInit) => {
      calls.push({ url, headers: (init.headers ?? {}) as Record<string, string> });
      return Response.json(body);
    };
    return { calls, fetchImpl };
  };

  it('reads an OpenAI-compatible list with the bearer key, sorted and de-duplicated', async () => {
    const { calls, fetchImpl } = reply({ data: [{ id: 'gpt-b' }, { id: 'gpt-a' }, { id: 'gpt-b' }, { id: 7 }] });
    await expect(
      listEndpointModels({ kind: 'openai-compatible', baseUrl: 'https://api.example.com/v1/' }, 'k', { fetchImpl }),
    ).resolves.toEqual(['gpt-a', 'gpt-b']);
    expect(calls).toEqual([{ url: 'https://api.example.com/v1/models', headers: { Authorization: 'Bearer k' } }]);
  });

  it('reads installed models from a loopback service without sending a key', async () => {
    const { calls, fetchImpl } = reply({ models: [{ name: 'qwen3:8b' }, { name: 'llama3.2:3b' }] });
    await expect(listEndpointModels({ kind: 'loopback', baseUrl: '' }, 'unused', { fetchImpl })).resolves.toEqual([
      'llama3.2:3b',
      'qwen3:8b',
    ]);
    expect(calls).toEqual([{ url: 'http://localhost:11434/api/tags', headers: {} }]);
  });

  it('reads Anthropic and Gemini lists with their own headers; Gemini keeps chat models only', async () => {
    const anthropic = reply({ data: [{ id: 'claude-x' }] });
    await expect(
      listEndpointModels({ kind: 'anthropic', baseUrl: '' }, 'ak', { fetchImpl: anthropic.fetchImpl }),
    ).resolves.toEqual(['claude-x']);
    expect(anthropic.calls[0]!.url.startsWith('https://api.anthropic.com/v1/models')).toBe(true);
    expect(anthropic.calls[0]!.headers['x-api-key']).toBe('ak');

    const gemini = reply({
      models: [
        { name: 'models/gemini-pro', supportedGenerationMethods: ['generateContent'] },
        { name: 'models/text-embedding', supportedGenerationMethods: ['embedContent'] },
      ],
    });
    await expect(
      listEndpointModels({ kind: 'gemini', baseUrl: '' }, 'gk', { fetchImpl: gemini.fetchImpl }),
    ).resolves.toEqual(['gemini-pro']);
    expect(gemini.calls[0]!.headers['x-goog-api-key']).toBe('gk');
  });

  it('refuses an address a connection would refuse, before any request', async () => {
    const { calls, fetchImpl } = reply({ data: [] });
    await expect(
      listEndpointModels({ kind: 'openai-compatible', baseUrl: 'http://api.example.com/v1' }, 'k', { fetchImpl }),
    ).rejects.toThrow();
    await expect(listEndpointModels({ kind: 'openai-compatible', baseUrl: '' }, 'k', { fetchImpl })).rejects.toThrow();
    expect(calls).toEqual([]);
  });
});
