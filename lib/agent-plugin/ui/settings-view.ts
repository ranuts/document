import { Div, Label, Span, View } from 'ranui/builder';
import { t, type I18nMessages } from '@ranuts/shared/i18n';

interface SettingsControls {
  modelSelect: HTMLElement;
  modelMemory: HTMLElement;
  loadBtn: HTMLElement;
  modelRow: HTMLElement;
  ggufRow: HTMLElement;
  endpointRow: HTMLElement;
  endpointKind: HTMLElement;
  endpointBaseUrl: HTMLElement;
  endpointModel: HTMLElement;
  endpointKey: HTMLElement;
  endpointConnect: HTMLElement;
  endpointStatus: HTMLElement;
  providerSelect: HTMLElement;
  consentLabel: HTMLElement;
  writePreference: HTMLElement;
  reviewLabel: HTMLElement;
  localModelId: HTMLElement;
  localModelUrl: HTMLElement;
  localModelLib: HTMLElement;
  selectedSource: string;
}

/** Settings layout and labels; providers and task state remain outside the view. */
export function createPanelSettingsView(controls: SettingsControls) {
  const {
    modelSelect,
    modelMemory,
    loadBtn,
    modelRow,
    ggufRow,
    endpointRow,
    endpointKind,
    endpointBaseUrl,
    endpointModel,
    endpointKey,
    endpointConnect,
    endpointStatus,
    providerSelect,
    consentLabel,
    writePreference,
    reviewLabel,
    localModelId,
    localModelUrl,
    localModelLib,
    selectedSource,
  } = controls;
  const settingsHeading = View('h2').build();
  settingsHeading.tabIndex = -1;
  const localCard = View('section').build();
  localCard.className = 'agent-use-card agent-device-section';
  const modelChoice = Div().build();
  modelChoice.className = 'agent-model-choice';
  modelChoice.append(modelSelect, modelMemory);
  const modelActions = Div().class('agent-model-actions').children(loadBtn).build();
  modelRow.replaceChildren(modelChoice, modelActions);
  localCard.append(modelRow, ggufRow);
  const serviceCard = View('section').build();
  serviceCard.className = 'agent-use-card agent-service-section';
  const serviceHint = View('p').build();
  const fieldLabels: Array<{ title: HTMLElement; key: keyof I18nMessages }> = [];
  const field = (control: HTMLElement, key: keyof I18nMessages) => {
    const wrapper = Label().build();
    wrapper.className = 'agent-settings-field';
    const title = Span().build();
    fieldLabels.push({ title, key });
    wrapper.append(title, control);
    return wrapper;
  };
  endpointRow.replaceChildren(
    field(endpointKind, 'agentEndpointKind'),
    field(endpointBaseUrl, 'agentEndpointUrl'),
    field(endpointModel, 'agentEndpointModel'),
    field(endpointKey, 'agentEndpointKey'),
    endpointConnect,
    endpointStatus,
  );
  serviceCard.append(endpointRow, serviceHint);
  const advanced = View<HTMLDetailsElement>('details').build();
  advanced.className = 'agent-preferences agent-disclosure';
  const advancedSummary = View('summary').build();
  const advancedTitle = Span().build();
  advancedSummary.append(advancedTitle);
  advanced.append(
    advancedSummary,
    field(providerSelect, 'agentProviderLabel'),
    consentLabel,
    field(writePreference, 'agentWritePreference'),
    reviewLabel,
  );
  const customSources = View('section')
    .class('agent-custom-sources')
    .children(
      View('h3').text(t('agentCustomModel')).build(),
      field(localModelId, 'agentModelId'),
      field(localModelUrl, 'agentModelUrl'),
      field(localModelLib, 'agentModelRuntimeUrl'),
    )
    .build();
  advanced.append(customSources);
  const settingsHero = Div().build();
  settingsHero.className = 'agent-settings-hero';
  settingsHero.append(settingsHeading);
  const sourcePicker = View('r-select')
    .class('agent-source-picker')
    .attr('value', selectedSource)
    .children(
      View('r-option').attr('value', 'local').text(t('agentSourceLocal')).build(),
      View('r-option').attr('value', 'service').text(t('agentSourceService')).build(),
    )
    .build() as HTMLElement & { value: string };
  sourcePicker.setAttribute('aria-label', t('agentSourceLabel'));
  const syncLabels = () => {
    fieldLabels.forEach(({ title, key }) => {
      title.textContent = t(key);
    });
    settingsHeading.textContent = t('agentSettings');
    serviceHint.textContent = t('agentUseServiceHint');
    advancedTitle.textContent = t('agentPreferences');
    customSources.querySelector('h3')!.textContent = t('agentCustomModel');
    sourcePicker.setAttribute('aria-label', t('agentSourceLabel'));
    const selected = sourcePicker.value ?? sourcePicker.getAttribute('value') ?? selectedSource;
    for (const option of sourcePicker.querySelectorAll('r-option')) {
      option.textContent = t(option.getAttribute('value') === 'local' ? 'agentSourceLocal' : 'agentSourceService');
    }
    sourcePicker.setAttribute('value', selected);
  };
  syncLabels();
  return {
    settingsHeading,
    modelActions,
    localCard,
    serviceCard,
    serviceHint,
    advanced,
    advancedTitle,
    customSources,
    settingsHero,
    sourcePicker,
    syncLabels,
  };
}
