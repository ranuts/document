/** Optional idle preparation with a timer guarantee; explicit work never waits for idle. */
export function scheduleHistoryTask(callback: () => void, idle: boolean): () => void {
  let done = false;
  let idleHandle: number | undefined;
  const run = () => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    if (idleHandle !== undefined) globalThis.cancelIdleCallback?.(idleHandle);
    callback();
  };
  const timer = setTimeout(run, idle && typeof globalThis.requestIdleCallback === 'function' ? 120 : 0);
  if (idle && typeof globalThis.requestIdleCallback === 'function')
    idleHandle = globalThis.requestIdleCallback(run, { timeout: 100 });
  return () => {
    done = true;
    clearTimeout(timer);
    if (idleHandle !== undefined) globalThis.cancelIdleCallback?.(idleHandle);
  };
}
