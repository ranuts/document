/** Build hosts may persist the runtime that is actually being activated. */
export type RuntimeCapability = 'webgpu' | 'wllama' | 'wllama-compat' | 'cpu' | 'cpu-compat';
export type RuntimeAssetPreparation = (capability: RuntimeCapability) => unknown;

/** Persistence is advisory and must never stall initialization or surface quota failures. */
export function prepareRuntimeAssets(
  prepare: RuntimeAssetPreparation | undefined,
  capability: RuntimeCapability,
): void {
  try {
    void Promise.resolve(prepare?.(capability)).catch(() => undefined);
  } catch {
    // Restricted host storage does not prevent using the runtime online.
  }
}
