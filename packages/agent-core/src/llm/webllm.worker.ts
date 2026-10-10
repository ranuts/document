import { WebWorkerMLCEngineHandler } from '@mlc-ai/web-llm';

const handler = new WebWorkerMLCEngineHandler();
let loaded = false;
// In SDK 0.2.85, GPU device loss calls engine.unload() without emitting a
// Worker error. Forward that lifecycle change so the host can invalidate ready
// state and settle pending requests. Initial reload also calls unload, so only
// notify after a successful load. Revalidate this hook when upgrading the SDK.
const unload = handler.engine.unload.bind(handler.engine);
handler.engine.unload = async () => {
  if (loaded) {
    loaded = false;
    self.postMessage({ kind: 'local-model-unloaded' });
  }
  await unload();
};
self.onmessage = (event: MessageEvent) => {
  handler.onmessage(event, () => {
    if (event.data?.kind === 'reload') loaded = true;
  });
};
