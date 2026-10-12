import { expect, it, vi } from 'vitest';
import { JsonTextStream } from '../../packages/agent-core/src/llm/json-text-stream';

it('decodes split escapes and Unicode while a JSON text field is still arriving', () => {
  const emit = vi.fn();
  const stream = new JsonTextStream(emit);
  stream.push('{"text":"Hello');
  expect(emit.mock.calls.flat().join('')).toBe('Hello');
  stream.push('\\n\\u4e');
  stream.push('2d\\"world\\"');
  stream.push('"}');
  expect(emit.mock.calls.flat().join('')).toBe('Hello\n中"world"');
});
it('holds text until its complete answer discriminator arrives, in either property order', () => {
  const emit = vi.fn();
  const stream = new JsonTextStream(emit, { answerOnly: true });
  stream.push('{"text":"Reply","kind":"ans');
  expect(emit).not.toHaveBeenCalled();
  stream.push('wer","disposition":"answered"}');
  expect(emit.mock.calls.flat().join('')).toBe('Reply');
});
it('never shows tool fields, nested text arguments or leading reasoning', () => {
  const emit = vi.fn();
  const stream = new JsonTextStream(emit, { answerOnly: true });
  stream.push('<thi');
  stream.push('nk>private</think>');
  stream.push('{"kind":"tool","tool":"insert_text","input":{"text":"secret"}}');
  expect(emit).not.toHaveBeenCalled();
});
it('leaves final validation authoritative when a malformed stream follows a preview', () => {
  const emit = vi.fn();
  const stream = new JsonTextStream(emit);
  stream.push('{"text":"Preview');
  stream.push('" bad syntax');
  stream.push('secret');
  expect(emit.mock.calls.flat().join('')).toBe('Preview');
  expect(() => stream.finish('Preview')).toThrow('Invalid structured stream');
});

it.each(['中文 😀 café', 'escaped\n"text"\\', '日本語 한국어'])('preserves %s across every chunk boundary', (text) => {
  const raw = JSON.stringify({ kind: 'answer', text, disposition: 'answered' });
  for (let boundary = 1; boundary < raw.length; boundary++) {
    const deltas: string[] = [];
    const stream = new JsonTextStream((delta) => deltas.push(delta), { answerOnly: true });
    stream.push(raw.slice(0, boundary));
    stream.push(raw.slice(boundary));
    stream.finish(text);
    expect(deltas.join(''), `boundary ${boundary}`).toBe(text);
  }
});

it.each(['{"text":"Partial', '{"text":"Preview"}'])('rejects incomplete or conflicting previews: %s', (raw) => {
  const stream = new JsonTextStream(() => {});
  stream.push(raw);
  expect(() => stream.finish('Different')).toThrow('Invalid structured stream');
});
