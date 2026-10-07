import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';

const source = readFileSync('packages/agent-core/vendor/wllama-count/client/index.js', 'utf8');
const method = source
  .match(/  fileReadResponse\(name, offset, size\) \{[\s\S]*?\n  \}\n  \/\*\*/)?.[0]
  .replace(/\n  \/\*\*$/, '');
const asyncHelper = (self: unknown, _: unknown, generator: () => Generator) =>
  new Promise((resolve, reject) => {
    const iterator = generator.call(self);
    const step = (value?: unknown, failed = false) => {
      try {
        const next = failed ? iterator.throw(value) : iterator.next(value);
        if (next.done) resolve(next.value);
        else
          Promise.resolve(next.value).then(
            (value) => step(value),
            (error) => step(error, true),
          );
      } catch (error) {
        reject(error);
      }
    };
    step();
  });

it('transfers exact requested model bytes while each backing Blob read stays within 8 MiB', async () => {
  expect(method).toBeDefined();
  const limit = 8 * 1024 * 1024;
  const offset = 37;
  const size = 2 * limit + 19;
  const reads: number[] = [];
  const blob = (start: number, end: number): object => ({
    size: end - start,
    slice(a: number, b: number) {
      return blob(start + a, Math.min(start + b, end));
    },
    async arrayBuffer() {
      reads.push(end - start);
      if (end - start > limit) throw new DOMException('Large backing read failed', 'NotReadableError');
      return Uint8Array.from({ length: end - start }, (_, i) => (start + i) % 251).buffer;
    },
  });
  let transferred: ArrayBuffer | undefined;
  let aborted: string | undefined;
  const receiver = {
    fileBlobs: new Map([['model', blob(0, size + offset + 10)]]),
    worker: {
      postMessage(message: { args: ArrayBuffer[] }) {
        transferred = message.args[0];
      },
      terminate() {},
    },
    logger: { error() {} },
    abort(message: string) {
      aborted = message;
    },
  };
  const read = new Function('__async', `return ({${method}}).fileReadResponse;`)(asyncHelper);
  await read.call(receiver, 'model', offset, size);
  expect(aborted).toBeUndefined();
  expect(transferred?.byteLength).toBe(size);
  const expected = Uint8Array.from({ length: size }, (_, i) => (offset + i) % 251);
  expect(createHash('sha256').update(new Uint8Array(transferred!)).digest('hex')).toBe(
    createHash('sha256').update(expected).digest('hex'),
  );
  expect(reads.every((n) => n <= limit)).toBe(true);
});

it('terminates the worker and propagates a failed subread without sending partial model bytes', async () => {
  let terminated = false;
  let sent = false;
  let aborted = '';
  const receiver = {
    fileBlobs: new Map([
      [
        'model',
        {
          slice: () => ({
            size: 9 * 1024 * 1024,
            slice: () => ({
              arrayBuffer: async () => {
                throw new DOMException('Backing file lost', 'NotReadableError');
              },
            }),
          }),
        },
      ],
    ]),
    worker: {
      postMessage() {
        sent = true;
      },
      terminate() {
        terminated = true;
      },
    },
    logger: { error() {} },
    abort(message: string) {
      aborted = message;
    },
  };
  const read = new Function('__async', `return ({${method}}).fileReadResponse;`)(asyncHelper);
  await read.call(receiver, 'model', 0, 9 * 1024 * 1024);
  expect(terminated).toBe(true);
  expect(sent).toBe(false);
  expect(aborted).toContain('Backing file lost');
  expect(receiver.worker).toBeUndefined();
});
