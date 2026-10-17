export type AssistantOfflineCapability = 'webgpu' | 'wllama' | 'wllama-compat' | 'cpu' | 'cpu-compat' | 'pdf';

interface OfflineWorker {
  postMessage(message: unknown, transfer: Transferable[]): void;
}
interface OfflineWorkerContainer {
  controller: OfflineWorker | null;
  ready: PromiseLike<{ active: OfflineWorker | null }>;
}

/** Prepare only the activated build-owned capability; never download model weights. */
export function prepareAssistantOffline(
  capability: AssistantOfflineCapability,
  container: OfflineWorkerContainer | undefined = typeof navigator === 'undefined'
    ? undefined
    : navigator.serviceWorker,
  timeoutMs = 60000,
): Promise<boolean> {
  if (!container || typeof MessageChannel === 'undefined') return Promise.resolve(false);
  return new Promise((resolve) => {
    let channel: MessageChannel | undefined;
    let finished = false;
    const done = (ready: boolean): void => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      channel?.port1.close();
      channel?.port2.close();
      resolve(ready);
    };
    const timer = setTimeout(() => done(false), timeoutMs);
    const send = (worker: OfflineWorker | null): void => {
      if (finished) return;
      if (!worker) return done(false);
      try {
        channel = new MessageChannel();
        channel.port1.onmessage = (event) => {
          if (event.data?.type === 'ASSISTANT_PREPARED') done(event.data.ok === true);
        };
        worker.postMessage({ type: 'PREPARE_ASSISTANT', capability }, [channel.port2]);
      } catch {
        done(false);
      }
    };
    if (container.controller) send(container.controller);
    else
      Promise.resolve(container.ready).then(
        (registration) => send(registration.active),
        () => done(false),
      );
  });
}
