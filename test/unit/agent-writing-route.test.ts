import { expect, it } from 'vitest';
import { resolveWritingRoute } from '../../packages/agent-core/src/llm/writing-route';

const local = { backend: 'webllm' as const, model: 'Qwen3-1.7B-q4f16_1-MLC' };

it('prefers a connected loopback service over the browser-local engine', () => {
  const route = resolveWritingRoute({
    loopback: { backend: 'loopback', model: 'qwen3:8b' },
    localWritingConsent: true,
    local,
  });
  expect(route).toEqual({
    kind: 'loopback',
    binding: { backend: 'loopback', model: 'qwen3:8b' },
    experimental: false,
  });
});

it('blocks writing when no loopback service is connected and consent is absent', () => {
  // Browser-local writing failed seven-language quality acceptance; it needs an
  // explicit opt-in rather than being the silent default.
  expect(resolveWritingRoute({ loopback: null, localWritingConsent: false, local })).toEqual({
    kind: 'blocked',
    reason: 'local-writing-disabled',
  });
  expect(resolveWritingRoute({ localWritingConsent: false, local })).toEqual({
    kind: 'blocked',
    reason: 'local-writing-disabled',
  });
});

it('returns the browser-local binding as experimental only with explicit consent', () => {
  expect(resolveWritingRoute({ loopback: null, localWritingConsent: true, local })).toEqual({
    kind: 'local',
    binding: local,
    experimental: true,
  });
});

it('rejects a placeholder or non-loopback loopback binding instead of silently falling back', () => {
  expect(() =>
    resolveWritingRoute({ loopback: { backend: 'loopback', model: '   ' }, localWritingConsent: false, local }),
  ).toThrow();
  expect(() =>
    resolveWritingRoute({ loopback: { backend: 'webllm', model: 'x' }, localWritingConsent: false, local }),
  ).toThrow();
});

it('rejects a browser-local binding that is not a browser engine', () => {
  expect(() =>
    resolveWritingRoute({
      localWritingConsent: true,
      local: { backend: 'loopback', model: 'qwen3:8b' },
    }),
  ).toThrow();
  expect(() => resolveWritingRoute({ localWritingConsent: true, local: { backend: 'webllm', model: ' ' } })).toThrow();
});

it('does not mutate the bindings it receives', () => {
  const loopback = { backend: 'loopback' as const, model: 'qwen3:8b' };
  const route = resolveWritingRoute({ loopback, localWritingConsent: false, local });
  expect(route).toMatchObject({ binding: { model: 'qwen3:8b' } });
  expect(loopback).toEqual({ backend: 'loopback', model: 'qwen3:8b' });
  expect(local).toEqual({ backend: 'webllm', model: 'Qwen3-1.7B-q4f16_1-MLC' });
});
