import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchRemoteDocument, MAX_REMOTE_DOCUMENT_BYTES, REMOTE_DOCUMENT_TIMEOUT_MS } from '../../lib/remote-document';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('bounded remote document transfer', () => {
  it('preserves fetch options and returns bytes and metadata', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), {
        headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename=test.pdf' },
      }),
    );
    vi.stubGlobal('fetch', fetcher);
    const result = await fetchRemoteDocument('/download', {
      credentials: 'include',
      headers: { Authorization: 'test-token' },
    });
    expect(fetcher).toHaveBeenCalledWith(
      '/download',
      expect.objectContaining({
        credentials: 'include',
        headers: { Authorization: 'test-token' },
        signal: expect.any(AbortSignal),
      }),
    );
    expect(Array.from(new Uint8Array(await result.blob.arrayBuffer()))).toEqual([1, 2, 3]);
    expect(result.blob.type).toBe('application/pdf');
    expect(result.headers.get('Content-Disposition')).toContain('test.pdf');
  });

  it('cancels a streamed response that exceeds the budget without trusting its header', async () => {
    const cancel = vi.fn();
    const chunk = new Uint8Array(MAX_REMOTE_DOCUMENT_BYTES / 2 + 1);
    let count = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (count++ < 2) controller.enqueue(chunk);
      },
      cancel,
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(stream, { headers: { 'Content-Length': '1' } })));
    await expect(fetchRemoteDocument('/large')).rejects.toThrow('100');
    expect(cancel).toHaveBeenCalledOnce();
  });

  it('cancels the body before reading a declared oversized file', async () => {
    const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>({ cancel });
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(stream, { headers: { 'Content-Length': String(MAX_REMOTE_DOCUMENT_BYTES + 1) } }),
        ),
    );
    await expect(fetchRemoteDocument('/large')).rejects.toThrow('100');
    expect(cancel).toHaveBeenCalledOnce();
  });

  it('times out while the response body is stalled and releases the stream', async () => {
    vi.useFakeTimers();
    const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>({ cancel });
    const fetcher = vi.fn().mockResolvedValue(new Response(stream));
    vi.stubGlobal('fetch', fetcher);
    const pending = fetchRemoteDocument('/stalled');
    const failed = expect(pending).rejects.toMatchObject({ name: 'TimeoutError' });
    await vi.advanceTimersByTimeAsync(REMOTE_DOCUMENT_TIMEOUT_MS);
    await failed;
    expect(cancel).toHaveBeenCalledOnce();
    expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('honors an external abort while reading the body', async () => {
    const cancel = vi.fn();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new ReadableStream({ cancel }))));
    const controller = new AbortController();
    const pending = fetchRemoteDocument('/cancel', { signal: controller.signal });
    const failed = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    await Promise.resolve();
    controller.abort();
    await failed;
    expect(cancel).toHaveBeenCalledOnce();
  });

  it('does not start a fetch when the caller already cancelled', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    const controller = new AbortController();
    controller.abort();
    await expect(fetchRemoteDocument('/cancel', { signal: controller.signal })).rejects.toMatchObject({
      name: 'AbortError',
    });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
