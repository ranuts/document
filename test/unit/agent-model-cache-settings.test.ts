import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createModelCacheSettings } from '../../lib/agent-plugin/ui/model-cache-settings';
import { rememberModelSource, type CachedModelSource } from '@ranuts/agent-core/llm/model-cache';
import { WEBLLM_MODELS, RETIRED_WEBLLM_MODELS } from '@ranuts/agent-core/llm/webllm';
import { t } from '@ranuts/shared/i18n';

const storage = vi.hoisted(() => ({ deleted: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@ranuts/agent-core/llm/webllm', async (original) => ({
  ...(await original<typeof import('@ranuts/agent-core/llm/webllm')>()),
  isModelCached: async () => true,
}));
vi.mock('@ranuts/agent-core/llm/model-cache', async (original) => ({
  ...(await original<typeof import('@ranuts/agent-core/llm/model-cache')>()),
  deleteCachedModel: storage.deleted,
  listCachedGGUF: async () => [],
}));
const official = WEBLLM_MODELS[0];
const mirror = {
  id: official.id,
  label: 'Remembered mirror',
  modelUrl: '/models/mirror/',
  modelLibUrl: '/models/mirror.wasm',
};
const control = (value = '') => Object.assign(document.createElement('input'), { value });
function settings(loaded?: CachedModelSource) {
  let active = loaded;
  let busy = false;
  const provider = { isReady: () => !!active };
  const options = {
    providerSelect: control('webllm'),
    modelSelect: control(official.id),
    localModelId: control(),
    localModelUrl: control(),
    localModelLib: control(),
    ggufUrl: control(),
    note: document.createElement('p'),
    getLoadedModel: () => active,
    currentProvider: () => options.providerSelect.value,
    getProvider: () => provider as any,
    isBusy: () => busy,
    setBusy: (value: boolean) => {
      busy = value;
    },
    resetController: vi.fn(() => {
      active = undefined;
    }),
    cleanup: vi.fn(async () => {}),
    cleanupFailed: () => false,
    loadModel: vi.fn(async () => {
      active = {
        id: options.localModelId.value || options.modelSelect.value,
        label: 'Loaded',
        modelUrl: options.localModelUrl.value || undefined,
        modelLibUrl: options.localModelLib.value || undefined,
      };
    }),
    chat: { refreshSendAvailability: vi.fn() },
  };
  const view = createModelCacheSettings(options);
  document.body.append(view.el);
  const row = (label: string) =>
    [...view.el.querySelectorAll<HTMLElement>('.agent-model-cache-row')].find((item) =>
      item.textContent?.includes(label),
    )!;
  const click = (item: HTMLElement, selector: string) => item.querySelector<HTMLElement>(selector)!.click();
  return { view, options, row, click, loaded: () => active };
}
beforeEach(() => {
  localStorage.clear();
  storage.deleted.mockClear();
  rememberModelSource(mirror);
});
afterEach(() => {
  document.body.replaceChildren();
});

it('uses a remembered mirror with a preset id and preserves both download URLs through loading', async () => {
  const ui = settings();
  await ui.view.refresh();
  ui.click(ui.row(mirror.label), '.agent-cache-use');
  expect(ui.loaded()).toEqual(
    expect.objectContaining({ id: mirror.id, modelUrl: mirror.modelUrl, modelLibUrl: mirror.modelLibUrl }),
  );
  expect(ui.options.loadModel).toHaveBeenCalledOnce();
  await ui.view.refresh();
  expect(ui.row(mirror.label).querySelector('.agent-cache-use')?.hasAttribute('disabled')).toBe(true);
  expect(ui.row(official.label).querySelector('.agent-cache-use')?.hasAttribute('disabled')).toBe(false);
});
it('marks only the loaded source in use and deletes an idle same-id source without releasing the active engine', async () => {
  const ui = settings({ ...official });
  await ui.view.refresh();
  expect(ui.row(official.label).textContent).toContain(t('agentModelInUse'));
  expect(ui.row(mirror.label).textContent).not.toContain(t('agentModelInUse'));
  ui.click(ui.row(mirror.label), '.agent-cache-delete');
  ui.click(ui.row(mirror.label), '.agent-cache-delete');
  await vi.waitFor(() => expect(storage.deleted).toHaveBeenCalledWith(mirror.id, expect.objectContaining(mirror)));
  expect(ui.options.resetController).not.toHaveBeenCalled();
  expect(ui.options.cleanup).not.toHaveBeenCalled();
  expect(ui.loaded()?.id).toBe(official.id);
});
it('releases the loaded source before deleting it even if the form currently names another source', async () => {
  const ui = settings(mirror);
  ui.options.localModelId.value = 'different-form-selection';
  await ui.view.refresh();
  ui.click(ui.row(mirror.label), '.agent-cache-delete');
  ui.click(ui.row(mirror.label), '.agent-cache-delete');
  await vi.waitFor(() => expect(storage.deleted).toHaveBeenCalled());
  expect(ui.options.resetController).toHaveBeenCalledOnce();
  expect(ui.options.cleanup).toHaveBeenCalledOnce();
  expect(ui.loaded()).toBeUndefined();
});
it('keeps library variants distinct in remembered rows, active guards and deletion', async () => {
  const alternate = { ...mirror, label: 'Other runtime', modelLibUrl: '/models/other.wasm' };
  rememberModelSource(alternate);
  const ui = settings(mirror);
  await ui.view.refresh();
  expect(ui.row(mirror.label)).toBeDefined();
  expect(ui.row(alternate.label)).toBeDefined();
  expect(ui.row(alternate.label).querySelector('.agent-cache-use')?.hasAttribute('disabled')).toBe(false);
  ui.click(ui.row(alternate.label), '.agent-cache-delete');
  ui.click(ui.row(alternate.label), '.agent-cache-delete');
  await vi.waitFor(() => expect(storage.deleted).toHaveBeenCalled());
  expect(ui.options.cleanup).not.toHaveBeenCalled();
});
it('deduplicates canonical relative and absolute sources while keeping official presets selectable', async () => {
  rememberModelSource({
    ...mirror,
    label: 'Canonical mirror',
    modelUrl: new URL(mirror.modelUrl, location.href).href,
    modelLibUrl: new URL(mirror.modelLibUrl, location.href).href,
  });
  const ui = settings(mirror);
  await ui.view.refresh();
  expect(
    [...ui.view.el.querySelectorAll('.agent-model-cache-row')].filter((row) => row.textContent?.includes('mirror')),
  ).toHaveLength(1);
  ui.click(ui.row(official.label), '.agent-cache-use');
  expect(ui.options.localModelId.value).toBe('');
  expect(ui.options.localModelUrl.value).toBe('');
  expect(ui.options.localModelLib.value).toBe('');
  expect(ui.loaded()?.id).toBe(official.id);
});
it('keeps retired preset downloads removal-only while allowing a distinct remembered mirror', async () => {
  const retired = RETIRED_WEBLLM_MODELS[0];
  rememberModelSource({ ...mirror, id: retired.id, label: 'Retired id mirror' });
  const ui = settings();
  await ui.view.refresh();
  expect(ui.row(retired.label).querySelector('.agent-cache-use')).toBeNull();
  expect(ui.row('Retired id mirror').querySelector('.agent-cache-use')).not.toBeNull();
});
it('honors busy state and cancel on remembered source actions', async () => {
  const ui = settings();
  await ui.view.refresh();
  ui.options.setBusy(true);
  ui.click(ui.row(mirror.label), '.agent-cache-use');
  ui.click(ui.row(mirror.label), '.agent-cache-delete');
  expect(ui.options.loadModel).not.toHaveBeenCalled();
  expect(storage.deleted).not.toHaveBeenCalled();
  ui.options.setBusy(false);
  ui.click(ui.row(mirror.label), '.agent-cache-delete');
  ui.click(ui.row(mirror.label), '.agent-cache-cancel');
  ui.click(ui.row(mirror.label), '.agent-cache-delete');
  expect(storage.deleted).not.toHaveBeenCalled();
});
