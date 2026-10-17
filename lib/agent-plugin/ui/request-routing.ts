import { resolveWritingRoute, type BrowserLocalBinding, type WritingRoute } from '@ranuts/agent-core/llm/writing-route';
import type { ModelTask } from '@ranuts/agent-core/llm/task-model';
import { configuredEndpoint, type EndpointSettings } from './endpoint-settings';

export interface RequestRoutingState {
  settings: EndpointSettings;
  endpointReady: boolean;
  localReady: boolean;
  offline: boolean;
  localWritingConsent: boolean;
  local: BrowserLocalBinding;
}

/** Destination policy reads live state; it neither connects providers nor warms a local model. */
export function createRequestRouting(state: () => RequestRoutingState) {
  const useEndpointForChat = (): boolean => {
    const { settings, endpointReady, localReady, offline } = state();
    if (!endpointReady || (settings.kind !== 'loopback' && offline)) return false;
    return settings.kind === 'loopback' || settings.preference === 'remote-first' || !localReady;
  };
  const writingRoute = (): WritingRoute => {
    const current = state();
    const endpoint = current.endpointReady ? configuredEndpoint(current.settings) : null;
    return resolveWritingRoute({
      loopback: endpoint?.kind === 'loopback' ? endpoint : null,
      remote: endpoint && endpoint.kind !== 'loopback' ? endpoint : null,
      preference: current.settings.preference,
      offline: current.offline,
      localWritingConsent: current.localWritingConsent,
      local: current.local,
    });
  };
  return {
    useEndpointForChat,
    writingRoute,
    needsLocalModel(task: ModelTask, modelFreeTools: boolean): boolean {
      if (task === 'tools') return !useEndpointForChat() && !modelFreeTools;
      if (task === 'chat') {
        const { endpointReady, settings, offline } = state();
        return !endpointReady || (settings.kind !== 'loopback' && offline);
      }
      try {
        return writingRoute().kind === 'local';
      } catch {
        return false;
      }
    },
  };
}
