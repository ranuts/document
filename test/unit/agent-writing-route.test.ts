import { expect, it } from 'vitest';
import { resolveWritingRoute } from '../../packages/agent-core/src/llm/writing-route';

const local = { backend: 'webllm' as const, model: 'Qwen3-1.7B-q4f16_1-MLC' };
const loopback = { kind: 'loopback' as const, baseUrl: 'http://127.0.0.1:11434', model: 'qwen3:8b' };
const remote = { kind: 'openai-compatible' as const, baseUrl: 'https://api.example.com/v1', model: 'gpt-4o-mini' };

it('prefers the loopback service by default and reports the device data path', () => {
  expect(
    resolveWritingRoute({ loopback, remote, preference: 'device-first', localWritingConsent: false, local }),
  ).toEqual({
    kind: 'endpoint',
    endpoint: loopback,
    dataPath: 'device',
    experimental: false,
  });
});

it('sends writing to the cloud endpoint only when the user asks for it, and says so', () => {
  const route = resolveWritingRoute({
    loopback,
    remote,
    preference: 'remote-first',
    localWritingConsent: false,
    local,
  });
  expect(route).toEqual({ kind: 'endpoint', endpoint: remote, dataPath: 'remote', experimental: false });
  // The reported data path is what lets the host warn before the text leaves.
  expect(route).toHaveProperty('dataPath', 'remote');
});

it('uses a connected cloud endpoint when no loopback service exists', () => {
  expect(resolveWritingRoute({ remote, preference: 'device-first', localWritingConsent: false, local })).toMatchObject({
    kind: 'endpoint',
    endpoint: remote,
    dataPath: 'remote',
  });
});

it('blocks writing when nothing is connected and consent is absent', () => {
  expect(resolveWritingRoute({ preference: 'device-first', localWritingConsent: false, local })).toEqual({
    kind: 'blocked',
    reason: 'local-writing-disabled',
  });
});

it('returns the browser-local binding as experimental only with explicit consent', () => {
  expect(resolveWritingRoute({ preference: 'device-first', localWritingConsent: true, local })).toEqual({
    kind: 'local',
    binding: local,
    dataPath: 'device',
    experimental: true,
  });
});

it('falls back to the browser-local engine only after the connected endpoints are exhausted', () => {
  expect(resolveWritingRoute({ remote, preference: 'device-first', localWritingConsent: true, local })).toMatchObject({
    kind: 'endpoint',
    endpoint: remote,
  });
});

it('rejects a mismatched or invalid endpoint instead of silently falling back', () => {
  expect(() =>
    resolveWritingRoute({
      loopback: remote,
      preference: 'device-first',
      localWritingConsent: true,
      local,
    }),
  ).toThrow('Invalid loopback writing endpoint');
  expect(() =>
    resolveWritingRoute({ remote: loopback, preference: 'device-first', localWritingConsent: true, local }),
  ).toThrow('Invalid remote writing endpoint');
  expect(() =>
    resolveWritingRoute({
      loopback: { kind: 'loopback', baseUrl: 'https://example.com', model: 'm' },
      preference: 'device-first',
      localWritingConsent: true,
      local,
    }),
  ).toThrow();
  expect(() =>
    resolveWritingRoute({
      remote: { kind: 'openai-compatible', baseUrl: 'http://api.example.com', model: 'm' },
      preference: 'device-first',
      localWritingConsent: true,
      local,
    }),
  ).toThrow();
});

it('rejects a browser-local binding that is not a browser engine', () => {
  expect(() =>
    resolveWritingRoute({
      localWritingConsent: true,
      preference: 'device-first',
      local: { backend: 'loopback' as unknown as 'webllm', model: 'qwen3:8b' },
    }),
  ).toThrow();
  expect(() =>
    resolveWritingRoute({
      localWritingConsent: true,
      preference: 'device-first',
      local: { backend: 'webllm', model: ' ' },
    }),
  ).toThrow();
});

it('does not mutate the endpoints it receives', () => {
  const route = resolveWritingRoute({ loopback, preference: 'device-first', localWritingConsent: false, local });
  expect(route).toMatchObject({ endpoint: { model: 'qwen3:8b' } });
  expect(loopback).toEqual({ kind: 'loopback', baseUrl: 'http://127.0.0.1:11434', model: 'qwen3:8b' });
  expect(local).toEqual({ backend: 'webllm', model: 'Qwen3-1.7B-q4f16_1-MLC' });
});
