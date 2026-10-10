import { expect, it } from 'vitest';
import {
  configuredEndpoint,
  isCloudEndpointKind,
  readEndpointSettings,
  writeEndpointSettings,
} from '../../lib/agent-plugin/ui/endpoint-settings';

it('round-trips an endpoint and keeps the preference and consent', () => {
  const raw = writeEndpointSettings({
    kind: 'openai-compatible',
    baseUrl: 'https://api.example.com/v1/',
    model: '  gpt-4o-mini  ',
    preference: 'remote-first',
    localWritingConsent: true,
  });
  expect(JSON.parse(raw)).toEqual({
    version: 1,
    kind: 'openai-compatible',
    baseUrl: 'https://api.example.com/v1/',
    model: 'gpt-4o-mini',
    preference: 'remote-first',
    localWritingConsent: true,
  });
  expect(readEndpointSettings(raw)).toEqual({
    kind: 'openai-compatible',
    baseUrl: 'https://api.example.com/v1/',
    model: 'gpt-4o-mini',
    preference: 'remote-first',
    localWritingConsent: true,
  });
});

it('falls back to defaults for missing, malformed or older records', () => {
  const empty = {
    kind: 'loopback',
    baseUrl: '',
    model: '',
    preference: 'device-first',
    localWritingConsent: false,
  };
  expect(readEndpointSettings(null)).toEqual(empty);
  expect(readEndpointSettings('not json')).toEqual(empty);
  expect(readEndpointSettings(JSON.stringify({ version: 2, kind: 'anthropic' }))).toEqual(empty);
  expect(readEndpointSettings(JSON.stringify({ version: 1, kind: 'nope', model: 7 }))).toEqual({
    ...empty,
    kind: 'loopback',
  });
});

it('treats consent and the preference as opt-in, never as truthy strings', () => {
  for (const value of ['yes', 1, {}, null, undefined])
    expect(readEndpointSettings(JSON.stringify({ version: 1, localWritingConsent: value })).localWritingConsent).toBe(
      false,
    );
  for (const value of ['remote-first ', 'REMOTE-FIRST', 1, null])
    expect(readEndpointSettings(JSON.stringify({ version: 1, preference: value })).preference).toBe('device-first');
});

it('refuses to persist an origin the writing route would reject', () => {
  // Plain http to a remote host would put the key and the document on the wire.
  expect(() =>
    writeEndpointSettings({
      kind: 'openai-compatible',
      baseUrl: 'http://api.example.com/v1',
      model: 'm',
      preference: 'device-first',
      localWritingConsent: false,
    }),
  ).toThrow();
  expect(() =>
    writeEndpointSettings({
      kind: 'loopback',
      baseUrl: 'https://example.com',
      model: 'm',
      preference: 'device-first',
      localWritingConsent: false,
    }),
  ).toThrow();
});

it('offers an endpoint only when it is complete, and reports the cloud kinds', () => {
  const base = { preference: 'device-first' as const, localWritingConsent: false };
  expect(configuredEndpoint({ ...base, kind: 'loopback', baseUrl: '', model: '' })).toBeNull();
  expect(configuredEndpoint({ ...base, kind: 'openai-compatible', baseUrl: '', model: 'm' })).toBeNull();
  expect(configuredEndpoint({ ...base, kind: 'openai-compatible', baseUrl: 'http://x.test', model: 'm' })).toBeNull();
  expect(configuredEndpoint({ ...base, kind: 'loopback', baseUrl: '', model: 'qwen3:8b' })).toEqual({
    kind: 'loopback',
    baseUrl: 'http://localhost:11434',
    model: 'qwen3:8b',
  });
  expect(configuredEndpoint({ ...base, kind: 'anthropic', baseUrl: '', model: 'claude-sonnet-4-5' })).toEqual({
    kind: 'anthropic',
    baseUrl: '',
    model: 'claude-sonnet-4-5',
  });
  expect(isCloudEndpointKind('loopback')).toBe(false);
  expect(isCloudEndpointKind('anthropic')).toBe(true);
});
