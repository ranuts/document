import { resolveModelArtifactUrl, resolveModelConfig, type ModelSource } from './model-source';
/** Delete model weights/config only. WASM may be shared by other cached models. */
export async function deleteCachedModel(modelId: string, source: ModelSource = {}): Promise<void> {
  const { deleteModelInCache, deleteChatConfigInCache, prebuiltAppConfig } = await import('@mlc-ai/web-llm');
  const config = resolveModelConfig(prebuiltAppConfig, modelId, source);
  await deleteModelInCache(modelId, config);
  await deleteChatConfigInCache(modelId, config);
}

/** Uses the same OPFS / Cache API fallback as the CPU provider. */
async function ggufCache() {
  const { CacheManager } = await import('@wllama/wllama/esm/index.js');
  const { selectWllamaStorage } = await import('./wllama-cache-storage');
  const storage = await selectWllamaStorage(
    navigator.storage?.getDirectory
      ? async () => (await navigator.storage.getDirectory()).getDirectoryHandle('cache', { create: true })
      : undefined,
    () => caches.open('local-ai-wllama-models-v1'),
    location.origin,
  );
  return new CacheManager(storage ? [storage] : undefined);
}
interface GGUFGroup {
  name: string;
  url: string;
  size: number;
  files: string[];
  complete: boolean;
}
function groupGGUF(
  entries: Array<{ name: string; size: number; metadata: { originalURL: string; originalSize?: number } }>,
): GGUFGroup[] {
  const groups = new Map<string, GGUFGroup>();
  for (const entry of entries) {
    const original = entry.metadata.originalURL;
    if (!/^https?:\/\//.test(original) || !/\.gguf(?:$|\?)/i.test(original)) continue;
    const url = original.replace(/-\d{5}-of-(\d{5})\.gguf(?=$|\?)/i, '-00001-of-$1.gguf');
    const group = groups.get(url) ?? { name: url, url, size: 0, files: [], complete: true };
    group.size += entry.size;
    group.complete &&= entry.metadata.originalSize === undefined || entry.size === entry.metadata.originalSize;
    group.files.push(entry.name);
    groups.set(url, group);
  }
  return [...groups.values()].map((group) => {
    const shards = Number(group.url.match(/-00001-of-(\d{5})\.gguf/i)?.[1] ?? 1);
    return { ...group, complete: group.complete && group.files.length === shards };
  });
}
export async function listCachedGGUF(): Promise<GGUFGroup[]> {
  if (typeof navigator === 'undefined' || typeof caches === 'undefined') return [];
  return groupGGUF(await (await ggufCache()).list());
}
export async function deleteCachedGGUF(name: string): Promise<void> {
  const manager = await ggufCache();
  const group = groupGGUF(await manager.list()).find((item) => item.name === name);
  if (!group) throw new Error('Cached model is no longer available');
  for (const file of group.files) await manager.delete(file);
}

export interface CachedModelSource extends ModelSource {
  id: string;
  label: string;
}
const CATALOG_KEY = 'agent-model-cache-catalog-v1';
/** The catalog is a hint; storage is checked again before showing or deleting a model. */
export function rememberedModelSources(): CachedModelSource[] {
  try {
    const entries: unknown = JSON.parse(localStorage.getItem(CATALOG_KEY) ?? '[]');
    if (!Array.isArray(entries)) return [];
    return entries
      .filter((entry): entry is CachedModelSource => {
        if (!entry || typeof entry.id !== 'string' || typeof entry.label !== 'string') return false;
        try {
          return [entry.modelUrl, entry.modelLibUrl].every((value) => {
            if (value === undefined) return true;
            if (typeof value !== 'string') return false;
            resolveModelArtifactUrl(value);
            return true;
          });
        } catch {
          return false;
        }
      })
      .slice(0, 32);
  } catch {
    return [];
  }
}
export function rememberModelSource(entry: CachedModelSource): void {
  try {
    const entries = rememberedModelSources().filter((item) => item.id !== entry.id || item.modelUrl !== entry.modelUrl);
    localStorage.setItem(CATALOG_KEY, JSON.stringify([...entries, entry].slice(-32)));
  } catch {
    /* Cache remains usable when preference storage is unavailable. */
  }
}
