import { afterEach, expect, it, vi } from 'vitest';
import { runSpreadsheetWorker } from '../../packages/converter/src/spreadsheet-worker';
class FakeWorker {
  static current: FakeWorker;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  onmessageerror: (() => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();
  constructor(public url: string) {
    FakeWorker.current = this;
  }
}
function setup() {
  vi.stubGlobal('Worker', FakeWorker);
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
it('transfers an exact copied view and terminates after a valid result', async () => {
  setup();
  const source = new Uint8Array([9, 1, 2, 9]);
  const result = runSpreadsheetWorker('xlsx-to-csv', source.subarray(1, 3));
  const worker = FakeWorker.current;
  const [message, transfer] = worker.postMessage.mock.calls[0];
  expect([...new Uint8Array(message.data)]).toEqual([1, 2]);
  expect(transfer).toEqual([message.data]);
  expect(source.byteLength).toBe(4);
  worker.onmessage?.({ data: { ok: true, data: new Uint8Array([3]).buffer } } as MessageEvent);
  expect([...new Uint8Array(await result)]).toEqual([3]);
  expect(worker.terminate).toHaveBeenCalledOnce();
});
it.each(['abort', 'timeout', 'error', 'messageerror', 'invalid'] as const)(
  'settles and releases a worker on %s',
  async (reason) => {
    setup();
    vi.useFakeTimers();
    const controller = new AbortController();
    const result = runSpreadsheetWorker('csv-to-xlsx', 'a,b', controller.signal);
    const rejected = expect(result).rejects.toBeInstanceOf(Error);
    const worker = FakeWorker.current;
    if (reason === 'abort') controller.abort();
    if (reason === 'timeout') vi.advanceTimersByTime(120000);
    if (reason === 'error') worker.onerror?.({ message: 'failed', preventDefault() {} } as ErrorEvent);
    if (reason === 'messageerror') worker.onmessageerror?.();
    if (reason === 'invalid') worker.onmessage?.({ data: { ok: true, data: 'bad' } } as MessageEvent);
    await rejected;
    expect(worker.terminate).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  },
);
it('rejects an already canceled request without constructing a worker', async () => {
  const worker = vi.fn();
  vi.stubGlobal('Worker', worker);
  const controller = new AbortController();
  controller.abort();
  await expect(runSpreadsheetWorker('csv-to-xlsx', 'a', controller.signal)).rejects.toMatchObject({
    name: 'AbortError',
  });
  expect(worker).not.toHaveBeenCalled();
});
