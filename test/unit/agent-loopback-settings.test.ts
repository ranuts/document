import { expect, it } from 'vitest';
import {
  DEFAULT_LOOPBACK_URL,
  loopbackBinding,
  readLoopbackSettings,
  writeLoopbackSettings,
} from '../../lib/agent-plugin/ui/loopback-settings';

it('round-trips a configured service without persisting anything beyond origin and model', () => {
  const raw = writeLoopbackSettings({
    url: 'http://127.0.0.1:11434/',
    model: '  qwen3:8b  ',
    localWritingConsent: true,
  });
  expect(JSON.parse(raw)).toEqual({
    version: 1,
    url: 'http://127.0.0.1:11434',
    model: 'qwen3:8b',
    localWritingConsent: true,
  });
  expect(readLoopbackSettings(raw)).toEqual({
    url: 'http://127.0.0.1:11434',
    model: 'qwen3:8b',
    localWritingConsent: true,
  });
});

it('falls back to nothing for missing, malformed or older records', () => {
  const empty = { url: '', model: '', localWritingConsent: false };
  expect(readLoopbackSettings(null)).toEqual(empty);
  expect(readLoopbackSettings('not json')).toEqual(empty);
  expect(readLoopbackSettings('{"version":2,"url":"http://localhost:11434","model":"m"}')).toEqual(empty);
  expect(readLoopbackSettings(JSON.stringify({ version: 1, url: 42, model: 7 }))).toEqual(empty);
});

it('drops a service origin that is not loopback or that carries credentials', () => {
  for (const url of [
    'https://example.com',
    'http://192.168.1.9',
    'http://user:secret@localhost',
    'http://localhost/?k=v',
  ]) {
    expect(readLoopbackSettings(JSON.stringify({ version: 1, url, model: 'm' })).url).toBe('');
  }
});

it('refuses to write a non-loopback or credential-bearing origin', () => {
  expect(() => writeLoopbackSettings({ url: 'https://example.com', model: 'm', localWritingConsent: false })).toThrow();
  expect(() =>
    writeLoopbackSettings({ url: 'http://user:secret@localhost', model: 'm', localWritingConsent: false }),
  ).toThrow();
});

it('treats consent as opt-in and never as a truthy string', () => {
  for (const value of ['yes', 1, {}, null, undefined]) {
    expect(readLoopbackSettings(JSON.stringify({ version: 1, localWritingConsent: value })).localWritingConsent).toBe(
      false,
    );
  }
});

it('offers a loopback binding only when both origin and model are present', () => {
  expect(loopbackBinding({ url: '', model: 'qwen3:8b', localWritingConsent: false })).toBeNull();
  expect(loopbackBinding({ url: DEFAULT_LOOPBACK_URL, model: '   ', localWritingConsent: false })).toBeNull();
  expect(loopbackBinding({ url: DEFAULT_LOOPBACK_URL, model: ' qwen3:8b ', localWritingConsent: false })).toEqual({
    backend: 'loopback',
    model: 'qwen3:8b',
  });
});
