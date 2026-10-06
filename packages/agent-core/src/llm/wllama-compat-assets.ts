export interface CompatibilityAssets {
  wasm: string;
  worker: { code: string };
}
export async function getWllamaCompatibility(
  capabilities: { Suspending?: unknown; validate(bytes: Uint8Array<ArrayBuffer>): boolean } = WebAssembly,
  load: () => Promise<CompatibilityAssets> = async () => {
    const [wasm, worker] = await Promise.all([
      import('@wllama/wllama-compat/wasm/wllama.wasm?url'),
      import('@wllama/wllama-compat/wasm/wllama.js?raw'),
    ]);
    return { wasm: wasm.default, worker: { code: worker.default } };
  },
): Promise<CompatibilityAssets | null> {
  try {
    if (capabilities.Suspending && capabilities.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 5, 3, 1, 4, 1])))
      return null;
  } catch {
    // Accepted constructor options do not prove that native modules compile.
  }
  return load();
}
