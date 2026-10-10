export class CacheAPIStorage {
  private prefix: string;
  constructor(
    private cache: Cache,
    origin: string,
  ) {
    this.prefix = new URL('/__local_ai_model_cache__/entry-', origin).href;
  }
  isSupported(): boolean {
    return true;
  }
  private url(key: string): string {
    return this.prefix + encodeURIComponent(key);
  }
  async read(key: string): Promise<Blob | null> {
    return (await this.cache.match(this.url(key)))?.blob() ?? null;
  }
  async write(key: string, stream: ReadableStream): Promise<void> {
    // Pass the stream through; do not materialize a second model-sized buffer.
    await this.cache.put(this.url(key), new Response(stream));
  }
  async getSize(key: string): Promise<number> {
    return (await this.read(key))?.size ?? -1;
  }
  async list(): Promise<Array<{ key: string; size: number }>> {
    const entries = [];
    for (const request of await this.cache.keys()) {
      if (!request.url.startsWith(this.prefix)) continue;
      const key = decodeURIComponent(request.url.slice(this.prefix.length));
      const size = await this.getSize(key);
      if (size >= 0) entries.push({ key, size });
    }
    return entries;
  }
  async delete(key: string): Promise<void> {
    await this.cache.delete(this.url(key));
  }
}
export async function selectWllamaStorage(
  openOPFS: (() => Promise<unknown>) | undefined,
  openCache: () => Promise<Cache>,
  origin: string,
): Promise<CacheAPIStorage | undefined> {
  if (openOPFS) {
    try {
      await openOPFS();
      return undefined;
    } catch {
      // Method presence does not establish that private storage is accessible.
    }
  }
  return new CacheAPIStorage(await openCache(), origin);
}
