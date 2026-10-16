import { getLanguage, setLanguage, t, LanguageCode } from '@ranuts/shared/i18n';
import { afterEach, expect, it, vi } from 'vitest';
import { createPanelSettingsView } from '../../lib/agent-plugin/ui/settings-view';

function setup(selectedSource: string) {
  const control = () => document.createElement('div');
  const controls = {
    modelSelect: control(),
    modelMemory: control(),
    loadBtn: control(),
    modelRow: control(),
    ggufRow: control(),
    endpointRow: control(),
    endpointKind: control(),
    endpointBaseUrl: control(),
    endpointModel: control(),
    endpointKey: control(),
    endpointConnect: control(),
    endpointStatus: control(),
    providerSelect: control(),
    consentLabel: control(),
    writePreference: control(),
    reviewLabel: control(),
    localModelId: control(),
    localModelUrl: control(),
    localModelLib: control(),
    selectedSource,
  };
  const view = createPanelSettingsView(controls);
  document.body.append(view.sourcePicker, view.localCard, view.serviceCard, view.advanced);
  return { controls, view };
}

function expectScope(fixture: ReturnType<typeof setup>, local: boolean) {
  const { controls, view } = fixture;
  expect(view.localCard.hidden).toBe(!local);
  expect(view.serviceCard.hidden).toBe(local);
  expect(controls.providerSelect.parentElement!.hidden).toBe(!local);
  expect(controls.consentLabel.hidden).toBe(!local);
  expect(controls.writePreference.parentElement!.hidden).toBe(!local);
  expect(view.customSources.hidden).toBe(!local);
  expect(controls.reviewLabel.hidden).toBe(false);
}

afterEach(() => document.body.replaceChildren());

it.each(['local', 'service'])('initializes %s settings without unrelated local controls', (source) => {
  const fixture = setup(source);
  expectScope(fixture, source === 'local');
});

it('updates scope on source changes and retains populated labels and field values', () => {
  const fixture = setup('local');
  const { controls, view } = fixture;
  controls.localModelId.textContent = 'My local model';
  view.sourcePicker.value = 'service';
  view.sourcePicker.dispatchEvent(new Event('change'));
  expectScope(fixture, false);
  view.syncLabels();
  expect(controls.providerSelect.parentElement!.querySelector('span')!.textContent).not.toBe('');
  expectScope(fixture, false);
  view.sourcePicker.value = 'local';
  view.sourcePicker.dispatchEvent(new Event('change'));
  expectScope(fixture, true);
  expect(controls.localModelId.textContent).toBe('My local model');
});

it('supports programmatic source changes', () => {
  const fixture = setup('local');
  fixture.view.setSource('service');
  expectScope(fixture, false);
  expect(fixture.view.sourcePicker.getAttribute('value')).toBe('service');
});

it('assembles existing controls and preserves their listeners', () => {
  const { view, controls } = setup('local');
  expect(view.modelActions.contains(controls.loadBtn)).toBe(true);
  expect(view.serviceCard.contains(controls.endpointKey)).toBe(true);
  expect(view.customSources.contains(controls.localModelLib)).toBe(true);
  const onConnect = vi.fn();
  controls.endpointConnect.addEventListener('click', onConnect);
  controls.endpointConnect.click();
  expect(onConnect).toHaveBeenCalledOnce();
});

it('retains the selected source and disclosure as independently owned settings controls', () => {
  const { view } = setup('service');
  expect(view.sourcePicker.getAttribute('value')).toBe('service');
  expect(view.localCard.className).toContain('agent-device-section');
  expect(view.serviceCard.className).toContain('agent-service-section');
  expect(view.advanced.contains(view.customSources)).toBe(true);
  view.advanced.open = true;
  view.syncLabels();
  expect(view.advanced.open).toBe(true);
  expect(view.sourcePicker.getAttribute('value')).toBe('service');
});

it('refreshes labels without resetting the selected source or disclosure state', () => {
  const previous = getLanguage();
  try {
    const { view, controls } = setup('service');
    view.advanced.open = true;
    setLanguage(previous === LanguageCode.EN ? LanguageCode.ZH : LanguageCode.EN);
    view.syncLabels();
    expect(view.settingsHeading.textContent).toBe(t('agentSettings'));
    expect(view.sourcePicker.getAttribute('aria-label')).toBe(t('agentSourceLabel'));
    expect(view.sourcePicker.querySelector('[value="service"]')?.textContent).toBe(t('agentSourceService'));
    expect(controls.endpointKey.parentElement?.textContent).toContain(t('agentEndpointKey'));
    expect(view.sourcePicker.getAttribute('value')).toBe('service');
    expect(view.advanced.open).toBe(true);
  } finally {
    setLanguage(previous);
  }
});

it('hides download discovery offline while preserving existing local controls and values', () => {
  const { view, controls } = setup('local');
  controls.localModelId.textContent = 'Saved local model';
  controls.providerSelect.textContent = 'Existing CPU model';
  const onChange = vi.fn();
  controls.providerSelect.addEventListener('change', onChange);
  view.sourcePicker.addEventListener('change', onChange);
  view.advanced.open = true;
  view.setOnline(false);
  expect(controls.modelSelect.parentElement!.hidden).toBe(true);
  expect(view.customSources.hidden).toBe(true);
  expect(controls.providerSelect.parentElement!.hidden).toBe(false);
  expect(controls.ggufRow.hidden).toBe(false);
  expect(controls.reviewLabel.hidden).toBe(false);
  expect(view.offlineHint.hidden).toBe(false);
  expect(view.offlineHint.getAttribute('role')).toBe('status');
  expect(view.offlineHint.className).toBe('agent-offline-hint');
  expect(view.offlineHint.textContent).toBe(t('agentOfflineFeaturesHint'));
  view.setOnline(true);
  expect(controls.modelSelect.parentElement!.hidden).toBe(false);
  expect(view.customSources.hidden).toBe(false);
  expect(view.offlineHint.hidden).toBe(true);
  expect(controls.localModelId.textContent).toBe('Saved local model');
  expect(controls.providerSelect.textContent).toBe('Existing CPU model');
  expect(view.advanced.open).toBe(true);
  expect(view.sourcePicker.getAttribute('value')).toBe('local');
  expect(onChange).not.toHaveBeenCalled();
});

it('retains configured service settings offline and restores local discovery only when online', () => {
  const { view, controls } = setup('service');
  controls.endpointBaseUrl.textContent = 'https://example.com';
  controls.endpointKey.textContent = 'Existing credential';
  view.setOnline(false);
  expect(view.serviceCard.hidden).toBe(false);
  expect(controls.endpointBaseUrl.hidden).toBe(false);
  expect(controls.endpointKey.hidden).toBe(false);
  expect(controls.reviewLabel.hidden).toBe(false);
  view.setOnline(true);
  expectScope({ view, controls }, false);
  view.setOnline(false);
  view.setSource('local');
  expect(view.customSources.hidden).toBe(true);
  expect(controls.modelSelect.parentElement!.hidden).toBe(true);
  expect(controls.providerSelect.parentElement!.hidden).toBe(false);
  view.setSource('service');
  view.syncLabels();
  expect(view.offlineHint.textContent).toBe(t('agentOfflineFeaturesHint'));
  expect(view.offlineHint.hidden).toBe(false);
  expect(view.serviceCard.hidden).toBe(false);
  expect(controls.endpointBaseUrl.textContent).toBe('https://example.com');
  expect(controls.endpointKey.textContent).toBe('Existing credential');
});

it('initializes offline disclosure from navigator without changing the chosen source', () => {
  const descriptor = Object.getOwnPropertyDescriptor(navigator, 'onLine');
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
  try {
    const { view, controls } = setup('local');
    expect(view.offlineHint.hidden).toBe(false);
    expect(controls.modelSelect.parentElement!.hidden).toBe(true);
    expect(view.customSources.hidden).toBe(true);
    expect(view.sourcePicker.getAttribute('value')).toBe('local');
  } finally {
    if (descriptor) Object.defineProperty(navigator, 'onLine', descriptor);
    else delete (navigator as unknown as Record<string, unknown>).onLine;
  }
});
