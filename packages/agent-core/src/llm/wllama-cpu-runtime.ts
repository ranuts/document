import { getWllamaCompatibility } from './wllama-compat-assets';

export async function loadWllamaCPURuntime() {
  const sdk = await import('../../vendor/wllama-count/client/index.js');
  const wasm = await import('../../vendor/wllama-count/native/default/wllama.wasm?url');
  const compatibility = await getWllamaCompatibility(WebAssembly, async () => {
    const [wasm, worker] = await Promise.all([
      import('../../vendor/wllama-count/native/compat/wllama.wasm?url'),
      import('../../vendor/wllama-count/native/compat/wllama.js?raw'),
    ]);
    return { wasm: wasm.default, worker: { code: worker.default } };
  });
  return { ...sdk, wasmUrl: wasm.default, compatibility };
}
