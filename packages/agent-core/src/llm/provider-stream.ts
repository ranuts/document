import { fetchProviderResponse, readProviderJson, type ProviderHttpOptions } from './provider-http';

/** Parse native SSE/NDJSON incrementally within the shared bounded lifetime. */
export function fetchProviderStream(
  provider: string,
  url: string,
  init: RequestInit,
  options: ProviderHttpOptions,
  protocol: 'sse' | 'ndjson',
  onRecord: (value: unknown) => boolean | void,
  onJson: (value: unknown) => void,
): Promise<void> {
  return fetchProviderResponse(provider, url, init, options, async (response, chunks, signal) => {
    if (!response.body || (protocol === 'sse' && response.headers?.get('Content-Type')?.includes('application/json'))) {
      const value = await readProviderJson(chunks);
      signal.throwIfAborted();
      onJson(value);
      return;
    }
    let buffer = '';
    let data: string[] = [];
    const parse = (text: string): boolean | void => {
      signal.throwIfAborted();
      if (text === '[DONE]' && protocol === 'sse') return onRecord('[DONE]');
      let value: unknown;
      try {
        value = JSON.parse(text);
      } catch {
        throw new Error(`Invalid ${provider} stream`);
      }
      return onRecord(value);
    };
    const line = (value: string): boolean | void => {
      if (protocol === 'ndjson') return value.trim() ? parse(value) : undefined;
      if (!value) {
        const text = data.join('\n');
        data = [];
        return text ? parse(text) : undefined;
      }
      if (value.startsWith('data:')) data.push(value.slice(5).replace(/^ /, ''));
    };
    for await (const chunk of chunks) {
      buffer += chunk;
      while (true) {
        const index = buffer.search(/[\r\n]/);
        if (index < 0 || (buffer[index] === '\r' && index === buffer.length - 1)) break;
        const value = buffer.slice(0, index);
        const width = buffer[index] === '\r' && buffer[index + 1] === '\n' ? 2 : 1;
        buffer = buffer.slice(index + width);
        if (line(value) === false) return;
      }
    }
    if (buffer.endsWith('\r')) {
      if (line(buffer.slice(0, -1)) === false) return;
      buffer = '';
    }
    // SSE requires a complete event delimiter; NDJSON permits the final line
    // without a newline. Adapters still require their native terminal marker.
    if (protocol === 'ndjson' && buffer.trim()) line(buffer);
  });
}

/** In-band service errors retain only their safe numeric status. */
export function assertStreamRecord(provider: string, value: unknown): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Invalid ${provider} stream`);
  if ('error' in value) {
    const raw = (value as { error?: { code?: unknown } }).error?.code;
    const status = typeof raw === 'number' && Number.isInteger(raw) && raw >= 400 && raw < 600 ? raw : undefined;
    throw Object.assign(
      new Error(status ? `${provider} request failed: ${status}` : `${provider} stream failed`),
      status ? { status } : {},
    );
  }
}
