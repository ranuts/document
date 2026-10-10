import { afterEach, describe, expect, it } from 'vitest';
import {
  clearApiKey,
  clearEndpointKey,
  getApiKey,
  getEndpointKey,
  setApiKey,
  setEndpointKey,
} from '@ranuts/agent-core/llm/keys';

describe('agent llm keys', () => {
  afterEach(() => {
    clearApiKey('anthropic');
    clearApiKey('openai');
  });

  it('returns undefined when no key is stored', () => {
    expect(getApiKey('anthropic')).toBeUndefined();
  });

  it('stores and retrieves a key per provider', () => {
    setApiKey('anthropic', 'sk-ant-123');
    setApiKey('openai', 'sk-oai-456');
    expect(getApiKey('anthropic')).toBe('sk-ant-123');
    expect(getApiKey('openai')).toBe('sk-oai-456');
  });

  it('treats a blank stored value as unset', () => {
    setApiKey('anthropic', '');
    expect(getApiKey('anthropic')).toBeUndefined();
  });

  it('clearApiKey removes the key', () => {
    setApiKey('anthropic', 'sk-ant-123');
    clearApiKey('anthropic');
    expect(getApiKey('anthropic')).toBeUndefined();
  });
});

describe('user-named endpoint keys', () => {
  const a = 'https://api.example.com/v1';
  const b = 'https://other.example.com/v1';
  afterEach(() => {
    clearEndpointKey(a);
    clearEndpointKey(b);
  });

  it('keeps two endpoints on separate slots instead of overwriting one another', () => {
    // The provider-keyed slots cannot do this: both are `openai`.
    setEndpointKey(a, 'key-a');
    setEndpointKey(b, 'key-b');
    expect(getEndpointKey(a)).toBe('key-a');
    expect(getEndpointKey(b)).toBe('key-b');
  });

  it('treats a trailing slash as the same origin, and a blank value as unset', () => {
    setEndpointKey(a, 'key-a');
    expect(getEndpointKey(`${a}/`)).toBe('key-a');
    setEndpointKey(a, '');
    expect(getEndpointKey(a)).toBeUndefined();
  });

  it('refuses an empty origin rather than writing a catch-all slot', () => {
    expect(() => setEndpointKey('   ', 'key')).toThrow();
  });
});
