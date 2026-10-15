/** Shared ownership for local, new and embedded document opens. */
let revision = 0;
let current: AbortController | undefined;

export function beginDocumentOpen() {
  current?.abort(new DOMException('Document open superseded', 'AbortError'));
  const controller = new AbortController();
  current = controller;
  const id = ++revision;
  return {
    id,
    signal: controller.signal,
    isCurrent: () => current === controller && !controller.signal.aborted,
    assertCurrent: () => controller.signal.throwIfAborted(),
  };
}

let mountedRevision = 0;

/** Mounted ownership is shared by host and standalone entry points. */
export function commitDocumentOpen(id: number): boolean {
  if (id < mountedRevision) return false;
  mountedRevision = id;
  return true;
}

export function isMountedDocumentOpen(id: number): boolean {
  return mountedRevision === id;
}

export function cancelDocumentOpen(): void {
  current?.abort(new DOMException('Document closed', 'AbortError'));
  current = undefined;
  mountedRevision = ++revision;
}
