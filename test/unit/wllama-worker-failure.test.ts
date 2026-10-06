import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

it.each(
  ['index.js', 'index.cjs'].flatMap((entry) =>
    ['error', 'exit', 'abort-object', 'abort-string', 'abort-unknown'].map((operation) => ({ entry, operation })),
  ),
)('rejects initialization and terminates the worker: $entry / $operation', async ({ entry, operation }) => {
  const source = readFileSync(`packages/agent-core/node_modules/@wllama/wllama/esm/${entry}`, 'utf8');
  const code = source.match(/var ProxyToWorker = (class \{[\s\S]*?\n\});/)?.[1];
  expect(code).toBeDefined();
  let terminated = false;
  const worker = {
    onmessage: undefined,
    onerror: undefined as undefined | ((event: { message: string }) => void),
    postMessage() {
      setTimeout(() => {
        try {
          if (operation.startsWith('abort-'))
            proxy.onRecvMsg({
              data: {
                verb: 'signal.abort',
                args: [
                  'abort',
                  operation === 'abort-object'
                    ? { message: 'WASM compilation failed' }
                    : operation === 'abort-string'
                      ? 'WASM compilation failed'
                      : null,
                  null,
                  null,
                ],
              },
            });
          else if (operation === 'exit') void proxy.wllamaExit();
          else worker.onerror?.({ message: 'WASM compilation failed' });
        } catch {
          /* old logger throws on Event */
        }
      }, 0);
    },
    terminate() {
      terminated = true;
    },
  };
  const asyncHelper = (_self: unknown, _args: unknown, generator: () => Generator) =>
    new Promise((resolve, reject) => {
      const iterator = generator.call(_self);
      const step = (value?: unknown) => {
        try {
          const next = iterator.next(value);
          if (next.done) resolve(next.value);
          else Promise.resolve(next.value).then(step, reject);
        } catch (error) {
          reject(error);
        }
      };
      step();
    });
  const Proxy = new Function(
    '__publicField',
    '__async',
    'canUseAsyncFileRead',
    'JSPI_STUB',
    'LLAMA_CPP_WORKER_CODE',
    'createWorker',
    'isSafariMobile',
    'WllamaRuntimeError',
    `return (${code});`,
  )(
    (object: Record<string, unknown>, key: string, value: unknown) => {
      object[key] = value;
    },
    asyncHelper,
    () => false,
    '',
    '',
    () => worker,
    () => false,
    Error,
  );
  const proxy = new Proxy({ wasmPath: '/local.wasm' }, 0, false, {
    error(message: string) {
      message.replace('Build with -sASSERTIONS for more info.', '');
    },
  });
  proxy.getModuleCode = async () => 'var Module = {};';
  const result = await Promise.race([
    proxy.moduleInit([]).then(
      () => 'unexpected success',
      (error: Error) => error.message,
    ),
    new Promise((resolve) => setTimeout(() => resolve('initialization still pending'), 50)),
  ]);
  const expected = operation.startsWith('abort-')
    ? `(ABORT) ${operation === 'abort-unknown' ? 'Wllama runtime aborted' : 'WASM compilation failed'}`
    : operation === 'exit'
      ? 'Wllama worker terminated'
      : 'WASM compilation failed';
  expect(result).toBe(expected);
  expect(terminated).toBe(true);
  await expect(proxy.pushTask({ verb: 'wllama.debug', args: [], callbackId: 999 })).rejects.toThrow(expected);
});
