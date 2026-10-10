import { afterEach, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ engine: { unload: async () => undefined } }));
vi.mock('../../packages/agent-core/node_modules/@mlc-ai/web-llm/lib/index.js', () => ({
  WebWorkerMLCEngineHandler: class {
    engine = state.engine;
    onmessage(_event: MessageEvent, complete?: () => void) {
      complete?.();
    }
  },
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

it('notifies the host when an SDK unload occurs after the model was loaded', async () => {
  const sent: unknown[] = [];
  const worker = {
    onmessage: undefined as undefined | ((event: MessageEvent) => void),
    postMessage: (message: unknown) => sent.push(message),
  };
  state.engine = { unload: async () => undefined };
  vi.stubGlobal('self', worker);
  await import('../../packages/agent-core/src/llm/webllm.worker');
  await state.engine.unload();
  expect(sent).toEqual([]);
  worker.onmessage!(new MessageEvent('message', { data: { kind: 'reload' } }));
  await state.engine.unload();
  expect(sent).toEqual([{ kind: 'local-model-unloaded' }]);
});
