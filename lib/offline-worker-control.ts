/** The page chooses the response policy; a Service Worker itself is not isolated. */
export function appWorkerScriptURL(href = location.href, isolated = globalThis.crossOriginIsolated === true): string {
  const url = new URL('/sw.js', href);
  if (isolated) url.searchParams.set('isolation', '1');
  return url.href;
}

interface WorkerControl {
  controller: { scriptURL: string } | null;
  addEventListener(type: 'controllerchange', listener: () => void): void;
  removeEventListener(type: 'controllerchange', listener: () => void): void;
}

/** An embedded page can require COEP while its ancestor prevents isolation. */
export async function resolveAppWorkerScriptURL(
  href = location.href,
  isolated = globalThis.crossOriginIsolated === true,
  embedded = window.parent !== window,
  request: typeof fetch = fetch,
  controllerURL = navigator.serviceWorker?.controller?.scriptURL,
): Promise<string> {
  if (isolated || !embedded) return appWorkerScriptURL(href, isolated);
  const plainURL = appWorkerScriptURL(href, false);
  const isolatedURL = appWorkerScriptURL(href, true);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1500);
  try {
    const target = new URL('/editor', href);
    const response = await request(target.href, { method: 'HEAD', cache: 'no-store', signal: controller.signal });
    const sameOrigin = !response.url || new URL(response.url).origin === target.origin;
    return response.ok &&
      sameOrigin &&
      response.headers.get('cross-origin-opener-policy') === 'same-origin' &&
      response.headers.get('cross-origin-embedder-policy') === 'require-corp'
      ? isolatedURL
      : plainURL;
  } catch {
    return controllerURL === isolatedURL ? isolatedURL : plainURL;
  } finally {
    clearTimeout(timer);
  }
}

let workerScriptURL: Promise<string> | undefined;
export function getAppWorkerScriptURL(): Promise<string> {
  return (workerScriptURL ??= resolveAppWorkerScriptURL());
}

/** Let the first editor load be observed by our cache worker; unavailable storage stays usable. */
export async function waitForAppWorkerControl(
  worker: WorkerControl | undefined = navigator.serviceWorker,
  scriptURL?: string,
  timeoutMs = 15000,
): Promise<boolean> {
  if (!worker) return false;
  const wantedURL = scriptURL ?? (await getAppWorkerScriptURL());
  if (worker.controller?.scriptURL === wantedURL) return true;
  return new Promise((resolve) => {
    let timer: ReturnType<typeof setTimeout>;
    const finish = (controlled: boolean): void => {
      clearTimeout(timer);
      worker.removeEventListener('controllerchange', changed);
      resolve(controlled);
    };
    const changed = (): void => {
      if (worker.controller?.scriptURL === wantedURL) finish(true);
    };
    worker.addEventListener('controllerchange', changed);
    timer = setTimeout(() => finish(false), timeoutMs);
    changed();
  });
}
