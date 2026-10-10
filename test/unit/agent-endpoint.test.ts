import { expect, it } from 'vitest';
import {
  createEndpointProvider,
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
