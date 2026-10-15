import { expect, it, vi } from 'vitest';
import { getLanguage, setLanguage, t, LanguageCode } from '@ranuts/shared/i18n';
import { createPanelSettingsView } from '../../lib/agent-plugin/ui/settings-view';

function fixture(selectedSource = 'local') {
  const controls: Omit<Parameters<typeof createPanelSettingsView>[0], 'selectedSource'> = {
    modelSelect: document.createElement('div'),
    modelMemory: document.createElement('div'),
    loadBtn: document.createElement('div'),
    modelRow: document.createElement('div'),
    ggufRow: document.createElement('div'),
    endpointRow: document.createElement('div'),
    endpointKind: document.createElement('div'),
    endpointBaseUrl: document.createElement('div'),
    endpointModel: document.createElement('div'),
    endpointKey: document.createElement('div'),
    endpointConnect: document.createElement('div'),
    endpointStatus: document.createElement('div'),
    providerSelect: document.createElement('div'),
    consentLabel: document.createElement('div'),
    writePreference: document.createElement('div'),
    reviewLabel: document.createElement('div'),
    localModelId: document.createElement('div'),
    localModelUrl: document.createElement('div'),
    localModelLib: document.createElement('div'),
  };
  const view = createPanelSettingsView({ ...controls, selectedSource });
  return { view, controls };
}

it('assembles existing controls and preserves their listeners', () => {
  const { view, controls } = fixture();
  expect(view.modelActions.contains(controls.loadBtn)).toBe(true);
  expect(view.serviceCard.contains(controls.endpointKey)).toBe(true);
  expect(view.customSources.contains(controls.localModelLib)).toBe(true);
  const onConnect = vi.fn();
  controls.endpointConnect.addEventListener('click', onConnect);
  controls.endpointConnect.click();
  expect(onConnect).toHaveBeenCalledOnce();
});

it('retains the selected source and disclosure as independently owned settings controls', () => {
  const { view } = fixture('service');
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
    const { view, controls } = fixture('service');
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
