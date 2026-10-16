/** Explicit read-only reference sources. Text is untrusted data, never agent instructions. */
export interface ReferenceText {
  id: string;
  connector: string;
  title: string;
  text: string;
  uri?: string;
}
export const MAX_REFERENCE_BYTES = 262144;
export class ReferenceSources {
  private entries = new Map<string, Readonly<ReferenceText>>();
  private readonly conversations = new Map<string, Map<string, Readonly<ReferenceText>>>();
  select(id: string): void {
    let entries = this.conversations.get(id);
    if (!entries) {
      entries = new Map();
      this.conversations.set(id, entries);
    }
    this.entries = entries;
  }
  list(): readonly Readonly<ReferenceText>[] {
    return [...this.entries.values()];
  }
  add(reference: ReferenceText): void {
    if (
      !reference.id ||
      !reference.connector ||
      !reference.title ||
      new TextEncoder().encode(reference.text).length > MAX_REFERENCE_BYTES
    )
      throw new Error('source-too-large');
    if (!this.entries.has(reference.id) && this.entries.size >= 5) throw new Error('source-limit');
    this.entries.set(reference.id, Object.freeze({ ...reference, title: reference.title.slice(0, 200) }));
  }
  remove(id: string): void {
    this.entries.delete(id);
  }
  disconnect(connector: string): void {
    for (const entries of new Set([this.entries, ...this.conversations.values()]))
      for (const [id, source] of entries) if (source.connector === connector) entries.delete(id);
  }
  forget(id?: string): void {
    if (id !== undefined) {
      const entries = this.conversations.get(id);
      entries?.clear();
      this.conversations.delete(id);
      if (entries === this.entries) this.entries = new Map();
    } else {
      this.entries.clear();
      for (const entries of this.conversations.values()) entries.clear();
      this.conversations.clear();
    }
  }
  capture() {
    const entries = this.entries;
    const references = Object.freeze([...entries.values()]);
    return Object.freeze({
      references,
      isCurrent: () => references.every((source) => entries.get(source.id) === source),
    });
  }
}
export async function readLocalReference(file: File): Promise<ReferenceText> {
  if (!/\.(?:txt|md|csv|tsv|json)$/i.test(file.name)) throw new Error('source-unsupported');
  if (file.size > MAX_REFERENCE_BYTES) throw new Error('source-too-large');
  const text = await file.text();
  if (text.includes('\0')) throw new Error('source-unsupported');
  return { id: crypto.randomUUID(), connector: 'local', title: file.name, text };
}
export async function boundedText(response: Response, limit = MAX_REFERENCE_BYTES): Promise<string> {
  if (Number(response.headers.get('content-length')) > limit) {
    await response.body?.cancel();
    throw new Error('source-too-large');
  }
  const reader = response.body?.getReader();
  if (!reader) return '';
  let length = 0;
  const decoder = new TextDecoder();
  let result = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > limit) throw new Error('source-too-large');
      result += decoder.decode(value, { stream: true });
    }
    return result + decoder.decode();
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}
export function validateMcpUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('source-invalid-url');
  }
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (
    (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) ||
    url.username ||
    url.password ||
    url.hash ||
    url.search
  )
    throw new Error('source-invalid-url');
  return url.href;
}
export interface McpResource {
  uri: string;
  name: string;
}
/** Resource-only Streamable HTTP client; credentials stay in memory and no tool calls are exposed. */
export class McpResources {
  private readonly url: string;
  private sequence = 0;
  private session = '';
  private initialized = false;
  private resources = new Map<string, McpResource>();
  private cursors = new Set<string>();
  private nextCursor = '';
  get continuation(): string {
    return this.nextCursor;
  }
  private readonly lifetime = new AbortController();
  constructor(
    url: string,
    private token = '',
    private readonly fetcher: typeof fetch = fetch,
  ) {
    this.url = validateMcpUrl(url);
  }
  disconnect(): void {
    this.lifetime.abort();
    this.token = '';
    this.session = '';
    this.resources.clear();
  }
  private async rpc(method: string, params: unknown, notification = false): Promise<Record<string, unknown>> {
    const id = ++this.sequence;
    const signal = AbortSignal.any([this.lifetime.signal, AbortSignal.timeout(15000)]);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    if (this.session) headers['Mcp-Session-Id'] = this.session;
    if (this.initialized) headers['MCP-Protocol-Version'] = '2025-11-25';
    const response = await this.fetcher(this.url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ jsonrpc: '2.0', ...(notification ? {} : { id }), method, params }),
      signal,
      credentials: 'omit',
      redirect: 'error',
      referrerPolicy: 'no-referrer',
    });
    if (!response.ok)
      throw new Error(response.status === 401 || response.status === 403 ? 'source-auth' : 'source-unavailable');
    if (method === 'initialize') this.session = response.headers.get('Mcp-Session-Id') ?? '';
    if (notification) {
      await response.body?.cancel();
      return {};
    }
    let message: { id?: number; result?: Record<string, unknown>; error?: unknown } | undefined;
    if (response.headers.get('content-type')?.includes('text/event-stream')) {
      const limit = MAX_REFERENCE_BYTES + 32768;
      if (Number(response.headers.get('content-length')) > limit) {
        await response.body?.cancel();
        throw new Error('source-too-large');
      }
      const reader = response.body?.getReader();
      if (!reader) throw new Error('source-invalid-response');
      const decoder = new TextDecoder();
      let bytes = 0;
      let pending = '';
      const abort = () => {
        void reader.cancel(signal.reason).catch(() => undefined);
      };
      signal.addEventListener('abort', abort, { once: true });
      try {
        signal.throwIfAborted();
        while (!message) {
          const { done, value } = await reader.read();
          signal.throwIfAborted();
          if (value) {
            bytes += value.length;
            if (bytes > limit) throw new Error('source-too-large');
          }
          pending += done ? decoder.decode() : decoder.decode(value, { stream: true });
          let boundary: RegExpExecArray | null;
          while ((boundary = /\r?\n\r?\n/.exec(pending))) {
            const block = pending.slice(0, boundary.index);
            pending = pending.slice(boundary.index + boundary[0].length);
            const data = block
              .split(/\r?\n/)
              .filter((line) => line.startsWith('data:'))
              .map((line) => line.slice(5).replace(/^ /, ''))
              .join('\n');
            if (!data) continue;
            let candidate;
            try {
              candidate = JSON.parse(data);
            } catch {
              throw new Error('source-invalid-response');
            }
            if (candidate?.id === id) {
              message = candidate;
              break;
            }
          }
          if (done) break;
        }
      } finally {
        signal.removeEventListener('abort', abort);
        await reader.cancel().catch(() => undefined);
      }
    } else {
      const text = await boundedText(response, MAX_REFERENCE_BYTES + 32768);
      try {
        message = JSON.parse(text);
      } catch {
        throw new Error('source-invalid-response');
      }
    }
    if (message?.id !== id || message.error || !message.result) throw new Error('source-invalid-response');
    return message.result;
  }
  async list(cursor = ''): Promise<McpResource[]> {
    if (
      cursor &&
      (cursor !== this.nextCursor || cursor.length > 2048 || this.cursors.has(cursor) || this.cursors.size >= 9)
    )
      throw new Error('source-invalid-response');
    if (!this.initialized) {
      const init = await this.rpc('initialize', {
        protocolVersion: '2025-11-25',
        capabilities: {},
        clientInfo: { name: 'document', version: '1.0' },
      });
      if (init.protocolVersion !== '2025-11-25') throw new Error('source-protocol');
      this.initialized = true;
      await this.rpc('notifications/initialized', {}, true);
    }
    const result = await this.rpc('resources/list', cursor ? { cursor } : {});
    if (!Array.isArray(result.resources)) throw new Error('source-invalid-response');
    if (!cursor) {
      this.resources.clear();
      this.cursors.clear();
    } else this.cursors.add(cursor);
    const page: McpResource[] = [];
    for (const item of result.resources.slice(0, 100))
      if (typeof item?.uri === 'string' && typeof item?.name === 'string')
        if (item.uri.length <= 2048 && !this.resources.has(item.uri) && this.resources.size < 500) {
          const resource = { uri: item.uri, name: item.name.slice(0, 200) };
          this.resources.set(item.uri, resource);
          page.push(resource);
        }
    const next = result.nextCursor;
    this.nextCursor =
      typeof next === 'string' &&
      next.length <= 2048 &&
      next !== cursor &&
      !this.cursors.has(next) &&
      this.resources.size < 500 &&
      this.cursors.size < 9
        ? next
        : '';
    return page;
  }
  async read(uri: string): Promise<ReferenceText> {
    const resource = this.resources.get(uri);
    if (!resource) throw new Error('source-unlisted');
    const result = await this.rpc('resources/read', { uri });
    if (!Array.isArray(result.contents)) throw new Error('source-invalid-response');
    const text = result.contents
      .filter((item) => typeof item?.text === 'string')
      .map((item) => item.text)
      .join('\n');
    if (!text || new TextEncoder().encode(text).length > MAX_REFERENCE_BYTES) throw new Error('source-too-large');
    return { id: crypto.randomUUID(), connector: 'mcp', title: resource.name, uri, text };
  }
}
