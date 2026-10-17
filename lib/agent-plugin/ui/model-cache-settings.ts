import { Div, Span, View } from 'ranui/builder';
import { t } from '@ranuts/shared/i18n';
import { LocalInferenceProvider } from '@ranuts/agent-core/llm/local';
import type { LocalLLMProvider } from '@ranuts/agent-core/llm/types';
import { isModelCached, WEBLLM_MODELS, RETIRED_WEBLLM_MODELS } from '@ranuts/agent-core/llm/webllm';
import {
  deleteCachedModel,
  listCachedGGUF,
  deleteCachedGGUF,
  rememberedModelSources,
} from '@ranuts/agent-core/llm/model-cache';
import { displayError } from './presentation';

type ValueEl = HTMLElement & { value: string };
const ranButton = (text: string, className: string): HTMLElement =>
  View('r-button').class(className).text(text).build();

/** Model inventory, use/delete confirmation and memory release presentation. */
export function createModelCacheSettings(options: {
  providerSelect: ValueEl;
  modelSelect: ValueEl;
  localModelId: ValueEl;
  localModelUrl: ValueEl;
  localModelLib: ValueEl;
  ggufUrl: ValueEl;
  note: HTMLElement;
  selectedLocalModel: () => string;
  currentProvider: () => string;
  getProvider: () => LocalLLMProvider | null;
  isBusy: () => boolean;
  setBusy: (busy: boolean) => void;
  resetController: () => void;
  cleanup: () => Promise<void>;
  cleanupFailed: () => boolean;
  loadModel: () => Promise<void>;
  chat: { refreshSendAvailability: () => void };
}) {
  const {
    providerSelect,
    modelSelect,
    localModelId,
    localModelUrl,
    localModelLib,
    ggufUrl,
    note,
    selectedLocalModel,
    currentProvider,
    getProvider,
    isBusy,
    setBusy,
    resetController,
    cleanup,
    cleanupFailed,
    loadModel,
    chat,
  } = options;
  const cacheList = View<HTMLDetailsElement>('details').class('agent-model-cache agent-disclosure').build();
  const cacheSummary = View('summary')
    .attr('tabindex', '0')
    .text(t('agentDownloadedModels').replace('{count}', '…'))
    .build();
  const cacheRows = Div().class('agent-model-cache-rows').build();
  const cacheStatus = Span().attr('role', 'status').build();
  cacheList.append(cacheSummary, cacheRows, cacheStatus);
  let cacheRevision = 0;
  const refreshCache = async () => {
    const revision = ++cacheRevision;
    const sources = [...WEBLLM_MODELS, ...RETIRED_WEBLLM_MODELS, ...rememberedModelSources()];
    const unique = sources.filter(
      (model, index) =>
        sources.findIndex(
          (item) =>
            item.id === model.id &&
            ('modelUrl' in item ? item.modelUrl : undefined) === ('modelUrl' in model ? model.modelUrl : undefined),
        ) === index,
    );
    const cached = await Promise.all(
      unique.map(async (model) => ({ model, cached: await isModelCached(model.id, 'modelUrl' in model ? model : {}) })),
    );

    let ggufs: Awaited<ReturnType<typeof listCachedGGUF>> = [];
    try {
      ggufs = await listCachedGGUF();
    } catch {
      cacheStatus.textContent = t('agentCacheUnavailable');
    }
    if (revision !== cacheRevision) return;
    cacheSummary.textContent = t('agentDownloadedModels').replace(
      '{count}',
      String(cached.filter((item) => item.cached).length + ggufs.length),
    );
    cacheRows.replaceChildren();
    for (const { model, cached: exists } of cached) {
      if (!exists) continue;
      const row = Div().class('agent-model-cache-row').attr('role', 'group').build();
      const provider = getProvider();
      const active =
        !!provider?.isReady() &&
        selectedLocalModel() === model.id &&
        !(provider instanceof LocalInferenceProvider && provider.backend === 'wllama');
      const name = Span()
        .text(model.label + (active ? ' · ' + t('agentModelInUse') : ''))
        .build();
      const use = ranButton(t(active ? 'agentModelInUse' : 'agentUseModel'), 'agent-cache-use');
      use.toggleAttribute('disabled', active);
      use.addEventListener('click', () => {
        if (isBusy() || active) return;
        providerSelect.value = 'webllm';
        providerSelect.dispatchEvent(new Event('change'));
        if (WEBLLM_MODELS.some((item) => item.id === model.id)) {
          localModelId.value = '';
          localModelUrl.value = '';
          localModelLib.value = '';
          localModelId.dispatchEvent(new Event('change'));
          modelSelect.value = model.id;
          modelSelect.dispatchEvent(new Event('change'));
        } else {
          localModelId.value = model.id;
          localModelUrl.value = 'modelUrl' in model ? String(model.modelUrl ?? '') : '';
          localModelLib.value = 'modelLibUrl' in model ? String(model.modelLibUrl ?? '') : '';
          localModelId.dispatchEvent(new Event('change'));
        }
        void loadModel();
      });
      const remove = ranButton(t('agentDeleteDownload'), 'agent-cache-delete');
      let confirming = false;
      const cancel = ranButton(t('agentPlanCancel'), 'agent-cache-cancel');
      cancel.hidden = true;
      cancel.addEventListener('click', () => {
        confirming = false;
        cancel.hidden = true;
        remove.textContent = t('agentDeleteDownload');
        remove.focus();
      });
      remove.addEventListener('click', () => {
        if (isBusy()) return;
        if (!confirming) {
          confirming = true;
          remove.textContent = t('agentConfirmDeleteDownload');
          cancel.hidden = false;
          cacheStatus.textContent = t('agentDeleteDownloadHint');
          return;
        }
        void (async () => {
          remove.setAttribute('disabled', '');
          setBusy(true);
          chat.refreshSendAvailability();
          try {
            if (selectedLocalModel() === model.id) {
              resetController();
              await cleanup();
              if (cleanupFailed()) throw new Error(t('agentModelCleanupFailed'));
            }
            await deleteCachedModel(model.id, 'modelUrl' in model ? model : {});
            cacheStatus.textContent = t('agentDownloadDeleted');
            await refreshCache();
            cacheSummary.focus();
          } catch {
            cacheStatus.textContent = t(cleanupFailed() ? 'agentModelCleanupFailed' : 'agentCacheDeleteFailed');
            remove.removeAttribute('disabled');
          } finally {
            setBusy(false);
            chat.refreshSendAvailability();
          }
        })();
      });
      row.setAttribute('aria-label', name.textContent ?? '');
      row.append(name);
      if (!RETIRED_WEBLLM_MODELS.some((item) => item.id === model.id)) row.append(use);
      row.append(remove, cancel);
      cacheRows.append(row);
    }
    for (const item of ggufs) {
      const active = currentProvider() === 'wllama' && !!getProvider()?.isReady() && ggufUrl.value.trim() === item.url;
      const row = Div().class('agent-model-cache-row').attr('role', 'group').build();
      const name = Span()
        .text(
          `${new URL(item.url).pathname.split('/').pop() ?? item.name} · ${(item.size / 1e9).toFixed(2)} GB${item.complete ? '' : ' · ' + t('agentDownloadIncomplete')}`,
        )
        .build();
      const use = ranButton(t(active ? 'agentModelInUse' : 'agentUseModel'), 'agent-cache-use');
      use.toggleAttribute('disabled', active);
      use.addEventListener('click', () => {
        if (isBusy() || active) return;
        providerSelect.value = 'wllama';
        providerSelect.dispatchEvent(new Event('change'));
        ggufUrl.value = item.url;
        ggufUrl.dispatchEvent(new Event('change'));
        void loadModel();
      });
      const remove = ranButton(t('agentDeleteDownload'), 'agent-cache-delete');
      const cancel = ranButton(t('agentPlanCancel'), 'agent-cache-cancel');
      cancel.hidden = true;
      let confirming = false;
      cancel.addEventListener('click', () => {
        confirming = false;
        cancel.hidden = true;
        remove.textContent = t('agentDeleteDownload');
        remove.focus();
      });
      remove.addEventListener('click', () => {
        if (isBusy()) return;
        if (!confirming) {
          confirming = true;
          remove.textContent = t('agentConfirmDeleteDownload');
          cacheStatus.textContent = t('agentDeleteDownloadHint');
          cancel.hidden = false;
          return;
        }
        remove.setAttribute('disabled', '');
        setBusy(true);
        chat.refreshSendAvailability();
        void (async () => {
          try {
            // Automatic CPU fallback may own this GGUF even when the GPU picker is selected.
            resetController();
            await cleanup();
            if (cleanupFailed()) throw new Error(t('agentModelCleanupFailed'));
            await deleteCachedGGUF(item.name);
            await refreshCache();
            cacheStatus.textContent = t('agentDownloadDeleted');
            cacheSummary.focus();
          } catch {
            cacheStatus.textContent = t(cleanupFailed() ? 'agentModelCleanupFailed' : 'agentCacheDeleteFailed');
            remove.removeAttribute('disabled');
          } finally {
            setBusy(false);
            chat.refreshSendAvailability();
          }
        })();
      });
      row.setAttribute('aria-label', name.textContent ?? '');
      row.append(name, use, remove, cancel);
      cacheRows.append(row);
    }
  };
  cacheList.addEventListener('toggle', () => {
    // Native toggle events are queued and may settle after this panel is removed.
    if (cacheList.isConnected && cacheList.open) void refreshCache();
  });
  const release = ranButton(t('agentReleaseMemory'), 'agent-release-memory');
  release.hidden = true;
  release.addEventListener('click', () => {
    if (isBusy()) return;
    resetController();
    void (async () => {
      try {
        await cleanup();
        note.textContent = t('agentMemoryReleased');
      } catch (error) {
        note.textContent = displayError(error);
      }
    })();
  });
  return { el: cacheList, release, refresh: refreshCache };
}
